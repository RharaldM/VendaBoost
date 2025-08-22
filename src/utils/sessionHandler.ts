import fs from 'fs/promises';
import path from 'path';
import { SessionData, SessionValidation, FacebookCookie, SessionInfo } from '../types/session';
import { info, warn, error, debug } from '../logger.js';

const SESSION_DIR = path.join(process.cwd(), 'data', 'sessions');
const CURRENT_SESSION_FILE = path.join(SESSION_DIR, 'current-session.json');
const ACTIVE_SESSION_CONFIG = path.join(SESSION_DIR, 'active-session-config.json');

// Ensure session directory exists
export async function ensureSessionDirectory(): Promise<void> {
  try {
    await fs.mkdir(SESSION_DIR, { recursive: true });
  } catch (err) {
    error('Erro ao criar diretório de sessões:', err);
  }
}

// Validate session data from extension
export function validateSessionData(sessionData: SessionData): SessionValidation {
  const errors: string[] = [];

  // Check required fields
  if (!sessionData.userId) {
    errors.push('userId é obrigatório');
  }

  if (!sessionData.timestamp) {
    errors.push('timestamp é obrigatório');
  }

  if (!sessionData.cookies || !Array.isArray(sessionData.cookies)) {
    errors.push('cookies deve ser um array');
  } else if (sessionData.cookies.length === 0) {
    errors.push('pelo menos um cookie é necessário');
  }

  if (!sessionData.userInfo) {
    errors.push('userInfo é obrigatório');
  } else {
    if (!sessionData.userInfo.id) {
      errors.push('userInfo.id é obrigatório');
    }
    if (!sessionData.userInfo.name) {
      errors.push('userInfo.name é obrigatório');
    }
  }

  if (!sessionData.userAgent) {
    errors.push('userAgent é obrigatório');
  }

  if (!sessionData.url) {
    errors.push('url é obrigatório');
  }

  // Validate cookies format
  if (sessionData.cookies && Array.isArray(sessionData.cookies)) {
    sessionData.cookies.forEach((cookie, index) => {
      if (!cookie.name) {
        errors.push(`cookie[${index}].name é obrigatório`);
      }
      if (!cookie.value) {
        errors.push(`cookie[${index}].value é obrigatório`);
      }
      if (!cookie.domain) {
        errors.push(`cookie[${index}].domain é obrigatório`);
      }
    });
  }

  // Check for essential Facebook cookies
  const essentialCookies = ['c_user', 'xs', 'datr'];
  const cookieNames = sessionData.cookies?.map(c => c.name) || [];
  
  essentialCookies.forEach(cookieName => {
    if (!cookieNames.includes(cookieName)) {
      errors.push(`Cookie essencial '${cookieName}' não encontrado`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Check if session data has significant changes compared to existing session
export async function hasSessionChanged(newSessionData: SessionData, existingSessionData: SessionData): Promise<boolean> {
  // Compare critical cookies that indicate actual session/login changes (excluding frequently changing ones)
  const criticalCookies = ['c_user', 'xs', 'datr']; // Removed 'fr' - changes too frequently
  
  const newCookieMap = new Map(newSessionData.cookies.map(c => [c.name, c.value]));
  const existingCookieMap = new Map(existingSessionData.cookies.map(c => [c.name, c.value]));
  
  // Check if any critical cookie has changed
  for (const cookieName of criticalCookies) {
    const newValue = newCookieMap.get(cookieName);
    const existingValue = existingCookieMap.get(cookieName);
    
    if (newValue !== existingValue) {
      debug(`🔄 Cookie '${cookieName}' mudou: ${existingValue} -> ${newValue}`);
      return true;
    }
  }
  
  // Check if user changed (different account)
  if (newSessionData.userId !== existingSessionData.userId) {
    info(`👤 Usuário mudou: ${existingSessionData.userId} -> ${newSessionData.userId}`);
    return true;
  }
  
  // Check if more than 4 hours has passed (longer refresh interval for production)
  const timeDiff = new Date(newSessionData.timestamp).getTime() - new Date(existingSessionData.timestamp).getTime();
  const refreshIntervalMs = 4 * 60 * 60 * 1000; // 4 hours
  
  if (timeDiff > refreshIntervalMs) {
    info('⏰ Sessão será atualizada - mais de 4 horas desde a última atualização');
    return true;
  }
  
  return false;
}

// Save session data to file (with strict duplicate prevention for production)
export async function saveSessionData(sessionData: SessionData): Promise<boolean> {
  try {
    await ensureSessionDirectory();
    
    // Check if we already have a session for this user that hasn't changed significantly
    const existingSession = await loadCurrentSession();
    
    if (existingSession) {
      const hasChanged = await hasSessionChanged(sessionData, existingSession);
      
      if (!hasChanged) {
        info('⏭️ Sessão não foi salva - nenhuma mudança significativa detectada', {
          userId: sessionData.userId,
          existingTimestamp: existingSession.timestamp,
          newTimestamp: sessionData.timestamp,
          reason: 'Mesma conta, cookies críticos inalterados, intervalo < 4h'
        });
        return false; // Indicate nothing was saved
      }
    }
    
    // Save current session (always update the main file)
    await fs.writeFile(CURRENT_SESSION_FILE, JSON.stringify(sessionData, null, 2));
    
    // For production: Only save timestamped backup for truly critical changes
    const shouldBackup = !existingSession || 
                        existingSession.userId !== sessionData.userId || 
                        await hasEssentialCookieChanged(sessionData, existingSession);
    
    if (shouldBackup) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(SESSION_DIR, `session-${timestamp}.json`);
      await fs.writeFile(backupFile, JSON.stringify(sessionData, null, 2));
      
      // Auto-set as active session for new accounts, first session, or if no active session exists
      const sessionId = `session-${timestamp}`;
      const currentActiveSessionId = await getActiveSessionId();
      
      if (!existingSession || existingSession.userId !== sessionData.userId || !currentActiveSessionId) {
        await setActiveSessionId(sessionId);
        info('🎯 Sessão definida automaticamente como ativa:', sessionId);
      }
      
      info('✅ Sessão completa salva (mudança crítica):', {
        currentFile: CURRENT_SESSION_FILE,
        backupFile,
        userId: sessionData.userId,
        sessionId: sessionId,
        autoActivated: !existingSession || existingSession.userId !== sessionData.userId || !currentActiveSessionId,
        reason: !existingSession ? 'Primeira sessão' : 
               existingSession.userId !== sessionData.userId ? 'Nova conta' : 'Cookies críticos alterados'
      });
    } else {
      info('✅ Sessão atualizada (sem backup - mudança menor):', {
        currentFile: CURRENT_SESSION_FILE,
        userId: sessionData.userId,
        reason: 'Refresh periódico ou mudanças não-críticas'
      });
    }
    
    return true; // Indicate something was saved
    
  } catch (err) {
    error('❌ Erro ao salvar dados de sessão:', err);
    throw err;
  }
}

// Load current session data
export async function loadCurrentSession(): Promise<SessionData | null> {
  try {
    const data = await fs.readFile(CURRENT_SESSION_FILE, 'utf-8');
    const sessionData = JSON.parse(data) as SessionData;
    
    // Validate loaded session
    const validation = validateSessionData(sessionData);
    if (!validation.isValid) {
      warn('⚠️ Sessão carregada é inválida:', validation.errors);
      return null;
    }
    
    return sessionData;
  } catch (err) {
    warn('⚠️ Não foi possível carregar sessão atual:', err);
    return null;
  }
}

// Convert session data to Playwright format
export function convertToPlaywrightSession(sessionData: SessionData) {
  return {
    cookies: sessionData.cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path || '/',
      expires: cookie.expires ? cookie.expires : -1,
      httpOnly: cookie.httpOnly || false,
      secure: cookie.secure || false,
      sameSite: cookie.sameSite || 'Lax'
    })),
    origins: [
      {
        origin: 'https://www.facebook.com',
        localStorage: sessionData.localStorage ? 
          Object.entries(sessionData.localStorage).map(([name, value]) => ({ name, value })) : []
      }
    ]
  };
}

// Check if session is still valid (not expired)
export function isSessionValid(sessionData: SessionData): boolean {
  const sessionAge = Date.now() - new Date(sessionData.timestamp).getTime();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  return sessionAge < maxAge;
}

// Check if only essential cookies changed (for backup decision)
export async function hasEssentialCookieChanged(newSessionData: SessionData, existingSessionData: SessionData): Promise<boolean> {
  const essentialCookies = ['c_user', 'xs', 'datr'];
  
  const newCookieMap = new Map(newSessionData.cookies.map(c => [c.name, c.value]));
  const existingCookieMap = new Map(existingSessionData.cookies.map(c => [c.name, c.value]));
  
  for (const cookieName of essentialCookies) {
    const newValue = newCookieMap.get(cookieName);
    const existingValue = existingCookieMap.get(cookieName);
    
    if (newValue !== existingValue) {
      debug(`🔄 Cookie essencial '${cookieName}' mudou - backup necessário`);
      return true;
    }
  }
  
  return false;
}

// Clean old session files (more aggressive for production)
export async function cleanOldSessions(maxAge: number = 3 * 24 * 60 * 60 * 1000): Promise<void> {
  try {
    await ensureSessionDirectory();
    const files = await fs.readdir(SESSION_DIR);
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const file of files) {
      if (file.startsWith('session-') && file.endsWith('.json')) {
        const filePath = path.join(SESSION_DIR, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          cleanedCount++;
          debug(`🗑️ Sessão antiga removida: ${file}`);
        }
      }
    }
    
    if (cleanedCount > 0) {
      info(`🧹 Limpeza concluída: ${cleanedCount} sessões antigas removidas`);
    }
  } catch (err) {
    error('❌ Erro ao limpar sessões antigas:', err);
  }
}

// Get all available sessions with metadata
export async function getAllSessions(): Promise<SessionInfo[]> {
  try {
    await ensureSessionDirectory();
    const files = await fs.readdir(SESSION_DIR);
    const sessions: SessionInfo[] = [];
    const activeSessionId = await getActiveSessionId();
    
    // Filter only session files (not config files)
    const sessionFiles = files.filter(file => 
      file.startsWith('session-') && file.endsWith('.json')
    );
    
    for (const file of sessionFiles) {
      try {
        const filePath = path.join(SESSION_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const sessionData: SessionData = JSON.parse(content);
        
        // Extract session ID from filename
        const sessionId = file.replace('.json', '');
        
        const sessionInfo: SessionInfo = {
          id: sessionId,
          userId: sessionData.userId,
          userName: sessionData.userInfo?.name || 'Nome não disponível',
          timestamp: sessionData.timestamp,
          isActive: sessionId === activeSessionId,
          isValid: isSessionValid(sessionData),
          filePath: filePath
        };
        
        sessions.push(sessionInfo);
      } catch (err) {
        warn(`⚠️ Erro ao processar arquivo de sessão ${file}:`, err);
      }
    }
    
    // Sort by timestamp (newest first)
    sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    debug(`📋 Encontradas ${sessions.length} sessões disponíveis`);
    return sessions;
    
  } catch (err) {
    error('❌ Erro ao listar sessões:', err);
    return [];
  }
}

// Get active session ID with validation and fallback
export async function getActiveSessionId(): Promise<string | null> {
  try {
    const configExists = await fs.access(ACTIVE_SESSION_CONFIG).then(() => true).catch(() => false);
    if (!configExists) {
      debug('ℹ️ Arquivo de configuração de sessão ativa não encontrado');
      return await selectMostRecentSessionAsFallback();
    }
    
    const content = await fs.readFile(ACTIVE_SESSION_CONFIG, 'utf-8');
    const config = JSON.parse(content);
    const activeSessionId = config.activeSessionId;
    
    if (!activeSessionId) {
      debug('ℹ️ Nenhuma sessão ativa configurada');
      return await selectMostRecentSessionAsFallback();
    }
    
    // Validate that the active session still exists
    const sessionExists = await loadSessionById(activeSessionId);
    if (!sessionExists) {
      warn(`⚠️ Sessão ativa ${activeSessionId} não existe mais, selecionando fallback`);
      return await selectMostRecentSessionAsFallback();
    }
    
    return activeSessionId;
  } catch (err) {
    debug('ℹ️ Erro ao obter sessão ativa, tentando fallback:', err);
    return await selectMostRecentSessionAsFallback();
  }
}

// Helper function to select the most recent session as fallback
async function selectMostRecentSessionAsFallback(): Promise<string | null> {
  try {
    const sessions = await getAllSessions();
    if (sessions.length === 0) {
      debug('ℹ️ Nenhuma sessão disponível para fallback');
      return null;
    }
    
    // Sort by timestamp (most recent first)
    const sortedSessions = sessions.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    const mostRecentSession = sortedSessions[0];
    if (!mostRecentSession) {
      debug('ℹ️ Nenhuma sessão válida encontrada para fallback');
      return null;
    }
    
    info(`🔄 Selecionando sessão mais recente como ativa: ${mostRecentSession.userName} (${mostRecentSession.id})`);
    
    // Set as active session
    await setActiveSessionId(mostRecentSession.id);
    return mostRecentSession.id;
  } catch (err) {
    error('❌ Erro ao selecionar sessão de fallback:', err);
    return null;
  }
}

// Set active session ID
export async function setActiveSessionId(sessionId: string): Promise<void> {
  try {
    await ensureSessionDirectory();
    
    const config = {
      activeSessionId: sessionId,
      updatedAt: new Date().toISOString()
    };
    
    await fs.writeFile(ACTIVE_SESSION_CONFIG, JSON.stringify(config, null, 2));
    info(`✅ Sessão ativa definida como: ${sessionId}`);
  } catch (err) {
    error('❌ Erro ao definir sessão ativa:', err);
    throw err;
  }
}

// Load session by ID
export async function loadSessionById(sessionId: string): Promise<SessionData | null> {
  try {
    const filePath = path.join(SESSION_DIR, `${sessionId}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    const sessionData: SessionData = JSON.parse(content);
    
    // Validate loaded session
    const validation = validateSessionData(sessionData);
    if (!validation.isValid) {
      warn(`⚠️ Sessão ${sessionId} é inválida:`, validation.errors);
      return null;
    }
    
    debug(`📥 Sessão ${sessionId} carregada com sucesso`);
    return sessionData;
  } catch (err) {
    warn(`⚠️ Não foi possível carregar sessão ${sessionId}:`, err);
    return null;
  }
}

// Initialize session system - ensures there's always an active session if sessions exist
export async function initializeSessionSystem(): Promise<void> {
  try {
    // Check if active session config exists without triggering fallback logic
    const configExists = await fs.access(ACTIVE_SESSION_CONFIG).then(() => true).catch(() => false);
    
    if (!configExists) {
      // No config file, try to create one with most recent session
      const sessions = await getAllSessions();
      if (sessions.length > 0) {
        const mostRecentSession = sessions[0]; // getAllSessions already sorts by timestamp (newest first)
        if (mostRecentSession) {
          await setActiveSessionId(mostRecentSession.id);
          info(`🚀 Sistema de sessões inicializado. Sessão ativa auto-configurada: ${mostRecentSession.id}`);
        }
      } else {
        info('ℹ️ Sistema de sessões inicializado. Nenhuma sessão disponível.');
      }
    } else {
      // Config exists, just validate it's readable
      try {
        const content = await fs.readFile(ACTIVE_SESSION_CONFIG, 'utf-8');
        const config = JSON.parse(content);
        if (config.activeSessionId) {
          info(`✅ Sistema de sessões inicializado. Sessão ativa: ${config.activeSessionId}`);
        } else {
          info('ℹ️ Sistema de sessões inicializado. Configuração existe mas sem sessão ativa.');
        }
      } catch (err) {
        warn('⚠️ Erro ao ler configuração de sessão ativa:', err);
      }
    }
  } catch (err) {
    warn('⚠️ Erro ao inicializar sistema de sessões:', err);
  }
}

// Get currently active session (using selected session or fallback to current-session.json)
export async function getActiveSession(): Promise<SessionData | null> {
  let activeSessionId = await getActiveSessionId();
  
  // If no active session is configured, auto-select the most recent one
  if (!activeSessionId) {
    const sessions = await getAllSessions();
    if (sessions.length > 0) {
      const mostRecentSession = sessions[0]; // getAllSessions already sorts by timestamp (newest first)
      if (mostRecentSession) {
        await setActiveSessionId(mostRecentSession.id);
        activeSessionId = mostRecentSession.id;
        info(`🎯 Nenhuma sessão ativa configurada. Auto-selecionando a mais recente: ${activeSessionId}`);
      }
    }
  }
  
  if (activeSessionId) {
    const session = await loadSessionById(activeSessionId);
    if (session) {
      debug(`📱 Usando sessão ativa selecionada: ${activeSessionId}`);
      return session;
    } else {
      warn(`⚠️ Sessão ativa ${activeSessionId} não encontrada, usando fallback`);
    }
  }
  
  // Fallback to current-session.json
  debug('📱 Usando sessão atual (current-session.json)');
  return await loadCurrentSession();
}