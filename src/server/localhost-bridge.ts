import express from 'express';
import cors from 'cors';
import { info, warn, error, debug } from '../logger.js';
import { SessionData, SessionListResponse, SessionSelectRequest, SessionSelectResponse } from '../types/session.js';
import { 
  saveSessionData, 
  validateSessionData, 
  getAllSessions, 
  getActiveSessionId, 
  setActiveSessionId, 
  loadSessionById,
  getActiveSession
} from '../utils/sessionHandler.js';
import { startAutomation } from '../automation/controller.js';

const app = express();
const PORT = 3000;

// Middleware - Allow all origins for development
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Handle preflight requests
app.options('/api/facebook-session', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.sendStatus(204);
});

// Main endpoint to receive Facebook session data from extension
app.post('/api/facebook-session', async (req, res) => {
  // Set CORS headers explicitly
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  try {
    const sessionData: SessionData = req.body;
    
    info('📥 Dados de sessão recebidos da extensão', {
      userId: sessionData.userId,
      cookiesCount: sessionData.cookies?.length || 0,
      timestamp: new Date().toISOString()
    });

    // Validate session data
    const validation = validateSessionData(sessionData);
    if (!validation.isValid) {
      error('❌ Dados de sessão inválidos:', validation.errors);
      return res.status(400).json({
        success: false,
        error: 'Dados de sessão inválidos',
        details: validation.errors
      });
    }

    // Save session data locally (returns true if actually saved)
    const wasSaved = await saveSessionData(sessionData);
    
    if (wasSaved) {
      info('✅ Dados de sessão salvos com sucesso');
    } else {
      info('ℹ️ Sessão não alterada - dados já atualizados');
    }

    return res.json({
      success: true,
      message: 'Sessão recebida e salva com sucesso',
      userId: sessionData.userId
    });

  } catch (err) {
    error('❌ Erro no servidor localhost:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  }
});

// Session management endpoints

// GET /api/sessions - List all available sessions
app.get('/api/sessions', async (req, res) => {
  try {
    info('📋 Requisição para listar sessões disponíveis');
    
    const sessions = await getAllSessions();
    const activeSessionId = await getActiveSessionId();
    
    const response: SessionListResponse = {
      success: true,
      sessions,
      activeSessionId: activeSessionId
    };
    
    info(`✅ Retornando ${sessions.length} sessões disponíveis`);
    return res.json(response);
    
  } catch (err) {
    error('❌ Erro ao listar sessões:', err);
    return res.status(500).json({
      success: false,
      sessions: [],
      error: 'Erro interno do servidor'
    });
  }
});

// GET /api/sessions/active - Get currently active session info
app.get('/api/sessions/active', async (req, res) => {
  try {
    info('🔍 Requisição para obter sessão ativa');
    
    const activeSessionId = await getActiveSessionId();
    
    if (!activeSessionId) {
      return res.json({
        success: true,
        message: 'Nenhuma sessão ativa selecionada',
        activeSession: undefined
      });
    }
    
    const sessions = await getAllSessions();
    const activeSession = sessions.find(s => s.id === activeSessionId);
    
    if (!activeSession) {
      return res.status(404).json({
        success: false,
        message: 'Sessão ativa não encontrada',
        activeSession: undefined
      });
    }
    
    info(`✅ Sessão ativa: ${activeSession.userName} (${activeSession.userId})`);
    return res.json({
      success: true,
      activeSession,
      message: 'Sessão ativa obtida com sucesso'
    });
    
  } catch (err) {
    error('❌ Erro ao obter sessão ativa:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /api/sessions/select - Select active session
app.post('/api/sessions/select', async (req, res) => {
  try {
    const { sessionId }: SessionSelectRequest = req.body;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'sessionId é obrigatório'
      });
    }
    
    info(`🎯 Requisição para selecionar sessão: ${sessionId}`);
    
    // Verify session exists and is valid
    const sessionData = await loadSessionById(sessionId);
    if (!sessionData) {
      return res.status(404).json({
        success: false,
        message: 'Sessão não encontrada ou inválida',
        activeSession: undefined
      });
    }
    
    // Set as active session
    await setActiveSessionId(sessionId);
    
    // Get updated session info
    const sessions = await getAllSessions();
    const activeSession = sessions.find(s => s.id === sessionId);
    
    const response: SessionSelectResponse = {
      success: true,
      message: `Sessão ativa alterada para: ${sessionData.userInfo?.name || sessionId}`,
      activeSession: activeSession!
    };
    
    info(`✅ Sessão ativa definida: ${sessionData.userInfo?.name} (${sessionData.userId})`);
    return res.json(response);
    
  } catch (err) {
    error('❌ Erro ao selecionar sessão:', err);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: err instanceof Error ? err.message : 'Erro desconhecido',
      activeSession: undefined
    });
  }
});

// Endpoint to start automation manually
app.post('/api/automation/start', async (req, res) => {
  try {
    info('🚀 Requisição para iniciar automação manual');
    
    // Get active session
    const sessionData = await getActiveSession();
    if (!sessionData) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma sessão ativa encontrada',
        message: 'Selecione uma sessão primeiro'
      });
    }

    // Start automation with active session
    const automationResult = await startAutomation(sessionData);
    
    if (automationResult.success) {
      info('✅ Automação iniciada com sucesso');
      return res.json({
        success: true,
        message: 'Automação iniciada com sucesso',
        automationId: automationResult.id,
        userId: sessionData.userId
      });
    } else {
      error('❌ Falha ao iniciar automação:', automationResult.error);
      return res.status(500).json({
        success: false,
        error: 'Falha ao iniciar automação',
        details: automationResult.error
      });
    }

  } catch (err) {
    error('❌ Erro ao iniciar automação:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  }
});

// Endpoint to get automation status
app.get('/api/automation/status/:id', (req, res) => {
  const { id } = req.params;
  // TODO: Implement automation status tracking
  res.json({ id, status: 'running', message: 'Status tracking em desenvolvimento' });
});

// Start server
export function startLocalhostBridge(): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, 'localhost', () => {
      info(`🌐 Servidor localhost bridge iniciado na porta ${PORT}`);
      info(`📡 Aguardando dados da extensão em http://localhost:${PORT}/api/facebook-session`);
      resolve();
    });

    server.on('error', (err) => {
      if ((err as any).code === 'EADDRINUSE') {
        error(`❌ Porta ${PORT} já está em uso. Tentando porta alternativa...`);
        // Try alternative port
        const altServer = app.listen(3001, 'localhost', () => {
          info(`🌐 Servidor localhost bridge iniciado na porta 3001`);
          resolve();
        });
        altServer.on('error', reject);
      } else {
        reject(err);
      }
    });
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  info('🛑 Encerrando servidor localhost bridge...');
  process.exit(0);
});

process.on('SIGINT', () => {
  info('🛑 Encerrando servidor localhost bridge...');
  process.exit(0);
});