import { chromium, type BrowserContext, type Page } from 'playwright';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { info, warn, error, debug } from '../logger.js';
import { sessionImporter, type ExtractedSessionData } from '../utils/sessionImporter.js';
import { autoConvertLatestSession, convertExtensionSessionToPlaywright } from '../utils/extensionSessionConverter.js';

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
        viewport: this.config.headless ? { width: 1920, height: 1080 } : this.config.viewport,
        args: this.config.headless ? [
          '--start-maximized',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ] : this.config.args,
        // Configurações de segurança e performance
        ignoreHTTPSErrors: false,
        acceptDownloads: true,
        // Configurações de localização
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo',
        // User agent personalizado para modo headless
        userAgent: this.config.headless ? 
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' : 
          undefined,
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
   * Limpa cookies do Facebook para evitar conflitos de sessão
   */
  async clearFacebookCookies(): Promise<void> {
    if (!this.context) return;
    
    try {
      info('🧹 Limpando cookies antigos do Facebook...');
      
      // Obter todos os cookies
      const cookies = await this.context.cookies();
      
      // Filtrar cookies do Facebook
      const fbCookies = cookies.filter(cookie => 
        cookie.domain.includes('facebook.com') || 
        cookie.domain.includes('fb.com')
      );
      
      // Limpar cookies do Facebook
      await this.context.clearCookies();
      
      info(`✅ ${fbCookies.length} cookies do Facebook removidos`);
    } catch (error) {
      warn('⚠️ Erro ao limpar cookies:', error);
    }
  }

  /**
   * Verifica se o usuário está logado no Facebook
   */
  async isLoggedIn(page: Page): Promise<boolean> {
    try {
      // Aguardar a página carregar completamente
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
      
      // Verificar se há elementos que indicam login
      const loginIndicators = [
        '[data-testid="user_menu"]',
        '[aria-label*="perfil"]',
        '[aria-label*="profile"]',
        'a[href*="/profile.php"]',
        'div[data-click="profile_icon"]',
        '[data-testid="blue_bar_profile_link"]',
        'div[role="banner"] a[href*="/profile"]',
        '[data-testid="nav_menu_item_profile"]',
        // Novos seletores mais específicos
        'div[data-pagelet="LeftRail"] a[href*="/profile"]',
        '[data-testid="left_nav_menu_profile"]'
      ];

      for (const selector of loginIndicators) {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          debug(`Login detectado via seletor: ${selector}`);
          return true;
        }
      }

      // Primeiro, tentar detectar se está na tela de seleção de conta
      const accountSelectionScreen = await page.locator('text=/Continuar como|Continue as/i').isVisible({ timeout: 1000 }).catch(() => false);
      
      if (accountSelectionScreen) {
        info('📱 Tela de seleção de conta detectada');
        
        // Tentar clicar no card/container do perfil primeiro (mais confiável)
        const profileCards = [
          // Card de perfil inteiro (mais específico)
          'div[data-visualcompletion="ignore-dynamic"]:has(div[role="button"]:has-text("Continuar como"))',
          // Container que tem a imagem do perfil e o botão
          'div:has(> div > div > img):has(div[role="button"])',
          // Link do perfil se for um link
          'a[role="link"]:has-text("Continuar como")',
          // Container direto do botão
          'div:has(> div[role="button"]:has-text("Continuar"))'
        ];
        
        for (const cardSelector of profileCards) {
          try {
            const card = page.locator(cardSelector).first();
            if (await card.isVisible({ timeout: 1000 }).catch(() => false)) {
              info(`📍 Card de perfil encontrado: ${cardSelector}`);
              await card.click({ timeout: 5000 });
              info('✅ Card de perfil clicado');
              
              // Aguardar navegação
              await Promise.race([
                page.waitForNavigation({ timeout: 5000 }).catch(() => {}),
                page.waitForTimeout(3000)
              ]);
              
              return await this.isLoggedIn(page);
            }
          } catch (e) {
            debug(`Card selector ${cardSelector} não funcionou:`, e);
          }
        }
      }
      
      // Se não conseguiu com os cards, tentar os botões diretamente
      const continueAsButtons = [
        // Seletores mais específicos para o botão "Continuar como"
        'div[role="button"][tabindex="0"]:has-text("Continuar como")',
        'a[role="link"]:has-text("Continuar como")',
        'div[data-visualcompletion="ignore-dynamic"] div[role="button"]:has-text("Continuar como")',
        // Seletor para o container pai do botão
        'div[data-testid="royal_login_form"] div[role="button"]',
        // Seletor mais genérico mas focado
        '*[role="button"][tabindex="0"]:has-text("Continuar")',
        // Fallback selectors
        'button:has-text("Continuar como")',
        '[data-testid="login_profile_button"]',
        'div[data-testid="identity_switch_account_item"]'
      ];

      for (const selector of continueAsButtons) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
            warn(`⚠️ Tela "Continuar como..." detectada. Tentando clicar com selector: ${selector}`);
            
            // Tentar diferentes métodos de clique
            try {
              // Método 1: Click normal com força
              await element.click({ force: true, timeout: 5000 });
              info('✅ Clique método 1 (force) bem-sucedido');
            } catch (e1) {
              try {
                // Método 2: Scroll e click
                await element.scrollIntoViewIfNeeded();
                await page.waitForTimeout(500);
                await element.click();
                info('✅ Clique método 2 (scroll + click) bem-sucedido');
              } catch (e2) {
                try {
                  // Método 3: JavaScript click
                  await element.evaluate((el: HTMLElement) => el.click());
                  info('✅ Clique método 3 (JavaScript) bem-sucedido');
                } catch (e3) {
                  error('❌ Todos os métodos de clique falharam:', e3);
                  continue; // Tentar próximo seletor
                }
              }
            }
            
            // Aguardar navegação ou mudança de página
            await Promise.race([
              page.waitForNavigation({ timeout: 5000 }).catch(() => {}),
              page.waitForTimeout(3000)
            ]);
            
            // Verificar se ainda está na tela de "Continuar como"
            const stillOnContinueScreen = await page.locator(selector).isVisible({ timeout: 1000 }).catch(() => false);
            if (stillOnContinueScreen) {
              warn('⚠️ Ainda na tela "Continuar como...". Pode haver conflito de sessão.');
              
              // Se ainda estiver na mesma tela, recarregar a página com a sessão correta
              if (this.context) {
                info('🔄 Recarregando com sessão correta...');
                
                // Navegar para a página inicial do Facebook para resetar
                await page.goto('https://www.facebook.com', { 
                  waitUntil: 'domcontentloaded',
                  timeout: 15000 
                });
                
                await page.waitForTimeout(2000);
                
                // Tentar recarregar a sessão da extensão se disponível
                const hasExtensionSession = await this.loadExtensionSession();
                if (hasExtensionSession) {
                  info('✅ Sessão da extensão recarregada');
                  // Recarregar a página com a nova sessão
                  await page.reload({ timeout: 10000 });
                  await page.waitForTimeout(2000);
                }
              }
            }
            
            // Verificar novamente após clicar
            info('🔄 Verificando login após clicar em "Continuar como..."');
            return await this.isLoggedIn(page);
          }
        } catch (error) {
          debug(`Erro ao tentar selector ${selector}:`, error);
        }
      }

      // Verificar cookies de sessão como última verificação
      const cookies = await this.context?.cookies() || [];
      const sessionCookies = cookies.filter(cookie => 
        cookie.name === 'c_user' || cookie.name === 'xs'
      );

      if (sessionCookies.length >= 2) {
        debug(`Login detectado via cookies de sessão: c_user=${sessionCookies.find(c => c.name === 'c_user')?.value}, xs presente`);
        return true;
      } else {
        warn(`⚠️ Cookies de sessão insuficientes: ${sessionCookies.map(c => c.name).join(', ')}`);
        // Listar todos os cookies para debug
        debug(`Cookies disponíveis: ${cookies.map(c => c.name).join(', ')}`);
      }

      return false;
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
      
      // Primeiro, converter sessão da extensão para formato Playwright
      let conversionSuccess = false;
      
      if (autoExtension) {
        debug('Convertendo sessão mais recente da extensão...');
        conversionSuccess = await autoConvertLatestSession();
      } else if (sessionFilePath) {
        debug(`Convertendo arquivo de sessão específico: ${sessionFilePath}`);
        conversionSuccess = await convertExtensionSessionToPlaywright(sessionFilePath);
      }
      
      if (!conversionSuccess) {
        warn('Falha ao converter dados de sessão da extensão');
        return false;
      }
      
      // Agora carregar a sessão convertida
      const sessionFile = 'vendaboost-session.json';
      if (!fs.existsSync(sessionFile)) {
        error('Arquivo de sessão convertida não encontrado');
        return false;
      }
      
      // Aplicar cookies e storage ao contexto
      const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
      
      if (this.context && sessionData.cookies) {
        // Debug: mostrar cookies essenciais antes de aplicar
        const essentialCookies = sessionData.cookies.filter((c: any) => ['c_user', 'xs', 'datr'].includes(c.name));
        info(`🔧 Aplicando ${sessionData.cookies.length} cookies, incluindo ${essentialCookies.length} essenciais:`);
        essentialCookies.forEach((cookie: any) => {
          const expireDate = new Date(cookie.expires * 1000);
          info(`  - ${cookie.name}: ${cookie.value.substring(0, 20)}... (exp: ${expireDate.toLocaleDateString()})`);
        });
        
        await this.context.addCookies(sessionData.cookies);
        
        // Verificar se cookies foram aplicados corretamente
        const appliedCookies = await this.context.cookies();
        const appliedEssential = appliedCookies.filter(c => ['c_user', 'xs', 'datr'].includes(c.name));
        info(`✅ ${appliedCookies.length} cookies aplicados, ${appliedEssential.length} essenciais confirmados`);
      }
      
      // Aplicar UserAgent da sessão original
      const originalSessionData = JSON.parse(fs.readFileSync(sessionFilePath || 'data/sessions/current-session.json', 'utf-8'));
      if (originalSessionData.userAgent && this.context) {
        await this.context.setExtraHTTPHeaders({
          'User-Agent': originalSessionData.userAgent
        });
        info(`✅ User Agent aplicado: ${originalSessionData.userAgent.substring(0, 80)}...`);
      }
      
      // Aplicar localStorage se disponível
      if (sessionData.origins && sessionData.origins.length > 0) {
        const origin = sessionData.origins[0];
        if (origin && origin.localStorage && origin.localStorage.length > 0) {
          // Criar um script que aplica o localStorage
          const localStorageData = origin.localStorage.reduce((acc: any, item: any) => {
            acc[item.name] = item.value;
            return acc;
          }, {});
          
          await this.context?.addInitScript((data) => {
            // Este script será executado antes de cada página carregar
            try {
              for (const [key, value] of Object.entries(data)) {
                window.localStorage.setItem(key, String(value));
              }
              console.log(`✅ ${Object.keys(data).length} itens de localStorage aplicados`);
            } catch (e) {
              console.warn('Erro ao aplicar localStorage:', e);
            }
          }, localStorageData);
          
          info(`✅ Script de localStorage configurado com ${origin.localStorage.length} itens`);
        }
      }

      
      return true;
    } catch (err) {
      error('Erro ao inicializar com dados da extensão:', err);
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