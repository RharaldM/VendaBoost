const os = require('os');
const fs = require('fs');
const path = require('path');

/**
 * Controller para verificações de saúde do sistema
 */
class HealthController {
  /**
   * Verifica a saúde geral do sistema
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async checkHealth(req, res) {
    try {
      const logManager = global.logManager;
      const socketService = global.socketService;
      
      const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        system: this.getSystemInfo(),
        services: {
          logManager: {
            status: logManager ? 'active' : 'inactive',
            totalLogs: logManager ? logManager.getLogs().length : 0,
            stats: logManager ? logManager.getLogStats() : null
          },
          socketService: {
            status: socketService ? 'active' : 'inactive',
            connectedClients: socketService ? socketService.getClientCount() : 0
          },
          puppeteer: await this.checkPuppeteerHealth(),
          storage: this.checkStorageHealth()
        },
        memory: this.getMemoryInfo(),
        dependencies: this.checkDependencies()
      };
      
      // Determinar status geral baseado nos serviços
      const hasErrors = Object.values(healthData.services).some(service => 
        service.status === 'error' || service.status === 'inactive'
      );
      
      if (hasErrors) {
        healthData.status = 'degraded';
      }
      
      const statusCode = healthData.status === 'healthy' ? 200 : 503;
      
      res.status(statusCode).json({
        success: healthData.status === 'healthy',
        data: healthData
      });
      
    } catch (error) {
      const logManager = global.logManager;
      if (logManager) {
        logManager.addLog('error', '❌ Erro no health check', { error: error.message });
      }
      
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: 'Erro interno no health check',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Verifica a saúde básica (endpoint simples)
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async checkBasicHealth(req, res) {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  }

  /**
   * Obtém informações do sistema
   * @returns {Object} Informações do sistema
   */
  getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      hostname: os.hostname(),
      loadAverage: os.loadavg(),
      cpuCount: os.cpus().length
    };
  }

  /**
   * Obtém informações de memória
   * @returns {Object} Informações de memória
   */
  getMemoryInfo() {
    const memUsage = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    
    return {
      process: {
        rss: this.formatBytes(memUsage.rss),
        heapTotal: this.formatBytes(memUsage.heapTotal),
        heapUsed: this.formatBytes(memUsage.heapUsed),
        external: this.formatBytes(memUsage.external)
      },
      system: {
        total: this.formatBytes(totalMem),
        free: this.formatBytes(freeMem),
        used: this.formatBytes(totalMem - freeMem),
        usagePercentage: Math.round(((totalMem - freeMem) / totalMem) * 100)
      }
    };
  }

  /**
   * Verifica a saúde do Puppeteer
   * @returns {Promise<Object>} Status do Puppeteer
   */
  async checkPuppeteerHealth() {
    try {
      const puppeteer = require('puppeteer');
      
      // Verificar se consegue obter a versão
      const executablePath = puppeteer.executablePath();
      const exists = fs.existsSync(executablePath);
      
      return {
        status: exists ? 'active' : 'error',
        executablePath,
        exists,
        version: puppeteer._preferredRevision || 'unknown'
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Verifica a saúde do armazenamento
   * @returns {Object} Status do armazenamento
   */
  checkStorageHealth() {
    try {
      const dataDir = path.join(__dirname, '../../data');
      const userDataDir = path.join(dataDir, 'user-data');
      const cookiesPath = path.join(dataDir, 'cookies.json');
      
      return {
        status: 'active',
        directories: {
          dataDir: {
            exists: fs.existsSync(dataDir),
            path: dataDir
          },
          userDataDir: {
            exists: fs.existsSync(userDataDir),
            path: userDataDir
          }
        },
        files: {
          cookies: {
            exists: fs.existsSync(cookiesPath),
            path: cookiesPath,
            size: fs.existsSync(cookiesPath) ? fs.statSync(cookiesPath).size : 0
          }
        }
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  /**
   * Verifica dependências críticas
   * @returns {Object} Status das dependências
   */
  checkDependencies() {
    const criticalDeps = ['express', 'puppeteer', 'socket.io', 'dotenv'];
    const dependencies = {};
    
    criticalDeps.forEach(dep => {
      try {
        const pkg = require(`${dep}/package.json`);
        dependencies[dep] = {
          status: 'active',
          version: pkg.version
        };
      } catch (error) {
        dependencies[dep] = {
          status: 'error',
          error: 'Não encontrado'
        };
      }
    });
    
    return dependencies;
  }

  /**
   * Formata bytes em formato legível
   * @param {number} bytes - Número de bytes
   * @returns {string} Formato legível
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Obtém métricas detalhadas do sistema
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getSystemMetrics(req, res) {
    try {
      const logManager = global.logManager;
      const socketService = global.socketService;
      
      const metrics = {
        timestamp: new Date().toISOString(),
        uptime: {
          process: process.uptime(),
          system: os.uptime()
        },
        memory: this.getMemoryInfo(),
        cpu: {
          loadAverage: os.loadavg(),
          cpuCount: os.cpus().length
        },
        logs: logManager ? logManager.getLogStats() : null,
        connections: {
          socketClients: socketService ? socketService.getClientCount() : 0
        },
        environment: {
          nodeVersion: process.version,
          platform: os.platform(),
          arch: os.arch(),
          env: process.env.NODE_ENV || 'development'
        }
      };
      
      res.json({
        success: true,
        data: metrics
      });
      
    } catch (error) {
      const logManager = global.logManager;
      if (logManager) {
        logManager.addLog('error', '❌ Erro ao obter métricas', { error: error.message });
      }
      
      res.status(500).json({
        success: false,
        error: 'Erro interno ao obter métricas'
      });
    }
  }
}

module.exports = new HealthController();