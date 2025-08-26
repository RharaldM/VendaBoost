/**
 * Script de Teste - Extração de Dados do Facebook
 * Execute este script no console (F12) enquanto estiver logado no Facebook
 * Ele NÃO faz modificações, apenas coleta e exibe dados disponíveis
 */

(async function() {
  console.log('🔍 VendaBoost - Iniciando análise de dados disponíveis...\n');
  
  const extractedData = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    cookies: {},
    userData: {},
    tokens: {},
    localStorage: {},
    sessionStorage: {},
    pageData: {},
    scriptData: {},
    metaTags: {}
  };

  // 1. COOKIES - Extrair cookies importantes
  console.log('📍 1. Analisando Cookies...');
  try {
    const cookieString = document.cookie;
    const cookies = cookieString.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key) acc[key] = value;
      return acc;
    }, {});
    
    extractedData.cookies = {
      c_user: cookies.c_user || 'NÃO ENCONTRADO',
      xs: cookies.xs ? '✅ PRESENTE' : 'NÃO ENCONTRADO',
      fr: cookies.fr ? '✅ PRESENTE' : 'NÃO ENCONTRADO',
      datr: cookies.datr ? '✅ PRESENTE' : 'NÃO ENCONTRADO',
      sb: cookies.sb ? '✅ PRESENTE' : 'NÃO ENCONTRADO',
      presence: cookies.presence ? '✅ PRESENTE' : 'NÃO ENCONTRADO'
    };
    console.log('✅ Cookies analisados:', extractedData.cookies);
  } catch (e) {
    console.error('❌ Erro ao extrair cookies:', e);
  }

  // 2. DADOS DO USUÁRIO - Múltiplas fontes
  console.log('\n📍 2. Procurando dados do usuário...');
  
  // 2.1 - Buscar no __RELAY_INTERNAL__
  try {
    if (window.__RELAY_INTERNAL__) {
      const relayStore = window.__RELAY_INTERNAL__.__store;
      if (relayStore && relayStore.__recordSource) {
        const records = relayStore.__recordSource.__records;
        for (let key in records) {
          if (key.includes('User') || key === extractedData.cookies.c_user) {
            const userData = records[key];
            if (userData && userData.name) {
              extractedData.userData.fromRelay = {
                name: userData.name,
                id: userData.id,
                email: userData.email || null,
                username: userData.username || null
              };
              console.log('✅ Dados encontrados no Relay:', extractedData.userData.fromRelay);
            }
          }
        }
      }
    }
  } catch (e) {
    console.log('⚠️ Relay store não disponível');
  }

  // 2.2 - Buscar no requireLazy/DTSGInitialData
  try {
    const scripts = document.querySelectorAll('script');
    scripts.forEach(script => {
      const content = script.textContent || '';
      
      // Buscar DTSGInitialData
      if (content.includes('DTSGInitialData')) {
        const dtsgMatch = content.match(/"DTSGInitialData".*?"token":"([^"]+)"/);
        if (dtsgMatch) {
          extractedData.tokens.fb_dtsg = dtsgMatch[1];
        }
      }
      
      // Buscar CurrentUserInitialData
      if (content.includes('CurrentUserInitialData')) {
        const userMatch = content.match(/"USER_ID":"(\d+)"/);
        const nameMatch = content.match(/"NAME":"([^"]+)"/);
        const shortNameMatch = content.match(/"SHORT_NAME":"([^"]+)"/);
        
        if (userMatch || nameMatch) {
          extractedData.userData.fromInitialData = {
            id: userMatch ? userMatch[1] : null,
            name: nameMatch ? nameMatch[1] : null,
            shortName: shortNameMatch ? shortNameMatch[1] : null
          };
          console.log('✅ Dados encontrados no InitialData:', extractedData.userData.fromInitialData);
        }
      }
      
      // Buscar no LSD token
      if (content.includes('LSD')) {
        const lsdMatch = content.match(/"LSD".*?"token":"([^"]+)"/);
        if (lsdMatch) {
          extractedData.tokens.lsd = lsdMatch[1];
        }
      }
    });
  } catch (e) {
    console.log('⚠️ Erro ao buscar em scripts:', e);
  }

  // 2.3 - Buscar no window.__meta ou window.require
  try {
    if (window.require) {
      const CurrentUser = window.require('CurrentUser');
      if (CurrentUser) {
        extractedData.userData.fromCurrentUser = {
          id: CurrentUser.getID ? CurrentUser.getID() : null,
          name: CurrentUser.getName ? CurrentUser.getName() : null,
          isEmployee: CurrentUser.isEmployee ? CurrentUser.isEmployee() : false
        };
        console.log('✅ Dados do CurrentUser:', extractedData.userData.fromCurrentUser);
      }
    }
  } catch (e) {
    console.log('⚠️ CurrentUser não disponível');
  }

  // 2.4 - Buscar em elementos do DOM
  try {
    // Nome do perfil no menu
    const profileLink = document.querySelector('[role="navigation"] a[href*="/me"]');
    const profileName = document.querySelector('div[role="banner"] span[dir="auto"]');
    const profileImage = document.querySelector('svg[role="none"] image');
    
    extractedData.userData.fromDOM = {
      profileLinkText: profileLink ? profileLink.textContent : null,
      profileNameText: profileName ? profileName.textContent : null,
      profileImageUrl: profileImage ? profileImage.getAttribute('xlink:href') : null
    };
    
    // Buscar em aria-labels
    document.querySelectorAll('[aria-label]').forEach(el => {
      const label = el.getAttribute('aria-label');
      if (label && label.includes('perfil') || label.includes('profile')) {
        extractedData.userData.ariaLabels = extractedData.userData.ariaLabels || [];
        extractedData.userData.ariaLabels.push(label);
      }
    });
    
    console.log('✅ Dados encontrados no DOM:', extractedData.userData.fromDOM);
  } catch (e) {
    console.log('⚠️ Erro ao buscar no DOM:', e);
  }

  // 3. TOKENS E SEGURANÇA
  console.log('\n📍 3. Procurando tokens de segurança...');
  try {
    // Buscar fb_dtsg em formulários
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      const dtsgInput = form.querySelector('input[name="fb_dtsg"]');
      const jazoestInput = form.querySelector('input[name="jazoest"]');
      
      if (dtsgInput) {
        extractedData.tokens.fb_dtsg_form = dtsgInput.value;
      }
      if (jazoestInput) {
        extractedData.tokens.jazoest = jazoestInput.value;
      }
    });
    
    // Buscar em meta tags
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfMeta) {
      extractedData.tokens.csrf = csrfMeta.content;
    }
    
    console.log('✅ Tokens encontrados:', extractedData.tokens);
  } catch (e) {
    console.log('⚠️ Erro ao buscar tokens:', e);
  }

  // 4. LOCAL STORAGE
  console.log('\n📍 4. Analisando LocalStorage...');
  try {
    const relevantKeys = ['Session', 'User', 'Token', 'Auth', 'LoggedIn'];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (relevantKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
        try {
          const value = localStorage.getItem(key);
          extractedData.localStorage[key] = value ? 
            (value.length > 100 ? value.substring(0, 100) + '...' : value) : null;
        } catch (e) {
          extractedData.localStorage[key] = 'ERRO AO LER';
        }
      }
    }
    console.log('✅ LocalStorage relevante:', extractedData.localStorage);
  } catch (e) {
    console.log('⚠️ Erro ao acessar LocalStorage:', e);
  }

  // 5. SESSION STORAGE
  console.log('\n📍 5. Analisando SessionStorage...');
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key.includes('User') || key.includes('Session')) {
        const value = sessionStorage.getItem(key);
        extractedData.sessionStorage[key] = value ? 
          (value.length > 100 ? value.substring(0, 100) + '...' : value) : null;
      }
    }
    console.log('✅ SessionStorage relevante:', extractedData.sessionStorage);
  } catch (e) {
    console.log('⚠️ Erro ao acessar SessionStorage:', e);
  }

  // 6. BUSCAR EM VARIÁVEIS GLOBAIS
  console.log('\n📍 6. Verificando variáveis globais...');
  try {
    const globalVars = {
      __USER: window.__USER,
      __VIEWER: window.__VIEWER,
      CurrentUserID: window.CurrentUserID,
      Env: window.Env ? { 
        user: window.Env.user,
        userid: window.Env.userid,
        USER: window.Env.USER 
      } : null,
      serverUser: window.serverUser,
      viewerID: window.viewerID
    };
    
    Object.keys(globalVars).forEach(key => {
      if (globalVars[key]) {
        extractedData.pageData[key] = globalVars[key];
        console.log(`✅ ${key} encontrado:`, globalVars[key]);
      }
    });
  } catch (e) {
    console.log('⚠️ Erro ao buscar variáveis globais:', e);
  }

  // 7. BUSCAR EM REACT FIBER
  console.log('\n📍 7. Tentando acessar React Fiber...');
  try {
    const reactRoot = document.querySelector('#mount_0_0_lv');
    if (reactRoot && reactRoot._reactRootContainer) {
      const fiber = reactRoot._reactRootContainer._internalRoot;
      if (fiber) {
        console.log('✅ React Fiber encontrado (dados podem estar em props/state dos componentes)');
        // Não vamos iterar profundamente para evitar travamentos
      }
    }
  } catch (e) {
    console.log('⚠️ React Fiber não acessível');
  }

  // 8. RESUMO FINAL
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO DOS DADOS ENCONTRADOS:');
  console.log('='.repeat(60));
  
  const summary = {
    userId: extractedData.cookies.c_user || 
            extractedData.userData.fromRelay?.id || 
            extractedData.userData.fromInitialData?.id ||
            'NÃO ENCONTRADO',
    
    userName: extractedData.userData.fromRelay?.name || 
              extractedData.userData.fromInitialData?.name ||
              extractedData.userData.fromDOM?.profileLinkText ||
              'NÃO ENCONTRADO',
    
    userEmail: extractedData.userData.fromRelay?.email || 
               'NÃO ENCONTRADO (raramente disponível no frontend)',
    
    tokensFound: Object.keys(extractedData.tokens).length,
    
    cookiesEssenciais: {
      c_user: !!extractedData.cookies.c_user,
      xs: extractedData.cookies.xs === '✅ PRESENTE',
      fr: extractedData.cookies.fr === '✅ PRESENTE',
      datr: extractedData.cookies.datr === '✅ PRESENTE'
    }
  };
  
  console.log('\n🆔 User ID:', summary.userId);
  console.log('👤 User Name:', summary.userName);
  console.log('📧 User Email:', summary.userEmail);
  console.log('🔐 Tokens encontrados:', summary.tokensFound);
  console.log('🍪 Cookies essenciais:', summary.cookiesEssenciais);
  
  console.log('\n💾 DADOS COMPLETOS (copie para análise):');
  console.log(JSON.stringify(extractedData, null, 2));
  
  console.log('\n✅ Análise concluída! Role para cima para ver todos os detalhes.');
  
  // Retornar dados para possível uso
  return extractedData;
})();