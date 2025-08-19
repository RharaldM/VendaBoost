import type { BrowserContext, Page } from 'playwright';
import { t } from '../utils/i18n.js';
import { wait, waitWithLog, info, warn, error, debug } from '../logger.js';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Interface para dados do anúncio
 */
export interface ListingData {
  title: string;
  price: string | number;
  description: string;
  images?: string[];
  category?: string;
  condition?: string;
  location?: string;
}

/**
 * Classe para automação do Facebook Marketplace
 */
export class MarketplaceAutomation {
  private page: Page;
  private throttleMs: number;

  constructor(page: Page, throttleMs: number = 350) {
    this.page = page;
    this.throttleMs = throttleMs;
  }

  /**
   * Cria um novo anúncio no Marketplace
   */
  async createListing(data: ListingData): Promise<void> {
    try {
      info('Iniciando criação de anúncio no Marketplace...');
      
      // Aguardar página carregar completamente
      await this.page.waitForLoadState('domcontentloaded');
      await wait(1000);

      // Tentar encontrar e clicar no botão de criar anúncio
      await this.clickCreateButton();

      // Preencher campos do formulário
      await this.fillTitle(data.title);
      await this.fillPrice(data.price);
      await this.fillDescription(data.description);

      // Upload de imagens se fornecidas
      if (data.images && data.images.length > 0) {
        await this.uploadImages(data.images);
      }

      // Preencher campos opcionais
      if (data.category) {
        await this.selectCategory(data.category);
      }

      if (data.condition) {
        await this.selectCondition(data.condition);
      }

      info('Formulário de anúncio preenchido com sucesso');
    } catch (err) {
      error('Erro ao criar anúncio:', err);
      throw new Error(`Falha na criação do anúncio: ${err}`);
    }
  }

  /**
   * Clica no botão de criar anúncio/listing
   */
  private async clickCreateButton(): Promise<void> {
    debug('Procurando botão de criar anúncio...');
    
    // Múltiplas estratégias para encontrar o botão
    const strategies = [
      () => this.page.getByRole('button', { name: t.buttons.createListing }),
      () => this.page.getByText(t.buttons.createListing).first(),
      () => this.page.locator('button').filter({ hasText: t.buttons.createListing }),
      () => this.page.locator('[data-testid*="create"]').filter({ hasText: /criar|create/i }),
    ];

    for (const strategy of strategies) {
      try {
        const button = strategy();
        if (await button.isVisible({ timeout: 2000 })) {
          await button.scrollIntoViewIfNeeded();
          await button.click();
          await waitWithLog(this.throttleMs, 'Aguardando após clicar em criar anúncio');
          debug('Botão de criar anúncio clicado com sucesso');
          return;
        }
      } catch (err) {
        debug('Estratégia falhou, tentando próxima...');
      }
    }

    warn('Botão de criar anúncio não encontrado - pode já estar na página de criação');
  }

  /**
   * Preenche o campo de título
   */
  private async fillTitle(title: string): Promise<void> {
    debug('Preenchendo título do anúncio...');
    
    const strategies = [
      () => this.page.getByLabel(t.labels.title),
      () => this.page.getByPlaceholder(t.labels.title),
      () => this.page.locator('input[name*="title"]'),
      () => this.page.locator('input').filter({ hasText: t.labels.title }),
      () => this.page.locator('textarea').filter({ hasText: t.labels.title }),
    ];

    for (const strategy of strategies) {
      try {
        const field = strategy().first();
        if (await field.isVisible({ timeout: 3000 })) {
          await field.scrollIntoViewIfNeeded();
          await field.click();
          await field.fill(title);
          await waitWithLog(this.throttleMs, 'Aguardando após preencher título');
          info(`Título preenchido: "${title}"`);
          return;
        }
      } catch (err) {
        debug('Estratégia de título falhou, tentando próxima...');
      }
    }

    throw new Error('Campo de título não encontrado');
  }

  /**
   * Preenche o campo de preço
   */
  private async fillPrice(price: string | number): Promise<void> {
    debug('Preenchendo preço do anúncio...');
    
    const priceStr = typeof price === 'number' ? price.toString() : price;
    
    const strategies = [
      () => this.page.getByLabel(t.labels.price),
      () => this.page.getByPlaceholder(t.labels.price),
      () => this.page.locator('input[name*="price"]'),
      () => this.page.locator('input[type="number"]'),
      () => this.page.locator('input').filter({ hasText: t.labels.price }),
    ];

    for (const strategy of strategies) {
      try {
        const field = strategy().first();
        if (await field.isVisible({ timeout: 3000 })) {
          await field.scrollIntoViewIfNeeded();
          await field.click();
          await field.fill(priceStr);
          await waitWithLog(this.throttleMs, 'Aguardando após preencher preço');
          info(`Preço preenchido: "${priceStr}"`);
          return;
        }
      } catch (err) {
        debug('Estratégia de preço falhou, tentando próxima...');
      }
    }

    throw new Error('Campo de preço não encontrado');
  }

  /**
   * Preenche o campo de descrição
   */
  private async fillDescription(description: string): Promise<void> {
    debug('Preenchendo descrição do anúncio...');
    
    const strategies = [
      () => this.page.getByLabel(t.labels.description),
      () => this.page.getByPlaceholder(t.labels.description),
      () => this.page.locator('textarea[name*="description"]'),
      () => this.page.locator('textarea').filter({ hasText: t.labels.description }),
      () => this.page.locator('div[contenteditable="true"]').filter({ hasText: t.labels.description }),
    ];

    for (const strategy of strategies) {
      try {
        const field = strategy().first();
        if (await field.isVisible({ timeout: 3000 })) {
          await field.scrollIntoViewIfNeeded();
          await field.click();
          await field.fill(description);
          await waitWithLog(this.throttleMs, 'Aguardando após preencher descrição');
          info(`Descrição preenchida (${description.length} caracteres)`);
          return;
        }
      } catch (err) {
        debug('Estratégia de descrição falhou, tentando próxima...');
      }
    }

    throw new Error('Campo de descrição não encontrado');
  }

  /**
   * Faz upload de imagens
   */
  private async uploadImages(imagePaths: string[]): Promise<void> {
    debug(`Fazendo upload de ${imagePaths.length} imagens...`);
    
    // Validar se os arquivos existem
    const validPaths = imagePaths.filter(imagePath => {
      const fullPath = path.resolve(imagePath);
      if (!fs.existsSync(fullPath)) {
        warn(`Imagem não encontrada: ${imagePath}`);
        return false;
      }
      return true;
    });

    if (validPaths.length === 0) {
      warn('Nenhuma imagem válida encontrada para upload');
      return;
    }

    const strategies = [
      () => this.page.locator('input[type="file"]'),
      () => this.page.getByText(t.buttons.addPhotos).locator('..').locator('input[type="file"]'),
      () => this.page.locator('[data-testid*="photo"]').locator('input[type="file"]'),
    ];

    for (const strategy of strategies) {
      try {
        const fileInput = strategy().first();
        if (await fileInput.count() > 0) {
          const resolvedPaths = validPaths.map(p => path.resolve(p));
          await fileInput.setInputFiles(resolvedPaths);
          await waitWithLog(2000, 'Aguardando upload das imagens');
          info(`Upload realizado: ${validPaths.length} imagens`);
          return;
        }
      } catch (err) {
        debug('Estratégia de upload falhou, tentando próxima...');
      }
    }

    warn('Campo de upload de imagens não encontrado - continuando sem imagens');
  }

  /**
   * Seleciona categoria do produto
   */
  private async selectCategory(category: string): Promise<void> {
    debug(`Selecionando categoria: ${category}`);
    
    try {
      // Procurar dropdown ou campo de categoria
      const categoryField = this.page.getByLabel(t.labels.category)
        .or(this.page.getByPlaceholder(t.labels.category))
        .first();

      if (await categoryField.isVisible({ timeout: 3000 })) {
        await categoryField.click();
        await wait(500);
        
        // Procurar opção da categoria
        const option = this.page.getByText(new RegExp(category, 'i')).first();
        if (await option.isVisible({ timeout: 2000 })) {
          await option.click();
          await waitWithLog(this.throttleMs, 'Aguardando após selecionar categoria');
          info(`Categoria selecionada: ${category}`);
        }
      }
    } catch (err) {
      warn('Não foi possível selecionar categoria:', err);
    }
  }

  /**
   * Seleciona condição do produto
   */
  private async selectCondition(condition: string): Promise<void> {
    debug(`Selecionando condição: ${condition}`);
    
    try {
      // Procurar campo de condição
      const conditionField = this.page.getByLabel(t.labels.condition)
        .or(this.page.getByPlaceholder(t.labels.condition))
        .first();

      if (await conditionField.isVisible({ timeout: 3000 })) {
        await conditionField.click();
        await wait(500);
        
        // Procurar opção da condição
        const option = this.page.getByText(new RegExp(condition, 'i')).first();
        if (await option.isVisible({ timeout: 2000 })) {
          await option.click();
          await waitWithLog(this.throttleMs, 'Aguardando após selecionar condição');
          info(`Condição selecionada: ${condition}`);
        }
      }
    } catch (err) {
      warn('Não foi possível selecionar condição:', err);
    }
  }

  /**
   * Publica o anúncio
   */
  async publish(): Promise<void> {
    try {
      info('Publicando anúncio...');
      
      const strategies = [
        () => this.page.getByRole('button', { name: t.buttons.publish }),
        () => this.page.getByText(t.buttons.publish).first(),
        () => this.page.locator('button').filter({ hasText: t.buttons.publish }),
        () => this.page.locator('[data-testid*="publish"]'),
        () => this.page.locator('button').filter({ hasText: /publicar|publish|postar|post/i }),
      ];

      for (const strategy of strategies) {
        try {
          const button = strategy().first();
          if (await button.isVisible({ timeout: 5000 })) {
            await button.scrollIntoViewIfNeeded();
            await button.click();
            await waitWithLog(2000, 'Aguardando confirmação de publicação');
            info('Botão de publicar clicado com sucesso');
            return;
          }
        } catch (err) {
          debug('Estratégia de publicação falhou, tentando próxima...');
        }
      }

      throw new Error('Botão de publicar não encontrado');
    } catch (err) {
      error('Erro ao publicar anúncio:', err);
      throw new Error(`Falha na publicação: ${err}`);
    }
  }

  /**
   * Verifica se há erros no formulário
   */
  async checkForErrors(): Promise<string[]> {
    const errors: string[] = [];
    
    try {
      // Procurar mensagens de erro comuns
      const errorSelectors = [
        '[role="alert"]',
        '.error',
        '[data-testid*="error"]',
        'div[style*="color: red"]',
        'span[style*="color: red"]'
      ];

      for (const selector of errorSelectors) {
        const errorElements = await this.page.locator(selector).all();
        for (const element of errorElements) {
          const text = await element.textContent();
          if (text && text.trim()) {
            errors.push(text.trim());
          }
        }
      }
    } catch (err) {
      debug('Erro ao verificar mensagens de erro:', err);
    }

    return errors;
  }

  /**
   * Aguarda o formulário estar pronto para preenchimento
   */
  async waitForForm(timeout: number = 10000): Promise<void> {
    debug('Aguardando formulário estar pronto...');
    
    try {
      // Aguardar pelo menos um campo principal estar visível
      await this.page.waitForFunction(() => {
        const titleSelectors = ['input[name*="title"]', 'textarea[name*="title"]'];
        const priceSelectors = ['input[name*="price"]', 'input[type="number"]'];
        
        const hasTitle = titleSelectors.some(sel => document.querySelector(sel));
        const hasPrice = priceSelectors.some(sel => document.querySelector(sel));
        
        return hasTitle || hasPrice;
      }, { timeout });
      
      debug('Formulário pronto para preenchimento');
    } catch (err) {
      throw new Error(`Timeout aguardando formulário: ${err}`);
    }
  }
}

/**
 * Função utilitária para criar anúncio completo
 */
export async function createListing(
  ctx: BrowserContext, 
  startUrl: string, 
  data: ListingData,
  throttleMs: number = 350
): Promise<Page> {
  const page = await ctx.newPage();
  
  try {
    await page.goto(startUrl, { waitUntil: 'domcontentloaded' });
    
    const automation = new MarketplaceAutomation(page, throttleMs);
    await automation.waitForForm();
    await automation.createListing(data);
    
    return page;
  } catch (err) {
    await page.close();
    throw err;
  }
}

/**
 * Função utilitária para publicar anúncio
 */
export async function publish(page: Page, throttleMs: number = 350): Promise<void> {
  const automation = new MarketplaceAutomation(page, throttleMs);
  await automation.publish();
}