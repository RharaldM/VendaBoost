import { Page } from 'playwright';
import { BaseCategory, PublicationData } from './types.js';
import { info, warn } from '../../logger.js';

export class ToolsCategory extends BaseCategory {
  constructor() {
    super(
      'tools',
      'Ferramentas',
      ['ferramenta', 'tool', 'equipamento', 'máquina', 'instrumento']
    );
  }

  async select(page: Page): Promise<void> {
    info(`🔧 Selecionando categoria: ${this.displayName}`);
    
    try {
      await this.clickCategoryButton(page);
      info(`✅ Dropdown de categoria aberto`);
      
      await this.selectOption(page, this.displayName);
      info(`✅ Categoria "${this.displayName}" selecionada com sucesso`);
      
    } catch (error) {
      warn(`⚠️ Erro ao selecionar categoria ${this.displayName}:`, error);
      throw error;
    }
  }
  
  validate(data: PublicationData): boolean {
    if (!data.title || !data.price) {
      warn('⚠️ Categoria Ferramentas requer título e preço');
      return false;
    }
    
    return true;
  }
  
  async fillSpecificFields(page: Page, data: PublicationData): Promise<void> {
    info('🔧 Preenchendo campos específicos para Ferramentas');
    
    try {
      // Se o usuário forneceu uma marca, usar ela
      if (data.brand) {
        info(`🔧 Preenchendo marca: ${data.brand}`);
        
        // Usar o seletor correto para o campo de marca
        const brandField = page.getByRole('textbox', { name: 'Marca' });
        
        if (await brandField.isVisible({ timeout: 3000 })) {
          await brandField.click();
          await page.waitForTimeout(200);
          await brandField.fill(data.brand);
          info(`✅ Campo marca preenchido com: ${data.brand}`);
        } else {
          warn('⚠️ Campo de marca não encontrado na página');
        }
      } else {
        info('ℹ️ Marca não fornecida pelo usuário');
      }
      
    } catch (error) {
      warn('⚠️ Erro ao preencher campos específicos de Ferramentas:', error);
    }
  }
}