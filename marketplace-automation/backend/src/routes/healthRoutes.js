const express = require('express');
const healthController = require('../controllers/healthController');

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
 * @route GET /health
 * @desc Verificação básica de saúde do sistema
 * @access Public
 */
router.get('/', healthController.checkBasicHealth);

/**
 * @route GET /health/detailed
 * @desc Verificação detalhada de saúde do sistema
 * @access Public
 */
router.get('/detailed', healthController.checkHealth);

/**
 * @route GET /health/system
 * @desc Informações do sistema
 * @access Public
 */
router.get('/system', healthController.getSystemInfo);

/**
 * @route GET /health/memory
 * @desc Informações de memória
 * @access Public
 */
router.get('/memory', healthController.getMemoryInfo);

/**
 * @route GET /health/puppeteer
 * @desc Verificação de saúde do Puppeteer
 * @access Public
 */
router.get('/puppeteer', healthController.checkPuppeteerHealth);

/**
 * @route GET /health/storage
 * @desc Verificação de saúde do armazenamento
 * @access Public
 */
router.get('/storage', healthController.checkStorageHealth);

/**
 * @route GET /health/dependencies
 * @desc Verificação de dependências
 * @access Public
 */
router.get('/dependencies', healthController.checkDependencies);

/**
 * @route GET /health/metrics
 * @desc Métricas detalhadas do sistema
 * @access Public
 */
router.get('/metrics', healthController.getSystemMetrics);

/**
 * @route GET /health/test
 * @desc Endpoint de teste para verificar se as rotas estão funcionando
 * @access Public
 */
router.get('/test', (req, res) => {
  const logManager = global.logManager;
  
  if (logManager) {
    logManager.addLog('info', '🧪 Endpoint de teste de health acessado');
  }
  
  res.json({
    success: true,
    message: 'Rotas de health funcionando corretamente',
    timestamp: new Date().toISOString(),
    endpoints: {
      basic: 'GET /health',
      detailed: 'GET /health/detailed',
      system: 'GET /health/system',
      memory: 'GET /health/memory',
      puppeteer: 'GET /health/puppeteer',
      storage: 'GET /health/storage',
      dependencies: 'GET /health/dependencies',
      metrics: 'GET /health/metrics',
      test: 'GET /health/test'
    }
  });
});

module.exports = router;