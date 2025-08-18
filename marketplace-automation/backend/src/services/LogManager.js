/**
 * LogManager - Sistema de logs global com suporte a Socket.IO
 */
class LogManager {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
    this.io = null;
  }

  /**
   * Define a instância do Socket.IO para emitir logs
   * @param {Object} io - Instância do Socket.IO
   */
  setSocketIO(io) {
    this.io = io;
  }

  /**
   * Adiciona um novo log
   * @param {string} level - Nível do log (info, warning, error, success)
   * @param {string} message - Mensagem do log
   * @param {Object} data - Dados adicionais (opcional)
   */
  addLog(level, message, data = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    };
    
    this.logs.push(logEntry);
    
    // Manter apenas os últimos logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // Enviar para todos os clientes conectados via Socket.IO
    if (this.io) {
      this.io.emit('log-entry', logEntry);
    }
    
    // Log no console também
    console.log(`[${level.toUpperCase()}] ${message}`, data || '');
    
    return logEntry;
  }

  /**
   * Retorna todos os logs
   * @returns {Array} Array de logs
   */
  getLogs() {
    return this.logs;
  }

  /**
   * Limpa todos os logs
   */
  clearLogs() {
    this.logs = [];
    
    // Notificar clientes via Socket.IO
    if (this.io) {
      this.io.emit('logs-cleared');
    }
  }

  /**
   * Retorna logs filtrados por nível
   * @param {string} level - Nível do log para filtrar
   * @returns {Array} Array de logs filtrados
   */
  getLogsByLevel(level) {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Retorna logs de um período específico
   * @param {Date} startDate - Data de início
   * @param {Date} endDate - Data de fim
   * @returns {Array} Array de logs do período
   */
  getLogsByDateRange(startDate, endDate) {
    return this.logs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= startDate && logDate <= endDate;
    });
  }

  /**
   * Retorna estatísticas dos logs
   * @returns {Object} Objeto com estatísticas
   */
  getLogStats() {
    const stats = {
      total: this.logs.length,
      info: 0,
      warning: 0,
      error: 0,
      success: 0
    };

    this.logs.forEach(log => {
      if (stats.hasOwnProperty(log.level)) {
        stats[log.level]++;
      }
    });

    return stats;
  }
}

module.exports = LogManager;