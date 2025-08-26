import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { info, warn, error, debug, setLogLevel } from '../logger.js';
import { SessionData, SessionListResponse, SessionSelectRequest, SessionSelectResponse } from '../types/session.js';
import { 
  saveSessionData, 
  validateSessionData, 
  getAllSessions, 
  getActiveSessionId, 
  setActiveSessionId, 
  loadSessionById,
  getActiveSession,
  isSessionValid,
  initializeSessionSystem,
  cleanUserName
} from '../utils/sessionHandler.js';
import { VendaBoostAutomation } from '../index.js';

const app = express();
const PORT = parseInt(process.env.BRIDGE_PORT || '49017', 10);

// Event emitter para SSE
const jobEvents = new EventEmitter();

// Configurar multer para upload de imagens
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB por arquivo
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de imagem são permitidos'));
    }
  }
});

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Criar diretório de uploads se não existir
const uploadsDir = path.join(process.cwd(), 'uploads');
fs.mkdir(uploadsDir, { recursive: true }).catch(() => {});

// Tipos para Jobs
interface Job {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  error?: string;
  createdAt: string;
  updatedAt: string;
  fbUserId: string;
  listing: any;
  groups: string[];
}

interface JobEvent {
  event: 'status' | 'log';
  data: any;
}

interface Session {
  fbUserId: string;
  lastUpdated: string;
}

// Armazenamento em memória (em produção usar Redis/PostgreSQL)
const jobs = new Map<string, Job>();
const jobLogs = new Map<string, Array<{msg: string, ts: string}>>();

// GET /healthz → "ok"
app.get('/healthz', (req, res) => {
  res.send('ok');
});

// POST /upload → recebe upload de imagens
app.post('/upload', upload.array('images', 10), (req, res) => {
  try {
    info('📷 [BRIDGE] Recebendo requisição de upload de imagens...');
    const files = req.files as Express.Multer.File[];
    
    info(`📷 [BRIDGE] Arquivos recebidos: ${files ? files.length : 0}`);
    
    if (!files || files.length === 0) {
      warn('📷 [BRIDGE] ❌ Nenhum arquivo enviado na requisição');
      return res.status(400).json({
        success: false,
        error: 'Nenhum arquivo enviado'
      });
    }

    info(`📷 [BRIDGE] Processando ${files.length} arquivos...`);
    
    const uploadedFiles = files.map((file, index) => {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      info(`📷 [BRIDGE] Arquivo ${index + 1}/${files.length}:`);
      info(`📷 [BRIDGE]   - Nome original: ${file.originalname}`);
      info(`📷 [BRIDGE]   - Nome salvo: ${file.filename}`);
      info(`📷 [BRIDGE]   - Caminho: ${file.path}`);
      info(`📷 [BRIDGE]   - Tamanho: ${fileSizeMB} MB`);
      info(`📷 [BRIDGE]   - Tipo: ${file.mimetype}`);
      
      return {
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype
      };
    });

    info(`📷 [BRIDGE] ✅ Upload realizado com sucesso: ${uploadedFiles.length} imagens`);
    info(`📷 [BRIDGE] ✅ Caminhos salvos: ${uploadedFiles.map(f => f.path).join(', ')}`);

    return res.json({
      success: true,
      files: uploadedFiles
    });

  } catch (err) {
    error('📷 [BRIDGE] ❌ Erro crítico no upload:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// POST /session → recebe sessão da extensão e salva localmente
app.post('/session', async (req, res) => {
  try {
    const sessionData: SessionData = req.body;
    
    info('📥 Dados de sessão recebidos da extensão', {
      userId: sessionData.userId,
      cookiesCount: sessionData.cookies?.length || 0
    });

    // Validar dados da sessão
    const validation = validateSessionData(sessionData);
    if (!validation.isValid) {
      error('❌ Dados de sessão inválidos:', validation.errors);
      return res.status(400).json({
        success: false,
        error: 'Dados de sessão inválidos',
        details: validation.errors
      });
    }

    // Salvar dados da sessão
    await saveSessionData(sessionData);
    
    info('✅ Dados de sessão salvos com sucesso');

    return res.json({
      success: true,
      message: 'Sessão salva com sucesso'
    });

  } catch (err) {
    error('❌ Erro ao salvar sessão:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      details: err instanceof Error ? err.message : 'Erro desconhecido'
    });
  }
});

// GET /sessions → lista sessões salvas
app.get('/sessions', async (req, res) => {
  try {
    const sessionsDir = path.join(process.cwd(), 'data', 'sessions');
    
    // Verificar se o diretório existe
    try {
      await fs.access(sessionsDir);
    } catch {
      return res.json([]);
    }

    const files = await fs.readdir(sessionsDir);
    const sessions: Session[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(sessionsDir, file);
          const stats = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf-8');
          const sessionData = JSON.parse(content);
          
          sessions.push({
            fbUserId: sessionData.userId || sessionData.facebookId || 'unknown',
            lastUpdated: stats.mtime.toISOString()
          });
        } catch (err) {
          warn(`Erro ao ler sessão ${file}:`, err);
        }
      }
    }

    return res.json(sessions);
  } catch (err) {
    error('❌ Erro ao listar sessões:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro ao listar sessões'
    });
  }
});

// Session management endpoints (new API compatible with frontend)

// GET /api/sessions - List all available sessions
app.get('/api/sessions', async (req, res) => {
  try {
    info('📋 [BRIDGE] Requisição para listar sessões disponíveis');
    
    const sessions = await getAllSessions();
    const activeSessionId = await getActiveSessionId();
    
    const response: SessionListResponse = {
      success: true,
      sessions,
      activeSessionId: activeSessionId
    };
    
    info(`✅ [BRIDGE] Retornando ${sessions.length} sessões disponíveis`);
    return res.json(response);
    
  } catch (err) {
    error('❌ [BRIDGE] Erro ao listar sessões:', err);
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
    info('🔍 [BRIDGE] Requisição para obter sessão ativa');
    
    // Use getActiveSession() which has proper fallback logic
    const activeSessionData = await getActiveSession();
    
    if (!activeSessionData) {
      return res.json({
        success: true,
        message: 'Nenhuma sessão ativa disponível',
        activeSession: undefined
      });
    }
    
    // Get the session info by finding it in the sessions list
    const sessions = await getAllSessions();
    
    // Try to find by active session ID first, then by user ID as fallback
    const activeSessionId = await getActiveSessionId();
    let activeSession = activeSessionId ? sessions.find(s => s.id === activeSessionId) : null;
    
    // If not found by ID, try to find by user ID (fallback scenario)
    if (!activeSession && activeSessionData.userId) {
      activeSession = sessions.find(s => s.userId === activeSessionData.userId);
    }
    
    if (!activeSession) {
      // Create a session info object from the session data if we can't find it in the list
      activeSession = {
        id: activeSessionId || 'current',
        userId: activeSessionData.userId,
        userName: cleanUserName(activeSessionData.userInfo?.name),
        timestamp: activeSessionData.timestamp,
        isActive: true,
        isValid: isSessionValid(activeSessionData),
        filePath: ''
      };
    }
    
    info(`✅ [BRIDGE] Sessão ativa: ${activeSession.userName} (${activeSession.userId})`);
    return res.json({
      success: true,
      activeSession,
      message: 'Sessão ativa obtida com sucesso'
    });
    
  } catch (err) {
    error('❌ [BRIDGE] Erro ao obter sessão ativa:', err);
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
        message: 'sessionId é obrigatório',
        activeSession: undefined
      });
    }
    
    info(`🎯 [BRIDGE] Requisição para selecionar sessão: ${sessionId}`);
    
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
      message: `Sessão ativa alterada para: ${cleanUserName(sessionData.userInfo?.name) || sessionId}`,
      activeSession: activeSession!
    };
    
    info(`✅ [BRIDGE] Sessão ativa definida: ${cleanUserName(sessionData.userInfo?.name)} (${sessionData.userId})`);
    return res.json(response);
    
  } catch (err) {
    error('❌ [BRIDGE] Erro ao selecionar sessão:', err);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: err instanceof Error ? err.message : 'Erro desconhecido',
      activeSession: undefined
    });
  }
});

// POST /jobs/marketplace.publish → cria um job
app.post('/jobs/marketplace.publish', async (req, res) => {
  try {
    const { fbUserId, listing, groups } = req.body;
    
    if (!fbUserId || !listing || !groups) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetros obrigatórios: fbUserId, listing, groups'
      });
    }

    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const job: Job = {
      id: jobId,
      status: 'queued',
      createdAt: now,
      updatedAt: now,
      fbUserId,
      listing,
      groups
    };

    jobs.set(jobId, job);
    jobLogs.set(jobId, []);
    
    info(`📋 Job criado: ${jobId}`, { fbUserId, groups: groups.length });
    
    // Iniciar processamento do job em background
    processJob(jobId).catch(err => {
      error(`❌ Erro ao processar job ${jobId}:`, err);
    });

    return res.json({
      id: jobId,
      status: 'queued'
    });

  } catch (err) {
    error('❌ Erro ao criar job:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro ao criar job'
    });
  }
});

// GET /jobs/:id → status do job
app.get('/jobs/:id', (req, res) => {
  const { id } = req.params;
  const job = jobs.get(id);
  
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job não encontrado'
    });
  }

  return res.json({
    id: job.id,
    status: job.status,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  });
});

// GET /events?jobId=... → SSE com eventos
app.get('/events', (req, res): any => {
  const jobId = req.query.jobId as string;
  
  if (!jobId) {
    return res.status(400).json({
      error: 'jobId é obrigatório'
    });
  }

  if (!jobs.has(jobId)) {
    return res.status(404).json({
      error: 'Job não encontrado'
    });
  }

  info(`📡 [SSE] Nova conexão estabelecida para job ${jobId}`);

  // Configurar SSE com headers mais robustos
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
    'X-Accel-Buffering': 'no', // Nginx
    'Transfer-Encoding': 'chunked'
  });

  // Enviar evento inicial com status atual
  const job = jobs.get(jobId)!;
  const statusEvent = {
    id: job.id,
    status: job.status,
    error: job.error
  };
  res.write(`event: status\ndata: ${JSON.stringify(statusEvent)}\n\n`);

  // Enviar logs existentes
  const logs = jobLogs.get(jobId) || [];
  logs.forEach(log => {
    res.write(`event: log\ndata: ${JSON.stringify(log)}\n\n`);
  });

  // Listener para novos eventos com error handling
  const eventListener = (event: JobEvent) => {
    if (event.data.jobId === jobId) {
      try {
        if (!res.destroyed && !res.writableEnded) {
          res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
        }
      } catch (err) {
        warn(`Erro ao enviar evento SSE para job ${jobId}:`, err);
        cleanup();
      }
    }
  };

  // Keep-alive mais frequente (10 segundos)
  const keepAlive = setInterval(() => {
    try {
      if (!res.destroyed && !res.writableEnded) {
        res.write(': keep-alive\n\n');
      } else {
        cleanup();
      }
    } catch (err) {
      warn(`Erro no keep-alive SSE para job ${jobId}:`, err);
      cleanup();
    }
  }, 10000);

  // Função de cleanup
  const cleanup = () => {
    try {
      info(`📡 [SSE] Conexão encerrada para job ${jobId}`);
      jobEvents.removeListener('job-event', eventListener);
      clearInterval(keepAlive);
      if (!res.destroyed && !res.writableEnded) {
        res.end();
      }
    } catch (err) {
      debug('Erro durante cleanup SSE:', err);
    }
  };

  jobEvents.on('job-event', eventListener);

  // Cleanup quando conexão fechar
  req.on('close', cleanup);
  req.on('error', cleanup);
  res.on('error', cleanup);
});

// Função para processar job
async function processJob(jobId: string) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    // Atualizar status para running
    job.status = 'running';
    job.updatedAt = new Date().toISOString();
    jobs.set(jobId, job);
    
    // Emitir evento de status
    jobEvents.emit('job-event', {
      event: 'status',
      data: {
        jobId,
        id: job.id,
        status: job.status
      }
    });

    // Adicionar log inicial
    addJobLog(jobId, 'Iniciando publicação no marketplace...');
    
    // Carregar dados da sessão
    const sessionData = await loadSessionData(job.fbUserId);
    if (!sessionData) {
      throw new Error(`Sessão não encontrada para usuário ${job.fbUserId}`);
    }

    addJobLog(jobId, 'Sessão carregada com sucesso');
    addJobLog(jobId, `Publicando em ${job.groups.length} grupos`);

    // Executar automação real
    try {
      // Configurar logs para debug e redirecionar para job
      setLogLevel('debug');
      
      const automation = new VendaBoostAutomation();
      
      // Converter dados do job para formato do flow
      const images = job.listing.images || [];
      
      // Log detalhado sobre as imagens
      addJobLog(jobId, `📷 [JOB] Imagens recebidas: ${images.length}`);
      if (images.length > 0) {
        addJobLog(jobId, `📷 [JOB] Caminhos das imagens: ${images.join(', ')}`);
        
        // Verificar se os arquivos existem
        for (let i = 0; i < images.length; i++) {
          const imagePath = images[i];
          try {
            await fs.access(imagePath);
            const stats = await fs.stat(imagePath);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            addJobLog(jobId, `📷 [JOB] ✅ Imagem ${i + 1}/${images.length}: ${imagePath} (${fileSizeMB} MB)`);
          } catch (err) {
            addJobLog(jobId, `📷 [JOB] ❌ Imagem ${i + 1}/${images.length} não encontrada: ${imagePath}`);
          }
        }
      } else {
        addJobLog(jobId, '📷 [JOB] ⚠️ Nenhuma imagem será enviada para o marketplace');
      }
      
      const flowData = {
        title: job.listing.title,
        price: job.listing.price,
        category: job.listing.category,
        description: job.listing.description,
        condition: job.listing.condition,
        location: job.listing.location,
        images: images
      };
      
      const config = {
        autoExtension: true,
        debug: false,  // Desativado para fechar browser automaticamente
        headless: true,  // Browser oculto
        throttleMs: 350
      };
      
      addJobLog(jobId, '🚀 Iniciando automação do marketplace...');
      addJobLog(jobId, `📋 Dados do anúncio: ${flowData.title} - R$ ${flowData.price}`);
      addJobLog(jobId, `📋 Categoria: ${flowData.category} | Condição: ${flowData.condition}`);
      addJobLog(jobId, `📷 Imagens para upload: ${images.length}`);
      
      // Logs diretos para debug - removendo delays
      addJobLog(jobId, '🔍 TESTE: Antes de executar a automação real', 'debug');
      
      addJobLog(jobId, '📤 Executando automação real do Playwright...', 'marketplace');
      addJobLog(jobId, `🔧 Config da automação: headless=${config.headless}, debug=${config.debug}`, 'debug');
      addJobLog(jobId, `📋 FlowData enviado: ${JSON.stringify(flowData)}`, 'debug');
      
      try {
        const result = await automation.runFlow({
          flowData,
          config,
          groupNames: job.groups
        });
        
        addJobLog(jobId, `📊 Resultado da automação: success=${result.success}`, 'debug');
        addJobLog(jobId, `📊 Mensagem: ${result.message || 'Sem mensagem'}`, 'debug');
        addJobLog(jobId, `📊 Error: ${result.error || 'Sem erro'}`, 'debug');
        
        if (!result.success) {
          throw new Error(result.error || 'Automação falhou sem erro específico');
        }
        
        addJobLog(jobId, `✅ Automação concluída: ${result.message}`, 'marketplace');
      } catch (automationError) {
        addJobLog(jobId, `❌ ERRO na automação: ${automationError}`, 'error');
        throw automationError;
      }
      
    } catch (automationError) {
      throw new Error(`Falha na automação: ${automationError instanceof Error ? automationError.message : 'Erro desconhecido'}`);
    }

    // Job concluído com sucesso
    job.status = 'succeeded';
    job.updatedAt = new Date().toISOString();
    jobs.set(jobId, job);
    
    addJobLog(jobId, '🎉 Publicação concluída com sucesso!');
    
    // Emitir evento final
    jobEvents.emit('job-event', {
      event: 'status',
      data: {
        jobId,
        id: job.id,
        status: job.status
      }
    });

  } catch (err) {
    // Job falhou
    job.status = 'failed';
    job.error = err instanceof Error ? err.message : 'Erro desconhecido';
    job.updatedAt = new Date().toISOString();
    jobs.set(jobId, job);
    
    addJobLog(jobId, `❌ Erro: ${job.error}`);
    
    // Emitir evento de erro
    jobEvents.emit('job-event', {
      event: 'status',
      data: {
        jobId,
        id: job.id,
        status: job.status,
        error: job.error
      }
    });
  }
}

// Função para adicionar log ao job com componente específico
function addJobLog(jobId: string, message: string, component: string = 'automation') {
  const logs = jobLogs.get(jobId) || [];
  const logEntry = {
    msg: message,
    ts: new Date().toISOString(),
    component
  };
  
  logs.push(logEntry);
  jobLogs.set(jobId, logs);
  
  // Emitir evento de log
  jobEvents.emit('job-event', {
    event: 'log',
    data: {
      jobId,
      ...logEntry
    }
  });
  
  info(`[Job ${jobId}] ${message}`);
}

// Função para carregar dados da sessão
async function loadSessionData(fbUserId: string): Promise<SessionData | null> {
  try {
    const sessionsDir = path.join(process.cwd(), 'data', 'sessions');
    const files = await fs.readdir(sessionsDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(sessionsDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const sessionData = JSON.parse(content);
        
        if (sessionData.userId === fbUserId || sessionData.facebookId === fbUserId) {
          return sessionData;
        }
      }
    }
    
    return null;
  } catch (err) {
    error('Erro ao carregar dados da sessão:', err);
    return null;
  }
}

// Iniciar servidor
export function startBridge(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      // Inicializar sistema de sessões
      await initializeSessionSystem();
      
      const server = app.listen(PORT, '127.0.0.1', () => {
        info(`🌉 Bridge API iniciado em http://127.0.0.1:${PORT}`);
        info('📡 Endpoints disponíveis:');
        info('  GET /healthz');
        info('  POST /upload');
        info('  POST /session');
        info('  GET /sessions');
        info('  POST /jobs/marketplace.publish');
        info('  GET /jobs/:id');
        info('  GET /events?jobId=...');
        resolve();
      });

      server.on('error', (err) => {
        if ((err as any).code === 'EADDRINUSE') {
          error(`❌ Porta ${PORT} já está em uso`);
          reject(new Error(`Porta ${PORT} já está em uso`));
        } else {
          reject(err);
        }
      });
    } catch (err) {
      error('❌ Erro ao inicializar Bridge API:', err);
      reject(err);
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  info('🛑 Encerrando Bridge API...');
  process.exit(0);
});

process.on('SIGINT', () => {
  info('🛑 Encerrando Bridge API...');
  process.exit(0);
});

export default app;