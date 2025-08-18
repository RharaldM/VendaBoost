require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Import routes
const itemRoutes = require('./routes/itemRoutes');
const logRoutes = require('./routes/logRoutes');
const healthRoutes = require('./routes/healthRoutes');

// Import services
const LogManager = require('./services/LogManager');
const SocketService = require('./services/SocketService');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const port = process.env.PORT || 7849;

// Initialize services
const logManager = new LogManager();
const socketService = new SocketService(io, logManager);

// Make services available globally
global.logManager = logManager;
global.socketService = socketService;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../../../')));

// Initialize Socket.IO
socketService.initialize();

// Routes
app.get('/', (req, res) => {
  res.send('Olá! Este é o servidor para automação de Marketplace do Facebook.');
});

app.use('/api/items', itemRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/health', healthRoutes);

// Error handling middleware
app.use((error, req, res, next) => {
  logManager.addLog('error', 'Erro não tratado', { 
    error: error.message, 
    stack: error.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(500).json({
    success: false,
    error: 'Erro interno do servidor',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint não encontrado'
  });
});

server.listen(port, () => {
  logManager.addLog('info', `🚀 Servidor rodando em http://localhost:${port}`);
  logManager.addLog('info', `📝 Endpoint principal: POST http://localhost:${port}/api/items/schedule`);
  logManager.addLog('info', `❤️  Health check: GET http://localhost:${port}/health`);
  logManager.addLog('info', `🔌 WebSocket ativo para logs em tempo real`);
});

module.exports = { app, server, io };