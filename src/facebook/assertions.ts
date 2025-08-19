import type { Page } from 'playwright';
import { t } from '../utils/i18n.js';
import { wait, waitWithLog, info, warn, error, debug } from '../logger.js';

/**
 * Interface para configurações de verificação
 */
export interface AssertionConfig {
  timeout: number;
  retryInterval: number;
  maxRetries: number;
}

/**
 * Resultado da verificação de publicação
 */
export interface PublicationResult {
  success: boolean;
  message: string;
  timestamp: Date;
  url?: string;
  groupsCount?: number;
}

/**
 * Classe para verificações de publicação
 */
export class PublicationAssertions {
  private page: Page;
  private config: AssertionConfig;

  constructor(page: Page, config: Partial<AssertionConfig> = {}) {
    this.page = page;
    this.config = {
      timeout: 30000,
      retryInterval: 2000,
      maxRetries: 15,
      ...config
    };
  }

  /**
   * Verifica se a publicação foi bem-sucedida
   */
  async assertPublished(): Promise<PublicationResult> {
    info('Verificando se a publicação foi bem-sucedida...');
    
    const startTime = Date.now();
    let attempt = 0;

    while (attempt < this.config.maxRetries) {
      attempt++;
      
      try {
        debug(`Tentativa ${attempt}/${this.config.maxRetries} de verificação...`);
        
        // Verificar indicadores de sucesso
        const result = await this.checkPublicationSuccess();
        
        if (result.success) {
          info(`✓ Publicação confirmada: ${result.message}`);
          return result;
        }

        // Verificar se houve erro
        const errorResult = await this.checkPublicationError();
        if (errorResult) {
          error(`✗ Erro na publicação: ${errorResult.message}`);
          return errorResult;
        }

        // Aguardar antes da próxima tentativa
        if (attempt < this.config.maxRetries) {
          await waitWithLog(this.config.retryInterval, `Aguardando próxima verificação (${attempt}/${this.config.maxRetries})`);
        }

      } catch (err) {
        debug(`Erro na verificação (tentativa ${attempt}):`, err);
        
        if (attempt < this.config.maxRetries) {
          await wait(this.config.retryInterval);
        }
      }

      // Verificar timeout
      if (Date.now() - startTime > this.config.timeout) {
        break;
      }
    }

    // Timeout ou máximo de tentativas atingido
    const timeoutResult: PublicationResult = {
      success: false,
      message: 'Timeout: Não foi possível confirmar se a publicação foi bem-sucedida',
      timestamp: new Date()
    };

    warn(timeoutResult.message);
    return timeoutResult;
  }

  /**
   * Verifica indicadores de sucesso na publicação
   */
  private async checkPublicationSuccess(): Promise<PublicationResult> {
    debug('Verificando indicadores de sucesso...');

    // Estratégias para detectar sucesso
    const successStrategies = [
      () => this.checkSuccessMessage(),
      () => this.checkUrlRedirect(),
      () => this.checkPublishedPost(),
      () => this.checkConfirmationModal(),
      () => this.checkPageState()
    ];

    for (const strategy of successStrategies) {
      try {
        const result = await strategy();
        if (result && result.success) {
          return result;
        }
      } catch (err) {
        debug('Estratégia de verificação falhou:', err);
      }
    }

    return {
      success: false,
      message: 'Nenhum indicador de sucesso encontrado',
      timestamp: new Date()
    };
  }

  /**
   * Verifica mensagens de sucesso
   */
  private async checkSuccessMessage(): Promise<PublicationResult | null> {
    debug('Verificando mensagens de sucesso...');

    const successSelectors = [
      // Mensagens de sucesso
      () => this.page.getByText(t.texts.publishSuccess),
      () => this.page.getByText(t.texts.postPublished),
      () => this.page.getByText(t.texts.listingCreated),
      () => this.page.locator('[data-testid*="success"]'),
      () => this.page.locator('.success'),
      
      // Textos específicos de sucesso
      () => this.page.getByText(/publicado|published|criado|created|sucesso|success/i),
      () => this.page.getByText(/anúncio.*criado|listing.*created|post.*publicado/i),
      () => this.page.locator('div').filter({ hasText: /✓|✔|check|sucesso|success/i }),
    ];

    for (const selector of successSelectors) {
      try {
        const element = selector().first();
        if (await element.isVisible({ timeout: 1000 })) {
          const text = await element.textContent() || '';
          
          return {
            success: true,
            message: `Sucesso detectado: ${text.trim()}`,
            timestamp: new Date()
          };
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * Verifica redirecionamento de URL
   */
  private async checkUrlRedirect(): Promise<PublicationResult | null> {
    debug('Verificando redirecionamento de URL...');

    try {
      const currentUrl = this.page.url();
      
      // URLs que indicam sucesso
      const successPatterns = [
        /marketplace.*item/i,
        /groups.*permalink/i,
        /posts.*\d+/i,
        /\/\d+\//,
        /created/i,
        /published/i
      ];

      for (const pattern of successPatterns) {
        if (pattern.test(currentUrl)) {
          return {
            success: true,
            message: `Redirecionamento detectado para: ${currentUrl}`,
            timestamp: new Date(),
            url: currentUrl
          };
        }
      }

      return null;
    } catch (err) {
      debug('Erro ao verificar URL:', err);
      return null;
    }
  }

  /**
   * Verifica se o post foi publicado (procura pelo post na página)
   */
  private async checkPublishedPost(): Promise<PublicationResult | null> {
    debug('Verificando post publicado...');

    try {
      // Procurar elementos que indicam um post publicado
      const postSelectors = [
        '[data-testid*="post"]',
        '[role="article"]',
        '.post',
        '[data-testid*="story"]',
        '[data-testid*="feed"]'
      ];

      for (const selector of postSelectors) {
        const elements = this.page.locator(selector);
        const count = await elements.count();
        
        if (count > 0) {
          // Verificar se algum post contém indicadores de publicação recente
          for (let i = 0; i < Math.min(count, 3); i++) {
            const post = elements.nth(i);
            const text = await post.textContent({ timeout: 1000 }).catch(() => '');
            
            if (text && /agora|now|minuto|minute|segundo|second/i.test(text)) {
              return {
                success: true,
                message: 'Post publicado encontrado na timeline',
                timestamp: new Date()
              };
            }
          }
        }
      }

      return null;
    } catch (err) {
      debug('Erro ao verificar posts:', err);
      return null;
    }
  }

  /**
   * Verifica modal de confirmação
   */
  private async checkConfirmationModal(): Promise<PublicationResult | null> {
    debug('Verificando modal de confirmação...');

    try {
      const modal = this.page.locator('[role="dialog"]').last();
      
      if (await modal.isVisible({ timeout: 1000 })) {
        const modalText = await modal.textContent() || '';
        
        if (/publicado|published|criado|created|sucesso|success/i.test(modalText)) {
          return {
            success: true,
            message: 'Modal de confirmação detectado',
            timestamp: new Date()
          };
        }
      }

      return null;
    } catch (err) {
      debug('Erro ao verificar modal:', err);
      return null;
    }
  }

  /**
   * Verifica estado da página
   */
  private async checkPageState(): Promise<PublicationResult | null> {
    debug('Verificando estado da página...');

    try {
      // Verificar se saiu da página de criação
      const currentUrl = this.page.url();
      
      if (!/create|compose|new|criar|novo/i.test(currentUrl)) {
        // Verificar se não está em página de erro
        const hasError = await this.page.locator('body').filter({ 
          hasText: /erro|error|falha|failed|problema|problem/i 
        }).count() > 0;

        if (!hasError) {
          return {
            success: true,
            message: 'Saiu da página de criação (possível sucesso)',
            timestamp: new Date(),
            url: currentUrl
          };
        }
      }

      return null;
    } catch (err) {
      debug('Erro ao verificar estado da página:', err);
      return null;
    }
  }

  /**
   * Verifica se houve erro na publicação
   */
  private async checkPublicationError(): Promise<PublicationResult | null> {
    debug('Verificando erros de publicação...');

    const errorSelectors = [
      // Mensagens de erro
      () => this.page.getByText(t.errors.publishFailed),
      () => this.page.getByText(t.errors.networkError),
      () => this.page.getByText(t.errors.validationError),
      () => this.page.locator('[data-testid*="error"]'),
      () => this.page.locator('.error'),
      () => this.page.locator('[role="alert"]'),
      
      // Textos específicos de erro
      () => this.page.getByText(/erro|error|falha|failed|problema|problem/i),
      () => this.page.getByText(/não.*publicado|not.*published|falhou|failed/i),
      () => this.page.locator('div').filter({ hasText: /❌|✗|×|erro|error/i }),
    ];

    for (const selector of errorSelectors) {
      try {
        const element = selector().first();
        if (await element.isVisible({ timeout: 1000 })) {
          const text = await element.textContent() || '';
          
          return {
            success: false,
            message: `Erro detectado: ${text.trim()}`,
            timestamp: new Date()
          };
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * Verifica quantos grupos foram selecionados para publicação
   */
  async getSelectedGroupsCount(): Promise<number> {
    try {
      const indicators = [
        this.page.getByText(t.texts.groupsSelected),
        this.page.locator('span').filter({ hasText: /\d+.*grupo|group/i }),
        this.page.locator('[data-testid*="group"]').filter({ hasText: /\d+/i }),
      ];

      for (const indicator of indicators) {
        try {
          const text = await indicator.first().textContent({ timeout: 1000 });
          if (text) {
            const match = text.match(/(\d+)/);
            if (match && match[1]) {
              return parseInt(match[1], 10);
            }
          }
        } catch {
          continue;
        }
      }

      return 0;
    } catch (err) {
      debug('Erro ao verificar grupos selecionados:', err);
      return 0;
    }
  }

  /**
   * Aguarda a página estar estável (sem mudanças por um período)
   */
  async waitForStableState(stabilityMs: number = 3000): Promise<void> {
    debug(`Aguardando página estável por ${stabilityMs}ms...`);
    
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 10000 });
      await wait(stabilityMs);
      debug('Página estável detectada');
    } catch (err) {
      debug('Timeout aguardando estabilidade, continuando...');
    }
  }
}

/**
 * Função utilitária para verificar publicação
 */
export async function assertPublished(
  page: Page, 
  timeout: number = 30000
): Promise<PublicationResult> {
  const assertions = new PublicationAssertions(page, { timeout });
  return await assertions.assertPublished();
}

/**
 * Função utilitária para aguardar estado estável
 */
export async function waitForStableState(
  page: Page, 
  stabilityMs: number = 3000
): Promise<void> {
  const assertions = new PublicationAssertions(page);
  await assertions.waitForStableState(stabilityMs);
}