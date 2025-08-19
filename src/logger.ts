import * as fs from 'node:fs';
import * as path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  extra?: unknown;
}

class Logger {
  private logLevel: LogLevel = 'info';
  private logFile: string | undefined;

  constructor(level: LogLevel = 'info', logFile?: string) {
    this.logLevel = level;
    this.logFile = logFile;
    
    // Cria diretório de logs se especificado
    if (logFile) {
      const logDir = path.dirname(logFile);
      try {
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
      } catch (err) {
        console.warn('Erro ao criar diretório de logs:', err);
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
    return levels[level] >= levels[this.logLevel];
  }

  private formatMessage(entry: LogEntry): string {
    const { timestamp, level, message, extra } = entry;
    let formatted = `[${timestamp}] ${level.toUpperCase()} ${message}`;
    
    if (extra !== undefined) {
      formatted += ` ${JSON.stringify(extra)}`;
    }
    
    return formatted;
  }

  private writeLog(entry: LogEntry): void {
    const formatted = this.formatMessage(entry);
    
    // Log para console
    const consoleMethod = entry.level === 'error' ? 'error' : 'log';
    if (entry.extra !== undefined) {
      console[consoleMethod](formatted.replace(` ${JSON.stringify(entry.extra)}`, ''), entry.extra);
    } else {
      console[consoleMethod](formatted);
    }

    // Log para arquivo se configurado
    if (this.logFile) {
      try {
        fs.appendFileSync(this.logFile, formatted + '\n', 'utf-8');
      } catch (error) {
        console.error('Erro ao escrever no arquivo de log:', error);
      }
    }
  }

  debug(message: string, extra?: unknown): void {
    if (this.shouldLog('debug')) {
      this.writeLog({
        timestamp: new Date().toISOString(),
        level: 'debug',
        message,
        extra
      });
    }
  }

  info(message: string, extra?: unknown): void {
    if (this.shouldLog('info')) {
      this.writeLog({
        timestamp: new Date().toISOString(),
        level: 'info',
        message,
        extra
      });
    }
  }

  warn(message: string, extra?: unknown): void {
    if (this.shouldLog('warn')) {
      this.writeLog({
        timestamp: new Date().toISOString(),
        level: 'warn',
        message,
        extra
      });
    }
  }

  error(message: string, extra?: unknown): void {
    if (this.shouldLog('error')) {
      this.writeLog({
        timestamp: new Date().toISOString(),
        level: 'error',
        message,
        extra
      });
    }
  }

  setLevel(level: LogLevel): void {
    this.logLevel = level;
  }
}

// Instância global do logger
let globalLogger = new Logger();

/**
 * Configura o logger global
 */
export function configureLogger(level: LogLevel, logFile?: string): void {
  globalLogger = new Logger(level, logFile);
}

/**
 * Funções de log simplificadas
 */
export const log = (level: LogLevel, msg: string, extra?: unknown) => {
  globalLogger[level](msg, extra);
};

export const debug = (msg: string, extra?: unknown) => globalLogger.debug(msg, extra);
export const info = (msg: string, extra?: unknown) => globalLogger.info(msg, extra);
export const warn = (msg: string, extra?: unknown) => globalLogger.warn(msg, extra);
export const error = (msg: string, extra?: unknown) => globalLogger.error(msg, extra);

/**
 * Define o nível de log global
 */
export const setLogLevel = (level: LogLevel): void => {
  globalLogger.setLevel(level);
};

/**
 * Função utilitária para esperar um tempo determinado
 */
export const wait = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Função para esperar com log de progresso
 */
export const waitWithLog = async (ms: number, message?: string): Promise<void> => {
  if (message) {
    debug(`Aguardando ${ms}ms: ${message}`);
  }
  await wait(ms);
};

/**
 * Função para retry com backoff exponencial
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      warn(`Tentativa ${attempt} falhou, tentando novamente em ${delay}ms`, error);
      await wait(delay);
    }
  }
  
  throw lastError!;
};