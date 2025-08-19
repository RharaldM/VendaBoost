import { chromium, type BrowserContext, type Page } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { info, warn, error, debug } from '../logger.js';
import { sessionImporter, type ExtractedSessionData } from '../utils/sessionImporter.js';

/**
 * Configurações para o browser
 */
export interface BrowserConfig {
  userDataDir: string;
  headless?: boolean;
  viewport?: { width: number; height: number } | null;
  args?: string[];
  timeout?: number;
}

/**
 * Classe para gerenciar sessões do browser
 */
export class BrowserSession {
  private context: BrowserContext | null = null;
  private config: BrowserConfig;

  constructor(config: BrowserConfig) {
    this.config = {
      headless: false,
      viewport: null,
      args: ['--start-maximized'],
      timeout: 30000,
      ...config
    };
  }

  /**
   * Inicia o contexto persistente do browser
   */
  async launch(): Promise<BrowserContext> {
    try {
      // Cria diretório de dados do usuário se não existir
      const userDataDir = path.resolve(this.config.userDataDir);
      if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
        info(`Diretório de perfil criado: ${userDataDir}`);
      }

      info('Iniciando contexto persistente do browser...');
      
      const launchOptions: any = {
        headless: this.config.headless,
        viewport: this.config.viewport,
        args: this.config.args,
        // Configurações de segurança e performance
        ignoreHTTPSErrors: false,
        acceptDownloads: true,
        // Configurações de localização
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
      };

      // Adicionar timeout apenas se definido
      if (this.config.timeout !== undefined) {
        launchOptions.timeout = this.config.timeout;
      }

      this.context = await chromium.launchPersistentContext(userDataDir, launchOptions);

      // Configurações adicionais do contexto
      await this.configureContext();

      info('Contexto do browser iniciado com sucesso');
      return this.context;
    } catch (err) {
      error('Erro ao iniciar contexto do browser:', err);
      throw new Error(`Falha ao iniciar browser: ${err}`);
    }
  }

  /**
   * Configura o contexto com interceptadores e configurações adicionais
   */
  private async configureContext(): Promise<void> {
    if (!this.context) return;

    // Configurar timeout padrão para navegação
    this.context.setDefaultNavigationTimeout(this.config.timeout || 30000);
    this.context.setDefaultTimeout(this.config.timeout || 30000);

    // Interceptar requests para otimizar performance (opcional)
    await this.context.route('**/*', async (route) => {
      const request = route.request();
      const resourceType = request.resourceType();
      
      // Bloquear recursos desnecessários para melhor performance
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        // Permitir apenas imagens essenciais
        if (resourceType === 'image' && !request.url().includes('profile')) {
          await route.abort();
          return;
        }
      }
      
      await route.continue();
    });

    // Configurar user agent
    await this.context.addInitScript(() => {
      // Remove indicadores de automação
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });

    debug('Contexto configurado com interceptadores e otimizações');
  }

  /**
   * Cria uma nova página
   */
  async newPage(): Promise<Page> {
    if (!this.context) {
      throw new Error('Contexto não iniciado. Chame launch() primeiro.');
    }

    const page = await this.context.newPage();
    
    // Configurações da página
    await this.configurePage(page);
    
    return page;
  }

  /**
   * Configura uma página com handlers e configurações
   */
  private async configurePage(page: Page): Promise<void> {
    // Handler para console logs
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        debug(`Console error: ${msg.text()}`);
      }
    });

    // Handler para erros de página
    page.on('pageerror', (err) => {
      warn('Erro na página:', err.message);
    });

    // Handler para requests falhados
    page.on('requestfailed', (request) => {
      debug(`Request failed: ${request.url()} - ${request.failure()?.errorText}`);
    });

    // Configurar viewport se especificado
    if (this.config.viewport) {
      await page.setViewportSize(this.config.viewport);
    }
  }

  /**
   * Navega para uma URL com retry automático
   */
  async navigateTo(page: Page, url: string, options?: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
    timeout?: number;
    retries?: number;
  }): Promise<void> {
    const {
      waitUntil = 'domcontentloaded',
      timeout = this.config.timeout || 30000,
      retries = 3
    } = options || {};

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        info(`Navegando para: ${url} (tentativa ${attempt}/${retries})`);
        
        const gotoOptions: any = { waitUntil };
        if (timeout !== undefined) {
          gotoOptions.timeout = timeout;
        }
        
        await page.goto(url, gotoOptions);

        // Aguardar que a página esteja totalmente carregada
        await page.waitForLoadState('domcontentloaded');
        
        info('Navegação concluída com sucesso');
        return;
      } catch (err) {
        lastError = err as Error;
        warn(`Tentativa ${attempt} falhou:`, err);
        
        if (attempt < retries) {
          const delay = 1000 * attempt; // Backoff progressivo
          debug(`Aguardando ${delay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Falha ao navegar para ${url} após ${retries} tentativas: ${lastError?.message}`);
  }

  /**
   * Verifica se o usuário está logado no Facebook
   */
  async isLoggedIn(page: Page): Promise<boolean> {
    try {
      // Verificar se há elementos que indicam login
      const loginIndicators = [
        '[data-testid="user_menu"]',
        '[aria-label*="perfil"]',
        '[aria-label*="profile"]',
        'a[href*="/profile.php"]',
        'div[data-click="profile_icon"]'
      ];

      for (const selector of loginIndicators) {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
          debug(`Login detectado via seletor: ${selector}`);
          return true;
        }
      }

      // Verificar cookies de sessão
      const cookies = await this.context?.cookies() || [];
      const sessionCookies = cookies.filter(cookie => 
        cookie.name === 'c_user' || cookie.name === 'xs'
      );

      return sessionCookies.length >= 2;
    } catch (err) {
      debug('Erro ao verificar login:', err);
      return false;
    }
  }

  /**
   * Carrega dados de sessão extraídos pela extensão Chrome
   */
  async loadExtensionSession(sessionFilePath?: string): Promise<boolean> {
    try {
      let loaded = false;
      
      if (sessionFilePath) {
        loaded = await sessionImporter.loadSessionFile(sessionFilePath);
      } else {
        loaded = await sessionImporter.loadLatestSessionFile();
      }

      if (!loaded) {
        warn('Não foi possível carregar dados de sessão da extensão');
        return false;
      }

      if (!sessionImporter.isSessionValid()) {
        warn('Dados de sessão da extensão estão expirados');
        return false;
      }

      // Aplicar cookies ao contexto
      if (this.context) {
        const cookies = sessionImporter.getPlaywrightCookies();
        await this.context.addCookies(cookies);
        info(`${cookies.length} cookies aplicados ao contexto do browser`);
      }

      const userInfo = sessionImporter.getUserInfo();
      info(`Sessão carregada para usuário: ${userInfo.name} (${userInfo.userId})`);
      
      return true;
    } catch (err) {
      error('Erro ao carregar sessão da extensão:', err);
      return false;
    }
  }

  /**
   * Aplica dados de localStorage e sessionStorage da extensão
   */
  async applyExtensionStorageData(page: Page): Promise<void> {
    try {
      if (!sessionImporter.hasSessionData()) {
        debug('Nenhum dado de sessão da extensão disponível');
        return;
      }

      const localStorage = sessionImporter.getLocalStorage();
      const sessionStorage = sessionImporter.getSessionStorage();

      // Aplicar localStorage
      if (Object.keys(localStorage).length > 0) {
        await page.evaluate((data) => {
          for (const [key, value] of Object.entries(data)) {
            try {
              window.localStorage.setItem(key, value);
            } catch (e) {
              console.warn('Erro ao definir localStorage:', key, e);
            }
          }
        }, localStorage);
        debug(`${Object.keys(localStorage).length} itens aplicados ao localStorage`);
      }

      // Aplicar sessionStorage
      if (Object.keys(sessionStorage).length > 0) {
        await page.evaluate((data) => {
          for (const [key, value] of Object.entries(data)) {
            try {
              window.sessionStorage.setItem(key, value);
            } catch (e) {
              console.warn('Erro ao definir sessionStorage:', key, e);
            }
          }
        }, sessionStorage);
        debug(`${Object.keys(sessionStorage).length} itens aplicados ao sessionStorage`);
      }

    } catch (err) {
      warn('Erro ao aplicar dados de storage da extensão:', err);
    }
  }

  /**
   * Configura User Agent da extensão
   */
  async setExtensionUserAgent(): Promise<void> {
    try {
      if (!sessionImporter.hasSessionData()) {
        return;
      }

      const userAgent = sessionImporter.getUserAgent();
      if (userAgent && this.context) {
        await this.context.setExtraHTTPHeaders({
          'User-Agent': userAgent
        });
        debug(`User Agent aplicado: ${userAgent.substring(0, 50)}...`);
      }
    } catch (err) {
      warn('Erro ao aplicar User Agent da extensão:', err);
    }
  }

  /**
   * Inicializa sessão completa com dados da extensão
   */
  async initializeWithExtensionData(sessionFilePath?: string, autoExtension?: boolean): Promise<boolean> {
    try {
      debug(`Tentando carregar dados da extensão: sessionFilePath=${sessionFilePath}, autoExtension=${autoExtension}`);
      
      // Carregar dados da extensão
      let sessionLoaded = false;
      
      if (autoExtension) {
        debug('Carregando arquivo de sessão mais recente...');
        sessionLoaded = await sessionImporter.loadLatestSessionFile();
      } else if (sessionFilePath) {
        debug(`Carregando arquivo de sessão específico: ${sessionFilePath}`);
        sessionLoaded = await sessionImporter.loadSessionFile(sessionFilePath);
      }
      
      if (!sessionLoaded) {
        warn('Falha ao carregar dados de sessão da extensão');
        return false;
      }

      debug('Dados de sessão carregados com sucesso');

      // Aplicar cookies ao contexto
      if (this.context) {
        const cookies = sessionImporter.getPlaywrightCookies();
        debug(`Aplicando ${cookies.length} cookies ao contexto...`);
        await this.context.addCookies(cookies);
        info(`${cookies.length} cookies aplicados ao contexto do browser`);
      } else {
        warn('Contexto do browser não disponível para aplicar cookies');
      }

      // Configurar User Agent
      await this.setExtensionUserAgent();

      const userInfo = sessionImporter.getUserInfo();
      info(`🔑 Sessão da extensão carregada para usuário: ${userInfo.name} (${userInfo.userId})`);
      return true;
    } catch (err) {
      error('Erro ao inicializar sessão com dados da extensão:', err);
      return false;
    }
  }

  /**
   * Aguarda o usuário fazer login manualmente
   */
  async waitForLogin(page: Page, timeout: number = 300000): Promise<void> {
    info('Aguardando login manual do usuário...');
    
    try {
      // Aguarda até que algum indicador de login apareça usando seletores diretos
      const loginIndicators = [
        '[data-testid="user_menu"]',
        '[aria-label*="perfil"]',
        '[aria-label*="profile"]',
        'a[href*="/profile.php"]',
        'div[data-click="profile_icon"]',
        '[data-testid="blue_bar_profile_link"]',
        'div[role="banner"] a[href*="/profile"]'
      ];

      // Tentar cada seletor até encontrar um elemento visível
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        for (const selector of loginIndicators) {
          try {
            const element = page.locator(selector).first();
            if (await element.isVisible({ timeout: 1000 })) {
              info('Login detectado com sucesso');
              return;
            }
          } catch {
            // Continuar tentando outros seletores
          }
        }
        
        // Aguardar um pouco antes de tentar novamente
        await page.waitForTimeout(2000);
      }
      
      throw new Error('Timeout aguardando login');
    } catch (err) {
      throw new Error(`Timeout aguardando login: ${err}`);
    }
  }

  /**
   * Obtém o contexto atual
   */
  getContext(): BrowserContext | null {
    return this.context;
  }

  /**
   * Fecha o contexto do browser
   */
  async close(): Promise<void> {
    if (this.context) {
      info('Fechando contexto do browser...');
      await this.context.close();
      this.context = null;
      info('Contexto fechado');
    }
  }

  /**
   * Verifica se o contexto está ativo
   */
  isActive(): boolean {
    return this.context !== null;
  }
}

/**
 * Função utilitária para criar e iniciar uma sessão do browser
 */
export async function launch(userDataDir: string, config?: Partial<BrowserConfig>): Promise<BrowserContext> {
  const session = new BrowserSession({
    userDataDir,
    ...config
  });

  return await session.launch();
}

/**
 * Função utilitária para criar uma sessão completa com verificação de login
 */
export async function createSessionWithLogin(
  userDataDir: string, 
  startUrl: string,
  config?: Partial<BrowserConfig>
): Promise<{ context: BrowserContext; page: Page; session: BrowserSession }> {
  const session = new BrowserSession({
    userDataDir,
    ...config
  });

  const context = await session.launch();
  const page = await session.newPage();

  // Navegar para a URL inicial
  await session.navigateTo(page, startUrl);

  // Verificar se está logado
  const isLoggedIn = await session.isLoggedIn(page);
  
  if (!isLoggedIn) {
    info('Usuário não está logado. Aguardando login manual...');
    await session.waitForLogin(page);
  }

  return { context, page, session };
}