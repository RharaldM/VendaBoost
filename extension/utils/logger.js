/**
 * VendaBoost Extension - Sistema de Logs Estruturados
 * Centraliza e organiza todos os logs da extensão
 */

class Logger {
  constructor() {
    this.levels = {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      CRITICAL: 4
    };
    
    this.currentLevel = this.levels.INFO;
    this.logHistory = [];
    this.maxHistorySize = 1000;
    
    // Configurações de contexto
    this.context = {
      extensionVersion: '2.0.0',
      environment: 'production',
      userId: null,
      sessionId: this.generateSessionId()
    };
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  setContext(key, value) {
    this.context[key] = value;
  }

  setLogLevel(level) {
    if (typeof level === 'string') {
      this.currentLevel = this.levels[level.toUpperCase()] || this.levels.INFO;
    } else {
      this.currentLevel = level;
    }
  }

  createLogEntry(level, component, message, data = null, error = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: Object.keys(this.levels)[level],
      component,
      message,
      sessionId: this.context.sessionId,
      userId: this.context.userId,
      data,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : null
    };

    // Adiciona ao histórico
    this.logHistory.push(logEntry);
    
    // Limita o tamanho do histórico
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }

    return logEntry;
  }

  formatConsoleMessage(logEntry) {
    const emoji = this.getLevelEmoji(logEntry.level);
    const timestamp = new Date(logEntry.timestamp).toLocaleTimeString();
    
    return `${emoji} [${timestamp}] [${logEntry.component}] ${logEntry.message}`;
  }

  getLevelEmoji(level) {
    const emojis = {
      'DEBUG': '🔍',
      'INFO': 'ℹ️',
      'WARN': '⚠️',
      'ERROR': '❌',
      'CRITICAL': '🚨'
    };
    return emojis[level] || 'ℹ️';
  }

  shouldLog(level) {
    return level >= this.currentLevel;
  }

  log(level, component, message, data = null, error = null) {
    if (!this.shouldLog(level)) return;

    const logEntry = this.createLogEntry(level, component, message, data, error);
    const consoleMessage = this.formatConsoleMessage(logEntry);

    // Log no console baseado no nível
    switch (level) {
      case this.levels.DEBUG:
        console.debug(consoleMessage, data);
        break;
      case this.levels.INFO:
        console.info(consoleMessage, data);
        break;
      case this.levels.WARN:
        console.warn(consoleMessage, data, error);
        break;
      case this.levels.ERROR:
      case this.levels.CRITICAL:
        console.error(consoleMessage, data, error);
        break;
    }

    // Salva logs críticos e erros no storage
    if (level >= this.levels.ERROR) {
      this.persistCriticalLog(logEntry);
    }
  }

  // Métodos de conveniência
  debug(component, message, data = null) {
    this.log(this.levels.DEBUG, component, message, data);
  }

  info(component, message, data = null) {
    this.log(this.levels.INFO, component, message, data);
  }

  warn(component, message, data = null, error = null) {
    this.log(this.levels.WARN, component, message, data, error);
  }

  error(component, message, data = null, error = null) {
    this.log(this.levels.ERROR, component, message, data, error);
  }

  critical(component, message, data = null, error = null) {
    this.log(this.levels.CRITICAL, component, message, data, error);
  }

  // Logs específicos para componentes
  extraction(message, data = null) {
    this.info('EXTRACTION', message, data);
  }

  scheduler(message, data = null) {
    this.info('SCHEDULER', message, data);
  }

  api(message, data = null) {
    this.info('API', message, data);
  }

  antiDetection(message, data = null) {
    this.info('ANTI-DETECTION', message, data);
  }

  // Performance tracking
  startTimer(timerName) {
    this.timers = this.timers || {};
    this.timers[timerName] = performance.now();
  }

  endTimer(timerName, component = 'PERFORMANCE') {
    if (!this.timers || !this.timers[timerName]) return;
    
    const duration = performance.now() - this.timers[timerName];
    this.info(component, `Timer ${timerName} completed`, { 
      duration: `${duration.toFixed(2)}ms` 
    });
    
    delete this.timers[timerName];
    return duration;
  }

  // Persistence para logs críticos
  async persistCriticalLog(logEntry) {
    try {
      const existingLogs = await chrome.storage.local.get(['critical_logs']) || {};
      const criticalLogs = existingLogs.critical_logs || [];
      
      criticalLogs.push(logEntry);
      
      // Manter apenas os últimos 50 logs críticos
      if (criticalLogs.length > 50) {
        criticalLogs.splice(0, criticalLogs.length - 50);
      }
      
      await chrome.storage.local.set({ critical_logs: criticalLogs });
    } catch (error) {
      console.error('Failed to persist critical log:', error);
    }
  }

  // Obter histórico de logs
  getLogHistory(component = null, level = null) {
    let logs = [...this.logHistory];
    
    if (component) {
      logs = logs.filter(log => log.component === component);
    }
    
    if (level) {
      const levelNum = typeof level === 'string' ? this.levels[level.toUpperCase()] : level;
      logs = logs.filter(log => this.levels[log.level] >= levelNum);
    }
    
    return logs;
  }

  // Estatísticas de logs
  getLogStats() {
    const stats = {};
    
    this.logHistory.forEach(log => {
      stats[log.level] = (stats[log.level] || 0) + 1;
    });
    
    return {
      total: this.logHistory.length,
      byLevel: stats,
      sessionId: this.context.sessionId,
      uptime: Date.now() - parseInt(this.context.sessionId.split('_')[1])
    };
  }

  // Limpar logs
  clearHistory() {
    this.logHistory = [];
  }

  // Export logs para debugging
  exportLogs() {
    return {
      context: this.context,
      stats: this.getLogStats(),
      history: this.logHistory,
      exportedAt: new Date().toISOString()
    };
  }
}

// Singleton instance
const logger = new Logger();

// Export para uso global
if (typeof module !== 'undefined' && module.exports) {
  module.exports = logger;
} else if (typeof window !== 'undefined') {
  window.VendaBoostLogger = logger;
}

// Para uso em background scripts
if (typeof chrome !== 'undefined' && chrome.runtime) {
  globalThis.logger = logger;
}