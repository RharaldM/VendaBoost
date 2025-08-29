import { Page } from 'playwright';
import { BaseCategory, PublicationData } from './types.js';
import { info, warn } from '../../logger.js';

export class DiversosCategory extends BaseCategory {
  constructor() {
    super(
      'diversos',
      'Diversos',
      ['diversos', 'outros', 'variados', 'geral']
    );
  }

  async select(page: Page): Promise<void> {
    info(`📦 Selecionando categoria: ${this.displayName}`);
    
    try {
      // Abrir o dropdown de categoria
      await this.clickCategoryButton(page);
      info(`✅ Dropdown de categoria aberto`);
      
      // Selecionar Diversos usando getByRole button
      await page.getByRole('button', { name: 'Diversos' }).click();
      info(`✅ Categoria "${this.displayName}" selecionada com sucesso`);
      
      // Aguardar processamento
      await page.waitForTimeout(500);
      
    } catch (error) {
      warn(`⚠️ Erro ao selecionar categoria ${this.displayName}:`, error);
      throw error;
    }
  }
  
  validate(data: PublicationData): boolean {
    if (!data.title || !data.price) {
      warn('⚠️ Categoria Diversos requer título e preço');
      return false;
    }
    
    return true;
  }
}