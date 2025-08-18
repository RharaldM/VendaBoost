const express = require('express');
const logController = require('../controllers/logController');

const router = express.Router();

// Middleware de logging para todas as rotas
router.use((req, res, next) => {
  const logManager = global.logManager;
  if (logManager) {
    logManager.addLog('info', `📡 ${req.method} ${req.originalUrl}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  }
  next();
});

/**
 * @route GET /api/logs
 * @desc Obtém todos os logs com opções de filtro e paginação
 * @query {string} level - Filtrar por nível (info, warning, error, success)
 * @query {number} limit - Limite de logs por página
 * @query {number} offset - Offset para paginação
 * @access Public
 */
router.get('/', logController.getLogs);

/**
 * @route DELETE /api/logs
 * @desc Limpa todos os logs
 * @access Public
 */
router.delete('/', logController.clearLogs);

/**
 * @route GET /api/logs/stats
 * @desc Obtém estatísticas dos logs
 * @access Public
 */
router.get('/stats', logController.getLogStats);

/**
 * @route GET /api/logs/range
 * @desc Obtém logs por período
 * @query {string} startDate - Data de início (ISO string)
 * @query {string} endDate - Data de fim (ISO string)
 * @access Public
 */
router.get('/range', logController.getLogsByDateRange);

/**
 * @route GET /api/logs/export
 * @desc Exporta logs em formato JSON
 * @query {string} level - Filtrar por nível (opcional)
 * @query {string} startDate - Data de início (opcional)
 * @query {string} endDate - Data de fim (opcional)
 * @access Public
 */
router.get('/export', logController.exportLogs);

/**
 * @route POST /api/logs
 * @desc Adiciona um log manualmente (para testes)
 * @body {string} level - Nível do log (info, warning, error, success)
 * @body {string} message - Mensagem do log
 * @body {object} data - Dados adicionais (opcional)
 * @access Public
 */
router.post('/', logController.addLog);

/**
 * @route GET /api/logs/test
 * @desc Endpoint de teste para verificar se as rotas estão funcionando
 * @access Public
 */
router.get('/test', (req, res) => {
  const logManager = global.logManager;
  
  if (logManager) {
    logManager.addLog('info', '🧪 Endpoint de teste de logs acessado');
  }
  
  res.json({
    success: true,
    message: 'Rotas de logs funcionando corretamente',
    timestamp: new Date().toISOString(),
    endpoints: {
      getLogs: 'GET /api/logs',
      clearLogs: 'DELETE /api/logs',
      getStats: 'GET /api/logs/stats',
      getRange: 'GET /api/logs/range',
      export: 'GET /api/logs/export',
      addLog: 'POST /api/logs',
      test: 'GET /api/logs/test'
    },
    currentStats: logManager ? logManager.getLogStats() : null
  });
});

module.exports = router;