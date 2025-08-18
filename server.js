require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { postMarketplaceItem } = require('./automation.js');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const port = process.env.PORT || 3000;

// Sistema de logs global
class LogManager {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
  }

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
    
    // Enviar para todos os clientes conectados
    io.emit('log', logEntry);
    
    // Log no console também
    console.log(`[${level.toUpperCase()}] ${message}`, data || '');
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
    io.emit('logs-cleared');
  }
}

const logManager = new LogManager();

// Tornar o logManager disponível globalmente
global.logManager = logManager;

// Middleware para parsing de JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname)));

// Configuração do Socket.IO
io.on('connection', (socket) => {
  logManager.addLog('info', `Cliente conectado: ${socket.id}`);
  
  // Enviar logs existentes para o novo cliente
  socket.emit('logs-history', logManager.getLogs());
  
  socket.on('disconnect', () => {
    logManager.addLog('info', `Cliente desconectado: ${socket.id}`);
  });
  
  // Permitir que o cliente limpe os logs
  socket.on('clear-logs', () => {
    logManager.clearLogs();
    logManager.addLog('info', 'Logs limpos pelo usuário');
  });
});

// Endpoint básico
app.get('/', (req, res) => {
  res.send('Olá! Este é o servidor para automação de Marketplace do Facebook.');
});

// Endpoint para obter logs
app.get('/api/logs', (req, res) => {
  res.json({
    success: true,
    logs: logManager.getLogs()
  });
});

// Endpoint para limpar logs
app.post('/api/logs/clear', (req, res) => {
  logManager.clearLogs();
  res.json({
    success: true,
    message: 'Logs limpos com sucesso'
  });
});

// Endpoint para agendar publicação de item
app.post('/schedule-item', async (req, res) => {
  logManager.addLog('info', 'Recebida solicitação para publicar item', req.body);
  
  try {
    // Validação dos dados obrigatórios
    const { title, price, description, photoPath, location } = req.body;
    
    if (!title || !price || !description || !photoPath) {
      logManager.addLog('error', 'Dados obrigatórios faltando', { received: req.body });
      return res.status(400).json({
        success: false,
        error: 'Dados obrigatórios faltando. Necessário: title, price, description, photoPath'
      });
    }
    
    // Validação de tipos
    if (typeof title !== 'string' || typeof description !== 'string' || typeof photoPath !== 'string') {
      logManager.addLog('error', 'Tipos de dados inválidos', { title: typeof title, description: typeof description, photoPath: typeof photoPath });
      return res.status(400).json({
        success: false,
        error: 'title, description e photoPath devem ser strings'
      });
    }
    
    if (typeof price !== 'number' && isNaN(parseFloat(price))) {
      logManager.addLog('error', 'Preço inválido', { price, type: typeof price });
      return res.status(400).json({
        success: false,
        error: 'price deve ser um número válido'
      });
    }
    
    // Preparar dados do item
    const itemData = {
      title: title.trim(),
      price: parseFloat(price),
      description: description.trim(),
      photoPath: photoPath.trim(),
      location: location || 'Sinop' // valor padrão
    };
    
    logManager.addLog('success', 'Dados validados, iniciando automação', itemData);
    
    // Resposta imediata para o cliente
    res.status(200).json({
      success: true,
      message: 'Automação iniciada com sucesso! O item será publicado em breve.',
      itemData: itemData
    });
    
    // Executar automação de forma assíncrona (não bloqueia a resposta)
    setImmediate(async () => {
      try {
        logManager.addLog('info', 'Iniciando processo de automação...', { title: itemData.title });
        await postMarketplaceItem(itemData);
        logManager.addLog('success', 'Automação concluída com sucesso', { title: itemData.title });
      } catch (automationError) {
        logManager.addLog('error', 'Erro durante a automação', { 
          error: automationError.message, 
          stack: automationError.stack,
          title: itemData.title 
        });
      }
    });
    
  } catch (error) {
    logManager.addLog('error', 'Erro no endpoint /schedule-item', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
});

// Endpoint para verificar status do servidor
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

server.listen(port, () => {
  logManager.addLog('info', `🚀 Servidor rodando em http://localhost:${port}`);
  logManager.addLog('info', `📝 Endpoint principal: POST http://localhost:${port}/schedule-item`);
  logManager.addLog('info', `❤️  Health check: GET http://localhost:${port}/health`);
  logManager.addLog('info', `🔌 WebSocket ativo para logs em tempo real`);
});