// Arquivo temporário para iniciar o bridge sem problemas de TypeScript
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const app = express();
const PORT = 49018;
const jobEvents = new EventEmitter();

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Configuração do multer para upload de imagens
const uploadsDir = path.join(process.cwd(), 'uploads');
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10 // máximo 10 arquivos
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de imagem são permitidos'));
    }
  }
});

// Armazenamento em memória
const jobs = new Map();
const jobLogs = new Map();

// GET /healthz
app.get('/healthz', (req, res) => {
  res.send('ok');
});

// POST /upload - Upload de imagens
app.post('/upload', upload.array('images', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Nenhuma imagem foi enviada'
      });
    }

    const uploadedFiles = req.files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      path: file.path,
      size: file.size,
      mimetype: file.mimetype
    }));

    console.log(`✅ Upload realizado: ${uploadedFiles.length} imagens`);
    uploadedFiles.forEach(file => {
      console.log(`  - ${file.originalName} -> ${file.path}`);
    });

    res.json({
      success: true,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('❌ Erro no upload:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor durante upload'
    });
  }
});

// GET /sessions
app.get('/sessions', async (req, res) => {
  try {
    const sessionsDir = path.join(process.cwd(), 'data', 'sessions');
    
    try {
      await fs.access(sessionsDir);
    } catch {
      return res.json([]);
    }

    const files = await fs.readdir(sessionsDir);
    const sessions = [];

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
          console.warn(`Erro ao ler sessão ${file}:`, err);
        }
      }
    }

    res.json(sessions);
  } catch (err) {
    console.error('Erro ao listar sessões:', err);
    res.status(500).json({
      success: false,
      error: 'Erro ao listar sessões'
    });
  }
});

// POST /jobs/marketplace.publish
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
    
    const job = {
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
    
    console.log(`📋 Job criado: ${jobId}`);
    
    // Simular processamento
    setTimeout(() => processJob(jobId), 1000);

    res.json({
      id: jobId,
      status: 'queued'
    });

  } catch (err) {
    console.error('Erro ao criar job:', err);
    res.status(500).json({
      success: false,
      error: 'Erro ao criar job'
    });
  }
});

// GET /jobs/:id
app.get('/jobs/:id', (req, res) => {
  const { id } = req.params;
  const job = jobs.get(id);
  
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job não encontrado'
    });
  }

  res.json({
    id: job.id,
    status: job.status,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    listing: job.listing,
    groups: job.groups,
    fbUserId: job.fbUserId
  });
});

// GET /events
app.get('/events', (req, res) => {
  const jobId = req.query.jobId;
  
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

  // Configurar SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Enviar evento inicial
  const job = jobs.get(jobId);
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

  // Listener para novos eventos
  const eventListener = (event) => {
    if (event.data.jobId === jobId) {
      res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
    }
  };

  jobEvents.on('job-event', eventListener);

  // Cleanup
  req.on('close', () => {
    jobEvents.removeListener('job-event', eventListener);
  });

  // Keep-alive
  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAlive);
  });
});

// Função para processar job
async function processJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    // Atualizar status
    job.status = 'running';
    job.updatedAt = new Date().toISOString();
    jobs.set(jobId, job);
    
    // Emitir evento
    jobEvents.emit('job-event', {
      event: 'status',
      data: {
        jobId,
        id: job.id,
        status: job.status
      }
    });

    addJobLog(jobId, 'Iniciando publicação no marketplace...');
    
    // TODO: Implementar publicação real nos grupos
    addJobLog(jobId, '⚠️ Postagem nos grupos está temporariamente desabilitada');
    addJobLog(jobId, `📋 Grupos configurados: ${job.groups.join(', ')}`);
    
    // Simular processamento básico
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    /* COMENTADO: Postagem nos grupos
    for (let i = 0; i < job.groups.length; i++) {
      const groupId = job.groups[i];
      addJobLog(jobId, `Publicando no grupo ${groupId}...`);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      addJobLog(jobId, `✅ Publicado no grupo ${groupId}`);
    }
    */

    // Concluído
    job.status = 'succeeded';
    job.updatedAt = new Date().toISOString();
    jobs.set(jobId, job);
    
    addJobLog(jobId, '🎉 Publicação concluída com sucesso!');
    
    jobEvents.emit('job-event', {
      event: 'status',
      data: {
        jobId,
        id: job.id,
        status: job.status
      }
    });

  } catch (err) {
    job.status = 'failed';
    job.error = err.message;
    job.updatedAt = new Date().toISOString();
    jobs.set(jobId, job);
    
    addJobLog(jobId, `❌ Erro: ${err.message}`);
    
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

// Função para adicionar log
function addJobLog(jobId, message) {
  const logs = jobLogs.get(jobId) || [];
  const logEntry = {
    msg: message,
    ts: new Date().toISOString()
  };
  
  logs.push(logEntry);
  jobLogs.set(jobId, logs);
  
  jobEvents.emit('job-event', {
    event: 'log',
    data: {
      jobId,
      ...logEntry
    }
  });
  
  console.log(`[Job ${jobId}] ${message}`);
}

// Iniciar servidor
const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`🌉 Bridge API iniciado em http://127.0.0.1:${PORT}`);
  console.log('📡 Endpoints disponíveis:');
  console.log('  GET /healthz');
  console.log('  GET /sessions');
  console.log('  POST /upload');
  console.log('  POST /jobs/marketplace.publish');
  console.log('  GET /jobs/:id');
  console.log('  GET /events?jobId=...');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Porta ${PORT} já está em uso`);
    process.exit(1);
  } else {
    console.error('❌ Erro no servidor:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Encerrando Bridge API...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Encerrando Bridge API...');
  process.exit(0);
});