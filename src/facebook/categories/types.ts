import { Page } from 'playwright';

export interface PublicationData {
  title: string;
  price: string | number;
  category?: string;
  condition?: string;
  description?: string;
  location?: string;
  images?: string[];
  brand?: string; // Campo para marca
}

export interface CategoryHandler {
  readonly id: string;
  readonly displayName: string;
  readonly keywords?: string[];
  
  select(page: Page): Promise<void>;
  validate?(data: PublicationData): boolean;
  fillSpecificFields?(page: Page, data: PublicationData): Promise<void>;
}

export abstract class BaseCategory implements CategoryHandler {
  constructor(
    public readonly id: string,
    public readonly displayName: string,
    public readonly keywords: string[] = []
  ) {}

  abstract select(page: Page): Promise<void>;
  
  validate?(data: PublicationData): boolean {
    return true;
  }
  
  fillSpecificFields?(page: Page, data: PublicationData): Promise<void> {
    return Promise.resolve();
  }
  
  protected async clickCategoryButton(page: Page): Promise<void> {
    const categoryButton = page.locator('label[role="combobox"]').filter({ hasText: 'Categoria' });
    
    if (await categoryButton.isVisible({ timeout: 3000 })) {
      await categoryButton.click();
      await page.waitForTimeout(1000);
    } else {
      throw new Error('Botão "Categoria" não encontrado');
    }
  }
  
  protected async selectOption(page: Page, optionText: string): Promise<void> {
    const option = page.getByText(optionText, { exact: true });
    
    if (await option.isVisible({ timeout: 3000 })) {
      await option.hover();
      await page.waitForTimeout(100);
      await option.click();
      await page.waitForTimeout(500);
    } else {
      throw new Error(`Opção "${optionText}" não encontrada no dropdown`);
    }
  }
}