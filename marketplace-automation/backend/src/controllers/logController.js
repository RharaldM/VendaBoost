/**
 * Controller para operações de logs
 */
class LogController {
  /**
   * Obtém todos os logs
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getLogs(req, res) {
    try {
      const logManager = global.logManager;
      const { level, limit, offset } = req.query;
      
      let logs = logManager.getLogs();
      
      // Filtrar por nível se especificado
      if (level) {
        logs = logManager.getLogsByLevel(level);
      }
      
      // Aplicar paginação
      const startIndex = parseInt(offset) || 0;
      const endIndex = limit ? startIndex + parseInt(limit) : logs.length;
      const paginatedLogs = logs.slice(startIndex, endIndex);
      
      res.json({
        success: true,
        data: {
          logs: paginatedLogs,
          total: logs.length,
          offset: startIndex,
          limit: limit ? parseInt(limit) : logs.length,
          stats: logManager.getLogStats()
        }
      });
      
    } catch (error) {
      const logManager = global.logManager;
      logManager.addLog('error', '❌ Erro ao obter logs', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Limpa todos os logs
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async clearLogs(req, res) {
    try {
      const logManager = global.logManager;
      const socketService = global.socketService;
      
      const previousCount = logManager.getLogs().length;
      logManager.clearLogs();
      
      logManager.addLog('info', `🧹 Logs limpos (${previousCount} entradas removidas)`);
      
      res.json({
        success: true,
        message: `${previousCount} logs foram limpos com sucesso`,
        data: {
          clearedCount: previousCount,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      const logManager = global.logManager;
      logManager.addLog('error', '❌ Erro ao limpar logs', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Obtém estatísticas dos logs
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getLogStats(req, res) {
    try {
      const logManager = global.logManager;
      const socketService = global.socketService;
      
      const stats = logManager.getLogStats();
      const connectedClients = socketService.getClientCount();
      
      res.json({
        success: true,
        data: {
          ...stats,
          connectedClients,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      const logManager = global.logManager;
      logManager.addLog('error', '❌ Erro ao obter estatísticas', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Obtém logs por período
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getLogsByDateRange(req, res) {
    try {
      const logManager = global.logManager;
      const { startDate, endDate } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'startDate e endDate são obrigatórios'
        });
      }
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Datas inválidas'
        });
      }
      
      const logs = logManager.getLogsByDateRange(start, end);
      
      res.json({
        success: true,
        data: {
          logs,
          total: logs.length,
          startDate: start.toISOString(),
          endDate: end.toISOString()
        }
      });
      
    } catch (error) {
      const logManager = global.logManager;
      logManager.addLog('error', '❌ Erro ao obter logs por período', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Exporta logs em formato JSON
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async exportLogs(req, res) {
    try {
      const logManager = global.logManager;
      const { level, startDate, endDate } = req.query;
      
      let logs = logManager.getLogs();
      
      // Filtrar por nível se especificado
      if (level) {
        logs = logManager.getLogsByLevel(level);
      }
      
      // Filtrar por período se especificado
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        logs = logManager.getLogsByDateRange(start, end);
      }
      
      const exportData = {
        exportedAt: new Date().toISOString(),
        totalLogs: logs.length,
        filters: { level, startDate, endDate },
        logs
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="logs-${new Date().toISOString().split('T')[0]}.json"`);
      
      res.json(exportData);
      
      logManager.addLog('info', `📤 Logs exportados (${logs.length} entradas)`);
      
    } catch (error) {
      const logManager = global.logManager;
      logManager.addLog('error', '❌ Erro ao exportar logs', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Adiciona um log manualmente (para testes)
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async addLog(req, res) {
    try {
      const logManager = global.logManager;
      const { level, message, data } = req.body;
      
      if (!level || !message) {
        return res.status(400).json({
          success: false,
          error: 'level e message são obrigatórios'
        });
      }
      
      const validLevels = ['info', 'warning', 'error', 'success'];
      if (!validLevels.includes(level)) {
        return res.status(400).json({
          success: false,
          error: 'level deve ser um dos seguintes: ' + validLevels.join(', ')
        });
      }
      
      const logEntry = logManager.addLog(level, message, data);
      
      res.json({
        success: true,
        message: 'Log adicionado com sucesso',
        data: logEntry
      });
      
    } catch (error) {
      const logManager = global.logManager;
      logManager.addLog('error', '❌ Erro ao adicionar log', { error: error.message });
      
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
}

module.exports = new LogController();