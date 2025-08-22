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

      // Preencher campos do formulário na ordem: título, preço, categoria
      await this.fillTitle(data.title);
      await this.fillPrice(data.price);
      
      // Selecionar categoria logo após o preço
      if (data.category) {
        info(`🏷️ Selecionando categoria: ${data.category}`);
        await this.selectCategory(data.category);
      } else {
        info('⚠️ Campo category não encontrado no flow.json');
      }
      
      // Selecionar condição logo após a categoria
      if (data.condition) {
        info(`🔧 Selecionando condição: ${data.condition}`);
        await this.selectCondition(data.condition);
      } else {
        info('⚠️ Campo condition não encontrado no flow.json ou está vazio');
      }
      
      await this.fillDescription(data.description);

      // Upload de imagens se fornecidas
      if (data.images && data.images.length > 0) {
        await this.uploadImages(data.images);
      }

      // Configurar disponibilidade
      await this.selectAvailability();

      // Configurar localização
      if (data.location) {
        await this.selectLocation(data.location);
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
          await wait(100);
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
      () => this.page.getByRole('textbox', { name: 'Título' }),
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
          await wait(150);
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
      () => this.page.getByRole('textbox', { name: 'Preço' }),
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
          await wait(150);
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
      () => this.page.getByRole('textbox', { name: 'Descrição' }),
      () => this.page.locator('textarea[placeholder*="Descrição"]'),
      () => this.page.locator('textarea[placeholder*="descrição"]'),
      () => this.page.locator('textarea[aria-label*="Descrição"]'),
      () => this.page.locator('textarea[aria-label*="descrição"]'),
      () => this.page.locator('div[contenteditable="true"][aria-label*="Descrição"]'),
      () => this.page.locator('div[contenteditable="true"][aria-label*="descrição"]'),
      // Estratégias mais genéricas
      () => this.page.locator('textarea').first(),
      () => this.page.locator('div[contenteditable="true"]').first(),
      () => this.page.locator('[role="textbox"]').first(),
      () => this.page.locator('textarea[placeholder*="Tell"]'),
      () => this.page.locator('textarea[placeholder*="Conte"]'),
      () => this.page.locator('textarea[placeholder*="Descreva"]'),
      () => this.page.locator('div[contenteditable="true"][data-text*="true"]'),
      () => this.page.locator('div[contenteditable="true"][aria-multiline="true"]'),
      // Fallbacks mais amplos
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
          await wait(100);
          await field.click();
          await wait(500);
          await field.fill(description);
          await waitWithLog(this.throttleMs, 'Aguardando após preencher descrição');
          info(`Descrição preenchida (${description.length} caracteres)`);
          return;
        }
      } catch (err) {
        debug('Estratégia de descrição falhou, tentando próxima...');
      }
    }

    // Debug: listar elementos disponíveis
    try {
      debug('Listando elementos de texto disponíveis na página...');
      const textareas = await this.page.locator('textarea').count();
      const editableDivs = await this.page.locator('div[contenteditable="true"]').count();
      const textboxes = await this.page.locator('[role="textbox"]').count();
      debug(`Encontrados: ${textareas} textareas, ${editableDivs} divs editáveis, ${textboxes} textboxes`);
      
      // Tentar pegar qualquer textarea visível
      const anyTextarea = this.page.locator('textarea').first();
      if (await anyTextarea.isVisible({ timeout: 2000 })) {
        debug('Tentando usar primeira textarea encontrada...');
        await anyTextarea.scrollIntoViewIfNeeded();
         await wait(100);
        await anyTextarea.click();
        await wait(500);
        await anyTextarea.fill(description);
        await waitWithLog(this.throttleMs, 'Aguardando após preencher descrição');
        info(`Descrição preenchida em textarea genérica (${description.length} caracteres)`);
        return;
      }
      
      // Tentar pegar qualquer div editável visível
      const anyEditableDiv = this.page.locator('div[contenteditable="true"]').first();
      if (await anyEditableDiv.isVisible({ timeout: 2000 })) {
        debug('Tentando usar primeira div editável encontrada...');
        await anyEditableDiv.scrollIntoViewIfNeeded();
         await wait(100);
        await anyEditableDiv.click();
        await wait(500);
        await anyEditableDiv.fill(description);
        await waitWithLog(this.throttleMs, 'Aguardando após preencher descrição');
        info(`Descrição preenchida em div editável genérica (${description.length} caracteres)`);
        return;
      }
    } catch (debugErr) {
      debug('Erro durante debug de elementos:', debugErr);
    }

    warn('Campo de descrição não encontrado - continuando sem descrição');
  }

  /**
   * Faz upload de imagens
   */
  private async uploadImages(imagePaths: string[]): Promise<void> {
    info(`📷 [UPLOAD] Iniciando upload de ${imagePaths.length} imagens...`);
    info(`📷 [UPLOAD] Caminhos recebidos: ${imagePaths.join(', ')}`);
    
    // Validar se os arquivos existem
    const validPaths = imagePaths.filter((imagePath, index) => {
      const fullPath = path.resolve(imagePath);
      info(`📷 [UPLOAD] Validando imagem ${index + 1}/${imagePaths.length}: ${imagePath}`);
      info(`📷 [UPLOAD] Caminho absoluto: ${fullPath}`);
      
      if (!fs.existsSync(fullPath)) {
        warn(`📷 [UPLOAD] ❌ Imagem não encontrada: ${imagePath}`);
        warn(`📷 [UPLOAD] ❌ Caminho absoluto testado: ${fullPath}`);
        return false;
      }
      
      // Verificar tamanho do arquivo
      try {
        const stats = fs.statSync(fullPath);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        info(`📷 [UPLOAD] ✅ Imagem válida encontrada: ${fullPath}`);
        info(`📷 [UPLOAD] ✅ Tamanho do arquivo: ${fileSizeMB} MB`);
        return true;
      } catch (err) {
        warn(`📷 [UPLOAD] ❌ Erro ao verificar arquivo: ${fullPath}`, err);
        return false;
      }
    });

    info(`📷 [UPLOAD] Resultado da validação: ${validPaths.length}/${imagePaths.length} imagens válidas`);
    
    if (validPaths.length === 0) {
      warn('📷 [UPLOAD] ❌ Nenhuma imagem válida encontrada para upload');
      return;
    }
    
    info(`📷 [UPLOAD] Imagens válidas para upload: ${validPaths.join(', ')}`);

    try {
      // Estratégia 1: Procurar botão "Adicionar fotos" e clicar nele primeiro
      info('📷 [UPLOAD] 🔍 Estratégia 1: Procurando botão "Adicionar fotos"...');
      const addPhotosButton = this.page.locator('div[aria-label*="Adicionar fotos"], div[aria-label*="Add photos"], div[role="button"]:has-text("Adicionar fotos"), div[role="button"]:has-text("Add photos")').first();
      
      const buttonCount = await addPhotosButton.count();
      info(`📷 [UPLOAD] Botões "Adicionar fotos" encontrados: ${buttonCount}`);
      
      if (await addPhotosButton.isVisible({ timeout: 3000 })) {
        info('📷 [UPLOAD] ✅ Botão "Adicionar fotos" encontrado e visível, clicando...');
        await addPhotosButton.click();
        info('📷 [UPLOAD] ✅ Botão "Adicionar fotos" clicado com sucesso');
        await wait(1000);
      } else {
        info('📷 [UPLOAD] ⚠️ Botão "Adicionar fotos" não encontrado ou não visível');
      }

      // Estratégia 2: Procurar input de arquivo
      info('📷 [UPLOAD] 🔍 Estratégia 2: Procurando campo de input de arquivo...');
      
      const fileInputStrategies = [
        // Input direto
        () => this.page.locator('input[type="file"][accept*="image"]').first(),
        () => this.page.locator('input[type="file"]').first(),
        // Input dentro de elementos específicos
        () => this.page.locator('[data-testid*="photo"] input[type="file"]').first(),
        () => this.page.locator('[aria-label*="foto"] input[type="file"]').first(),
        () => this.page.locator('[aria-label*="photo"] input[type="file"]').first(),
        // Input oculto que pode estar em qualquer lugar
        () => this.page.locator('input[type="file"][multiple]').first(),
      ];

      const strategyNames = [
        'input[type="file"][accept*="image"]',
        'input[type="file"]',
        '[data-testid*="photo"] input[type="file"]',
        '[aria-label*="foto"] input[type="file"]',
        '[aria-label*="photo"] input[type="file"]',
        'input[type="file"][multiple]'
      ];

      let uploadSuccess = false;
      info(`📷 [UPLOAD] Testando ${fileInputStrategies.length} estratégias de input de arquivo...`);
      
      for (let i = 0; i < fileInputStrategies.length; i++) {
        try {
          info(`📷 [UPLOAD] 🔄 Testando estratégia ${i + 1}/${fileInputStrategies.length}: ${strategyNames[i]}`);
          const strategy = fileInputStrategies[i];
          if (!strategy) {
            warn(`📷 [UPLOAD] ❌ Estratégia ${i + 1} não definida`);
            continue;
          }
          const fileInput = strategy();
          
          // Verificar se o input existe (mesmo que não esteja visível)
          const inputCount = await fileInput.count();
          info(`📷 [UPLOAD] Inputs encontrados com estratégia ${i + 1}: ${inputCount}`);
          
          if (inputCount > 0) {
            info(`📷 [UPLOAD] ✅ Input de arquivo encontrado (estratégia ${i + 1}: ${strategyNames[i]})`);
            
            const resolvedPaths = validPaths.map(p => path.resolve(p));
            info(`📷 [UPLOAD] 📤 Enviando ${resolvedPaths.length} arquivos...`);
            info(`📷 [UPLOAD] 📤 Caminhos absolutos: ${resolvedPaths.join(', ')}`);
            
            // Usar setInputFiles que funciona mesmo com inputs ocultos
            info(`📷 [UPLOAD] 🔄 Executando setInputFiles...`);
            await fileInput.setInputFiles(resolvedPaths);
            info(`📷 [UPLOAD] ✅ setInputFiles executado com sucesso`);
            
            // Aguardar mais tempo para o upload processar
            await waitWithLog(3000, '📷 [UPLOAD] Aguardando processamento das imagens');
            
            // Verificar se as imagens foram carregadas
            info(`📷 [UPLOAD] 🔄 Aguardando finalização do upload...`);
            await wait(2000);
            
            info(`📷 [UPLOAD] ✅ Upload realizado com sucesso: ${validPaths.length} imagens (estratégia ${i + 1})`);
            uploadSuccess = true;
            break;
          } else {
            info(`📷 [UPLOAD] ⚠️ Estratégia ${i + 1} não encontrou inputs`);
          }
        } catch (err) {
          warn(`📷 [UPLOAD] ❌ Estratégia ${i + 1} falhou:`, err);
        }
      }

      if (!uploadSuccess) {
        info(`📷 [UPLOAD] ⚠️ Todas as ${fileInputStrategies.length} estratégias falharam`);
        
        // Última tentativa: forçar input em qualquer elemento file
        try {
          info('📷 [UPLOAD] 🔄 Tentativa final: procurando qualquer input de arquivo...');
          const anyFileInput = this.page.locator('input[type="file"]');
          const count = await anyFileInput.count();
          info(`📷 [UPLOAD] Total de inputs de arquivo encontrados na página: ${count}`);
          
          if (count > 0) {
            info(`📷 [UPLOAD] ✅ Encontrados ${count} inputs de arquivo, tentando o primeiro...`);
            const resolvedPaths = validPaths.map(p => path.resolve(p));
            info(`📷 [UPLOAD] 📤 Tentativa final com ${resolvedPaths.length} arquivos`);
            
            await anyFileInput.first().setInputFiles(resolvedPaths);
            info(`📷 [UPLOAD] ✅ setInputFiles executado na tentativa final`);
            
            await waitWithLog(3000, '📷 [UPLOAD] Aguardando processamento das imagens (tentativa final)');
            info(`📷 [UPLOAD] ✅ Upload realizado (tentativa final): ${validPaths.length} imagens`);
            uploadSuccess = true;
          } else {
            warn('📷 [UPLOAD] ❌ Nenhum campo de upload de imagens encontrado na página');
            warn('📷 [UPLOAD] ❌ Continuando sem imagens - nenhum input de arquivo disponível');
          }
        } catch (finalErr) {
          warn('📷 [UPLOAD] ❌ Falha na tentativa final de upload:', finalErr);
        }
      }
      
      // Log final do resultado
      if (uploadSuccess) {
        info(`📷 [UPLOAD] 🎉 SUCESSO: Upload de ${validPaths.length} imagens concluído`);
      } else {
        warn(`📷 [UPLOAD] ❌ FALHA: Não foi possível fazer upload das imagens`);
        warn(`📷 [UPLOAD] ❌ Continuando criação do anúncio sem imagens`);
      }
      
    } catch (err) {
      error('📷 [UPLOAD] ❌ ERRO CRÍTICO durante upload de imagens:', err);
      warn('📷 [UPLOAD] ❌ Continuando sem imagens devido ao erro crítico');
    }
  }

  /**
   * Mapeamento de categorias do painel para textos do Facebook Marketplace
   */
  private getCategoryDisplayName(category: string): string {
    const categoryMap: Record<string, string> = {
      'tools': 'Ferramentas',
      'electronics': 'Eletrônicos',
      'clothing': 'Roupas',
      'home': 'Casa e jardim',
      'sports': 'Esportes',
      'vehicles': 'Veículos',
      'books': 'Livros',
      'toys': 'Brinquedos',
      'music': 'Música',
      'other': 'Outros'
    };
    
    return categoryMap[category] || category;
  }

  /**
   * Seleciona categoria do produto
   */
  private async selectCategory(category: string): Promise<void> {
    const displayCategory = this.getCategoryDisplayName(category);
    info(`🔍 Iniciando seleção de categoria: ${category} -> ${displayCategory}`);
    
    try {
      // Passo 1: Encontrar e clicar no botão "Categoria" para abrir o dropdown
      info('🎯 Passo 1: Procurando botão "Categoria" para abrir dropdown...');
      
      const categoryButtonStrategies = [
        // Estratégia que funciona: Label com role combobox contendo "Categoria"
        () => this.page.locator('label[role="combobox"]').filter({ hasText: 'Categoria' })
      ];

      let categoryButtonClicked = false;
      
      try {
        info(`🔄 Clicando no botão "Categoria"...`);
        const strategy = categoryButtonStrategies[0];
        if (!strategy) throw new Error('Estratégia não definida');
        
        const categoryButton = strategy();
        
        if (await categoryButton.isVisible({ timeout: 3000 })) {
          await categoryButton.scrollIntoViewIfNeeded();
          await wait(100);
          await wait(300);
          await categoryButton.click();
          info(`✅ Botão "Categoria" clicado com sucesso`);
          categoryButtonClicked = true;
        }
      } catch (err) {
        warn(`⚠️ Falha ao clicar no botão "Categoria":`, err);
      }
      
      if (!categoryButtonClicked) {
        throw new Error('Não foi possível encontrar ou clicar no botão "Categoria"');
      }
      
      // Passo 2: Aguardar dropdown abrir e selecionar a categoria desejada
      info(`🎯 Passo 2: Aguardando dropdown abrir e procurando categoria "${displayCategory}"...`);
      await wait(1000); // Aguardar dropdown abrir

      const categoryOptionStrategies = [
        // Estratégia que funciona: Texto exato da categoria
        () => this.page.getByText(displayCategory, { exact: true })
      ];

      let categorySelected = false;

      try {
        info(`🔄 Selecionando categoria "${displayCategory}"...`);
        const strategy = categoryOptionStrategies[0];
        if (!strategy) throw new Error('Estratégia não definida');

        const categoryOption = strategy();

        if (await categoryOption.isVisible({ timeout: 3000 })) {
          // Não fazer scroll para evitar que a categoria saia da view em dropdowns
          // await categoryOption.scrollIntoViewIfNeeded();
          
          // Tentar hover primeiro para garantir que está acessível
          try {
            await categoryOption.hover();
            await wait(200);
          } catch (hoverErr) {
            debug('Hover falhou, tentando click direto');
          }
          
          await wait(100);
          await categoryOption.click();
          info(`✅ Categoria "${displayCategory}" selecionada com sucesso`);
          categorySelected = true;
        }
      } catch (err) {
        warn(`⚠️ Falha ao selecionar categoria "${displayCategory}":`, err);
      }

      if (!categorySelected) {
        warn(`⚠️ Não foi possível selecionar a categoria "${displayCategory}" no dropdown`);
      }
      
      await wait(500); // Aguardar seleção ser processada
      
    } catch (err) {
      error('Erro ao selecionar categoria:', err);
      throw err;
    }
  }

  /**
   * Seleciona condição do produto
   */
  private async selectCondition(condition: string): Promise<void> {
    info(`🔍 Iniciando seleção de condição: ${condition}`);
    
    try {
      // Passo 1: Encontrar e clicar no combobox "Condição" para abrir o dropdown
      info('🎯 Passo 1: Procurando combobox "Condição" para abrir dropdown...');
      
      const conditionCombobox = this.page.getByRole('combobox', { name: 'Condição' });
      
      if (await conditionCombobox.isVisible({ timeout: 3000 })) {
        await conditionCombobox.scrollIntoViewIfNeeded();
        await wait(100);
        await conditionCombobox.click();
        info(`✅ Combobox "Condição" clicado com sucesso`);
        
        // Passo 2: Aguardar dropdown abrir e selecionar "Novo"
        info('🎯 Passo 2: Aguardando dropdown abrir e procurando condição "Novo"...');
        await wait(1000);
        
        info(`🔄 Selecionando condição "Novo"...`);
        const novoOption = this.page.getByRole('option', { name: 'Novo', exact: true }).locator('div').first();
        
        if (await novoOption.isVisible({ timeout: 2000 })) {
          await novoOption.click();
          await waitWithLog(this.throttleMs, 'Aguardando após selecionar condição');
          info(`✅ Condição "Novo" selecionada com sucesso`);
        } else {
          throw new Error('Opção "Novo" não encontrada no dropdown');
        }
      } else {
        throw new Error('Combobox "Condição" não encontrado');
      }
    } catch (err) {
      warn('Não foi possível selecionar condição:', err);
    }
  }

  /**
   * Seleciona disponibilidade do produto
   */
  private async selectAvailability(): Promise<void> {
    debug('Configurando disponibilidade do produto...');
    
    try {
      // Usar seletor específico para disponibilidade
      const availabilityCombobox = this.page.getByRole('combobox', { name: 'Disponibilidade' });
      
      if (await availabilityCombobox.isVisible({ timeout: 3000 })) {
        await availabilityCombobox.locator('div').nth(2).click();
        await wait(500);
        
        // Selecionar "Em estoque" como disponibilidade padrão
        const emEstoqueOption = this.page.getByLabel('Selecione uma opção').getByText('Anunciar como Em estoque');
        if (await emEstoqueOption.isVisible({ timeout: 2000 })) {
          await emEstoqueOption.click();
          await waitWithLog(this.throttleMs, 'Aguardando após selecionar disponibilidade');
          info('Disponibilidade selecionada: Em estoque');
        }
      }
    } catch (err) {
      warn('Não foi possível selecionar disponibilidade:', err);
    }
  }

  /**
   * Seleciona localização do produto
   */
  private async selectLocation(location: string): Promise<void> {
    debug(`Configurando localização: ${location}`);
    
    try {
      // Aguardar um pouco mais para garantir que a página carregou completamente
      await wait(1000);
      
      // Usar seletor específico para localização
      const locationCombobox = this.page.getByRole('combobox', { name: 'Localização' });
      
      if (await locationCombobox.isVisible({ timeout: 5000 })) {
        // Garantir que o elemento está visível e interagível
        await locationCombobox.scrollIntoViewIfNeeded();
        await wait(500);
        
        // Clicar no combobox
        await locationCombobox.click();
        await wait(1000); // Wait maior para modo headless
        
        // Digitar a localização fornecida pelo usuário
        await locationCombobox.fill(location);
        await wait(1000); // Aguardar sugestões aparecerem
        
        // Tentar selecionar a primeira opção da lista de sugestões
        const firstOption = this.page.locator('[role="option"]').first();
        if (await firstOption.isVisible({ timeout: 3000 })) {
          await firstOption.click();
          await waitWithLog(this.throttleMs, 'Aguardando após selecionar localização');
          info(`Localização selecionada: ${location}`);
        } else {
          // Se não houver sugestões, manter o texto digitado
          info(`Localização digitada: ${location}`);
        }
      } else {
        warn('Combobox de localização não encontrado');
      }
    } catch (err) {
      warn('Não foi possível selecionar localização:', err);
    }
  }

  /**
   * Publica o anúncio
   */
  async publish(): Promise<void> {
    try {
      info('📤 Iniciando processo de publicação...');
      
      // Passo 1: Clicar em "Avançar" para ir para a tela de publicação
      info('🎯 Passo 1: Procurando botão "Avançar"...');
      const advanceButton = this.page.getByRole('button', { name: 'Avançar' });
      
      if (await advanceButton.isVisible({ timeout: 5000 })) {
        await advanceButton.scrollIntoViewIfNeeded();
        await wait(100);
        await advanceButton.click();
        await waitWithLog(2000, 'Aguardando página de publicação carregar');
        info('✅ Botão "Avançar" clicado com sucesso');
      } else {
        throw new Error('Botão "Avançar" não encontrado');
      }
      
      // Passo 2: Aguardar página de confirmação carregar e procurar botão "Publicar"
      info('🎯 Passo 2: Procurando botão "Publicar" na página de confirmação...');
      await wait(2000); // Aguardar página carregar
      
      const publishStrategies = [
        // Botões específicos de publicar
        () => this.page.getByRole('button', { name: 'Publicar' }),
        () => this.page.getByRole('button', { name: 'Publish' }),
        () => this.page.getByText('Publicar', { exact: true }),
        () => this.page.getByText('Publish', { exact: true }),
        // Botões mais genéricos mas excluindo patrocínio
        () => this.page.locator('button').filter({ hasText: /^Publicar$/ }),
        () => this.page.locator('button').filter({ hasText: /^Publish$/ }),
        // Estratégia com seletor mais amplo
        () => this.page.locator('button:has-text("Publicar"):not(:has-text("Patrocin")):not(:has-text("Promov"))'),
        () => this.page.locator('button:has-text("Publish"):not(:has-text("Sponsor")):not(:has-text("Promot"))'),
      ];

      let publishSuccess = false;
      
      for (let i = 0; i < publishStrategies.length; i++) {
        try {
          const strategy = publishStrategies[i];
          if (!strategy) continue;
          const publishButton = strategy();
          
          if (await publishButton.isVisible({ timeout: 3000 })) {
            info(`✅ Botão "Publicar" encontrado (estratégia ${i + 1})`);
            await publishButton.scrollIntoViewIfNeeded();
            await wait(100);
            await publishButton.click();
            await waitWithLog(3000, 'Aguardando confirmação final de publicação');
            info('✅ Botão "Publicar" clicado com sucesso');
            publishSuccess = true;
            break;
          }
        } catch (err) {
          debug(`Estratégia de publicação ${i + 1} falhou:`, err);
        }
      }
      
      if (!publishSuccess) {
        // Verificar se já foi publicado automaticamente
        await wait(2000);
        const isPublished = await this.checkIfPublished();
        if (isPublished) {
          info('✅ Anúncio foi publicado automaticamente após clicar em "Avançar"');
        } else {
          throw new Error('Botão "Publicar" não encontrado e anúncio não foi publicado automaticamente');
        }
      }
      
      info('🎉 Processo de publicação concluído');
      
    } catch (err) {
      error('❌ Erro ao publicar anúncio:', err);
      throw new Error(`Falha na publicação: ${err}`);
    }
  }
  
  /**
   * Verifica se o anúncio foi publicado com sucesso
   */
  private async checkIfPublished(): Promise<boolean> {
    try {
      const publishedIndicators = [
        this.page.getByText('Anúncio publicado'),
        this.page.getByText('Ad published'),
        this.page.getByText('Publicado com sucesso'),
        this.page.getByText('Published successfully'),
        this.page.getByText('Seu anúncio foi publicado'),
        this.page.getByText('Your ad has been published'),
        this.page.locator('[data-testid*="success"]'),
        this.page.locator('.success'),
      ];
      
      for (const indicator of publishedIndicators) {
        if (await indicator.isVisible({ timeout: 1000 })) {
          return true;
        }
      }
      
      return false;
    } catch {
      return false;
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