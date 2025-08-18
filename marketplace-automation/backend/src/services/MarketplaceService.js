const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * MarketplaceService - Serviço para automação do Facebook Marketplace
 */
class MarketplaceService {
  constructor(logManager) {
    this.logManager = logManager;
    this.browser = null;
    this.page = null;
    this.cookiesPath = path.join(__dirname, '../../data/cookies.json');
    this.userDataDir = path.join(__dirname, '../../data/user-data');
  }

  /**
   * Inicializa o navegador Puppeteer
   * @param {Object} options - Opções de configuração
   * @returns {Promise<Object>} Browser e page instances
   */
  async initializeBrowser(options = {}) {
    try {
      this.logManager.addLog('info', '🚀 Inicializando navegador...');
      
      const isProduction = process.env.NODE_ENV === 'production';
      const useProxy = process.env.USE_PROXY === 'true';
      
      const puppeteerOptions = {
        headless: isProduction ? 'new' : false,
        userDataDir: this.userDataDir,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ],
        ignoreDefaultArgs: ['--disable-extensions'],
        ...options
      };

      // Try to find Chrome executable on Windows
      if (process.platform === 'win32') {
        const possiblePaths = [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          process.env.CHROME_PATH
        ].filter(Boolean);

        for (const chromePath of possiblePaths) {
          try {
            if (require('fs').existsSync(chromePath)) {
              puppeteerOptions.executablePath = chromePath;
              this.logManager.addLog('info', `🌐 Usando Chrome em: ${chromePath}`);
              break;
            }
          } catch (e) {
            // Continue to next path
          }
        }
      }

      // Configurar proxy se especificado
      if (useProxy && process.env.PROXY_SERVER) {
        puppeteerOptions.args.push(`--proxy-server=${process.env.PROXY_SERVER}`);
        this.logManager.addLog('info', `🌐 Usando proxy: ${process.env.PROXY_SERVER}`);
      }

      this.browser = await puppeteer.launch(puppeteerOptions);
      this.page = await this.browser.newPage();
      
      // Configurar viewport
      await this.page.setViewport({ width: 1366, height: 768 });
      
      // Configurar user agent
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      this.logManager.addLog('success', '✅ Navegador inicializado com sucesso');
      
      return { browser: this.browser, page: this.page };
    } catch (error) {
      this.logManager.addLog('error', '❌ Erro ao inicializar navegador', { error: error.message });
      throw error;
    }
  }

  /**
   * Salva cookies da sessão
   * @returns {Promise<void>}
   */
  async saveCookies() {
    try {
      if (!this.page) {
        throw new Error('Página não inicializada');
      }

      const cookies = await this.page.cookies();
      
      // Criar diretório se não existir
      const cookiesDir = path.dirname(this.cookiesPath);
      if (!fs.existsSync(cookiesDir)) {
        fs.mkdirSync(cookiesDir, { recursive: true });
      }
      
      fs.writeFileSync(this.cookiesPath, JSON.stringify(cookies, null, 2));
      this.logManager.addLog('info', '🍪 Cookies salvos com sucesso');
    } catch (error) {
      this.logManager.addLog('error', '❌ Erro ao salvar cookies', { error: error.message });
    }
  }

  /**
   * Carrega cookies salvos
   * @returns {Promise<void>}
   */
  async loadCookies() {
    try {
      if (!this.page) {
        throw new Error('Página não inicializada');
      }

      if (fs.existsSync(this.cookiesPath)) {
        const cookies = JSON.parse(fs.readFileSync(this.cookiesPath, 'utf8'));
        await this.page.setCookie(...cookies);
        this.logManager.addLog('info', '🍪 Cookies carregados com sucesso');
      } else {
        this.logManager.addLog('info', '🍪 Nenhum cookie encontrado');
      }
    } catch (error) {
      this.logManager.addLog('error', '❌ Erro ao carregar cookies', { error: error.message });
    }
  }

  /**
   * Realiza login no Facebook
   * @returns {Promise<boolean>} True se logado com sucesso
   */
  async loginToFacebook() {
    try {
      this.logManager.addLog('info', '🔐 Iniciando processo de login...');
      
      await this.page.goto('https://www.facebook.com', { waitUntil: 'networkidle2' });
      await this.loadCookies();
      
      // Verificar se já está logado
      await this.page.waitForTimeout(3000);
      
      const isLoggedIn = await this.page.evaluate(() => {
        return !document.querySelector('input[name="email"]') && 
               !document.querySelector('input[name="pass"]');
      });
      
      if (isLoggedIn) {
        this.logManager.addLog('success', '✅ Usuário já está logado');
        await this.saveCookies();
        return true;
      }
      
      this.logManager.addLog('warning', '⚠️ Login manual necessário. Por favor, faça login no navegador.');
      this.logManager.addLog('info', '⏳ Aguardando login manual... (timeout: 5 minutos)');
      
      // Aguardar login manual por até 5 minutos
      const loginTimeout = 5 * 60 * 1000; // 5 minutos
      const startTime = Date.now();
      
      while (Date.now() - startTime < loginTimeout) {
        await this.page.waitForTimeout(5000);
        
        const currentlyLoggedIn = await this.page.evaluate(() => {
          return !document.querySelector('input[name="email"]') && 
                 !document.querySelector('input[name="pass"]');
        });
        
        if (currentlyLoggedIn) {
          this.logManager.addLog('success', '✅ Login realizado com sucesso!');
          
          // Verifica se há 2FA após login manual
          const pageContent = await this.page.content();
          if (pageContent.includes('two-factor') || pageContent.includes('código de segurança') || 
              pageContent.includes('security code') || pageContent.includes('authentication')) {
            this.logManager.addLog('warning', '🔐 Autenticação de dois fatores detectada');
            await this.handleTwoFactorAuth();
          }
          
          await this.saveCookies();
          return true;
        }
      }
      
      throw new Error('Timeout: Login não foi realizado dentro do tempo limite');
      
    } catch (error) {
      this.logManager.addLog('error', '❌ Erro no processo de login', { error: error.message });
      return false;
    }
  }

  /**
   * Navega para o Facebook Marketplace
   * @returns {Promise<boolean>} True se navegação foi bem-sucedida
   */
  async navigateToMarketplace() {
    try {
      this.logManager.addLog('info', '🛒 Navegando para o Marketplace...');
      
      await this.page.goto('https://www.facebook.com/marketplace/create/item', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      await this.page.waitForTimeout(3000);
      
      // Verificar se chegou na página correta
      const isMarketplacePage = await this.page.evaluate(() => {
        return window.location.href.includes('marketplace/create') ||
               document.querySelector('[data-testid="marketplace-composer-title-input"]') !== null ||
               document.querySelector('input[placeholder*="título"]') !== null;
      });
      
      if (isMarketplacePage) {
        this.logManager.addLog('success', '✅ Marketplace carregado com sucesso');
        return true;
      } else {
        throw new Error('Não foi possível acessar a página de criação do Marketplace');
      }
      
    } catch (error) {
      this.logManager.addLog('error', '❌ Erro ao navegar para o Marketplace', { error: error.message });
      return false;
    }
  }

  /**
   * Posta um item no Marketplace
   * @param {Object} itemData - Dados do item
   * @returns {Promise<Object>} Resultado da operação
   */
  async postMarketplaceItem(itemData) {
    try {
      await this.fillMarketplaceForm(this.page, itemData);
      
      return {
        success: true,
        message: 'Item publicado com sucesso no Marketplace',
        data: itemData
      };
      
    } catch (error) {
      this.logManager.addLog('error', '❌ Erro ao postar item', { error: error.message });
      throw error;
    }
  }

  /**
   * Preenche o formulário do Marketplace
   * @param {Object} page - Página do Puppeteer
   * @param {Object} itemData - Dados do item
   */
  async fillMarketplaceForm(page, itemData) {
    try {
      const { title, price, description, photos, category = 'Diversos', condition = 'Novo', location = 'Sinop' } = itemData;
      
      this.logManager.addLog('info', '📝 Iniciando preenchimento do formulário...');
      
      // Upload photos first
      if (photos && photos.length > 0) {
        await this.uploadPhotos(photos);
      }
      
      // Fill title
      await this.fillTitle(title);
      
      // Fill price
      if (price) {
        await this.fillPrice(price);
      }
      
      // Fill description
      if (description) {
        await this.fillDescription(description);
      }
      
      // Select category
      if (category) {
        await this.fillCategory(category);
      }
      
      // Fill location
      await this.fillLocation(location);
      
      // Click advance button
      await this.clickAdvanceButton();
      
      // Click publish button
      await this.clickPublishButton();
      
      this.logManager.addLog('success', '✅ Formulário preenchido e publicado com sucesso');
      
    } catch (error) {
      this.logManager.addLog('error', `❌ Erro ao preencher formulário: ${error.message}`);
      throw error;
    }
  }

  /**
   * Faz upload das fotos
   * @param {Array} photos - Array de caminhos das fotos
   */
  async uploadPhotos(photos) {
    try {
      this.logManager.addLog('info', `📸 Fazendo upload de ${photos.length} foto(s)...`);
      
      const fileInput = await this.page.$('input[type="file"]');
      if (fileInput) {
        await fileInput.uploadFile(...photos);
        await this.page.waitForTimeout(2000);
        this.logManager.addLog('success', '✅ Fotos enviadas com sucesso');
      } else {
        this.logManager.addLog('warning', '⚠️ Campo de upload de fotos não encontrado');
      }
    } catch (error) {
      this.logManager.addLog('error', '❌ Erro ao fazer upload das fotos', { error: error.message });
    }
  }

  /**
   * Preenche o título do item
   * @param {string} title - Título do item
   */
  async fillTitle(title) {
    try {
      this.logManager.addLog('info', '📝 Preenchendo título...');
      
      const titleSelectors = [
        '[data-testid="marketplace-composer-title-input"]',
        'input[placeholder*="título"]',
        'input[placeholder*="Título"]',
        'input[aria-label*="título"]',
        'input[aria-label*="Título"]'
      ];
      
      let titleField = null;
      for (const selector of titleSelectors) {
        titleField = await this.page.$(selector);
        if (titleField) break;
      }
      
      if (titleField) {
        await titleField.click();
        await titleField.type(title);
        this.logManager.addLog('success', `✅ Título preenchido: "${title}"`);
      } else {
        this.logManager.addLog('warning', '⚠️ Campo de título não encontrado');
      }
    } catch (error) {
      this.logManager.addLog('error', '❌ Erro ao preencher título', { error: error.message });
    }
  }

  /**
   * Preenche o preço do item
   * @param {string} price - Preço do item
   */
  async fillPrice(price) {
    try {
      this.logManager.addLog('info', '💰 Preenchendo preço...');
      
      const priceField = await this.page.$('input[placeholder*="preço"], input[placeholder*="Preço"], input[aria-label*="preço"]');
      if (priceField) {
        await priceField.click();
        await priceField.type(price.toString());
        this.logManager.addLog('success', `✅ Preço preenchido: R$ ${price}`);
      } else {
        this.logManager.addLog('warning', '⚠️ Campo de preço não encontrado');
      }
    } catch (error) {
      this.logManager.addLog('error', '❌ Erro ao preencher preço', { error: error.message });
    }
  }

  /**
   * Preenche a categoria do item
   * @param {string} category - Categoria do item
   */
  async fillCategory(category) {
    try {
      this.logManager.addLog('info', '🏷️ Selecionando categoria...');
      
      // Implementar lógica de seleção de categoria
      this.logManager.addLog('info', `📂 Categoria: ${category}`);
    } catch (error) {
      this.logManager.addLog('error', '❌ Erro ao selecionar categoria', { error: error.message });
    }
  }

  /**
   * Preenche a localização do item
   * @param {string} location - Localização do item
   */
  async fillLocation(location) {
    try {
      this.logManager.addLog('info', `📍 Preenchendo localização: ${location}`);
      
      await this.page.evaluate((local) => {
        return new Promise(async (resolve) => {
          console.log(`Iniciando busca pelo campo "Localização" para inserir "${local}"...`);
          
          // Find location field
          const campoLocalizacao = Array.from(document.querySelectorAll('input[aria-label="Localização"]'))
                                        .find(input => input.offsetParent !== null);
          
          if (!campoLocalizacao) {
            console.error('ERRO: Campo "Localização" não foi encontrado ou não está visível.');
            resolve(false);
            return;
          }
          
          console.log('SUCESSO: Campo "Localização" detectado:', campoLocalizacao);
          campoLocalizacao.focus();
          
          // Clear existing value
          console.log("Limpando qualquer valor existente no campo...");
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          nativeInputValueSetter.call(campoLocalizacao, '');
          campoLocalizacao.dispatchEvent(new Event('input', { bubbles: true }));
          
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Set new value
          console.log(`Escrevendo "${local}" no campo...`);
          nativeInputValueSetter.call(campoLocalizacao, local);
          const event = new Event('input', { bubbles: true });
          campoLocalizacao.dispatchEvent(event);
          
          console.log(`SUCESSO: Valor "${local}" foi escrito corretamente no campo.`);
          
          // Wait for suggestions
          console.log('Aguardando 2 segundos para as sugestões...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Find and click suggestion
          const textoDaOpcao = `${local}, Brazil`;
          console.log(`Procurando pelo texto "${textoDaOpcao}" dentro das opções...`);
          
          const allTextElements = Array.from(document.querySelectorAll('div[role="option"] span, ul[role="listbox"] li span'));
          const textElement = allTextElements.find(el => el.textContent.includes(textoDaOpcao) && el.offsetParent !== null);
          
          if (textElement) {
            console.log("Elemento de texto encontrado:", textElement);
            const clickableOption = textElement.closest('div[role="option"], li');
            
            if (clickableOption) {
              console.log(`SUCESSO: Container clicável da opção encontrado:`, clickableOption);
              console.log(`Clicando no container para selecionar "${textoDaOpcao}"...`);
              
              clickableOption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
              clickableOption.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
              clickableOption.click();
              console.log("Ação de clique REAL executada.");
            } else {
              console.error("ERRO: O texto foi encontrado, mas não foi possível encontrar o container clicável.");
            }
          } else {
            console.warn(`AVISO: Nenhuma sugestão com o texto "${textoDaOpcao}" foi encontrada.`);
          }
          
          // Remove focus
          setTimeout(() => campoLocalizacao.blur(), 500);
          console.log('Processo finalizado.');
          resolve(true);
        });
      }, location);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      this.logManager.addLog('success', `✅ Localização preenchida: ${location}`);
      
    } catch (error) {
      this.logManager.addLog('error', `❌ Erro ao preencher localização: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clica no botão de avançar
   */
  async clickAdvanceButton() {
    try {
      this.logManager.addLog('info', '⏭️ Aguardando 2 segundos antes de clicar em "Avançar"...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const avancarClicked = await this.page.evaluate(() => {
        console.log("Iniciando a busca pelo botão 'Avançar'...");
        
        const seletores = 'button, div[role="button"]';
        const todosOsBotoes = Array.from(document.querySelectorAll(seletores));
        
        const botaoAvancar = todosOsBotoes.find(botao =>
          botao.textContent.trim() === 'Avançar' &&
          botao.offsetParent !== null
        );
        
        if (botaoAvancar) {
          console.log("SUCESSO: Botão 'Avançar' detectado:", botaoAvancar);
          
          const estaDesabilitado = botaoAvancar.getAttribute('aria-disabled') === 'true' || botaoAvancar.disabled;
          
          if (estaDesabilitado) {
            console.warn("AVISO: O botão 'Avançar' foi encontrado, mas está desabilitado. Verifique se todos os campos obrigatórios do formulário foram preenchidos corretamente.");
            return false;
          } else {
            console.log("Ação: Clicando no botão 'Avançar'...");
            botaoAvancar.click();
            console.log("Botão 'Avançar' foi clicado.");
            return true;
          }
        } else {
          console.error("ERRO: Não foi possível encontrar um botão 'Avançar' visível na página.");
          return false;
        }
      });
      
      if (avancarClicked) {
        this.logManager.addLog('success', '✅ Botão Avançar clicado com sucesso! Aguardando 5 segundos para a próxima página carregar...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        this.logManager.addLog('error', '❌ Falha ao clicar no botão Avançar');
        throw new Error('Falha ao clicar no botão Avançar');
      }
      
    } catch (error) {
      this.logManager.addLog('error', `❌ Erro ao clicar no botão Avançar: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clica no botão de publicar
   */
  async clickPublishButton() {
    try {
      this.logManager.addLog('info', '📤 Tentando clicar no botão Publicar...');
      
      const publicarClicked = await this.page.evaluate(() => {
        console.log("Iniciando a busca pelo botão 'Publicar'...");
        
        const seletores = 'button, div[role="button"]';
        const todosOsBotoes = Array.from(document.querySelectorAll(seletores));
        
        const botaoPublicar = todosOsBotoes.find(botao =>
          botao.textContent.trim() === 'Publicar' &&
          botao.offsetParent !== null
        );
        
        if (botaoPublicar) {
          console.log("SUCESSO: Botão 'Publicar' detectado:", botaoPublicar);
          
          const estaDesabilitado = botaoPublicar.getAttribute('aria-disabled') === 'true' || botaoPublicar.disabled;
          
          if (estaDesabilitado) {
            console.warn("AVISO: O botão 'Publicar' foi encontrado, mas está desabilitado. Verifique se todas as etapas anteriores foram concluídas.");
            return false;
          } else {
            console.log("Ação: Clicando no botão 'Publicar'...");
            botaoPublicar.click();
            console.log("Anúncio publicado!");
            return true;
          }
        } else {
          console.error("ERRO: Não foi possível encontrar um botão 'Publicar' visível na página.");
          return false;
        }
      });
      
      if (publicarClicked) {
        this.logManager.addLog('success', '🎉 Automation completed successfully! Anúncio publicado!');
      } else {
        this.logManager.addLog('warning', '⚠️ Falha ao clicar no botão Publicar. Verifique manualmente.');
        throw new Error('Falha ao clicar no botão Publicar');
      }
      
    } catch (error) {
      this.logManager.addLog('error', `❌ Erro ao clicar no botão Publicar: ${error.message}`);
      throw error;
    }
  }

  /**
   * Preenche a descrição do item
   * @param {string} description - Descrição do item
   */
  async fillDescription(description) {
    try {
      this.logManager.addLog('info', '📄 Preenchendo descrição...');
      
      const descriptionField = await this.page.$('textarea[placeholder*="descrição"], textarea[placeholder*="Descrição"]');
      if (descriptionField) {
        await descriptionField.click();
        await descriptionField.type(description);
        this.logManager.addLog('success', '✅ Descrição preenchida');
      } else {
        this.logManager.addLog('warning', '⚠️ Campo de descrição não encontrado');
      }
    } catch (error) {
      this.logManager.addLog('error', '❌ Erro ao preencher descrição', { error: error.message });
    }
  }

  /**
   * Lida com autenticação de dois fatores
   */
  async handleTwoFactorAuth() {
    try {
      this.logManager.addLog('info', '🔐 Detectada autenticação de dois fatores. Aguardando resolução manual...');
      
      // Aguarda até que o usuário resolva o 2FA manualmente
      // Verifica se ainda estamos na página de 2FA ou se já passamos
      let twoFactorResolved = false;
      let attempts = 0;
      const maxAttempts = 60; // 5 minutos (60 * 5 segundos)
      
      while (!twoFactorResolved && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Aguarda 5 segundos
        
        // Verifica se ainda estamos na página de 2FA
        const is2FAPage = await this.page.evaluate(() => {
          const twoFactorIndicators = [
            'two-factor',
            'two factor',
            'código de segurança',
            'security code',
            'authentication',
            'verificação'
          ];
          
          const pageText = document.body.textContent.toLowerCase();
          return twoFactorIndicators.some(indicator => pageText.includes(indicator));
        });
        
        if (!is2FAPage) {
          twoFactorResolved = true;
          this.logManager.addLog('success', '✅ Autenticação de dois fatores resolvida!');
        } else {
          attempts++;
          this.logManager.addLog('info', `⏳ Aguardando resolução do 2FA... (${attempts}/${maxAttempts})`);
        }
      }
      
      if (!twoFactorResolved) {
        throw new Error('Timeout na resolução da autenticação de dois fatores');
      }
      
    } catch (error) {
      this.logManager.addLog('error', `❌ Erro na autenticação de dois fatores: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fecha o navegador
   */
  async closeBrowser() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
        this.logManager.addLog('info', '🔒 Navegador fechado');
      }
    } catch (error) {
      this.logManager.addLog('error', '❌ Erro ao fechar navegador', { error: error.message });
    }
  }
}

module.exports = MarketplaceService;