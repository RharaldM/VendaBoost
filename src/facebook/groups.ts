import type { Page } from 'playwright';
import { t, escapeRegex } from '../utils/i18n.js';
import { wait, waitWithLog, info, warn, error, debug } from '../logger.js';

/**
 * Interface para configurações de seleção de grupos
 */
export interface GroupSelectionConfig {
  throttleMs: number;
  maxRetries: number;
  searchDelay: number;
  selectionTimeout: number;
}

/**
 * Classe para automação de seleção de grupos
 */
export class GroupsAutomation {
  private page: Page;
  private config: GroupSelectionConfig;

  constructor(page: Page, config: Partial<GroupSelectionConfig> = {}) {
    this.page = page;
    this.config = {
      throttleMs: 350,
      maxRetries: 3,
      searchDelay: 1000,
      selectionTimeout: 10000,
      ...config
    };
  }

  /**
   * Abre o modal "Anunciar mais locais" e seleciona grupos pelo nome
   */
  async selectGroupsByName(groupNames: string[]): Promise<void> {
    if (!groupNames || groupNames.length === 0) {
      info('Nenhum grupo especificado para seleção');
      return;
    }

    try {
      info(`Iniciando seleção de ${groupNames.length} grupos...`);
      
      // Abrir modal de grupos
      await this.openGroupsModal();
      
      // Aguardar modal estar pronto
      await this.waitForModal();
      
      // Selecionar cada grupo
      const results = await this.selectGroups(groupNames);
      
      // Confirmar seleção
      await this.confirmSelection();
      
      info(`Seleção concluída: ${results.selected.length} grupos selecionados, ${results.failed.length} falharam`);
      
      if (results.failed.length > 0) {
        warn('Grupos que falharam:', results.failed);
      }
      
    } catch (err) {
      error('Erro na seleção de grupos:', err);
      throw new Error(`Falha na seleção de grupos: ${err}`);
    }
  }

  /**
   * Abre o modal de seleção de grupos
   */
  private async openGroupsModal(): Promise<void> {
    debug('Abrindo modal de grupos...');
    
    const strategies = [
      () => this.page.getByRole('button', { name: t.buttons.postToMorePlaces }),
      () => this.page.getByText(t.buttons.postToMorePlaces).first(),
      () => this.page.locator('button').filter({ hasText: t.buttons.postToMorePlaces }),
      () => this.page.locator('[data-testid*="more"]').filter({ hasText: /mais|more|grupos|groups/i }),
      () => this.page.locator('button').filter({ hasText: /anunciar mais|post to more|compartilhar|share/i }),
    ];

    for (const strategy of strategies) {
      try {
        const button = strategy().first();
        if (await button.isVisible({ timeout: 3000 })) {
          await button.scrollIntoViewIfNeeded();
        await wait(100);
          await button.click();
          await waitWithLog(this.config.throttleMs, 'Aguardando modal abrir');
          debug('Modal de grupos aberto com sucesso');
          return;
        }
      } catch (err) {
        debug('Estratégia de abertura falhou, tentando próxima...');
      }
    }

    throw new Error('Botão para abrir modal de grupos não encontrado');
  }

  /**
   * Aguarda o modal estar pronto para uso
   */
  private async waitForModal(): Promise<void> {
    debug('Aguardando modal estar pronto...');
    
    try {
      // Aguardar modal aparecer
      const modalSelectors = [
        '[role="dialog"]',
        '[data-visualcompletion="ignore-dynamic"]',
        'div[style*="position: fixed"]',
        '.modal',
        '[aria-modal="true"]'
      ];

      let modal = null;
      for (const selector of modalSelectors) {
        try {
          modal = this.page.locator(selector).last();
          if (await modal.isVisible({ timeout: 2000 })) {
            break;
          }
        } catch {
          continue;
        }
      }

      if (!modal) {
        throw new Error('Modal não encontrado');
      }

      // Aguardar campo de busca estar disponível
      await this.page.waitForFunction(() => {
        const searchSelectors = [
          'input[type="text"]',
          'input[placeholder*="esquisar"]',
          'input[placeholder*="earch"]',
          'input[placeholder*="uscar"]'
        ];
        
        return searchSelectors.some(sel => {
          const element = document.querySelector(sel) as HTMLElement;
          return element && element.offsetParent !== null;
        });
      }, { timeout: this.config.selectionTimeout });

      debug('Modal pronto para uso');
    } catch (err) {
      throw new Error(`Timeout aguardando modal: ${err}`);
    }
  }

  /**
   * Seleciona múltiplos grupos
   */
  private async selectGroups(groupNames: string[]): Promise<{selected: string[], failed: string[]}> {
    const selected: string[] = [];
    const failed: string[] = [];

    for (const groupName of groupNames) {
      if (!groupName || groupName.trim().length === 0) {
        continue;
      }

      try {
        await this.selectSingleGroup(groupName.trim());
        selected.push(groupName);
        info(`✓ Grupo selecionado: ${groupName}`);
      } catch (err) {
        failed.push(groupName);
        warn(`✗ Falha ao selecionar grupo: ${groupName} - ${err}`);
      }

      // Aguardar entre seleções
      await wait(this.config.throttleMs);
    }

    return { selected, failed };
  }

  /**
   * Seleciona um único grupo pelo nome
   */
  private async selectSingleGroup(groupName: string): Promise<void> {
    debug(`Selecionando grupo: ${groupName}`);
    
    // Limpar campo de busca e digitar nome do grupo
    await this.searchGroup(groupName);
    
    // Aguardar resultados da busca
    await wait(this.config.searchDelay);
    
    // Encontrar e clicar na opção do grupo
    await this.clickGroupOption(groupName);
  }

  /**
   * Busca por um grupo específico
   */
  private async searchGroup(groupName: string): Promise<void> {
    debug(`Buscando grupo: ${groupName}`);
    
    const searchStrategies = [
      () => this.page.getByRole('textbox', { name: t.labels.groupSearch }),
      () => this.page.getByPlaceholder(t.labels.groupSearch),
      () => this.page.locator('input[type="text"]').first(),
      () => this.page.locator('input[placeholder*="esquisar"]'),
      () => this.page.locator('input[placeholder*="earch"]'),
      () => this.page.locator('input[placeholder*="uscar"]'),
    ];

    let searchBox = null;
    for (const strategy of searchStrategies) {
      try {
        const box = strategy().first();
        if (await box.isVisible({ timeout: 1000 })) {
          searchBox = box;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!searchBox) {
      throw new Error('Campo de busca não encontrado');
    }

    // Limpar campo e digitar nome
    await searchBox.click();
    await searchBox.selectText().catch(() => {});
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Delete');
    await searchBox.type(groupName, { delay: 50 });
    
    debug(`Texto digitado no campo de busca: ${groupName}`);
  }

  /**
   * Clica na opção do grupo nos resultados da busca
   */
  private async clickGroupOption(groupName: string): Promise<void> {
    debug(`Procurando opção do grupo: ${groupName}`);
    
    // Estratégias para encontrar a opção do grupo
    const modal = this.page.locator('[role="dialog"]').last();
    const escapedName = escapeRegex(groupName);
    const nameRegex = new RegExp(`^${escapedName}$`, 'i');
    const partialRegex = new RegExp(escapedName, 'i');

    const optionStrategies = [
      // Busca exata por role
      () => modal.getByRole('option', { name: nameRegex }),
      () => modal.getByRole('menuitemcheckbox', { name: nameRegex }),
      () => modal.getByRole('checkbox', { name: nameRegex }),
      
      // Busca parcial por role
      () => modal.getByRole('option', { name: partialRegex }),
      () => modal.getByRole('menuitemcheckbox', { name: partialRegex }),
      
      // Busca por texto
      () => modal.getByText(nameRegex),
      () => modal.getByText(partialRegex),
      
      // Busca em elementos clicáveis
      () => modal.locator('div[role="button"]').filter({ hasText: nameRegex }),
      () => modal.locator('div[role="button"]').filter({ hasText: partialRegex }),
      () => modal.locator('[data-testid*="group"]').filter({ hasText: partialRegex }),
      
      // Busca em listas
      () => modal.locator('li').filter({ hasText: nameRegex }),
      () => modal.locator('li').filter({ hasText: partialRegex }),
    ];

    for (const strategy of optionStrategies) {
      try {
        const option = strategy().first();
        if (await option.isVisible({ timeout: 2000 })) {
          await option.scrollIntoViewIfNeeded();
        await wait(100);
          await option.click();
          debug(`Opção clicada com sucesso: ${groupName}`);
          return;
        }
      } catch (err) {
        debug(`Estratégia falhou para ${groupName}:`, err);
      }
    }

    throw new Error(`Grupo não encontrado nos resultados: ${groupName}`);
  }

  /**
   * Confirma a seleção de grupos (salvar/fechar modal)
   */
  private async confirmSelection(): Promise<void> {
    debug('Confirmando seleção de grupos...');
    
    const modal = this.page.locator('[role="dialog"]').last();
    
    const confirmStrategies = [
      () => modal.getByRole('button', { name: t.buttons.save }),
      () => modal.getByRole('button', { name: t.buttons.next }),
      () => modal.getByRole('button', { name: t.buttons.close }),
      () => modal.getByText(t.buttons.save).first(),
      () => modal.locator('button').filter({ hasText: t.buttons.save }),
      () => modal.locator('button').filter({ hasText: /salvar|save|concluído|done|aplicar|apply/i }),
    ];

    for (const strategy of confirmStrategies) {
      try {
        const button = strategy().first();
        if (await button.isVisible({ timeout: 2000 })) {
          await button.click();
          await waitWithLog(this.config.throttleMs, 'Aguardando confirmação');
          debug('Seleção confirmada com sucesso');
          return;
        }
      } catch (err) {
        debug('Estratégia de confirmação falhou, tentando próxima...');
      }
    }

    // Se não encontrar botão de confirmação, tentar fechar modal com ESC
    try {
      await this.page.keyboard.press('Escape');
      await wait(500);
      debug('Modal fechado com ESC');
    } catch (err) {
      warn('Não foi possível confirmar seleção ou fechar modal');
    }
  }

  /**
   * Verifica quantos grupos foram selecionados
   */
  async getSelectedGroupsCount(): Promise<number> {
    try {
      // Procurar indicadores de grupos selecionados
      const indicators = [
        this.page.getByText(t.texts.groupsSelected),
        this.page.locator('[data-testid*="selected"]'),
        this.page.locator('span').filter({ hasText: /\d+.*selecionado|selected/i }),
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
   * Verifica se o modal de grupos está aberto
   */
  async isModalOpen(): Promise<boolean> {
    try {
      const modal = this.page.locator('[role="dialog"]').last();
      return await modal.isVisible({ timeout: 1000 });
    } catch {
      return false;
    }
  }
}

/**
 * Função utilitária para seleção de grupos
 */
export async function selectGroupsByName(
  page: Page, 
  groupNames: string[], 
  throttleMs: number = 350
): Promise<void> {
  const automation = new GroupsAutomation(page, { throttleMs });
  await automation.selectGroupsByName(groupNames);
}

/**
 * Função utilitária para verificar se grupos podem ser selecionados
 */
export async function canSelectGroups(page: Page): Promise<boolean> {
  try {
    const button = page.getByRole('button', { name: t.buttons.postToMorePlaces }).first();
    return await button.isVisible({ timeout: 3000 });
  } catch {
    return false;
  }
}