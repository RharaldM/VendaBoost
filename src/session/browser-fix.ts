// CORREÇÃO PARA O PROBLEMA "CONTINUAR COMO"
// Adicione este trecho no arquivo src/session/browser.ts na VPS

// Na função launch(), após linha 76, adicione:

// NOVA LÓGICA: Limpar cookies conflitantes antes de aplicar novos
async cleanConflictingData(page: Page): Promise<void> {
  try {
    // Limpar localStorage e sessionStorage que podem causar conflito
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Deletar cookies que causam a tela de "Continuar como"
    const cookies = await page.context().cookies();
    const problematicCookies = cookies.filter(c => 
      c.name === 'checkpoint' || 
      c.name === 'presence' ||
      c.name === 'wd'
    );
    
    if (problematicCookies.length > 0) {
      await page.context().clearCookies();
      info('🧹 Cookies problemáticos limpos');
    }
  } catch (e) {
    debug('Erro ao limpar dados conflitantes:', e);
  }
}

// Na função navigateTo(), adicione no início:
async navigateTo(page: Page, url: string): Promise<void> {
  // NOVO: Limpar dados conflitantes antes de navegar
  if (url.includes('facebook.com')) {
    await this.cleanConflictingData(page);
  }
  
  // ... resto do código existente
}

// ALTERNATIVA: Usar contexto não-persistente
// Na função launch(), substitua chromium.launchPersistentContext por:

async launchCleanContext(): Promise<void> {
  // Usar contexto regular ao invés de persistente
  this.browser = await chromium.launch({
    headless: this.config.headless,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });
  
  // Criar contexto novo (não persistente)
  this.context = await this.browser.newContext({
    viewport: { width: 1920, height: 1080 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  
  info('✅ Contexto limpo criado (sem dados persistentes)');
}