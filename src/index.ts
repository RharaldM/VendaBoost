import type { FlowInput as FlowData } from './config.js';
import { loadAppConfig } from './config.js';
import { BrowserSession } from './session/browser.js';
import { MarketplaceAutomation } from './facebook/marketplace.js';
import { GroupsAutomation } from './facebook/groups.js';
import { PublicationAssertions, type PublicationResult } from './facebook/assertions.js';
import { info, warn, error, debug, setLogLevel } from './logger.js';

/**
 * Interface para opções de execução do fluxo
 */
export interface FlowOptions {
  /** Dados do fluxo (anúncio) */
  flowData: FlowData;
  /** Lista de nomes de grupos para publicar */
  groupNames?: string[];
  /** Configurações personalizadas */
  config?: {
    throttleMs?: number;
    headless?: boolean;
    timeout?: number;
    retries?: number;
    extensionSession?: string;
    autoExtension?: boolean;
  };
}

/**
 * Resultado da execução do fluxo
 */
export interface FlowResult {
  success: boolean;
  message: string;
  timestamp: Date;
  listingUrl?: string;
  groupsCount?: number;
  publicationResult?: PublicationResult;
  error?: string;
}

/**
 * Classe principal para automação do VendaBoost
 */
export class VendaBoostAutomation {
  private browserSession: BrowserSession | null = null;
  private config: ReturnType<typeof loadAppConfig>;

  constructor() {
    this.config = loadAppConfig();
    setLogLevel(this.config.logLevel);
  }

  /**
   * Executa o fluxo completo de automação
   */
  async runFlow(options: FlowOptions): Promise<FlowResult> {
    const startTime = new Date();
    info('🚀 Iniciando automação VendaBoost...');
    
    try {
      // Validar dados de entrada
      this.validateFlowOptions(options);
      
      // Inicializar sessão do browser
      await this.initializeBrowser(
        options.config?.headless,
        options.config?.extensionSession,
        options.config?.autoExtension
      );
      
      if (!this.browserSession) {
        throw new Error('Falha ao inicializar sessão do browser');
      }

      const page = await this.browserSession.newPage();
      
      // Aplicar dados de sessão ANTES de navegar se disponíveis
      if (options.config?.extensionSession || options.config?.autoExtension) {
        info('🔧 Aplicando dados de sessão da extensão antes da navegação...');
        
        // Primeiro navegar para Facebook para que localStorage funcione
        await this.browserSession.navigateTo(page, 'https://www.facebook.com');
        
        // Aplicar localStorage e sessionStorage
        await this.browserSession.applyExtensionStorageData(page);
        
        // Aguardar processamento
        await page.waitForTimeout(3000);
        info('✅ Dados de sessão aplicados');
      }
      
      // Navegar para URL final (Marketplace)
      await this.browserSession.navigateTo(page, this.config.startUrl);
      
      // Verificar se está logado
      const isLoggedIn = await this.browserSession.isLoggedIn(page);
      if (!isLoggedIn) {
        info('⚠️ Login necessário. Aguardando login manual...');
        await this.browserSession.waitForLogin(page);
      }

      info('✅ Login confirmado, iniciando automação...');

      // Criar automações
      const marketplace = new MarketplaceAutomation(page, options.config?.throttleMs || this.config.throttleMs);
      
      const groups = new GroupsAutomation(page, {
        throttleMs: options.config?.throttleMs || this.config.throttleMs
      });
      
      const assertions = new PublicationAssertions(page, {
        timeout: options.config?.timeout || 30000
      });

      // Executar fluxo
      info('📝 Criando anúncio no Marketplace...');
      const listingData = {
        title: options.flowData.title,
        price: options.flowData.price,
        description: options.flowData.description,
        ...(options.flowData.category && { category: options.flowData.category }),
        ...(options.flowData.condition && { condition: options.flowData.condition }),
        ...(options.flowData.location && { location: options.flowData.location }),
        ...(options.flowData.images && { images: options.flowData.images }),
        ...(options.flowData.groups && { groups: options.flowData.groups })
      };
      await marketplace.createListing(listingData);
      
      // Selecionar grupos se especificados
      if (options.groupNames && options.groupNames.length > 0) {
        info(`🎯 Selecionando ${options.groupNames.length} grupos...`);
        await groups.selectGroupsByName(options.groupNames);
      }

      // Publicar
      info('📤 Publicando anúncio...');
      await marketplace.publish();

      // Verificar publicação
      info('🔍 Verificando se a publicação foi bem-sucedida...');
      const publicationResult = await assertions.assertPublished();

      // Obter contagem de grupos
      const groupsCount = await assertions.getSelectedGroupsCount();

      // Resultado final
      const result: FlowResult = {
        success: publicationResult.success,
        message: publicationResult.success 
          ? `Anúncio publicado com sucesso! ${groupsCount > 0 ? `Distribuído para ${groupsCount} grupos.` : ''}`
          : `Falha na publicação: ${publicationResult.message}`,
        timestamp: startTime,
        ...(publicationResult.url && { listingUrl: publicationResult.url }),
        groupsCount,
        publicationResult
      };

      if (result.success) {
        info(`🎉 ${result.message}`);
      } else {
        warn(`❌ ${result.message}`);
      }

      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      error('💥 Erro durante execução do fluxo:', errorMessage);
      
      return {
        success: false,
        message: `Erro na automação: ${errorMessage}`,
        timestamp: startTime,
        error: errorMessage
      };
    } finally {
      // Cleanup opcional - manter browser aberto para debug
      if (this.config.debug === false) {
        await this.cleanup();
      } else {
        info('🔧 Modo debug ativo - browser mantido aberto');
      }
    }
  }

  /**
   * Executa apenas a criação do anúncio (sem grupos)
   */
  async createListingOnly(flowData: FlowData): Promise<FlowResult> {
    return this.runFlow({ flowData });
  }

  /**
   * Executa apenas a seleção de grupos (assumindo que já existe um anúncio criado)
   */
  async selectGroupsOnly(groupNames: string[], extensionSession?: string, autoExtension?: boolean): Promise<FlowResult> {
    info('🎯 Executando apenas seleção de grupos...');
    
    try {
      if (!this.browserSession) {
        await this.initializeBrowser(false, extensionSession, autoExtension);
      }

      if (!this.browserSession) {
        throw new Error('Falha ao inicializar sessão do browser');
      }

      const page = await this.browserSession.newPage();
      const groups = new GroupsAutomation(page, {
        throttleMs: this.config.throttleMs
      });

      await groups.selectGroupsByName(groupNames);

      return {
        success: true,
        message: `${groupNames.length} grupos selecionados com sucesso`,
        timestamp: new Date(),
        groupsCount: groupNames.length
      };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      error('Erro na seleção de grupos:', errorMessage);
      
      return {
        success: false,
        message: `Erro na seleção de grupos: ${errorMessage}`,
        timestamp: new Date(),
        error: errorMessage
      };
    }
  }

  /**
   * Inicializa a sessão do browser
   */
  private async initializeBrowser(headless?: boolean, extensionSession?: string, autoExtension?: boolean): Promise<void> {
    debug('Inicializando sessão do browser...');
    
    this.browserSession = new BrowserSession({
      userDataDir: this.config.userDataDir,
      headless: headless ?? false // Sempre visível por padrão
    });

    await this.browserSession.launch();

    // Se especificado, carrega dados da extensão
    if (extensionSession || autoExtension) {
      info(`🔧 Tentando carregar dados da extensão: extensionSession=${extensionSession}, autoExtension=${autoExtension}`);
      try {
        const success = await this.browserSession.initializeWithExtensionData(extensionSession, autoExtension);
        if (success) {
          info('🔑 Sessão da extensão carregada com sucesso');
        } else {
          warn('⚠️ Falha ao carregar dados da extensão: método retornou false');
        }
      } catch (err) {
        warn('⚠️ Falha ao carregar dados da extensão:', err instanceof Error ? err.message : String(err));
      }
    } else {
      info('ℹ️ Nenhuma extensão especificada para carregar');
    }

    info('🌐 Browser inicializado com sucesso');
  }

  /**
   * Valida as opções do fluxo
   */
  private validateFlowOptions(options: FlowOptions): void {
    if (!options.flowData) {
      throw new Error('flowData é obrigatório');
    }

    if (!options.flowData.title || options.flowData.title.trim().length === 0) {
      throw new Error('Título do anúncio é obrigatório');
    }

    const price = typeof options.flowData.price === 'string' ? parseFloat(options.flowData.price) : options.flowData.price;
    if (!options.flowData.price || price <= 0 || isNaN(price)) {
      throw new Error('Preço deve ser maior que zero');
    }

    if (!options.flowData.description || options.flowData.description.trim().length === 0) {
      throw new Error('Descrição do anúncio é obrigatória');
    }

    if (options.groupNames && options.groupNames.length > 50) {
      warn('⚠️ Muitos grupos especificados (>50). Considere reduzir para evitar limitações do Facebook.');
    }

    debug('✅ Validação das opções concluída');
  }

  /**
   * Limpa recursos
   */
  async cleanup(): Promise<void> {
    debug('Limpando recursos...');
    
    try {
      if (this.browserSession) {
        await this.browserSession.close();
        this.browserSession = null;
      }
      info('🧹 Cleanup concluído');
    } catch (err) {
      warn('Erro durante cleanup:', err);
    }
  }

  /**
   * Obtém informações sobre a sessão atual
   */
  getSessionInfo(): { isActive: boolean; config: any } {
    return {
      isActive: this.browserSession !== null,
      config: this.config
    };
  }
}

/**
 * Função utilitária para executar fluxo completo
 */
export async function runFlow(options: FlowOptions): Promise<FlowResult> {
  const automation = new VendaBoostAutomation();
  return await automation.runFlow(options);
}

/**
 * Função utilitária para criar apenas anúncio
 */
export async function createListingOnly(flowData: FlowData): Promise<FlowResult> {
  const automation = new VendaBoostAutomation();
  return await automation.createListingOnly(flowData);
}

/**
 * Função utilitária para selecionar apenas grupos
 */
export async function selectGroupsOnly(groupNames: string[], extensionSession?: string, autoExtension?: boolean): Promise<FlowResult> {
  const automation = new VendaBoostAutomation();
  return await automation.selectGroupsOnly(groupNames, extensionSession, autoExtension);
}

// Exportar tipos principais
export type { FlowData, PublicationResult };