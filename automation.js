require('dotenv').config(); // Para carregar .env
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Funções para gerenciar cookies
async function saveCookies(page) {
  try {
    const cookies = await page.cookies();
    const cookiesPath = path.join(__dirname, 'facebook-cookies.json');
    await fs.writeFile(cookiesPath, JSON.stringify(cookies, null, 2));
    console.log('Cookies salvos com sucesso!');
  } catch (error) {
    console.error('Erro ao salvar cookies:', error);
  }
}

async function loadCookies(page) {
  try {
    const cookiesPath = path.join(__dirname, 'facebook-cookies.json');
    const cookiesString = await fs.readFile(cookiesPath, 'utf8');
    const cookies = JSON.parse(cookiesString);
    await page.setCookie(...cookies);
    console.log('Cookies carregados com sucesso!');
  } catch (error) {
    console.log('Nenhum cookie salvo encontrado, fazendo login normal...');
  }
}

async function loginToFacebook(page) {
  const logManager = global.logManager;
  logManager?.addLog('info', 'Iniciando login no Facebook...');
  
  try {
    // Tentar carregar cookies salvos primeiro
    await loadCookies(page);
    
    // Navegar para Facebook
    logManager?.addLog('info', 'Navegando para Facebook...');
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });
    
    // Aguardar a página carregar completamente
    logManager?.addLog('info', 'Aguardando página carregar...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verificar se já está logado pelos cookies
    const isAlreadyLoggedIn = await page.evaluate(() => {
      // Verificar se não está na página de login
      const isLoginPage = window.location.href.includes('/login') || 
                         document.querySelector('#email') || 
                         document.querySelector('#loginform');
      
      if (isLoginPage) return false;
      
      // Verificar elementos que indicam usuário logado
      const profileMenu = document.querySelector('[aria-label="Sua conta"]') || 
                         document.querySelector('[data-testid="blue_bar_profile_link"]') ||
                         document.querySelector('[aria-label="Account"]') ||
                         document.querySelector('[data-testid="nav_profile_photo"]') ||
                         document.querySelector('[role="banner"] [role="navigation"]') ||
                         document.querySelector('[data-testid="left_nav_menu_list"]');
      
      return !!profileMenu;
    });
    
    if (isAlreadyLoggedIn) {
      logManager?.addLog('success', 'Já logado via cookies salvos!');
      await page.screenshot({ path: 'facebook-already-logged.png' });
      return true;
    }
    
    logManager?.addLog('warning', 'Cookies não funcionaram, fazendo login manual...');
    
    // Aguardar campos de login aparecerem
    logManager?.addLog('info', 'Aguardando campos de login aparecerem...');
    await page.waitForSelector('#email', { timeout: 10000 });
    await page.waitForSelector('#pass', { timeout: 10000 });
    
    // IMPORTANTE: As credenciais devem ser inseridas manualmente
    // Este código não funcionará mais pois as credenciais foram removidas por segurança
    logManager?.addLog('warning', 'ATENÇÃO: Login deve ser feito manualmente. Credenciais removidas por segurança.');
    logManager?.addLog('info', 'Por favor, faça login manualmente no navegador quando ele abrir.');
    
    // Aguardar login manual por até 2 minutos
    const loginTimeout = 2 * 60 * 1000; // 2 minutos
    const startTime = Date.now();
    
    while (Date.now() - startTime < loginTimeout) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Verificar se o login foi feito
      const isLoggedIn = await page.evaluate(() => {
        const profileMenu = document.querySelector('[aria-label="Sua conta"]') || 
                           document.querySelector('[data-testid="blue_bar_profile_link"]') ||
                           document.querySelector('[aria-label="Account"]') ||
                           document.querySelector('[data-testid="nav_profile_photo"]') ||
                           document.querySelector('[role="banner"] [role="navigation"]');
        return !!profileMenu;
      });
      
      if (isLoggedIn) {
        logManager?.addLog('success', 'Login manual detectado com sucesso!');
        return true;
      }
    }
    
    throw new Error('Timeout: Login manual não foi completado no tempo limite.');
     
     // Verificar se há elementos que indicam login bem-sucedido
     const isLoggedIn = await page.evaluate(() => {
       // Procurar por elementos que só existem quando logado
       const profileMenu = document.querySelector('[aria-label="Sua conta"]') || 
                          document.querySelector('[data-testid="blue_bar_profile_link"]') ||
                          document.querySelector('[aria-label="Account"]') ||
                          document.querySelector('[data-testid="nav_profile_photo"]') ||
                          document.querySelector('[role="banner"] [role="navigation"]');
       return !!profileMenu;
     });
     
     if (!isLoggedIn) {
       console.log('Elementos de usuário logado não encontrados. Tentando aguardar mais tempo...');
       await new Promise(resolve => setTimeout(resolve, 5000));
       
       // Verificar novamente
       const isLoggedInRetry = await page.evaluate(() => {
         const profileMenu = document.querySelector('[aria-label="Sua conta"]') || 
                            document.querySelector('[data-testid="blue_bar_profile_link"]') ||
                            document.querySelector('[aria-label="Account"]') ||
                            document.querySelector('[data-testid="nav_profile_photo"]') ||
                            document.querySelector('[role="banner"] [role="navigation"]');
         return !!profileMenu;
       });
       
       if (!isLoggedInRetry) {
         throw new Error('Login falhou - elementos de usuário logado não encontrados após retry');
       }
     }
    
    console.log('Login realizado com sucesso!');
    await page.screenshot({ path: 'facebook-after-login.png' });
    
    // Salvar cookies para próximas execuções
    await saveCookies(page);
    
    return true;
    
  } catch (error) {
    console.error('Erro durante o login:', error.message);
    await page.screenshot({ path: 'facebook-login-error.png' });
    throw error;
  }
}

async function navigateToMarketplace(page) {
  const logManager = global.logManager;
  logManager?.addLog('info', 'Navegando para o Marketplace...');
  
  try {
    // Navegar para a página de criação de item
    await page.goto('https://www.facebook.com/marketplace/create/item', { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    
    // Aguardar a página carregar completamente
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Verificar se estamos na página correta
    const currentUrl = page.url();
    logManager?.addLog('info', 'URL do Marketplace', { url: currentUrl });
    
    if (!currentUrl.includes('marketplace/create')) {
      throw new Error('Não conseguiu acessar a página de criação do Marketplace');
    }
    
    logManager?.addLog('success', 'Navegação para Marketplace bem-sucedida!');
    await page.screenshot({ path: 'marketplace-page-debug.png' });
    
    return true;
    
  } catch (error) {
    console.error('Erro ao navegar para o Marketplace:', error.message);
    await page.screenshot({ path: 'marketplace-navigation-error.png' });
    throw error;
  }
}

async function postMarketplaceItem(itemData) {
  // Configuração do Puppeteer com userDataDir para persistência de sessão
  const userDataDir = process.env.USER_DATA_DIR || './user-data';
  const isHeadless = process.env.HEADLESS !== 'false';
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Configurar cache local do Puppeteer para evitar problemas de permissão
  process.env.PUPPETEER_CACHE_DIR = process.env.PUPPETEER_CACHE_DIR || './puppeteer-cache';
  
  const launchOptions = {
    headless: isHeadless,
    userDataDir: userDataDir,
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  };
  
  // Configurações específicas por ambiente
  if (isProduction) {
    // Em produção (servidor Linux), usar Chromium padrão do sistema
    launchOptions.args.push('--single-process');
    launchOptions.args.push('--no-zygote');
  } else {
    // Em desenvolvimento (Windows), tentar usar Chrome instalado
    const possiblePaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Users\\' + process.env.USERNAME + '\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'
    ];
    
    const fs = require('fs');
    for (const chromePath of possiblePaths) {
      if (fs.existsSync(chromePath)) {
        launchOptions.executablePath = chromePath;
        logManager?.addLog('info', 'Chrome encontrado', { path: chromePath });
        break;
      }
    }
    
    if (!launchOptions.executablePath) {
      logManager?.addLog('warning', 'Chrome não encontrado nos caminhos padrão. Tentando usar Puppeteer bundled.');
    }
  }
  
  // Configurar proxy se disponível
  if (process.env.PROXY_URL) {
    launchOptions.args.push(`--proxy-server=${process.env.PROXY_URL}`);
  }
  
  const browser = await puppeteer.launch(launchOptions);
  
  const page = await browser.newPage();
  
  // Configurar headers para parecer mais humano
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  });
  
  // Configurar viewport consistente
  await page.setViewport({ width: 1366, height: 768 });
  
  try {
    // Etapa 1: Login
    await loginToFacebook(page);
    
    // Aguardar um pouco entre login e navegação
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Etapa 2: Navegar para Marketplace
     await navigateToMarketplace(page);
     
     // Etapa 3: Preencher formulário
     await fillMarketplaceForm(page, itemData);
     
   } catch (error) {
     console.error('Erro durante o processo:', error.message);
     await page.screenshot({ path: 'error-screenshot.png' });
     throw error;
   } finally {
     await browser.close();
   }
}

async function fillMarketplaceForm(page, itemData) {
   const logManager = global.logManager;
   logManager?.addLog('info', 'Preenchendo formulário do Marketplace...', { title: itemData.title });
   
   try {
     // Aguardar página carregar completamente
     console.log('Aguardando página carregar...');
     await new Promise(resolve => setTimeout(resolve, 8000));
     
     console.log('Iniciando preenchimento do formulário...');
     
     // Upload de foto
     console.log('Iniciando upload de foto...');
     try {
       const fileInput = await page.$('input[type="file"]');
       if (fileInput) {
         await fileInput.uploadFile(itemData.photoPath);
         console.log('Foto enviada com sucesso!');
         await new Promise(resolve => setTimeout(resolve, 3000));
       } else {
         console.log('Campo de upload não encontrado');
       }
     } catch (e) {
       console.log('Erro no upload da foto:', e.message);
     }
     
     await new Promise(resolve => setTimeout(resolve, 2000));
    
     // Título usando método robusto
     console.log('Iniciando preenchimento de título...');
     const titleFilled = await page.evaluate((titleValue) => {
       // ===== Utils =====
       const sleep = (ms) => new Promise(r => setTimeout(r, ms));
       const norm = (s) => (s || '').trim().toLowerCase();
       const txt = (el) => (el?.innerText || el?.textContent || '').trim();
       const vis = (el) => el && (() => {
         const cs = getComputedStyle(el), r = el.getBoundingClientRect();
         return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0' && r.width > 0 && r.height > 0;
       })();
       const isVisible = vis;
       const highlight = (el) => { if (el) el.style.outline = '3px solid red'; };
       
       // ===== Regex para título =====
       const RX_TITLE = /t[íi]tulo|title|nome|name|produto|product/i;
       const RX_EXCLUDE = /categ|condi[cç][aã]o|condition|pre[cç]o|price|descri[cç][aã]o|description/i;
       
       // ===== Seletores para campos de título =====
       const TITLE_SELECTORS = [
         'input[type="text"]',
         'input[aria-label]',
         'input[placeholder]',
         '[role="textbox"]',
         '[contenteditable="true"]'
       ].join(',');
       
       // ===== Função para verificar se é campo de título =====
       const isTitleField = (el) => {
         if (!vis(el)) return false;
         
         // Verifica aria-label
         const al = (el.getAttribute('aria-label') || '').trim();
         if (al && RX_TITLE.test(al) && !RX_EXCLUDE.test(al)) return true;
         
         // Verifica placeholder
         const ph = (el.getAttribute('placeholder') || '').trim();
         if (ph && RX_TITLE.test(ph) && !RX_EXCLUDE.test(ph)) return true;
         
         // Verifica aria-labelledby
         const ref = (el.getAttribute('aria-labelledby') || '').trim();
         if (ref) {
           const labTxt = ref.split(/\s+/).map(id => txt(document.getElementById(id))).join(' ');
           if (RX_TITLE.test(labTxt) && !RX_EXCLUDE.test(labTxt)) return true;
         }
         
         return false;
       };
       
       // ===== Função para encontrar campo de título =====
       const findTitleField = () => {
         // 1) Busca direta por seletores com aria-label/placeholder
         const direct = [...document.querySelectorAll(TITLE_SELECTORS)].find(isTitleField);
         if (direct) return direct;
         
         // 2) Busca por labels próximos
         for (const lb of [...document.querySelectorAll('label,div,span,h3,h4')].filter(vis)) {
           const t = txt(lb);
           if (!RX_TITLE.test(t) || RX_EXCLUDE.test(t)) continue;
           
           // Busca campo associado via 'for'
           const forId = lb.getAttribute('for');
           if (forId) {
             const field = document.getElementById(forId);
             if (field && vis(field) && field.matches(TITLE_SELECTORS)) return field;
           }
           
           // Busca no escopo próximo
           const scope = lb.closest('[data-pagelet],form,section,div') || lb.parentElement;
           const ctrl = scope && [...scope.querySelectorAll(TITLE_SELECTORS)].find(el => vis(el));
           if (ctrl) return ctrl;
         }
         
         return null;
       };
       
       // ===== Função para preencher campo =====
       const fillTitleField = (field, value) => {
         try {
           field.focus();
           
           // Limpa o campo
           field.select();
           field.value = '';
           
           // Para campos React, usa nativeInputValueSetter
           const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
           if (nativeInputValueSetter) {
             nativeInputValueSetter.call(field, value);
           } else {
             field.value = value;
           }
           
           // Dispara eventos para React
           field.dispatchEvent(new Event('input', { bubbles: true }));
           field.dispatchEvent(new Event('change', { bubbles: true }));
           
           return true;
         } catch (error) {
           console.error('[MP] Erro ao preencher título:', error);
           return false;
         }
       };
       
       // ===== Execução =====
       const titleField = findTitleField();
       if (!titleField) {
         console.warn('[MP] Campo "Título" não encontrado.');
         return false;
       }
       
       highlight(titleField);
       console.log('[MP] Campo "Título" detectado:', titleField);
       
       const success = fillTitleField(titleField, titleValue);
       if (success) {
         console.log('[MP] Título preenchido com sucesso:', titleValue);
       } else {
         console.warn('[MP] Falha ao preencher título.');
       }
       
       return success;
     }, itemData.title);
     
     if (titleFilled) {
       console.log('Título preenchido com sucesso usando o novo método');
     } else {
       console.log('Falha ao preencher o campo de título');
     }
    
    // Detecção e preenchimento do campo de preço usando o novo método
    const priceFieldFound = await page.evaluate((valor) => {
      function preencherCampoPreco(valor) {
        // 1. Encontra a etiqueta "Preço" para localizar o campo de input.
        const labels = Array.from(document.querySelectorAll('label'));
        const priceLabel = labels.find(label => label.textContent.trim() === 'Preço');
        
        if (!priceLabel) {
          console.error('ERRO: Etiqueta "Preço" não encontrada.');
          return false;
        }
      
        const input = document.getElementById(priceLabel.getAttribute('for')) || priceLabel.closest('div').querySelector('input');
        
        if (!input) {
          console.error('ERRO: Campo de input associado à etiqueta "Preço" não encontrado.');
          return false;
        }
      
        // 2. Altera o valor de uma forma que o sistema do Facebook reconheça.
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(input, valor);
      
        // 3. Dispara um evento para simular a digitação e registrar a mudança.
        const event = new Event('input', { bubbles: true });
        input.dispatchEvent(event);
      
        console.log(`SUCESSO: O valor "${valor}" foi escrito no campo Preço.`);
        return true;
      }
      
      return preencherCampoPreco(valor);
    }, itemData.price);
    
    if (priceFieldFound) {
      console.log('Preço preenchido com sucesso usando o novo método');
    } else {
      console.log('Falha ao preencher o campo de preço');
    }
    
    // Descrição usando método avançado do script.txt
    console.log('Iniciando preenchimento de descrição...');
    const descriptionFilled = await page.evaluate(() => {
      // ===== Utils =====
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const norm  = (s) => (s || '').trim().toLowerCase();
      const txt   = (el) => (el?.innerText || el?.textContent || '').trim();
      const vis   = (el) => el && (() => {
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        return cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 0 && r.height > 0;
      })();

      // ===== Heurísticas =====
      const RX_DESC     = /descriç[aã]o|descripci[oó]n|description/i;
      const RX_EXCLUDE  = /categ|condi[cç][aã]o|condition|t[ií]tulo|title|pre[cç]o|price/i;
      const ROLESEL     = '[role="textbox"], textarea, [contenteditable="true"]';

      const isDescriptionField = (el) => {
        if (!vis(el)) return false;

        // aria-label direto
        const al = (el.getAttribute('aria-label') || '').trim();
        if (al && RX_DESC.test(al) && !RX_EXCLUDE.test(al)) return true;

        // aria-labelledby
        const ref = (el.getAttribute('aria-labelledby') || '').trim();
        if (ref) {
          const labTxt = ref.split(/\s+/).map(id => txt(document.getElementById(id))).join(' ');
          if (RX_DESC.test(labTxt) && !RX_EXCLUDE.test(labTxt)) return true;
        }

        // placeholder (quando existir)
        const ph = (el.getAttribute('placeholder') || '').trim();
        if (ph && RX_DESC.test(ph) && !RX_EXCLUDE.test(ph)) return true;

        // proximidade textual
        const scope = el.closest('[data-pagelet],form,section,div') || el.parentElement;
        if (scope) {
          const around = [...scope.querySelectorAll('label,div,span,h3,h4')].filter(vis).map(txt).join(' ');
          if (RX_DESC.test(around) && !RX_EXCLUDE.test(around)) return true;
        }

        // fallback: role/atributos típicos do editor
        if (el.matches('[role="textbox"][contenteditable="true"], textarea')) return true;

        return false;
      };

      const findDescriptionField = () => {
        // 1) diretos com aria-label/placeholder
        const direct = [...document.querySelectorAll(
          '[role="textbox"][aria-label],[contenteditable="true"][aria-label],textarea[aria-label],' +
          '[role="textbox"][placeholder],[contenteditable="true"][placeholder],textarea[placeholder]'
        )].find(isDescriptionField);
        if (direct) return direct;

        // 2) qualquer candidato de entrada filtrado
        const any = [...document.querySelectorAll(ROLESEL)].find(isDescriptionField);
        if (any) return any;

        // 3) partindo do rótulo "Descrição"
        for (const lb of [...document.querySelectorAll('label,div,span,h3,h4')].filter(vis)) {
          const t = txt(lb);
          if (!RX_DESC.test(t) || RX_EXCLUDE.test(t)) continue;
          const scope = lb.closest('[data-pagelet],form,section,div') || lb.parentElement;
          const ctrl = scope && [...scope.querySelectorAll(ROLESEL)].find(isDescriptionField);
          if (ctrl) return ctrl;
        }
        return null;
      };

      // ===== Edição segura (textarea vs contenteditable/Lexical) =====
      const fireInput = (el) => {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const setTextareaValue = (ta, value) => {
        const proto = Object.getPrototypeOf(ta);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        setter ? setter.call(ta, value) : (ta.value = value);
        fireInput(ta);
      };

      const replaceContentEditable = (ce, value) => {
        ce.focus();
        try {
          // Seleciona tudo e insere texto (boa compatibilidade com React/Lexical)
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, value);
        } catch {
          ce.textContent = value; // fallback
        }
        fireInput(ce);
      };

      const highlight = (el) => {
        const oldO = el.style.outline, oldOff = el.style.outlineOffset;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.outline = '3px solid #00e676';
        el.style.outlineOffset = '2px';
        setTimeout(() => { el.style.outline = oldO; el.style.outlineOffset = oldOff; }, 1200);
      };

      // ===== Execução =====
      const descField = findDescriptionField();
      if (!descField) {
        console.warn('[MP] Campo "Descrição" não encontrado.');
        return false;
      }
      
      highlight(descField);
      descField.focus();
      console.log('[MP] Campo "Descrição" detectado:', descField);
      
      // Preencher com "Teste"
      if (descField.matches('textarea')) {
        setTextareaValue(descField, 'Teste');
      } else {
        replaceContentEditable(descField, 'Teste');
      }
      
      console.log('[MP] Descrição preenchida com "Teste".');
      return true;
    });
    
    if (descriptionFilled) {
      console.log('Descrição preenchida com sucesso usando o novo método');
    } else {
      console.log('Falha ao preencher o campo de descrição');
    }
    
    // Categoria - Seleção de "Diversos" usando método avançado
    console.log('Iniciando seleção de categoria "Diversos"...');
    const categorySelected = await page.evaluate(async () => {
      // ===== Config =====
      const TARGET_TEXT     = 'diversos';  // alvo (case-insensitive)
      const TIMEOUT_MS      = 15000;       // tempo total de tentativa
      const STEP_PX         = 320;         // passo de scroll
      const SCROLL_DELAY_MS = 450;         // delay entre passos de scroll
      const RENDER_WAIT_MS  = 220;         // tempo p/ virtualização/render após cada scroll

      // ===== Utils =====
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const isVisible = (el) => {
        if (!el) return false;
        const cs = getComputedStyle(el);
        const r  = el.getBoundingClientRect();
        return cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 0 && r.height > 0;
      };
      const norm = (s) => (s || '').trim().toLowerCase();
      const waitFor = async (getter, timeout = TIMEOUT_MS, interval = 150) => {
        const end = Date.now() + timeout;
        while (Date.now() < end) {
          const v = getter();
          if (v) return v;
          await sleep(interval);
        }
        return null;
      };
      const sendKey = (el, key) => el && el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      const highlight = (el) => {
        if (!el) return;
        const old = { outline: el.style.outline, offset: el.style.outlineOffset };
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.outline = '3px solid #00e676'; el.style.outlineOffset = '2px';
        setTimeout(() => { el.style.outline = old.outline; el.style.outlineOffset = old.offset; }, 1400);
      };

      // ===== Detecta controle "Categoria" =====
      const DIRECT = [
        '[role="combobox"][aria-label*="categ" i]',
        '[role="button"][aria-label*="categ" i]',
        'label[role="combobox"]',
        'select[aria-label*="categ" i]'
      ].join(',');

      const byLabel = () => {
        const labs = [...document.querySelectorAll('label,div,span,h3,h4')]
          .filter(isVisible)
          .filter(el => /categoria|categor[íi]a|category/i.test(el.textContent || ''));
        for (const lb of labs) {
          const scope = lb.closest('[data-pagelet],form,section,div') || lb.parentElement;
          const ctrl = scope && [...scope.querySelectorAll(
            '[role="combobox"],[role="button"][aria-haspopup],select,[aria-haspopup]'
          )].find(isVisible);
          if (ctrl) return ctrl;
        }
        return null;
      };

      const findCtrl = () => [...document.querySelectorAll(DIRECT)].find(isVisible) || byLabel();

      const ctrl = await waitFor(findCtrl);
      if (!ctrl) { console.warn('[MP] Campo "Categoria" não encontrado.'); return false; }
      highlight(ctrl);

      // ===== Abrir dropdown =====
      ctrl.focus(); ctrl.click();
      await sleep(140);
      sendKey(ctrl, 'Enter');
      await sleep(120);
      sendKey(ctrl, 'ArrowDown');

      // ===== Achar popup/lista =====
      const findOverlay = () => {
        // prioriza roles típicos e maior z-index
        const cands = [...document.querySelectorAll('[role="listbox"],[role="menu"],[role="dialog"],[aria-modal="true"],div,ul')]
          .filter(isVisible);
        let best = null, bestZ = -1;
        for (const el of cands) {
          const hasRole = el.matches('[role="listbox"],[role="menu"],[role="dialog"],[aria-modal="true"]');
          const z = parseInt(getComputedStyle(el).zIndex) || 0;
          if ((hasRole || z >= 1000) && z >= bestZ) { best = el; bestZ = z; }
        }
        return best;
      };

      let list = await waitFor(findOverlay, 5000);
      if (!list) { ctrl.click(); await sleep(180); list = await waitFor(findOverlay, 4000); }
      if (!list) { console.warn('[MP] Lista de categorias não detectada.'); return false; }

      // ===== Scroller =====
      const getScroller = (root) => {
        let cur = root;
        for (let i = 0; i < 8 && cur; i++) {
          const cs = getComputedStyle(cur);
          if ((cur.scrollHeight > cur.clientHeight) && /(auto|scroll)/i.test(cs.overflowY)) return cur;
          cur = cur.parentElement;
        }
        return document.scrollingElement || document.documentElement;
      };
      const scroller = getScroller(list);

      // ===== Funções de busca/scroll =====
      const findOption = () => {
        const pool = list.querySelectorAll('[role="option"],[role="menuitem"],li,div[role],span[role],div[role="button"]');
        for (const el of pool) {
          if (!isVisible(el)) continue;
          const t = norm(el.innerText || el.textContent);
          if (t && (t === TARGET_TEXT || t.includes(TARGET_TEXT))) return el;
        }
        return null;
      };

      const tryClick = async (opt, note='') => {
        opt.scrollIntoView({ block: 'center' });
        await sleep(RENDER_WAIT_MS);
        opt.click();
        console.log(`[MP] Categoria selecionada: "${TARGET_TEXT}" ${note}`.trim());
        return true;
      };

      // topo
      scroller.scrollTop = 0;
      await sleep(RENDER_WAIT_MS);
      let opt = findOption();
      if (opt) { await tryClick(opt, '(topo)'); return true; }

      // varredura para baixo (lenta)
      const end = Date.now() + TIMEOUT_MS;
      while (Date.now() < end) {
        opt = findOption();
        if (opt) { await tryClick(opt); return true; }

        const before = scroller.scrollTop;
        scroller.scrollTop = before + STEP_PX;
        await sleep(SCROLL_DELAY_MS);       // delay entre passos
        await sleep(RENDER_WAIT_MS);        // espera renderização
        if (scroller.scrollTop === before || (scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop) < 4) break;
      }

      // varredura reversa (lenta)
      scroller.scrollTop = scroller.scrollHeight;
      await sleep(RENDER_WAIT_MS);
      while (Date.now() < end) {
        opt = findOption();
        if (opt) { await tryClick(opt, '(reverso)'); return true; }

        const before = scroller.scrollTop;
        scroller.scrollTop = before - STEP_PX;
        await sleep(SCROLL_DELAY_MS);       // delay entre passos
        await sleep(RENDER_WAIT_MS);        // espera renderização
        if (scroller.scrollTop === 0 || scroller.scrollTop === before) break;
      }

      // fallback global
      const any = [...document.querySelectorAll('[role="option"],[role="menuitem"],li,div[role],span[role]')]
        .filter(isVisible)
        .find(el => norm(el.innerText || el.textContent).includes(TARGET_TEXT));
      if (any) { await tryClick(any, '(global)'); return true; }

      console.warn('[MP] Não encontrei "Diversos". Ajuste o texto ou aumente os delays.');
      return false;
    });
    
    if (categorySelected) {
      console.log('Categoria "Diversos" selecionada com sucesso!');
    } else {
      console.log('Falha ao selecionar categoria "Diversos"');
    }
    
    // ===== SELEÇÃO DE CONDIÇÃO "NOVO" =====
    console.log('Iniciando seleção de condição "Novo"...');
    
    const conditionSelected = await page.evaluate(async () => {
      // ===== Config =====
      const TARGETS = ['novo', 'new', 'nuevo']; // ordem de preferência
      const TIMEOUT = 10000;
      
      // ===== Utils =====
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));
      const txt = (el) => (el?.innerText || el?.textContent || '').trim();
      const norm = (s) => (s || '').trim().toLowerCase();
      const vis = (el) => el && (() => {
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        return cs.visibility !== 'hidden' && cs.display !== 'none' && r.width > 0 && r.height > 0;
      })();
      const waitFor = async (fn, ms = TIMEOUT, iv = 120) => {
        const end = Date.now() + ms;
        while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(iv); }
        return null;
      };
      const key = (el, k) => el && el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      const clickableAncestor = (el) => {
        let cur = el;
        for (let i = 0; i < 6 && cur; i++) {
          if (cur.matches?.('[role="option"],[role="menuitem"],[role="button"],li,button')) return cur;
          cur = cur.parentElement;
        }
        return el;
      };
      
      // ===== Detecta especificamente "Condição" (evita "Categoria") =====
      const RX_COND = /condi[cç][aã]o|condition|condici[oó]n/i;
      const RX_CAT = /categ/i;
      const ROLESEL = '[role="combobox"],[role="button"][aria-haspopup],select';
      
      const isConditionCtrl = (el) => {
        if (!vis(el)) return false;
        const al = el.getAttribute('aria-label') || '';
        if (al && RX_COND.test(al) && !RX_CAT.test(al)) return true;
        
        const ref = (el.getAttribute('aria-labelledby') || '').trim();
        if (ref) {
          const t = ref.split(/\s+/).map(id => txt(document.getElementById(id))).join(' ');
          if (RX_COND.test(t) && !RX_CAT.test(t)) return true;
        }
        
        if (el.id) {
          const lb = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
          if (lb && RX_COND.test(txt(lb)) && !RX_CAT.test(txt(lb))) return true;
        }
        
        const scope = el.closest('[data-pagelet],form,section,div') || el.parentElement;
        if (scope) {
          const near = [...scope.querySelectorAll('label,div,span,h3,h4')].filter(vis).map(txt).join(' ');
          if (RX_COND.test(near) && !RX_CAT.test(near)) return true;
        }
        return false;
      };
      
      const findConditionCtrl = () => {
        const byAL = [...document.querySelectorAll(`${ROLESEL}[aria-label]`)].find(isConditionCtrl);
        if (byAL) return byAL;
        
        const any = [...document.querySelectorAll(ROLESEL)].find(isConditionCtrl);
        if (any) return any;
        
        for (const lb of [...document.querySelectorAll('label,div,span,h3,h4')].filter(vis)) {
          const t = txt(lb);
          if (!RX_COND.test(t) || RX_CAT.test(t)) continue;
          const scope = lb.closest('[data-pagelet],form,section,div') || lb.parentElement;
          const ctrl = scope && [...scope.querySelectorAll(ROLESEL)].find(isConditionCtrl);
          if (ctrl) return ctrl;
        }
        return null;
      };
      
      // ===== Abrir dropdown e pegar a lista =====
      const openDropdown = async (ctrl) => {
        ctrl.scrollIntoView({ block: 'center' });
        ctrl.focus(); ctrl.click(); await sleep(140);
        key(ctrl, 'Enter'); await sleep(100);
        key(ctrl, 'ArrowDown'); await sleep(100);
      };
      
      const findList = (ctrl) => {
        const ac = ctrl.getAttribute('aria-controls');
        if (ac) {
          const el = document.getElementById(ac);
          if (vis(el)) return el;
        }
        const byRole = [...document.querySelectorAll(
          '[role="listbox"],[role="menu"],[role="dialog"] [role="listbox"],[role="dialog"] [role="menu"]'
        )].find(vis);
        if (byRole) return byRole;
        
        const cands = [...document.querySelectorAll('div,ul')].filter(vis);
        return cands.sort((a,b)=>(+getComputedStyle(b).zIndex||0)-(+getComputedStyle(a).zIndex||0))[0] || null;
      };
      
      // ===== Busca e clique em "Novo" =====
      const findOption = (root, targets) => {
        const pool = root.querySelectorAll('[role="option"],[role="menuitem"],li,div[role],span[role]');
        for (const el of pool) {
          if (!vis(el)) continue;
          const t = norm(txt(el));
          if (!t) continue;
          if (targets.some(m => t === m || t.includes(m))) return clickableAncestor(el);
        }
        return null;
      };
      
      // ===== Execução =====
      const ctrl = await waitFor(findConditionCtrl);
      if (!ctrl) {
        console.warn('[MP] Campo "Condição" não encontrado.');
        return false;
      }
      
      await openDropdown(ctrl);
      
      let list = await waitFor(() => findList(ctrl), 6000);
      if (!list) { await openDropdown(ctrl); list = await waitFor(() => findList(ctrl), 6000); }
      if (!list) {
        console.warn('[MP] Lista de condição não detectada.');
        return false;
      }
      
      // Tenta direto por busca no DOM
      let opt = findOption(list, TARGETS.map(norm));
      if (!opt) {
        // Typeahead: digita "novo"
        const focusTarget = list.querySelector('input,[contenteditable="true"]') || list;
        focusTarget.focus(); await sleep(80);
        for (const ch of 'novo') { key(focusTarget, ch); await sleep(45); }
        await sleep(250);
        opt = findOption(list, TARGETS.map(norm));
      }
      
      if (opt) {
        opt.scrollIntoView({ block: 'center' });
        await sleep(120);
        opt.click();
        console.log('[MP] Condição selecionada: "Novo".');
        return true;
      } else {
        console.warn('[MP] Não localizei "Novo". Verifique o idioma/rotulagem e tente novamente.');
        return false;
      }
    });
    
    if (conditionSelected) {
      console.log('Condição "Novo" selecionada com sucesso!');
    } else {
      console.log('Falha ao selecionar condição "Novo"');
    }
    
    // Aguardar um pouco após seleção da condição
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // === Localização — versão mais robusta ===
    console.log('Iniciando preenchimento de localização...');
    await page.evaluate(() => {
      async function preencherLocalizacao(local, textoDaOpcao) {
        console.log(`Iniciando busca pelo campo "Localização" para inserir "${local}"...`);
      
        // 1. Encontra o campo de input correto
        const campoLocalizacao = Array.from(document.querySelectorAll('input[aria-label="Localização"]'))
                                      .find(input => input.offsetParent !== null);
      
        if (!campoLocalizacao) {
          console.error('ERRO: Campo "Localização" não foi encontrado ou não está visível.');
          return;
        }
        
        console.log('SUCESSO: Campo "Localização" detectado:', campoLocalizacao);
        campoLocalizacao.focus();
      
        // ETAPA ADICIONADA: Limpa o campo antes de escrever.
        console.log("Limpando qualquer valor existente no campo...");
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeInputValueSetter.call(campoLocalizacao, ''); // Define o valor como vazio.
      
        // Dispara um evento para o React registrar que o campo foi limpo.
        campoLocalizacao.dispatchEvent(new Event('input', { bubbles: true }));
      
        // Pequena pausa para garantir que o sistema processe a limpeza.
        await new Promise(resolve => setTimeout(resolve, 100));
      
        // 2. Define o novo valor usando o método que o React entende
        console.log(`Escrevendo "${local}" no campo...`);
        nativeInputValueSetter.call(campoLocalizacao, local);
      
        // 3. Dispara o evento 'input' para notificar o React do novo valor
        const event = new Event('input', { bubbles: true });
        campoLocalizacao.dispatchEvent(event);
      
        console.log(`SUCESSO: Valor "${local}" foi escrito corretamente no campo.`);
      
        // 4. Aguarda as sugestões aparecerem
        console.log('Aguardando 2 segundos para as sugestões...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      
        // 5. Encontra o TEXTO e clica no CONTAINER PAI clicável
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
            console.error("ERRO: O texto foi encontrado, mas não foi possível encontrar o container clicável (div[role='option'] ou li) acima dele.");
          }
        } else {
          console.warn(`AVISO: Nenhuma sugestão com o texto "${textoDaOpcao}" foi encontrada.`);
        }
      
        // 6. Tira o foco do campo para finalizar
        setTimeout(() => campoLocalizacao.blur(), 500);
        console.log('Processo finalizado.');
      }
      
      // Chama a função
      return preencherLocalizacao('Sinop', 'Sinop, Brazil');
    });
    
    // Aguardar todos os campos serem preenchidos
     await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Aguarda 2 segundos antes de clicar em "Avançar"
    console.log('Aguardando 2 segundos antes de clicar em "Avançar"...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Clica no botão "Avançar"
    console.log('Procurando pelo botão Avançar...');
    const avancarClicked = await page.evaluate(() => {
      console.log("Iniciando a busca pelo botão 'Avançar'...");

      // 1. Define os seletores comuns para botões em sites modernos.
      const seletores = 'button, div[role="button"]';
      const todosOsBotoes = Array.from(document.querySelectorAll(seletores));

      // 2. Filtra a lista para encontrar o botão correto.
      // Ele precisa conter o texto "Avançar" e estar visível na página.
      const botaoAvancar = todosOsBotoes.find(botao =>
        botao.textContent.trim() === 'Avançar' &&
        botao.offsetParent !== null // 'offsetParent' é uma forma eficaz de checar a visibilidade.
      );

      // 3. Se o botão for encontrado, prossiga.
      if (botaoAvancar) {
        console.log("SUCESSO: Botão 'Avançar' detectado:", botaoAvancar);

        // 4. Verifica se o botão está desabilitado.
        // Botões desabilitados não podem ser clicados.
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
      console.log('Botão Avançar clicado com sucesso! Aguardando 5 segundos para a próxima página carregar...');
      
      // Aguarda 5 segundos para a próxima página carregar
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Chama automaticamente a função para clicar em Publicar
      console.log('Tentando clicar no botão Publicar...');
      const publicarClicked = await encontrarEclicarPublicar(page);
      
      if (publicarClicked) {
        console.log('Automation completed successfully! Anúncio publicado!');
      } else {
        console.log('Falha ao clicar no botão Publicar. Verifique manualmente.');
      }
    } else {
      console.log('Falha ao clicar no botão Avançar.');
    }
    
  } catch (error) {
    console.error('Erro ao preencher formulário:', error.message);
    await page.screenshot({ path: 'form-fill-error.png' });
    throw error;
  }
}

// Função para encontrar e clicar no botão "Publicar"
// NOTA: Esta função deve ser chamada manualmente ou após o botão "Avançar" ser clicado
// e a página de publicação final estiver carregada
async function encontrarEclicarPublicar(page) {
  console.log("Iniciando a busca pelo botão 'Publicar'...");
  
  return await page.evaluate(() => {
    // 1. Define os seletores comuns para botões.
    const seletores = 'button, div[role="button"]';
    const todosOsBotoes = Array.from(document.querySelectorAll(seletores));
    
    // 2. Filtra a lista para encontrar o botão com o texto "Publicar" que esteja visível.
    const botaoPublicar = todosOsBotoes.find(botao =>
      botao.textContent.trim() === 'Publicar' &&
      botao.offsetParent !== null // Garante que o botão está visível na tela.
    );
    
    // 3. Se o botão for encontrado, prossiga.
    if (botaoPublicar) {
      console.log("SUCESSO: Botão 'Publicar' detectado:", botaoPublicar);
      
      // 4. Verifica se o botão está desabilitado.
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
}

// Função para lidar com 2FA de forma segura (sem bypass)
async function handleTwoFactorAuth(page) {
  console.log('Detectado 2FA. Aguardando resolução manual...');
  
  try {
    // Aguardar até 5 minutos para o usuário resolver o 2FA manualmente
    const maxWaitTime = 5 * 60 * 1000; // 5 minutos
    const checkInterval = 5000; // 5 segundos
    let elapsed = 0;
    
    while (elapsed < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;
      
      // Verificar se ainda estamos na página de 2FA
      const currentUrl = page.url();
      const isStill2FA = currentUrl.includes('two_step_verification') || 
                        currentUrl.includes('checkpoint') ||
                        currentUrl.includes('login');
      
      if (!isStill2FA) {
        console.log('2FA resolvido com sucesso!');
        return true;
      }
      
      console.log(`Aguardando resolução do 2FA... (${Math.floor(elapsed/1000)}s/${Math.floor(maxWaitTime/1000)}s)`);
    }
    
    console.log('Timeout: 2FA não foi resolvido no tempo limite.');
    return false;
    
  } catch (error) {
    console.error('Erro ao aguardar resolução do 2FA:', error);
    return false;
  }
}

// Exportar a função para uso no servidor
module.exports = {
  postMarketplaceItem,
  handleTwoFactorAuth
};

// Código de teste removido - use apenas via API do servidor