import { CategoryHandler } from './types.js';
import { ToolsCategory } from './tools.js';
import { DiversosCategory } from './diversos.js';
import { warn } from '../../logger.js';

export class CategoryFactory {
  private static categories: Map<string, CategoryHandler> = new Map();
  
  static {
    // Registrar categoria Ferramentas
    const tools = new ToolsCategory();
    this.categories.set(tools.id, tools);
    this.categories.set('Ferramentas', tools); // Aceitar nome em português também
    
    // Registrar categoria Diversos
    const diversos = new DiversosCategory();
    this.categories.set(diversos.id, diversos);
    this.categories.set('Diversos', diversos); // Aceitar nome em português também
  }
  
  static getCategory(categoryId: string): CategoryHandler | null {
    const category = this.categories.get(categoryId);
    
    if (!category) {
      warn(`⚠️ Categoria não encontrada: ${categoryId}`);
      return null;
    }
    
    return category;
  }
  
  static getAllCategories(): CategoryHandler[] {
    return Array.from(this.categories.values());
  }
  
  static getCategoryIds(): string[] {
    return Array.from(this.categories.keys());
  }
}