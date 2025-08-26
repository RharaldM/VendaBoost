/**
 * VendaBoost Extension - File System Bridge
 * Servidor Node.js para permitir que a extensão salve arquivos no sistema local
 */

import express from 'express';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import cors from 'cors';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Base path for data storage - Dynamic detection
function getDataBasePath() {
  // Priority order: ENV variable -> Current directory -> Fallback to __dirname
  const envDataDir = process.env.USER_DATA_DIR || process.env.VENDA_BOOST_DATA_DIR;
  
  if (envDataDir) {
    console.log(`📁 Using data directory from environment: ${envDataDir}`);
    return envDataDir;
  }
  
  // Check if we're in the project root (has extension/ folder)
  const projectRoot = process.cwd();
  const extensionPath = path.join(projectRoot, 'extension');
  
  if (fsSync.existsSync(extensionPath)) {
    const dataPath = path.join(projectRoot, 'data');
    console.log(`📁 Using project root data directory: ${dataPath}`);
    return dataPath;
  }
  
  // Fallback to __dirname/data
  const fallbackPath = path.join(__dirname, 'data');
  console.log(`📁 Using fallback data directory: ${fallbackPath}`);
  return fallbackPath;
}

const DATA_BASE_PATH = getDataBasePath();

// Migration system for existing data
async function migrateExistingData() {
  const legacyPath = 'C:\\Users\\Hardd\\Documents\\AUTOMACAO\\data';
  
  // Skip migration if legacy path doesn't exist or is the same as current
  if (!fsSync.existsSync(legacyPath) || legacyPath === DATA_BASE_PATH) {
    return;
  }
  
  try {
    console.log(`🔄 Migrating data from ${legacyPath} to ${DATA_BASE_PATH}...`);
    
    // Create target directories
    await fs.mkdir(DATA_BASE_PATH, { recursive: true });
    await fs.mkdir(path.join(DATA_BASE_PATH, 'sessions'), { recursive: true });
    await fs.mkdir(path.join(DATA_BASE_PATH, 'groups'), { recursive: true });
    await fs.mkdir(path.join(DATA_BASE_PATH, 'profiles'), { recursive: true });
    await fs.mkdir(path.join(DATA_BASE_PATH, 'logs'), { recursive: true });
    
    // Migration function for a directory
    async function migrateDirectory(subDir) {
      const sourcePath = path.join(legacyPath, subDir);
      const targetPath = path.join(DATA_BASE_PATH, subDir);
      
      if (fsSync.existsSync(sourcePath)) {
        const files = await fs.readdir(sourcePath);
        let migratedCount = 0;
        
        for (const file of files) {
          const sourceFile = path.join(sourcePath, file);
          const targetFile = path.join(targetPath, file);
          
          // Only migrate if target doesn't exist
          if (!fsSync.existsSync(targetFile)) {
            await fs.copyFile(sourceFile, targetFile);
            migratedCount++;
          }
        }
        
        if (migratedCount > 0) {
          console.log(`✅ Migrated ${migratedCount} files from ${subDir}/`);
        }
      }
    }
    
    // Migrate each directory
    await migrateDirectory('sessions');
    await migrateDirectory('groups');
    await migrateDirectory('current');
    await migrateDirectory('playwright-sessions');
    await migrateDirectory('user');
    
    console.log('🎉 Data migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during data migration:', error);
  }
}

// Initialize data migration on startup
migrateExistingData().catch(console.error);

// ==========================================
// SESSION DEDUPLICATION SYSTEM
// ==========================================

class SessionDeduplicator {
  constructor(basePath, config = {}) {
    this.basePath = basePath;
    this.config = {
      maxSessionsPerUser: 5,
      maxTotalSessions: 100,
      retentionDays: 7,
      cleanupIntervalMs: 60 * 60 * 1000, // 1 hora
      significantChangeThreshold: 0.1, // 10% de mudança
      ...config
    };
    
    this.sessionsIndex = new Map(); // userId -> sessions[]
    this.cleanupInterval = null;
    
    this.initializeIndex();
    this.startCleanupScheduler();
  }

  async initializeIndex() {
    try {
      // Ensure sessions directory exists first
      const sessionsDir = path.join(this.basePath, 'sessions');
      await fs.mkdir(sessionsDir, { recursive: true });
      
      const sessionFiles = await this.loadExistingSessions();
      
      for (const sessionFile of sessionFiles) {
        const userId = sessionFile.fingerprint.userId;
        if (!this.sessionsIndex.has(userId)) {
          this.sessionsIndex.set(userId, []);
        }
        this.sessionsIndex.get(userId).push(sessionFile);
      }

      // Ordenar por timestamp (mais recente primeiro)
      for (const [userId, sessions] of this.sessionsIndex) {
        sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }

      console.log(`📊 Session Deduplicator initialized: ${sessionFiles.length} sessions for ${this.sessionsIndex.size} users`);
    } catch (error) {
      console.error('❌ Error initializing session deduplicator:', error);
      // Continue anyway - system can still work
    }
  }

  async loadExistingSessions() {
    const sessionFiles = [];
    const sessionsDir = path.join(this.basePath, 'sessions');
    
    try {
      // Ensure directory exists
      await fs.mkdir(sessionsDir, { recursive: true });
      
      const files = await fs.readdir(sessionsDir);
      
      for (const file of files) {
        if (file.startsWith('session-') && file.endsWith('.json')) {
          try {
            const filePath = path.join(sessionsDir, file);
            const stats = await fs.stat(filePath);
            const content = await fs.readFile(filePath, 'utf-8');
            const sessionData = JSON.parse(content);
            
            const fingerprint = this.generateFingerprint(sessionData);
            const timestamp = sessionData.timestamp || this.extractTimestampFromFilename(file);
            
            sessionFiles.push({
              filename: file,
              path: filePath,
              timestamp,
              fingerprint,
              size: stats.size
            });
          } catch (error) {
            console.warn(`⚠️ Could not load session file ${file}:`, error.message);
          }
        }
      }
    } catch (error) {
      // Diretório não existe ainda
      await fs.mkdir(sessionsDir, { recursive: true });
    }
    
    return sessionFiles;
  }

  generateFingerprint(sessionData) {
    // Dados core que importam (sem cookies que mudam constantemente)
    const coreData = {
      userId: sessionData.userId,
      userInfo: sessionData.userInfo || {},
      localStorage: this.normalizeStorage(sessionData.localStorage),
      sessionStorage: this.normalizeStorage(sessionData.sessionStorage),
      metadata: this.normalizeMetadata(sessionData.metadata)
    };

    return {
      userId: sessionData.userId,
      userInfoHash: this.hashObject(sessionData.userInfo || {}),
      localStorageHash: this.hashObject(sessionData.localStorage || {}),
      sessionStorageHash: this.hashObject(sessionData.sessionStorage || {}),
      metadataHash: this.hashObject(this.normalizeMetadata(sessionData.metadata)),
      coreDataHash: this.hashObject(coreData)
    };
  }

  normalizeStorage(storage) {
    if (!storage) return {};
    
    const normalized = {};
    
    for (const [key, value] of Object.entries(storage)) {
      // Ignora chaves que contêm timestamps ou dados voláteis
      if (!key.includes('timestamp') && !key.includes('_ts') && !key.includes('expir')) {
        normalized[key] = value;
      }
    }
    
    return normalized;
  }

  normalizeMetadata(metadata) {
    if (!metadata) return {};
    
    const normalized = { ...metadata };
    
    // Remove campos voláteis
    delete normalized.timestamp;
    delete normalized.extractionTimestamp;
    delete normalized.sessionId;
    
    return normalized;
  }

  hashObject(obj) {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('md5').update(str).digest('hex');
  }

  extractTimestampFromFilename(filename) {
    const match = filename.match(/session-(.+)\.json$/);
    if (match) {
      return match[1].replace(/-/g, ':').replace(/(\d{4}):(\d{2}):(\d{2})T/, '$1-$2-$3T');
    }
    return new Date().toISOString();
  }

  async shouldSaveSession(sessionData) {
    const fingerprint = this.generateFingerprint(sessionData);
    const userId = sessionData.userId;
    const userSessions = this.sessionsIndex.get(userId) || [];

    // Se não há sessões para este usuário, sempre salva
    if (userSessions.length === 0) {
      return {
        shouldSave: true,
        reason: 'First session for this user',
        action: 'create'
      };
    }

    // Compara com a sessão mais recente
    const latestSession = userSessions[0];
    const similarity = this.calculateSimilarity(fingerprint, latestSession.fingerprint);

    // Se os dados core são idênticos, faz merge ao invés de criar novo arquivo
    if (fingerprint.coreDataHash === latestSession.fingerprint.coreDataHash) {
      return {
        shouldSave: true,
        reason: 'Core data identical, will merge cookies and update timestamp',
        action: 'merge',
        targetFile: latestSession.filename
      };
    }

    // Se a mudança é significativa, cria nova sessão
    if (similarity < (1 - this.config.significantChangeThreshold)) {
      return {
        shouldSave: true,
        reason: `Significant change detected (${((1-similarity)*100).toFixed(1)}% different)`,
        action: 'create'
      };
    }

    // Senão, pula (mudança não significativa)
    return {
      shouldSave: false,
      reason: `Insignificant change (${((1-similarity)*100).toFixed(1)}% different), skipping`,
      action: 'skip'
    };
  }

  calculateSimilarity(fp1, fp2) {
    if (fp1.userId !== fp2.userId) return 0;

    let matches = 0;
    let total = 0;

    const fields = ['userInfoHash', 'localStorageHash', 'sessionStorageHash', 'metadataHash'];
    
    for (const field of fields) {
      total++;
      if (fp1[field] === fp2[field]) {
        matches++;
      }
    }

    return matches / total;
  }

  async processSession(sessionData) {
    const decision = await this.shouldSaveSession(sessionData);
    
    if (!decision.shouldSave) {
      console.log(`⏭️ Skipping session for ${sessionData.userId}: ${decision.reason}`);
      return {
        saved: false,
        action: 'skipped',
        reason: decision.reason
      };
    }

    if (decision.action === 'merge' && decision.targetFile) {
      // Merge com sessão existente
      const result = await this.mergeSession(sessionData, decision.targetFile);
      console.log(`🔄 Merged session for ${sessionData.userId} into ${decision.targetFile}`);
      return {
        saved: true,
        filename: decision.targetFile,
        action: 'merged',
        reason: decision.reason,
        sizeSaved: result.sizeSaved
      };
    } else {
      // Cria nova sessão
      const filename = this.generateFilename(sessionData);
      const sessionsDir = path.join(this.basePath, 'sessions');
      const filepath = path.join(sessionsDir, filename);
      
      // Ensure sessions directory exists
      await fs.mkdir(sessionsDir, { recursive: true });
      
      await fs.writeFile(filepath, JSON.stringify(sessionData, null, 2), 'utf-8');
      
      // Atualiza índice
      const fingerprint = this.generateFingerprint(sessionData);
      const stats = await fs.stat(filepath);
      
      const sessionFile = {
        filename,
        path: filepath,
        timestamp: sessionData.timestamp,
        fingerprint,
        size: stats.size
      };
      
      if (!this.sessionsIndex.has(sessionData.userId)) {
        this.sessionsIndex.set(sessionData.userId, []);
      }
      
      this.sessionsIndex.get(sessionData.userId).unshift(sessionFile);
      
      // Cleanup automático se necessário
      await this.cleanupUserSessions(sessionData.userId);
      
      console.log(`✅ Created new session for ${sessionData.userId}: ${filename}`);
      return {
        saved: true,
        filename,
        action: 'created',
        reason: decision.reason
      };
    }
  }

  async mergeSession(newSessionData, targetFilename) {
    const targetPath = path.join(this.basePath, 'sessions', targetFilename);
    
    try {
      const existingContent = await fs.readFile(targetPath, 'utf-8');
      const existingSession = JSON.parse(existingContent);
      const originalSize = existingContent.length;
      
      // Merge inteligente: atualiza apenas dados dinâmicos
      const mergedSession = {
        ...existingSession,
        timestamp: newSessionData.timestamp, // Atualiza timestamp
        cookies: newSessionData.cookies || existingSession.cookies, // Atualiza cookies
        localStorage: { ...existingSession.localStorage, ...newSessionData.localStorage },
        sessionStorage: { ...existingSession.sessionStorage, ...newSessionData.sessionStorage },
        metadata: {
          ...existingSession.metadata,
          ...newSessionData.metadata,
          lastMerged: new Date().toISOString(),
          mergeCount: (existingSession.metadata?.mergeCount || 0) + 1
        }
      };
      
      const newContent = JSON.stringify(mergedSession, null, 2);
      await fs.writeFile(targetPath, newContent, 'utf-8');
      
      // Atualiza índice
      const userSessions = this.sessionsIndex.get(newSessionData.userId);
      if (userSessions) {
        const sessionFile = userSessions.find(s => s.filename === targetFilename);
        if (sessionFile) {
          sessionFile.timestamp = newSessionData.timestamp;
          sessionFile.fingerprint = this.generateFingerprint(mergedSession);
          sessionFile.size = newContent.length;
        }
      }
      
      const sizeSaved = Math.max(0, originalSize); // Economia por não criar arquivo novo
      
      return { sizeSaved };
      
    } catch (error) {
      console.error(`❌ Error merging session ${targetFilename}:`, error);
      throw error;
    }
  }

  generateFilename(sessionData) {
    const timestamp = sessionData.timestamp.replace(/[:.]/g, '-');
    return `session-${timestamp}.json`;
  }

  async cleanupUserSessions(userId) {
    const userSessions = this.sessionsIndex.get(userId);
    if (!userSessions) return;

    // Remove sessões em excesso (mantém apenas as mais recentes)
    if (userSessions.length > this.config.maxSessionsPerUser) {
      const sessionsToRemove = userSessions.splice(this.config.maxSessionsPerUser);
      
      for (const session of sessionsToRemove) {
        try {
          await fs.unlink(session.path);
          console.log(`🗑️ Removed old session: ${session.filename}`);
        } catch (error) {
          console.error(`❌ Error removing session ${session.filename}:`, error);
        }
      }
    }
  }

  async performGlobalCleanup() {
    const cutoffDate = new Date(Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000));
    let removedFiles = 0;
    let freedSpace = 0;

    for (const [userId, sessions] of this.sessionsIndex) {
      const validSessions = [];
      
      for (const session of sessions) {
        const sessionDate = new Date(session.timestamp);
        
        if (sessionDate < cutoffDate) {
          try {
            await fs.unlink(session.path);
            removedFiles++;
            freedSpace += session.size;
            console.log(`🗑️ Removed expired session: ${session.filename}`);
          } catch (error) {
            console.error(`❌ Error removing expired session ${session.filename}:`, error);
          }
        } else {
          validSessions.push(session);
        }
      }
      
      this.sessionsIndex.set(userId, validSessions);
    }

    if (removedFiles > 0) {
      console.log(`🧹 Global cleanup completed: ${removedFiles} files removed, ${(freedSpace/1024/1024).toFixed(2)}MB freed`);
    }
    
    return { removedFiles, freedSpace };
  }

  startCleanupScheduler() {
    this.cleanupInterval = setInterval(async () => {
      await this.performGlobalCleanup();
    }, this.config.cleanupIntervalMs);
    
    console.log(`🕒 Session cleanup scheduler started (every ${this.config.cleanupIntervalMs/1000/60} minutes)`);
  }

  stopCleanupScheduler() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  getStats() {
    let totalSessions = 0;
    let totalSize = 0;
    let oldestTimestamp = '';
    let newestTimestamp = '';

    for (const sessions of this.sessionsIndex.values()) {
      totalSessions += sessions.length;
      
      for (const session of sessions) {
        totalSize += session.size;
        
        if (!oldestTimestamp || session.timestamp < oldestTimestamp) {
          oldestTimestamp = session.timestamp;
        }
        
        if (!newestTimestamp || session.timestamp > newestTimestamp) {
          newestTimestamp = session.timestamp;
        }
      }
    }

    return {
      totalUsers: this.sessionsIndex.size,
      totalSessions,
      totalSize,
      avgSessionsPerUser: Math.round((totalSessions / (this.sessionsIndex.size || 1)) * 10) / 10,
      oldestSession: oldestTimestamp,
      newestSession: newestTimestamp
    };
  }

  async destroy() {
    this.stopCleanupScheduler();
    await this.performGlobalCleanup();
  }
}

// Ensure required directories exist
async function ensureDirectories() {
  const dirs = [
    path.join(DATA_BASE_PATH),
    path.join(DATA_BASE_PATH, 'sessions'),
    path.join(DATA_BASE_PATH, 'groups'),
    path.join(DATA_BASE_PATH, 'profiles'),
    path.join(DATA_BASE_PATH, 'logs')
  ];
  
  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`✅ Directory ensured: ${dir}`);
    } catch (error) {
      console.error(`❌ Error creating directory ${dir}:`, error);
    }
  }
}

// Initialize directories on startup
ensureDirectories().catch(console.error);

// Initialize Session Deduplicator
const sessionDeduplicator = new SessionDeduplicator(DATA_BASE_PATH, {
  maxSessionsPerUser: 3,    // Máximo 3 sessões por usuário
  maxTotalSessions: 50,     // Máximo 50 sessões total  
  retentionDays: 3,         // Manter sessões por 3 dias
  cleanupIntervalMs: 30 * 60 * 1000, // Cleanup a cada 30 minutos
  significantChangeThreshold: 0.15   // 15% de mudança para considerar significativo
});

console.log('🔧 Session Deduplication System initialized');

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

/**
 * Test endpoint to check API availability
 */
app.get('/api/file-system/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'VendaBoost File System Bridge is running',
    timestamp: new Date().toISOString()
  });
});

/**
 * Get data directory configuration for extension
 */
app.get('/api/file-system/config', (req, res) => {
  res.json({
    success: true,
    config: {
      dataBasePath: DATA_BASE_PATH,
      paths: {
        sessions: path.join(DATA_BASE_PATH, 'sessions'),
        groups: path.join(DATA_BASE_PATH, 'groups'),
        profiles: path.join(DATA_BASE_PATH, 'profiles'),
        logs: path.join(DATA_BASE_PATH, 'logs')
      },
      platform: process.platform,
      separator: path.sep
    },
    timestamp: new Date().toISOString()
  });
});

/**
 * Save file to local directory
 */
app.post('/api/file-system/save', async (req, res) => {
  try {
    const { filePath, data } = req.body;
    
    if (!filePath || !data) {
      return res.status(400).json({ 
        error: 'Missing filePath or data in request body' 
      });
    }
    
    // Ensure the directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    // Convert data to JSON string
    const jsonData = JSON.stringify(data, null, 2);
    
    // Write file
    await fs.writeFile(filePath, jsonData, 'utf8');
    
    console.log(`✅ File saved: ${filePath} (${jsonData.length} bytes)`);
    
    res.json({
      success: true,
      filePath,
      size: jsonData.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error saving file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Read file from local directory
 */
app.post('/api/file-system/read', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ 
        error: 'Missing filePath in request body' 
      });
    }
    
    // Read file
    const fileContent = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);
    
    res.json({
      success: true,
      data,
      filePath,
      size: fileContent.length
    });
    
  } catch (error) {
    console.error('❌ Error reading file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * List files in directory
 */
app.post('/api/file-system/list', async (req, res) => {
  try {
    const { dirPath } = req.body;
    
    if (!dirPath) {
      return res.status(400).json({ 
        error: 'Missing dirPath in request body' 
      });
    }
    
    // Read directory
    const files = await fs.readdir(dirPath);
    const fileStats = [];
    
    for (const file of files) {
      try {
        const fullPath = path.join(dirPath, file);
        const stats = await fs.stat(fullPath);
        
        fileStats.push({
          name: file,
          path: fullPath,
          size: stats.size,
          modified: stats.mtime.getTime(),
          created: stats.birthtime.getTime(),
          isDirectory: stats.isDirectory()
        });
      } catch (error) {
        // Skip files that can't be read
      }
    }
    
    res.json({
      success: true,
      files: fileStats.sort((a, b) => b.modified - a.modified) // Sort by newest first
    });
    
  } catch (error) {
    console.error('❌ Error listing directory:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Delete file
 */
app.post('/api/file-system/delete', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ 
        error: 'Missing filePath in request body' 
      });
    }
    
    // Delete file
    await fs.unlink(filePath);
    
    console.log(`🗑️ File deleted: ${filePath}`);
    
    res.json({
      success: true,
      filePath,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error deleting file:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Legacy Facebook session endpoint (for compatibility)
 */
app.post('/api/facebook-session', async (req, res) => {
  try {
    const data = req.body;
    
    console.log('📡 Facebook session data received:', {
      type: data.type || 'session',
      userId: data.userId || data.data?.userId,
      timestamp: data.timestamp || new Date().toISOString()
    });
    
    // Determine data type and save accordingly
    if (data.type === 'facebook_groups') {
      // Groups data
      const groupsData = data.data;
      const timestamp = groupsData.timestamp || new Date().toISOString();
      const filename = `groups-${groupsData.userId}-${timestamp.replace(/[:.]/g, '-')}.json`;
      const filePath = path.join(DATA_BASE_PATH, 'groups', filename);
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      // Save groups data
      await fs.writeFile(filePath, JSON.stringify(groupsData, null, 2), 'utf8');
      
      console.log(`✅ Groups data saved: ${filename} (${groupsData.groups?.length || 0} groups)`);
      
      res.json({
        success: true,
        message: 'Groups data saved successfully',
        filename,
        groupsCount: groupsData.groups?.length || 0
      });
      
    } else {
      // Session data - Use intelligent deduplication system
      const sessionData = data.data || data;
      
      // Ensure timestamp
      if (!sessionData.timestamp) {
        sessionData.timestamp = new Date().toISOString();
      }
      
      // Ensure sessions directory exists before processing
      const sessionsDir = path.join(DATA_BASE_PATH, 'sessions');
      await fs.mkdir(sessionsDir, { recursive: true });
      
      // Process session through deduplication system
      const result = await sessionDeduplicator.processSession(sessionData);
      
      if (result.saved) {
        // Update current session pointer only if it was saved/updated
        const currentSessionPath = path.join(sessionsDir, 'current-session.json');
        await fs.writeFile(currentSessionPath, JSON.stringify(sessionData, null, 2), 'utf8');
        
        // Update active session config
        const activeConfigPath = path.join(sessionsDir, 'active-session-config.json');
        const activeConfig = {
          activeSessionId: result.filename ? result.filename.replace('.json', '') : 'current',
          updatedAt: new Date().toISOString()
        };
        await fs.writeFile(activeConfigPath, JSON.stringify(activeConfig, null, 2), 'utf8');
        
        // Log with deduplication info
        const stats = sessionDeduplicator.getStats();
        console.log(`📊 Session stats: ${stats.totalSessions} sessions for ${stats.totalUsers} users (${(stats.totalSize/1024/1024).toFixed(2)}MB total)`);
      }
      
      res.json({
        success: true,
        message: `Session ${result.action}: ${result.reason}`,
        filename: result.filename,
        userId: sessionData.userId,
        action: result.action,
        sizeSaved: result.sizeSaved || 0,
        stats: sessionDeduplicator.getStats()
      });
    }
    
  } catch (error) {
    console.error('❌ Error saving Facebook session data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Simple test endpoint
 */
app.get('/api/test-simple', (req, res) => {
  res.json({ message: 'Test endpoint working', timestamp: new Date().toISOString() });
});

/**
 * Get session deduplication statistics
 */
app.get('/api/session-stats', (req, res) => {
  try {
    const stats = sessionDeduplicator.getStats();
    
    res.json({
      success: true,
      stats: {
        ...stats,
        totalSizeMB: (stats.totalSize / 1024 / 1024).toFixed(2),
        config: {
          maxSessionsPerUser: sessionDeduplicator.config.maxSessionsPerUser,
          maxTotalSessions: sessionDeduplicator.config.maxTotalSessions,
          retentionDays: sessionDeduplicator.config.retentionDays,
          cleanupIntervalMinutes: sessionDeduplicator.config.cleanupIntervalMs / 1000 / 60,
          significantChangeThreshold: sessionDeduplicator.config.significantChangeThreshold
        }
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error getting session stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Force cleanup of old sessions
 */
app.post('/api/session-cleanup', async (req, res) => {
  try {
    const result = await sessionDeduplicator.performGlobalCleanup();
    
    res.json({
      success: true,
      message: 'Manual cleanup completed',
      result: {
        removedFiles: result.removedFiles,
        freedSpaceMB: (result.freedSpace / 1024 / 1024).toFixed(2)
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error during manual cleanup:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get available profiles for panel
 */
app.get('/api/profiles', async (req, res) => {
  try {
    const sessionsDir = path.join(DATA_BASE_PATH, 'sessions');
    
    // Check if sessions directory exists
    try {
      await fs.access(sessionsDir);
    } catch (error) {
      return res.json({
        success: true,
        profiles: []
      });
    }
    
    // Read sessions directory
    const files = await fs.readdir(sessionsDir);
    const sessionFiles = files.filter(file => file.startsWith('session-') && file.endsWith('.json'));
    
    const profiles = new Map();
    
    // Parse each session file
    for (const file of sessionFiles) {
      try {
        const filePath = path.join(sessionsDir, file);
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf8');
        const sessionData = JSON.parse(content);
        
        if (sessionData.userId) {
          const userId = sessionData.userId;
          
          if (!profiles.has(userId) || stats.mtime > profiles.get(userId).lastSeen) {
            profiles.set(userId, {
              userId,
              name: sessionData.userInfo?.name || 'Unknown',
              profileUrl: sessionData.userInfo?.profileUrl || '',
              avatarUrl: sessionData.userInfo?.avatarUrl || '',
              lastSeen: stats.mtime,
              sessionFile: file,
              isActive: file === 'current-session.json'
            });
          }
        }
      } catch (error) {
        console.debug(`Error parsing session file ${file}:`, error);
      }
    }
    
    res.json({
      success: true,
      profiles: Array.from(profiles.values()).sort((a, b) => b.lastSeen - a.lastSeen)
    });
    
  } catch (error) {
    console.error('❌ Error getting profiles:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 VendaBoost File System Bridge started');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`📁 Data path: ${DATA_BASE_PATH}`);
  console.log('✅ Ready to receive extension data');
  console.log('=====================================');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 VendaBoost File System Bridge shutting down...');
  
  try {
    console.log('🧹 Performing final cleanup...');
    await sessionDeduplicator.destroy();
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Error during shutdown cleanup:', error);
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 VendaBoost File System Bridge received SIGTERM...');
  
  try {
    await sessionDeduplicator.destroy();
  } catch (error) {
    console.error('❌ Error during SIGTERM cleanup:', error);
  }
  
  process.exit(0);
});

export default app;