/**
 * Enhanced Facebook Data Extractor v2.0
 * Script completo para capturar TODOS os dados disponíveis do Facebook
 * Execute no console (F12) enquanto logado no Facebook
 */

(async function() {
  console.log('🚀 VendaBoost Enhanced Extractor v2.0 - Iniciando captura completa...\n');
  
  // Objeto principal com todos os dados estruturados
  const sessionData = {
    // Metadados da extração
    timestamp: new Date().toISOString(),
    source: 'console_extractor',
    url: window.location.href,
    extractionId: `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    version: '2.0.0',
    
    // Dados do usuário
    userId: null,
    userInfo: {
      id: null,
      name: null,
      shortName: null,
      firstName: null,
      lastName: null,
      email: null,
      username: null,
      profileUrl: null,
      avatarUrl: null,
      coverPhotoUrl: null,
      locale: null,
      isVerified: false,
      isEmployee: false
    },
    
    // Cookies (apenas os visíveis via JS)
    cookies: [],
    cookieString: document.cookie,
    
    // Tokens importantes
    tokens: {
      fb_dtsg: null,
      lsd: null,
      jazoest: null,
      spin_r: null,
      spin_t: null,
      hsi: null,
      csrf_token: null,
      access_token: null
    },
    
    // Storage
    localStorage: {},
    sessionStorage: {},
    
    // Dados adicionais
    pageData: {
      pageId: null,
      pageName: null,
      pageType: null,
      entityId: null
    },
    
    // Informações do navegador
    browserInfo: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screenResolution: `${screen.width}x${screen.height}`,
      windowSize: `${window.innerWidth}x${window.innerHeight}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    },
    
    // Status da extração
    extractionStatus: {
      success: false,
      errors: [],
      warnings: [],
      dataCompleteness: 0
    }
  };

  // ============================================================================
  // FUNÇÕES AUXILIARES
  // ============================================================================
  
  /**
   * Extrai valor de uma string usando regex
   */
  function extractWithRegex(text, pattern, groupIndex = 1) {
    try {
      const match = text.match(pattern);
      return match ? match[groupIndex] : null;
    } catch (e) {
      return null;
    }
  }
  
  /**
   * Decodifica string do Facebook
   */
  function decodeFacebookString(str) {
    try {
      return decodeURIComponent(str).replace(/\+/g, ' ');
    } catch (e) {
      return str;
    }
  }
  
  /**
   * Busca em objetos aninhados
   */
  function deepSearch(obj, key, maxDepth = 5, currentDepth = 0) {
    if (!obj || currentDepth > maxDepth) return null;
    
    if (obj.hasOwnProperty(key)) return obj[key];
    
    for (let prop in obj) {
      if (typeof obj[prop] === 'object' && obj[prop] !== null) {
        const result = deepSearch(obj[prop], key, maxDepth, currentDepth + 1);
        if (result) return result;
      }
    }
    return null;
  }

  // ============================================================================
  // 1. EXTRAIR COOKIES
  // ============================================================================
  console.log('📍 1. Extraindo cookies...');
  try {
    const cookieObj = {};
    document.cookie.split(';').forEach(cookie => {
      const [key, value] = cookie.trim().split('=');
      if (key) cookieObj[key] = value;
    });
    
    // Converter para formato array (compatível com Chrome extension)
    sessionData.cookies = Object.entries(cookieObj).map(([name, value]) => ({
      name,
      value,
      domain: '.facebook.com',
      path: '/',
      secure: true,
      httpOnly: false, // Os que são visíveis via JS não são httpOnly
      sameSite: 'no_restriction'
    }));
    
    // Extrair userId do cookie c_user
    sessionData.userId = cookieObj.c_user || null;
    sessionData.userInfo.id = cookieObj.c_user || null;
    
    console.log(`✅ ${Object.keys(cookieObj).length} cookies extraídos`);
    console.log(`   User ID: ${sessionData.userId || 'NÃO ENCONTRADO'}`);
  } catch (e) {
    console.error('❌ Erro ao extrair cookies:', e);
    sessionData.extractionStatus.errors.push(`Cookie extraction: ${e.message}`);
  }

  // ============================================================================
  // 2. EXTRAIR DADOS DO USUÁRIO - MÚLTIPLAS FONTES
  // ============================================================================
  console.log('\n📍 2. Extraindo dados do usuário...');
  
  // 2.1 - CurrentUserInitialData em scripts
  try {
    const scripts = Array.from(document.querySelectorAll('script')).map(s => s.textContent || '').join('\n');
    
    // Buscar diferentes padrões
    const patterns = {
      userId: [
        /"USER_ID":"(\d+)"/,
        /"userID":"(\d+)"/,
        /"id":"(\d+)"/,
        /\\"user_id\\":\\"(\d+)\\"/,
        /"viewerID":"(\d+)"/
      ],
      userName: [
        /"NAME":"([^"]+)"/,
        /"name":"([^"]+)"/,
        /\\"name\\":\\"([^"]+)\\"/,
        /"fullName":"([^"]+)"/
      ],
      shortName: [
        /"SHORT_NAME":"([^"]+)"/,
        /"firstName":"([^"]+)"/,
        /"first_name":"([^"]+)"/
      ],
      email: [
        /"email":"([^"]+@[^"]+)"/,
        /\\"email\\":\\"([^"]+@[^"]+)\\"/,
        /"contactEmail":"([^"]+@[^"]+)"/
      ],
      locale: [
        /"locale":"([^"]+)"/,
        /"language":"([^"]+)"/
      ]
    };
    
    // Aplicar padrões
    for (const [key, patternList] of Object.entries(patterns)) {
      for (const pattern of patternList) {
        const value = extractWithRegex(scripts, pattern);
        if (value && !sessionData.userInfo[key]) {
          if (key === 'userName') {
            sessionData.userInfo.name = decodeFacebookString(value);
            // Tentar extrair primeiro e último nome
            const nameParts = sessionData.userInfo.name.split(' ');
            sessionData.userInfo.firstName = nameParts[0];
            sessionData.userInfo.lastName = nameParts[nameParts.length - 1];
          } else if (key === 'shortName') {
            sessionData.userInfo.shortName = decodeFacebookString(value);
            if (!sessionData.userInfo.firstName) {
              sessionData.userInfo.firstName = sessionData.userInfo.shortName;
            }
          } else {
            sessionData.userInfo[key] = decodeFacebookString(value);
          }
          console.log(`   ✅ ${key}: ${sessionData.userInfo[key]}`);
        }
      }
    }
  } catch (e) {
    console.error('❌ Erro ao buscar em scripts:', e);
  }
  
  // 2.2 - window.require (CurrentUser)
  try {
    if (window.require) {
      const modules = ['CurrentUser', 'CurrentUserInitialData', 'ViewerContext'];
      
      for (const moduleName of modules) {
        try {
          const module = window.require(moduleName);
          if (module) {
            if (module.getID) sessionData.userInfo.id = sessionData.userInfo.id || module.getID();
            if (module.getName) sessionData.userInfo.name = sessionData.userInfo.name || module.getName();
            if (module.getShortName) sessionData.userInfo.shortName = sessionData.userInfo.shortName || module.getShortName();
            if (module.isEmployee) sessionData.userInfo.isEmployee = module.isEmployee();
            if (module.isVerified) sessionData.userInfo.isVerified = module.isVerified();
          }
        } catch (e) {
          // Módulo não disponível
        }
      }
    }
  } catch (e) {
    console.error('❌ Erro ao acessar window.require:', e);
  }
  
  // 2.3 - Relay Store
  try {
    if (window.__RELAY_INTERNAL__) {
      const store = window.__RELAY_INTERNAL__.__store;
      if (store && store.__recordSource && store.__recordSource.__records) {
        const records = store.__recordSource.__records;
        
        // Procurar por registros do usuário
        for (const key in records) {
          if (key === sessionData.userId || key.includes('User') || key.includes('Viewer')) {
            const record = records[key];
            if (record) {
              sessionData.userInfo.name = sessionData.userInfo.name || record.name;
              sessionData.userInfo.username = sessionData.userInfo.username || record.username;
              sessionData.userInfo.email = sessionData.userInfo.email || record.email;
              
              // Procurar URL da foto
              if (record.profile_picture || record.profilePicture) {
                const pic = record.profile_picture || record.profilePicture;
                if (pic && pic.uri) {
                  sessionData.userInfo.avatarUrl = pic.uri;
                }
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('❌ Erro ao acessar Relay Store:', e);
  }
  
  // 2.4 - Elementos do DOM
  try {
    // Buscar nome no DOM
    const nameSelectors = [
      '[role="banner"] [role="button"] span[dir="auto"]',
      '[aria-label*="perfil"] span',
      'a[href*="/me"] span',
      '[data-pagelet="ProfileActions"] h1 span',
      'div[role="main"] h1 span'
    ];
    
    for (const selector of nameSelectors) {
      if (!sessionData.userInfo.name) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
          sessionData.userInfo.name = element.textContent.trim();
          console.log(`   ✅ Nome do DOM: ${sessionData.userInfo.name}`);
          break;
        }
      }
    }
    
    // Buscar imagem do perfil
    const imageSelectors = [
      'image[data-imgperflogname="profileCoverPhoto"]',
      'svg[role="img"] image',
      'img[data-imgperflogname="profilePicThumb"]',
      '[role="button"] image[style*="40x40"]'
    ];
    
    for (const selector of imageSelectors) {
      if (!sessionData.userInfo.avatarUrl) {
        const element = document.querySelector(selector);
        if (element) {
          const url = element.getAttribute('xlink:href') || element.getAttribute('src');
          if (url) {
            sessionData.userInfo.avatarUrl = url;
            console.log('   ✅ Avatar URL encontrada');
            break;
          }
        }
      }
    }
  } catch (e) {
    console.error('❌ Erro ao buscar no DOM:', e);
  }
  
  // 2.5 - Construir URLs do perfil
  if (sessionData.userId) {
    sessionData.userInfo.profileUrl = `https://www.facebook.com/profile.php?id=${sessionData.userId}`;
  }

  // ============================================================================
  // 3. EXTRAIR TOKENS DE SEGURANÇA
  // ============================================================================
  console.log('\n📍 3. Extraindo tokens de segurança...');
  try {
    const scripts = Array.from(document.querySelectorAll('script')).map(s => s.textContent || '').join('\n');
    
    // fb_dtsg (CSRF token - mais importante)
    const dtsgPatterns = [
      /"DTSGInitialData".*?"token":"([^"]+)"/,
      /\{"token":"([^"]+)","async_get_token"/,
      /"fb_dtsg":"([^"]+)"/,
      /fb_dtsg\\":\\"([^"]+)\\"/
    ];
    
    for (const pattern of dtsgPatterns) {
      if (!sessionData.tokens.fb_dtsg) {
        sessionData.tokens.fb_dtsg = extractWithRegex(scripts, pattern);
        if (sessionData.tokens.fb_dtsg) break;
      }
    }
    
    // LSD token
    sessionData.tokens.lsd = extractWithRegex(scripts, /"LSD".*?"token":"([^"]+)"/) ||
                              extractWithRegex(scripts, /\["LSD",\[\],\{"token":"([^"]+)"/);
    
    // Jazoest
    sessionData.tokens.jazoest = extractWithRegex(scripts, /jazoest=(\d+)/) ||
                                  extractWithRegex(scripts, /"jazoest":"(\d+)"/);
    
    // Spin tokens
    sessionData.tokens.spin_r = extractWithRegex(scripts, /__spin_r:\s*(\d+)/);
    sessionData.tokens.spin_t = extractWithRegex(scripts, /__spin_t:\s*(\d+)/);
    
    // HSI
    sessionData.tokens.hsi = extractWithRegex(scripts, /hsi=([^&]+)/);
    
    // Buscar em formulários
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      const inputs = form.querySelectorAll('input[type="hidden"]');
      inputs.forEach(input => {
        const name = input.name;
        const value = input.value;
        if (name === 'fb_dtsg' && !sessionData.tokens.fb_dtsg) {
          sessionData.tokens.fb_dtsg = value;
        }
        if (name === 'jazoest' && !sessionData.tokens.jazoest) {
          sessionData.tokens.jazoest = value;
        }
        if (name === 'lsd' && !sessionData.tokens.lsd) {
          sessionData.tokens.lsd = value;
        }
      });
    });
    
    // Contar tokens encontrados
    const tokensFound = Object.values(sessionData.tokens).filter(v => v !== null).length;
    console.log(`✅ ${tokensFound} tokens encontrados`);
    
    if (sessionData.tokens.fb_dtsg) {
      console.log(`   fb_dtsg: ${sessionData.tokens.fb_dtsg.substring(0, 20)}...`);
    }
  } catch (e) {
    console.error('❌ Erro ao extrair tokens:', e);
    sessionData.extractionStatus.errors.push(`Token extraction: ${e.message}`);
  }

  // ============================================================================
  // 4. EXTRAIR LOCAL STORAGE (dados relevantes)
  // ============================================================================
  console.log('\n📍 4. Extraindo LocalStorage...');
  try {
    const relevantPatterns = ['session', 'user', 'token', 'auth', 'login', 'fb'];
    let relevantItems = 0;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const isRelevant = relevantPatterns.some(pattern => 
        key.toLowerCase().includes(pattern)
      );
      
      if (isRelevant) {
        try {
          const value = localStorage.getItem(key);
          // Limitar tamanho para não poluir os dados
          sessionData.localStorage[key] = value && value.length > 500 ? 
            value.substring(0, 500) + '...' : value;
          relevantItems++;
        } catch (e) {
          // Ignorar itens que não podem ser lidos
        }
      }
    }
    console.log(`✅ ${relevantItems} itens relevantes do LocalStorage`);
  } catch (e) {
    console.error('❌ Erro ao extrair LocalStorage:', e);
  }

  // ============================================================================
  // 5. EXTRAIR SESSION STORAGE
  // ============================================================================
  console.log('\n📍 5. Extraindo SessionStorage...');
  try {
    let sessionItems = 0;
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      try {
        const value = sessionStorage.getItem(key);
        sessionData.sessionStorage[key] = value && value.length > 500 ? 
          value.substring(0, 500) + '...' : value;
        sessionItems++;
      } catch (e) {
        // Ignorar itens que não podem ser lidos
      }
    }
    console.log(`✅ ${sessionItems} itens do SessionStorage`);
  } catch (e) {
    console.error('❌ Erro ao extrair SessionStorage:', e);
  }

  // ============================================================================
  // 6. INFORMAÇÕES DA PÁGINA
  // ============================================================================
  console.log('\n📍 6. Extraindo informações da página...');
  try {
    // Tipo de página
    const pageTypes = {
      '/home': 'feed',
      '/watch': 'videos',
      '/marketplace': 'marketplace',
      '/groups': 'groups',
      '/friends': 'friends',
      '/pages': 'pages',
      '/gaming': 'gaming',
      '/events': 'events'
    };
    
    const pathname = window.location.pathname;
    for (const [path, type] of Object.entries(pageTypes)) {
      if (pathname.includes(path)) {
        sessionData.pageData.pageType = type;
        break;
      }
    }
    
    // Meta tags
    const metaTags = document.querySelectorAll('meta[property^="og:"], meta[property^="fb:"]');
    metaTags.forEach(meta => {
      const property = meta.getAttribute('property');
      const content = meta.getAttribute('content');
      if (property && content) {
        if (property === 'fb:page_id') sessionData.pageData.pageId = content;
        if (property === 'og:title') sessionData.pageData.pageName = content;
      }
    });
    
    console.log('✅ Informações da página extraídas');
  } catch (e) {
    console.error('❌ Erro ao extrair informações da página:', e);
  }

  // ============================================================================
  // 7. CALCULAR COMPLETUDE DOS DADOS
  // ============================================================================
  const calculateCompleteness = () => {
    let total = 0;
    let filled = 0;
    
    // Campos essenciais
    const essentialFields = [
      sessionData.userId,
      sessionData.userInfo.name,
      sessionData.tokens.fb_dtsg,
      sessionData.cookies.length > 0
    ];
    
    total = essentialFields.length;
    filled = essentialFields.filter(f => f).length;
    
    return Math.round((filled / total) * 100);
  };
  
  sessionData.extractionStatus.dataCompleteness = calculateCompleteness();
  sessionData.extractionStatus.success = sessionData.extractionStatus.dataCompleteness >= 50;

  // ============================================================================
  // 8. RESULTADO FINAL
  // ============================================================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 EXTRAÇÃO COMPLETA - RESUMO');
  console.log('='.repeat(60));
  
  console.log('\n🔐 DADOS ESSENCIAIS:');
  console.log(`   User ID: ${sessionData.userId || '❌ NÃO ENCONTRADO'}`);
  console.log(`   Nome: ${sessionData.userInfo.name || '❌ NÃO ENCONTRADO'}`);
  console.log(`   Email: ${sessionData.userInfo.email || '⚠️ Não disponível no frontend'}`);
  console.log(`   FB_DTSG: ${sessionData.tokens.fb_dtsg ? '✅ ENCONTRADO' : '❌ NÃO ENCONTRADO'}`);
  console.log(`   Cookies: ${sessionData.cookies.length} capturados`);
  console.log(`   Tokens: ${Object.values(sessionData.tokens).filter(t => t).length} encontrados`);
  
  console.log('\n📈 STATUS DA EXTRAÇÃO:');
  console.log(`   Completude: ${sessionData.extractionStatus.dataCompleteness}%`);
  console.log(`   Status: ${sessionData.extractionStatus.success ? '✅ SUCESSO' : '⚠️ PARCIAL'}`);
  console.log(`   Erros: ${sessionData.extractionStatus.errors.length}`);
  
  console.log('\n💾 DADOS PRONTOS PARA USO NA EXTENSÃO:');
  console.log('   Copie o objeto abaixo para implementar na extensão:');
  console.log('\n' + '='.repeat(60));
  
  // Criar versão limpa para a extensão
  const extensionData = {
    userId: sessionData.userId,
    timestamp: sessionData.timestamp,
    source: 'enhanced_extractor',
    url: sessionData.url,
    cookies: sessionData.cookies,
    userInfo: sessionData.userInfo,
    tokens: sessionData.tokens,
    browserInfo: sessionData.browserInfo,
    metadata: {
      extractedAt: sessionData.timestamp,
      completeness: sessionData.extractionStatus.dataCompleteness,
      version: sessionData.version
    }
  };
  
  console.log(JSON.stringify(extensionData, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Extração concluída! Dados prontos para implementação.');
  console.log('💡 Dica: Use window.extractedSessionData para acessar os dados');
  
  // Disponibilizar globalmente para fácil acesso
  window.extractedSessionData = extensionData;
  
  return extensionData;
})();