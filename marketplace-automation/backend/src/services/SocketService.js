/**
 * SocketService - Gerencia conexões Socket.IO e eventos em tempo real
 */
class SocketService {
  constructor(io, logManager) {
    this.io = io;
    this.logManager = logManager;
    this.connectedClients = new Map();
  }

  /**
   * Inicializa os event listeners do Socket.IO
   */
  initialize() {
    // Configurar LogManager para usar Socket.IO
    this.logManager.setSocketIO(this.io);

    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Manipula nova conexão de cliente
   * @param {Object} socket - Socket do cliente
   */
  handleConnection(socket) {
    const clientInfo = {
      id: socket.id,
      connectedAt: new Date().toISOString(),
      userAgent: socket.handshake.headers['user-agent'] || 'Unknown'
    };

    this.connectedClients.set(socket.id, clientInfo);
    this.logManager.addLog('info', `Cliente conectado: ${socket.id}`);
    
    // Enviar logs existentes para o novo cliente
    socket.emit('logs-history', this.logManager.getLogs());
    
    // Enviar estatísticas dos logs
    socket.emit('log-stats', this.logManager.getLogStats());

    // Event listeners para este socket
    this.setupSocketEvents(socket);
  }

  /**
   * Configura event listeners para um socket específico
   * @param {Object} socket - Socket do cliente
   */
  setupSocketEvents(socket) {
    // Evento de desconexão
    socket.on('disconnect', () => {
      this.connectedClients.delete(socket.id);
      this.logManager.addLog('info', `Cliente desconectado: ${socket.id}`);
    });
    
    // Permitir que o cliente limpe os logs
    socket.on('clear-logs', () => {
      this.logManager.clearLogs();
      this.logManager.addLog('info', 'Logs limpos pelo usuário', { clientId: socket.id });
      
      // Enviar estatísticas atualizadas
      this.io.emit('log-stats', this.logManager.getLogStats());
    });

    // Solicitar estatísticas dos logs
    socket.on('get-log-stats', () => {
      socket.emit('log-stats', this.logManager.getLogStats());
    });

    // Solicitar histórico de logs
    socket.on('get-logs-history', () => {
      socket.emit('logs-history', this.logManager.getLogs());
    });

    // Solicitar logs por nível
    socket.on('get-logs-by-level', (level) => {
      const logs = this.logManager.getLogsByLevel(level);
      socket.emit('logs-by-level', logs);
    });

    // Solicitar informações de clientes conectados (apenas para admins)
    socket.on('get-connected-clients', () => {
      const clients = Array.from(this.connectedClients.values());
      socket.emit('connected-clients', clients);
    });

    // Ping/Pong para manter conexão ativa
    socket.on('ping', () => {
      socket.emit('pong');
    });
  }

  /**
   * Emite um evento para todos os clientes conectados
   * @param {string} event - Nome do evento
   * @param {*} data - Dados a serem enviados
   */
  broadcast(event, data) {
    this.io.emit(event, data);
  }

  /**
   * Emite um evento para um cliente específico
   * @param {string} socketId - ID do socket
   * @param {string} event - Nome do evento
   * @param {*} data - Dados a serem enviados
   */
  emitToClient(socketId, event, data) {
    this.io.to(socketId).emit(event, data);
  }

  /**
   * Retorna informações sobre clientes conectados
   * @returns {Array} Array com informações dos clientes
   */
  getConnectedClients() {
    return Array.from(this.connectedClients.values());
  }

  /**
   * Retorna o número de clientes conectados
   * @returns {number} Número de clientes conectados
   */
  getClientCount() {
    return this.connectedClients.size;
  }

  /**
   * Desconecta um cliente específico
   * @param {string} socketId - ID do socket a ser desconectado
   */
  disconnectClient(socketId) {
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.disconnect(true);
      this.logManager.addLog('info', `Cliente desconectado forçadamente: ${socketId}`);
    }
  }
}

module.exports = SocketService;