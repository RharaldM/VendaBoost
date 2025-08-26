/**
 * VendaBoost - Session Deduplication System
 * Professional-grade session management with intelligent deduplication
 * Designed for scalability and future database migration
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

interface SessionData {
  userId: string;
  timestamp: string;
  cookies: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string;
  }>;
  userInfo: {
    name?: string;
    profileUrl?: string;
    avatarUrl?: string;
    [key: string]: any;
  };
  localStorage?: { [key: string]: string };
  sessionStorage?: { [key: string]: string };
  metadata?: {
    userAgent?: string;
    url?: string;
    extractionContext?: string;
    chromeVersion?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface SessionFingerprint {
  userId: string;
  userInfoHash: string;
  localStorageHash: string;
  sessionStorageHash: string;
  metadataHash: string;
  coreDataHash: string; // Hash dos dados realmente importantes
}

interface SessionFile {
  filename: string;
  path: string;
  timestamp: string;
  fingerprint: SessionFingerprint;
  size: number;
}

interface DeduplicationConfig {
  maxSessionsPerUser: number;
  maxTotalSessions: number;
  retentionDays: number;
  cleanupIntervalMs: number;
  significantChangeThreshold: number; // % de mudança para considerar significativo
}

export class SessionDeduplicator {
  private config: DeduplicationConfig;
  private basePath: string;
  private sessionsIndex: Map<string, SessionFile[]> = new Map(); // userId -> sessions
  private cleanupInterval?: NodeJS.Timeout;

  constructor(basePath: string, config?: Partial<DeduplicationConfig>) {
    this.basePath = basePath;
    this.config = {
      maxSessionsPerUser: 5,     // Máximo 5 sessões por usuário
      maxTotalSessions: 100,     // Máximo 100 sessões total
      retentionDays: 7,          // Manter sessões por 7 dias
      cleanupIntervalMs: 60 * 60 * 1000, // Cleanup a cada hora
      significantChangeThreshold: 0.1, // 10% de mudança
      ...config
    };
    
    this.initializeIndex();
    this.startCleanupScheduler();
  }

  /**
   * Inicializa o índice de sessões existentes
   */
  private async initializeIndex(): Promise<void> {
    try {
      const sessionFiles = await this.loadExistingSessions();
      
      for (const sessionFile of sessionFiles) {
        const userId = sessionFile.fingerprint.userId;
        if (!this.sessionsIndex.has(userId)) {
          this.sessionsIndex.set(userId, []);
        }
        this.sessionsIndex.get(userId)!.push(sessionFile);
      }

      // Ordenar por timestamp (mais recente primeiro)
      for (const [userId, sessions] of this.sessionsIndex) {
        sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }

      console.log(`📊 Session Index initialized: ${sessionFiles.length} sessions for ${this.sessionsIndex.size} users`);
    } catch (error) {
      console.error('❌ Error initializing session index:', error);
    }
  }

  /**
   * Carrega sessões existentes do disco
   */
  private async loadExistingSessions(): Promise<SessionFile[]> {
    const sessionFiles: SessionFile[] = [];
    const sessionsDir = path.join(this.basePath, 'sessions');
    
    try {
      const files = await fs.readdir(sessionsDir);
      
      for (const file of files) {
        if (file.startsWith('session-') && file.endsWith('.json')) {
          try {
            const filePath = path.join(sessionsDir, file);
            const stats = await fs.stat(filePath);
            const content = await fs.readFile(filePath, 'utf-8');
            const sessionData: SessionData = JSON.parse(content);
            
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
            console.warn(`⚠️ Could not load session file ${file}:`, error);
          }
        }
      }
    } catch (error) {
      // Diretório não existe ainda
      await fs.mkdir(sessionsDir, { recursive: true });
    }
    
    return sessionFiles;
  }

  /**
   * Gera fingerprint único dos dados essenciais da sessão
   */
  private generateFingerprint(sessionData: SessionData): SessionFingerprint {
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

  /**
   * Normaliza dados de storage removendo timestamps e dados voláteis
   */
  private normalizeStorage(storage: { [key: string]: string } | undefined): { [key: string]: string } {
    if (!storage) return {};
    
    const normalized: { [key: string]: string } = {};
    
    for (const [key, value] of Object.entries(storage)) {
      // Ignora chaves que contêm timestamps ou dados voláteis
      if (!key.includes('timestamp') && !key.includes('_ts') && !key.includes('expir')) {
        normalized[key] = value;
      }
    }
    
    return normalized;
  }

  /**
   * Normaliza metadados removendo dados voláteis
   */
  private normalizeMetadata(metadata: any): any {
    if (!metadata) return {};
    
    const normalized = { ...metadata };
    
    // Remove campos voláteis
    delete normalized.timestamp;
    delete normalized.extractionTimestamp;
    delete normalized.sessionId;
    
    return normalized;
  }

  /**
   * Gera hash MD5 de um objeto
   */
  private hashObject(obj: any): string {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('md5').update(str).digest('hex');
  }

  /**
   * Extrai timestamp do nome do arquivo
   */
  private extractTimestampFromFilename(filename: string): string {
    const match = filename.match(/session-(.+)\.json$/);
    if (match && match[1]) {
      return match[1].replace(/-/g, ':').replace(/(\d{4}):(\d{2}):(\d{2})T/, '$1-$2-$3T');
    }
    return new Date().toISOString();
  }

  /**
   * Decide se uma nova sessão deve ser salva ou se pode fazer merge
   */
  public async shouldSaveSession(sessionData: SessionData): Promise<{
    shouldSave: boolean;
    reason: string;
    action: 'create' | 'merge' | 'skip';
    targetFile?: string;
  }> {
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
    const similarity = this.calculateSimilarity(fingerprint, latestSession!.fingerprint);

    // Se os dados core são idênticos, faz merge ao invés de criar novo arquivo
    if (fingerprint.coreDataHash === latestSession!.fingerprint.coreDataHash) {
      return {
        shouldSave: true,
        reason: 'Core data identical, will merge cookies and update timestamp',
        action: 'merge',
        targetFile: latestSession!.filename
      };
    }

    // Se a mudança é significativa, cria nova sessão
    if (similarity < (1 - this.config.significantChangeThreshold)) {
      return {
        shouldSave: true,
        reason: `Significant change detected (${(1-similarity)*100}% different)`,
        action: 'create'
      };
    }

    // Senão, pula (mudança não significativa)
    return {
      shouldSave: false,
      reason: `Insignificant change (${(1-similarity)*100}% different), skipping`,
      action: 'skip'
    };
  }

  /**
   * Calcula similaridade entre dois fingerprints (0-1, onde 1 = idêntico)
   */
  private calculateSimilarity(fp1: SessionFingerprint, fp2: SessionFingerprint): number {
    if (fp1.userId !== fp2.userId) return 0;

    let matches = 0;
    let total = 0;

    const fields = ['userInfoHash', 'localStorageHash', 'sessionStorageHash', 'metadataHash'];
    
    for (const field of fields) {
      total++;
      if (fp1[field as keyof SessionFingerprint] === fp2[field as keyof SessionFingerprint]) {
        matches++;
      }
    }

    return matches / total;
  }

  /**
   * Processa uma nova sessão aplicando lógica de deduplicação
   */
  public async processSession(sessionData: SessionData): Promise<{
    saved: boolean;
    filename?: string;
    action: 'created' | 'merged' | 'skipped';
    reason: string;
    sizeSaved?: number;
  }> {
    const decision = await this.shouldSaveSession(sessionData);
    
    if (!decision.shouldSave) {
      return {
        saved: false,
        action: 'skipped',
        reason: decision.reason
      };
    }

    if (decision.action === 'merge' && decision.targetFile) {
      // Merge com sessão existente
      const result = await this.mergeSession(sessionData, decision.targetFile);
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
      const filepath = path.join(this.basePath, 'sessions', filename);
      
      await fs.writeFile(filepath, JSON.stringify(sessionData, null, 2), 'utf-8');
      
      // Atualiza índice
      const fingerprint = this.generateFingerprint(sessionData);
      const stats = await fs.stat(filepath);
      
      const sessionFile: SessionFile = {
        filename,
        path: filepath,
        timestamp: sessionData.timestamp,
        fingerprint,
        size: stats.size
      };
      
      if (!this.sessionsIndex.has(sessionData.userId)) {
        this.sessionsIndex.set(sessionData.userId, []);
      }
      
      this.sessionsIndex.get(sessionData.userId)!.unshift(sessionFile);
      
      // Cleanup automático se necessário
      await this.cleanupUserSessions(sessionData.userId);
      
      return {
        saved: true,
        filename,
        action: 'created',
        reason: decision.reason
      };
    }
  }

  /**
   * Faz merge de uma nova sessão com uma existente
   */
  private async mergeSession(newSessionData: SessionData, targetFilename: string): Promise<{
    sizeSaved: number;
  }> {
    const targetPath = path.join(this.basePath, 'sessions', targetFilename);
    
    try {
      // Verifica se arquivo existe antes de tentar ler
      const existingContent = await fs.readFile(targetPath, 'utf-8');
      const existingSession: SessionData = JSON.parse(existingContent);
      const originalSize = existingContent.length;
      
      // Merge inteligente
      const mergedSession: SessionData = {
        ...existingSession,
        timestamp: newSessionData.timestamp, // Atualiza timestamp
        userId: newSessionData.userId || existingSession.userId, // Mantém userId
        cookies: newSessionData.cookies || existingSession.cookies, // Atualiza cookies
        userInfo: this.mergeUserInfo(newSessionData.userInfo, existingSession.userInfo), // IMPORTANTE: Merge inteligente userInfo
        tokens: this.mergeTokens(newSessionData.tokens, existingSession.tokens), // Merge inteligente tokens
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
      
      const sizeSaved = originalSize - newContent.length + (originalSize); // Economia por não criar arquivo novo
      
      console.log(`🔄 Merged session for user ${newSessionData.userId} into ${targetFilename}`);
      
      return { sizeSaved };
      
    } catch (error) {
      // Se o arquivo não existe (ENOENT), cria um novo ao invés de fazer merge
      if ((error as any).code === 'ENOENT') {
        console.log(`⚠️ Target file ${targetFilename} not found, creating new file instead of merging`);
        
        // Cria novo arquivo com os dados recebidos
        const newContent = JSON.stringify(newSessionData, null, 2);
        await fs.writeFile(targetPath, newContent, 'utf-8');
        
        // Remove referência ao arquivo inexistente do índice
        const userSessions = this.sessionsIndex.get(newSessionData.userId);
        if (userSessions) {
          const index = userSessions.findIndex(s => s.filename === targetFilename);
          if (index >= 0) {
            userSessions.splice(index, 1);
          }
        }
        
        // Adiciona nova entrada no índice
        this.addToIndex(newSessionData, targetFilename);
        
        console.log(`✅ Created new session file ${targetFilename}`);
        
        return { sizeSaved: 0 }; // Não houve economia pois criou novo arquivo
      }
      
      console.error(`❌ Error merging session ${targetFilename}:`, error);
      throw error;
    }
  }

  /**
   * Merge inteligente de userInfo - prefere dados não-vazios
   */
  private mergeUserInfo(newUserInfo: any, existingUserInfo: any): any {
    if (!newUserInfo && !existingUserInfo) return {};
    if (!newUserInfo) return existingUserInfo;
    if (!existingUserInfo) return newUserInfo;
    
    return {
      id: newUserInfo.id || existingUserInfo.id,
      name: newUserInfo.name || existingUserInfo.name,
      email: newUserInfo.email || existingUserInfo.email,
      profileUrl: newUserInfo.profileUrl || existingUserInfo.profileUrl,
      avatarUrl: newUserInfo.avatarUrl || existingUserInfo.avatarUrl,
      ...existingUserInfo,
      ...newUserInfo
    };
  }

  /**
   * Merge inteligente de tokens - prefere dados não-vazios
   */
  private mergeTokens(newTokens: any, existingTokens: any): any {
    if (!newTokens && !existingTokens) return {};
    if (!newTokens) return existingTokens;
    if (!existingTokens) return newTokens;
    
    return {
      ...existingTokens,
      ...newTokens
    };
  }

  /**
   * Adiciona sessão ao índice
   */
  private addToIndex(sessionData: SessionData, filename: string): void {
    const fingerprint = this.generateFingerprint(sessionData);
    const userId = sessionData.userId;
    
    if (!this.sessionsIndex.has(userId)) {
      this.sessionsIndex.set(userId, []);
    }
    
    const userSessions = this.sessionsIndex.get(userId)!;
    userSessions.unshift({
      filename,
      path: path.join(this.basePath, 'sessions', filename),
      timestamp: sessionData.timestamp,
      fingerprint,
      size: JSON.stringify(sessionData).length
    });
    
    // Manter apenas as mais recentes (limite)
    if (userSessions.length > this.config.maxSessionsPerUser) {
      userSessions.splice(this.config.maxSessionsPerUser);
    }
  }

  /**
   * Gera nome do arquivo baseado no timestamp
   */
  private generateFilename(sessionData: SessionData): string {
    const timestamp = sessionData.timestamp.replace(/[:.]/g, '-');
    return `session-${timestamp}.json`;
  }

  /**
   * Cleanup automático de sessões antigas para um usuário
   */
  private async cleanupUserSessions(userId: string): Promise<void> {
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

  /**
   * Cleanup geral baseado em retenção de dias
   */
  public async performGlobalCleanup(): Promise<{
    removedFiles: number;
    freedSpace: number;
  }> {
    const cutoffDate = new Date(Date.now() - (this.config.retentionDays * 24 * 60 * 60 * 1000));
    let removedFiles = 0;
    let freedSpace = 0;

    for (const [userId, sessions] of this.sessionsIndex) {
      const validSessions: SessionFile[] = [];
      
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

    console.log(`🧹 Global cleanup completed: ${removedFiles} files removed, ${(freedSpace/1024/1024).toFixed(2)}MB freed`);
    
    return { removedFiles, freedSpace };
  }

  /**
   * Inicia scheduler de cleanup automático
   */
  private startCleanupScheduler(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.performGlobalCleanup();
    }, this.config.cleanupIntervalMs);
    
    console.log(`🕒 Cleanup scheduler started (interval: ${this.config.cleanupIntervalMs/1000/60} minutes)`);
  }

  /**
   * Para o scheduler de cleanup
   */
  public stopCleanupScheduler(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined as any;
    }
  }

  /**
   * Obtém estatísticas do sistema
   */
  public getStats(): {
    totalUsers: number;
    totalSessions: number;
    totalSize: number;
    avgSessionsPerUser: number;
    oldestSession: string;
    newestSession: string;
  } {
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
      avgSessionsPerUser: totalSessions / (this.sessionsIndex.size || 1),
      oldestSession: oldestTimestamp,
      newestSession: newestTimestamp
    };
  }

  /**
   * Prepara estrutura para migração futura ao banco de dados
   */
  public exportForDatabase(): {
    users: Array<{
      userId: string;
      latestSession: SessionData;
      sessionHistory: Array<{
        timestamp: string;
        fingerprint: string;
        changes: string[];
      }>;
    }>;
  } {
    const users = [];
    
    for (const [userId, sessions] of this.sessionsIndex) {
      if (sessions.length === 0) continue;
      
      const latestSession = sessions[0];
      const sessionHistory = sessions.map(session => ({
        timestamp: session.timestamp,
        fingerprint: session.fingerprint.coreDataHash,
        changes: [] // TODO: calcular mudanças entre sessões
      }));
      
      users.push({
        userId,
        latestSession: JSON.parse(JSON.stringify(latestSession)), // Deep clone
        sessionHistory
      });
    }
    
    return { users };
  }

  /**
   * Cleanup quando o processo termina
   */
  public async destroy(): Promise<void> {
    this.stopCleanupScheduler();
    await this.performGlobalCleanup();
  }
}