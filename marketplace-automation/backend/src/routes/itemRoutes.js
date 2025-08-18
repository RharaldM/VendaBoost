const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ItemController = require('../controllers/itemController');

// Create an instance of ItemController
const itemController = new ItemController();

const router = express.Router();

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    
    // Criar diretório se não existir
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Gerar nome único para o arquivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `item-${uniqueSuffix}${extension}`);
  }
});

// Filtro para tipos de arquivo permitidos
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não permitido. Apenas JPEG, PNG e WebP são aceitos.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB por arquivo
    files: 10 // Máximo 10 arquivos
  }
});

// Middleware para tratamento de erros do multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    const logManager = global.logManager;
    
    let message = 'Erro no upload de arquivo';
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'Arquivo muito grande. Máximo 5MB por arquivo.';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Muitos arquivos. Máximo 10 arquivos.';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = 'Campo de arquivo inesperado.';
        break;
      default:
        message = error.message;
    }
    
    if (logManager) {
      logManager.addLog('error', '❌ Erro no upload', { error: message });
    }
    
    return res.status(400).json({
      success: false,
      error: message
    });
  }
  
  if (error.message.includes('Tipo de arquivo não permitido')) {
    const logManager = global.logManager;
    if (logManager) {
      logManager.addLog('error', '❌ Tipo de arquivo inválido', { error: error.message });
    }
    
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
  
  next(error);
};

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
 * @route POST /api/items/schedule
 * @desc Agenda um item para publicação no Marketplace
 * @access Public
 */
router.post('/schedule', 
  upload.array('photos', 10),
  handleMulterError,
  itemController.scheduleItem
);

/**
 * @route GET /api/items/status
 * @desc Obtém o status da automação
 * @access Public
 */
router.get('/status', itemController.getAutomationStatus);

/**
 * @route POST /api/items/cancel
 * @desc Cancela a automação em execução
 * @access Public
 */
router.post('/cancel', itemController.cancelAutomation);

/**
 * @route GET /api/items/test
 * @desc Endpoint de teste para verificar se as rotas estão funcionando
 * @access Public
 */
router.get('/test', (req, res) => {
  const logManager = global.logManager;
  
  if (logManager) {
    logManager.addLog('info', '🧪 Endpoint de teste acessado');
  }
  
  res.json({
    success: true,
    message: 'Rotas de itens funcionando corretamente',
    timestamp: new Date().toISOString(),
    endpoints: {
      schedule: 'POST /api/items/schedule',
      status: 'GET /api/items/status',
      cancel: 'POST /api/items/cancel',
      test: 'GET /api/items/test'
    }
  });
});

module.exports = router;