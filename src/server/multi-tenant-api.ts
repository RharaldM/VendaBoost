import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { info, warn, error } from '../logger.js';
import { validateSessionData, saveSessionData } from '../utils/sessionHandler.js';
import { convertExtensionSessionToPlaywright } from '../utils/extensionSessionConverter.js';
import { VendaBoostAutomation } from '../index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Token']
}));
app.use(express.json({ limit: '10mb' }));

// Banco de dados em memória (em produção, use PostgreSQL/MongoDB)
interface UserSession {
  userId: string;
  userToken: string;
  facebookId: string;
  facebookName: string;
  sessionData: any;
  lastUpdate: string;
  automationStatus: 'idle' | 'running' | 'completed' | 'error';
  automationQueue: any[];
}

const userSessions = new Map<string, UserSession>();
const activeAutomations = new Map<string, any>();

/**
 * Middleware para autenticação do usuário
 */
async function authenticateUser(req: any, res: any, next: any): Promise<void> {
  const userToken = req.headers['x-user-token'];
  
  if (!userToken) {
    return res.status(401).json({ 
      success: false, 
      error: 'Token de usuário não fornecido' 
    });
  }
  
  // Verificar se o token existe
  const session = Array.from(userSessions.values())
    .find(s => s.userToken === userToken);
  
  if (!session) {
    return res.status(401).json({ 
      success: false, 
      error: 'Token inválido ou sessão expirada' 
    });
  }
  
  req.userSession = session;
  next();
}

/**
 * 1. REGISTRO DE NOVO USUÁRIO
 * Quando alguém se cadastra no seu site
 */
app.post('/api/users/register', async (req: any, res: any): Promise<void> => {
  try {
    const { email, name } = req.body;
    
    // Gerar token único para o usuário
    const userToken = crypto.randomBytes(32).toString('hex');
    const userId = crypto.randomBytes(16).toString('hex');
    
    // Criar sessão vazia para o usuário
    const newSession: UserSession = {
      userId,
      userToken,
      facebookId: '',
      facebookName: '',
      sessionData: null,
      lastUpdate: new Date().toISOString(),
      automationStatus: 'idle',
      automationQueue: []
    };
    
    userSessions.set(userId, newSession);
    
    // Retornar token para o usuário salvar na extensão
    return res.json({
      success: true,
      userId,
      userToken,
      extensionConfig: {
        serverUrl: `${req.protocol}://${req.get('host')}`,
        endpoint: '/api/extension/session',
        headers: {
          'X-User-Token': userToken
        }
      },
      message: 'Usuário registrado. Configure a extensão com o token fornecido.'
    });
    
  } catch (err) {
    error('Erro ao registrar usuário:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro ao registrar usuário' 
    });
  }
});

/**
 * 2. RECEBER DADOS DA EXTENSÃO
 * A extensão envia os dados do Facebook aqui
 */
app.post('/api/extension/session', authenticateUser, async (req: any, res: any): Promise<void> => {
  try {
    const userSession = req.userSession as UserSession;
    const sessionData = req.body;
    
    info(`📥 Dados recebidos do usuário ${userSession.userId} (Facebook: ${sessionData.userInfo?.name})`);
    
    // Validar dados da sessão
    const validation = validateSessionData(sessionData);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Dados de sessão inválidos',
        details: validation.errors
      });
    }
    
    // Atualizar sessão do usuário
    userSession.facebookId = sessionData.userId;
    userSession.facebookName = sessionData.userInfo?.name || '';
    userSession.sessionData = sessionData;
    userSession.lastUpdate = new Date().toISOString();
    
    // Salvar em arquivo individual para o usuário
    const userDir = path.join('data', 'users', userSession.userId);
    await fs.mkdir(userDir, { recursive: true });
    
    const sessionFile = path.join(userDir, 'facebook-session.json');
    await fs.writeFile(sessionFile, JSON.stringify(sessionData, null, 2));
    
    // Converter para formato Playwright
    const playwrightFile = path.join(userDir, 'playwright-session.json');
    await convertExtensionSessionToPlaywright(sessionFile, playwrightFile);
    
    info(`✅ Sessão salva para usuário ${userSession.userId}`);
    
    return res.json({
      success: true,
      message: 'Sessão do Facebook atualizada com sucesso',
      userData: {
        userId: userSession.userId,
        facebookId: userSession.facebookId,
        facebookName: userSession.facebookName,
        lastUpdate: userSession.lastUpdate
      }
    });
    
  } catch (err) {
    error('Erro ao processar sessão:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro ao processar sessão' 
    });
  }
});

/**
 * 3. CRIAR AUTOMAÇÃO
 * Usuário solicita uma automação no site
 */
app.post('/api/automation/create', authenticateUser, async (req: any, res: any): Promise<void> => {
  try {
    const userSession = req.userSession as UserSession;
    const { flowData, groupNames } = req.body;
    
    // Verificar se usuário tem sessão do Facebook
    if (!userSession.sessionData) {
      return res.status(400).json({
        success: false,
        error: 'Você precisa conectar sua conta do Facebook primeiro'
      });
    }
    
    // Verificar se já tem automação rodando
    if (userSession.automationStatus === 'running') {
      return res.status(400).json({
        success: false,
        error: 'Você já tem uma automação em andamento'
      });
    }
    
    // Adicionar à fila
    const automationId = crypto.randomBytes(16).toString('hex');
    const automation = {
      id: automationId,
      userId: userSession.userId,
      flowData,
      groupNames: groupNames || [],
      status: 'queued',
      createdAt: new Date().toISOString()
    };
    
    userSession.automationQueue.push(automation);
    
    // Processar automação em background
    processUserAutomation(userSession, automation);
    
    return res.json({
      success: true,
      automationId,
      message: 'Automação criada e adicionada à fila',
      position: userSession.automationQueue.length
    });
    
  } catch (err) {
    error('Erro ao criar automação:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro ao criar automação' 
    });
  }
});

/**
 * 4. STATUS DA AUTOMAÇÃO
 * Verificar o progresso da automação
 */
app.get('/api/automation/status/:automationId', authenticateUser, async (req: any, res: any): Promise<void> => {
  try {
    const userSession = req.userSession as UserSession;
    const { automationId } = req.params;
    
    // Buscar automação
    const automation = userSession.automationQueue.find(a => a.id === automationId);
    
    if (!automation) {
      return res.status(404).json({
        success: false,
        error: 'Automação não encontrada'
      });
    }
    
    return res.json({
      success: true,
      automation: {
        id: automation.id,
        status: automation.status,
        createdAt: automation.createdAt,
        completedAt: automation.completedAt,
        result: automation.result
      }
    });
    
  } catch (err) {
    error('Erro ao buscar status:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar status' 
    });
  }
});

/**
 * 5. HISTÓRICO DO USUÁRIO
 */
app.get('/api/user/history', authenticateUser, async (req: any, res: any): Promise<void> => {
  try {
    const userSession = req.userSession as UserSession;
    
    return res.json({
      success: true,
      userData: {
        userId: userSession.userId,
        facebookId: userSession.facebookId,
        facebookName: userSession.facebookName,
        lastSessionUpdate: userSession.lastUpdate,
        automationStatus: userSession.automationStatus,
        totalAutomations: userSession.automationQueue.length,
        recentAutomations: userSession.automationQueue.slice(-10)
      }
    });
    
  } catch (err) {
    error('Erro ao buscar histórico:', err);
    return res.status(500).json({ 
      success: false, 
      error: 'Erro ao buscar histórico' 
    });
  }
});

/**
 * Processar automação do usuário (em background)
 */
async function processUserAutomation(userSession: UserSession, automation: any) {
  try {
    // Marcar como rodando
    userSession.automationStatus = 'running';
    automation.status = 'running';
    
    info(`🤖 Iniciando automação ${automation.id} para usuário ${userSession.userId}`);
    
    // Carregar sessão do usuário
    const userDir = path.join('data', 'users', userSession.userId);
    const sessionFile = path.join(userDir, 'playwright-session.json');
    
    // Criar instância isolada da automação
    const vendaBoost = new VendaBoostAutomation();
    
    // Configurar para usar a sessão específica do usuário
    const result = await vendaBoost.runFlow({
      flowData: automation.flowData,
      groupNames: automation.groupNames,
      config: {
        extensionSession: sessionFile,
        headless: true, // Sempre headless no servidor
        throttleMs: 500
      }
    });
    
    // Salvar resultado
    automation.status = result.success ? 'completed' : 'error';
    automation.completedAt = new Date().toISOString();
    automation.result = result;
    
    userSession.automationStatus = 'idle';
    
    info(`✅ Automação ${automation.id} concluída para usuário ${userSession.userId}`);
    
    // Notificar usuário (webhook, email, etc)
    await notifyUser(userSession, automation);
    
  } catch (err) {
    error(`Erro na automação ${automation.id}:`, err);
    automation.status = 'error';
    automation.error = err instanceof Error ? err.message : 'Erro desconhecido';
    userSession.automationStatus = 'idle';
  }
}

/**
 * Notificar usuário sobre conclusão
 */
async function notifyUser(userSession: UserSession, automation: any) {
  // Implementar:
  // - Envio de email
  // - Webhook
  // - Push notification
  // - WebSocket em tempo real
  info(`📧 Notificando usuário ${userSession.userId} sobre automação ${automation.id}`);
}

/**
 * Limpar sessões antigas (executar periodicamente)
 */
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 dias
  
  for (const [userId, session] of userSessions.entries()) {
    const sessionAge = now - new Date(session.lastUpdate).getTime();
    if (sessionAge > maxAge) {
      userSessions.delete(userId);
      info(`🗑️ Sessão expirada removida: ${userId}`);
    }
  }
}, 24 * 60 * 60 * 1000); // Executar diariamente

// Iniciar servidor
app.listen(PORT, () => {
  info(`🚀 API Multi-tenant rodando na porta ${PORT}`);
  info(`📦 Endpoints disponíveis:`);
  info(`  - POST /api/users/register`);
  info(`  - POST /api/extension/session`);
  info(`  - POST /api/automation/create`);
  info(`  - GET  /api/automation/status/:id`);
  info(`  - GET  /api/user/history`);
});

export default app;