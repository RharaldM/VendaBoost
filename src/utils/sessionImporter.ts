/**
 * VendaBoost Desktop - Session Importer
 * Utilitário para importar e usar dados de sessão extraídos pela extensão Chrome
 */

import fs from 'fs';
import path from 'path';
import { info, warn, error } from '../logger.js';

export interface CookieData {
  value: string;
  domain: string;
  path: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: string;
  expirationDate?: number;
}

export interface ExtractedSessionData {
  timestamp: string;
  userAgent: string;
  cookies: Record<string, CookieData | string>;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  userInfo: {
    name?: string;
    userId?: string;
  };
}

export interface FacebookCookies {
  c_user?: string;
  xs?: string;
  fr?: string;
  sb?: string;
  datr?: string;
  wd?: string;
  dpr?: string;
  locale?: string;
  [key: string]: string | undefined;
}

export class SessionImporter {
  private sessionData: ExtractedSessionData | null = null;
  private sessionFile: string | null = null;

  /**
   * Carrega dados de sessão de um arquivo JSON exportado pela extensão
   */
  async loadSessionFile(filePath: string): Promise<boolean> {
    try {
      if (!fs.existsSync(filePath)) {
        error(`Arquivo de sessão não encontrado: ${filePath}`);
        return false;
      }

      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(fileContent) as ExtractedSessionData;

      // Validar estrutura dos dados
      if (!this.validateSessionData(data)) {
        error('Dados de sessão inválidos no arquivo');
        return false;
      }

      this.sessionData = data;
      this.sessionFile = filePath;

      info(`Dados de sessão carregados: ${data.userInfo.name} (${data.userInfo.userId})`);
      info(`Timestamp da extração: ${new Date(data.timestamp).toLocaleString('pt-BR')}`);

      return true;
    } catch (err) {
        error('Erro ao carregar arquivo de sessão:', err);
        return false;
      }
  }

  /**
   * Carrega automaticamente o arquivo de sessão mais recente
   */
  async loadLatestSessionFile(): Promise<boolean> {
    try {
      const projectDir = process.cwd();
      const files = fs.readdirSync(projectDir);
      
      // Buscar arquivos que começam com 'vendaboost-session-'
      const sessionFiles = files
        .filter(file => file.startsWith('vendaboost-session-') && file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(projectDir, file),
          mtime: fs.statSync(path.join(projectDir, file)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // Mais recente primeiro

      if (sessionFiles.length === 0) {
        warn('Nenhum arquivo de sessão encontrado. Use a extensão Chrome para extrair dados.');
        return false;
      }

      const latestFile = sessionFiles[0];
      if (!latestFile) {
        warn('Nenhum arquivo de sessão válido encontrado');
        return false;
      }
      
      info(`Carregando arquivo de sessão mais recente: ${latestFile.name}`);
      
      return await this.loadSessionFile(latestFile.path);
    } catch (err) {
        error('Erro ao buscar arquivos de sessão:', err);
        return false;
      }
  }

  /**
   * Retorna os cookies do Facebook formatados para uso com Playwright
   */
  getFacebookCookies(): FacebookCookies {
    if (!this.sessionData) {
      throw new Error('Nenhum dado de sessão carregado');
    }

    const facebookCookies: FacebookCookies = {};
    
    for (const [name, cookieData] of Object.entries(this.sessionData.cookies)) {
      if (cookieData) {
        if (typeof cookieData === 'object' && 'value' in cookieData) {
          facebookCookies[name] = cookieData.value;
        } else {
          facebookCookies[name] = cookieData as string;
        }
      }
    }

    return facebookCookies;
  }

  /**
   * Retorna cookies formatados para Playwright context
   */
  getPlaywrightCookies(): Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
    expires?: number;
  }> {
    if (!this.sessionData) {
      throw new Error('Nenhum dado de sessão carregado');
    }

    const cookies = [];
    const facebookDomain = '.facebook.com';

    for (const [name, cookieData] of Object.entries(this.sessionData.cookies)) {
      if (cookieData) {
        // Se é um objeto com estrutura de cookie
        if (typeof cookieData === 'object' && 'value' in cookieData) {
          const cookie: any = {
            name,
            value: cookieData.value,
            domain: cookieData.domain || facebookDomain,
            path: cookieData.path || '/'
          };
          
          if (cookieData.secure !== undefined) {
            cookie.secure = cookieData.secure;
          }
          
          if (cookieData.httpOnly !== undefined) {
            cookie.httpOnly = cookieData.httpOnly;
          }
          
          if (cookieData.sameSite) {
            // Converter sameSite para formato do Playwright
            switch (cookieData.sameSite.toLowerCase()) {
              case 'no_restriction':
                cookie.sameSite = 'None';
                break;
              case 'lax':
                cookie.sameSite = 'Lax';
                break;
              case 'strict':
                cookie.sameSite = 'Strict';
                break;
              default:
                cookie.sameSite = 'Lax';
            }
          }
          
          if (cookieData.expirationDate) {
            cookie.expires = cookieData.expirationDate;
          }
          
          cookies.push(cookie);
        } else {
          // Se é uma string simples (formato antigo)
          cookies.push({
            name,
            value: cookieData as string,
            domain: facebookDomain,
            path: '/'
          });
        }
      }
    }

    return cookies;
  }

  /**
   * Retorna o User Agent extraído
   */
  getUserAgent(): string {
    if (!this.sessionData) {
      throw new Error('Nenhum dado de sessão carregado');
    }

    return this.sessionData.userAgent;
  }

  /**
   * Retorna informações do usuário
   */
  getUserInfo(): { name?: string; userId?: string } {
    if (!this.sessionData) {
      throw new Error('Nenhum dado de sessão carregado');
    }

    return this.sessionData.userInfo;
  }

  /**
   * Retorna dados do localStorage
   */
  getLocalStorage(): Record<string, string> {
    if (!this.sessionData) {
      throw new Error('Nenhum dado de sessão carregado');
    }

    return this.sessionData.localStorage;
  }

  /**
   * Retorna dados do sessionStorage
   */
  getSessionStorage(): Record<string, string> {
    if (!this.sessionData) {
      throw new Error('Nenhum dado de sessão carregado');
    }

    return this.sessionData.sessionStorage;
  }

  /**
   * Verifica se há dados de sessão carregados
   */
  hasSessionData(): boolean {
    return this.sessionData !== null;
  }

  /**
   * Verifica se a sessão ainda é válida (não expirou)
   */
  isSessionValid(maxAgeHours: number = 24): boolean {
    if (!this.sessionData) {
      return false;
    }

    const extractionTime = new Date(this.sessionData.timestamp);
    const now = new Date();
    const ageHours = (now.getTime() - extractionTime.getTime()) / (1000 * 60 * 60);

    return ageHours <= maxAgeHours;
  }

  /**
   * Limpa dados de sessão carregados
   */
  clearSession(): void {
    this.sessionData = null;
    this.sessionFile = null;
    info('Dados de sessão limpos');
  }

  /**
   * Valida a estrutura dos dados de sessão
   */
  private validateSessionData(data: any): data is ExtractedSessionData {
    return (
      data &&
      typeof data.timestamp === 'string' &&
      typeof data.userAgent === 'string' &&
      typeof data.cookies === 'object' &&
      typeof data.localStorage === 'object' &&
      typeof data.sessionStorage === 'object' &&
      typeof data.userInfo === 'object' &&
      data.cookies.c_user && // Cookie essencial do Facebook
      data.cookies.xs // Token de sessão essencial
    );
  }

  /**
   * Retorna informações sobre o arquivo de sessão carregado
   */
  getSessionInfo(): {
    file: string | null;
    timestamp: string | null;
    userInfo: { name?: string; userId?: string } | null;
    isValid: boolean;
  } {
    return {
      file: this.sessionFile,
      timestamp: this.sessionData?.timestamp || null,
      userInfo: this.sessionData?.userInfo || null,
      isValid: this.isSessionValid()
    };
  }
}

// Instância singleton para uso global
export const sessionImporter = new SessionImporter();