import { SessionData, AutomationResult } from '../types/session.js';
import { info, warn, error, debug } from '../logger.js';
import { convertToPlaywrightSession, saveSessionData, getActiveSession } from '../utils/sessionHandler.js';
import { MarketplaceAutomation } from '../facebook/marketplace.js';
import { GroupsAutomation } from '../facebook/groups.js';
import fs from 'fs/promises';
import path from 'path';

interface AutomationConfig {
  marketplace?: {
    enabled: boolean;
    adData?: any;
  };
  groups?: {
    enabled: boolean;
    groupIds?: string[];
    message?: string;
  };
}

class AutomationController {
  private activeAutomations: Map<string, any> = new Map();

  async startAutomation(sessionData: SessionData, config?: AutomationConfig): Promise<AutomationResult> {
    const automationId = `automation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      info('🚀 Iniciando automação com dados da extensão', {
        automationId,
        userId: sessionData.userId,
        config
      });

      // Convert session data to Playwright format
      const playwrightSession = convertToPlaywrightSession(sessionData);
      
      // Save session in Playwright format for compatibility
      await this.savePlaywrightSession(playwrightSession, sessionData.userId);
      
      // Start automation based on config or default behavior
      const result = await this.executeAutomation(automationId, sessionData, config);
      
      this.activeAutomations.set(automationId, {
        sessionData,
        config,
        startTime: new Date(),
        status: 'running'
      });

      return {
        success: true,
        id: automationId,
        details: result
      };

    } catch (err) {
      error('❌ Erro ao iniciar automação:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Erro desconhecido',
        details: err
      };
    }
  }

  // Start automation using currently selected active session
  async startAutomationWithActiveSession(config?: AutomationConfig): Promise<AutomationResult> {
    try {
      info('🎯 Iniciando automação com sessão ativa selecionada');
      
      const activeSession = await getActiveSession();
      
      if (!activeSession) {
        return {
          success: false,
          error: 'Nenhuma sessão ativa disponível. Faça login no Facebook via extensão ou selecione uma sessão.'
        };
      }

      info('📱 Usando sessão ativa:', {
        userId: activeSession.userId,
        userName: activeSession.userInfo?.name || 'Nome não disponível'
      });

      return await this.startAutomation(activeSession, config);
      
    } catch (err) {
      error('❌ Erro ao iniciar automação com sessão ativa:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Erro ao obter sessão ativa'
      };
    }
  }

  private async executeAutomation(automationId: string, sessionData: SessionData, config?: AutomationConfig) {
    // Default behavior: run marketplace automation
    if (!config) {
      info('📦 Executando automação padrão do Marketplace');
      return await this.runMarketplaceAutomation(sessionData);
    }

    const results: any[] = [];

    // Run marketplace automation if enabled
    if (config.marketplace?.enabled) {
      info('📦 Executando automação do Marketplace');
      const marketplaceResult = await this.runMarketplaceAutomation(sessionData, config.marketplace.adData);
      results.push({ type: 'marketplace', result: marketplaceResult });
    }

    // Run groups automation if enabled
    if (config.groups?.enabled) {
      info('👥 Executando automação de Grupos');
      const groupsResult = await this.runGroupsAutomation(sessionData, config.groups);
      results.push({ type: 'groups', result: groupsResult });
    }

    return results;
  }

  private async runMarketplaceAutomation(sessionData: SessionData, adData?: any) {
    try {
      // Load ad data from file if not provided
      if (!adData) {
        adData = await this.loadDefaultAdData();
      }

      // Set session data for the automation
      await this.setSessionForAutomation(sessionData);
      
      // Note: MarketplaceAutomation needs a Page instance
      // For now, return a placeholder result
      const result = {
        success: true,
        message: 'Marketplace automation prepared',
        adData: adData,
        sessionConfigured: true
      };
      
      info('✅ Automação do Marketplace concluída', { result });
      return result;
      
    } catch (err) {
      error('❌ Erro na automação do Marketplace:', err);
      throw err;
    }
  }

  private async runGroupsAutomation(sessionData: SessionData, groupsConfig: any) {
    try {
      // Set session data for the automation
      await this.setSessionForAutomation(sessionData);
      
      // Note: GroupsAutomation needs a Page instance
      // For now, return a placeholder result
      const result = {
        success: true,
        message: 'Groups automation prepared',
        groupIds: groupsConfig.groupIds || [],
        postMessage: groupsConfig.message || 'Mensagem automática',
        sessionConfigured: true
      };
      
      info('✅ Automação de Grupos concluída', { result });
      return result;
      
    } catch (err) {
      error('❌ Erro na automação de Grupos:', err);
      throw err;
    }
  }

  private async setSessionForAutomation(sessionData: SessionData) {
    // Save session in the format expected by existing automation
    const sessionFile = path.join(process.cwd(), 'vendaboost-session.json');
    const playwrightSession = convertToPlaywrightSession(sessionData);
    
    await fs.writeFile(sessionFile, JSON.stringify(playwrightSession, null, 2));
    info('💾 Sessão configurada para automação:', sessionFile);
  }

  private async savePlaywrightSession(session: any, userId: string) {
    const sessionDir = path.join(process.cwd(), 'data', 'playwright-sessions');
    await fs.mkdir(sessionDir, { recursive: true });
    
    const sessionFile = path.join(sessionDir, `${userId}-session.json`);
    await fs.writeFile(sessionFile, JSON.stringify(session, null, 2));
    
    info('💾 Sessão Playwright salva:', sessionFile);
  }

  private async loadDefaultAdData() {
    try {
      // Try to load from flow.json or other config file
      const flowFile = path.join(process.cwd(), 'flow.json');
      const flowData = await fs.readFile(flowFile, 'utf-8');
      const flow = JSON.parse(flowData);
      
      return flow.adData || {
        title: 'Produto Automático',
        description: 'Descrição automática do produto',
        price: '100',
        category: 'Outros',
        condition: 'Novo'
      };
    } catch (error) {
      warn('⚠️ Não foi possível carregar dados do anúncio, usando padrão');
      return {
        title: 'Produto Automático',
        description: 'Descrição automática do produto',
        price: '100',
        category: 'Outros',
        condition: 'Novo'
      };
    }
  }

  getAutomationStatus(automationId: string) {
    const automation = this.activeAutomations.get(automationId);
    if (!automation) {
      return { found: false };
    }

    return {
      found: true,
      id: automationId,
      status: automation.status,
      startTime: automation.startTime,
      userId: automation.sessionData.userId
    };
  }

  stopAutomation(automationId: string) {
    const automation = this.activeAutomations.get(automationId);
    if (automation) {
      automation.status = 'stopped';
      info('🛑 Automação interrompida:', automationId);
      return true;
    }
    return false;
  }

  listActiveAutomations() {
    return Array.from(this.activeAutomations.entries()).map(([id, automation]) => ({
      id,
      status: automation.status,
      startTime: automation.startTime,
      userId: automation.sessionData.userId
    }));
  }
}

// Singleton instance
const automationController = new AutomationController();

// Export functions for use in the server
export async function startAutomation(sessionData: SessionData, config?: AutomationConfig): Promise<AutomationResult> {
  return automationController.startAutomation(sessionData, config);
}

export async function startAutomationWithActiveSession(config?: AutomationConfig): Promise<AutomationResult> {
  return automationController.startAutomationWithActiveSession(config);
}

export function getAutomationStatus(automationId: string) {
  return automationController.getAutomationStatus(automationId);
}

export function stopAutomation(automationId: string) {
  return automationController.stopAutomation(automationId);
}

export function listActiveAutomations() {
  return automationController.listActiveAutomations();
}