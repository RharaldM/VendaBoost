// VendaBoost Cookie Extractor - Content Script
console.log('VendaBoost Cookie Extractor carregado');

// Função para extrair informações da sessão
function extractSessionInfo() {
  const sessionData = {
    url: window.location.href,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    cookies: {},
    localStorage: {},
    sessionStorage: {},
    userInfo: {}
  };

  // Extrair cookies do documento
  if (document.cookie) {
    document.cookie.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        sessionData.cookies[name] = value;
      }
    });
  }

  // Extrair localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        sessionData.localStorage[key] = localStorage.getItem(key);
      }
    }
  } catch (e) {
    console.warn('Erro ao acessar localStorage:', e);
  }

  // Extrair sessionStorage
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        sessionData.sessionStorage[key] = sessionStorage.getItem(key);
      }
    }
  } catch (e) {
    console.warn('Erro ao acessar sessionStorage:', e);
  }

  // Tentar extrair informações do usuário
  try {
    // Procurar por elementos que contenham informações do usuário
    const profileLinks = document.querySelectorAll('a[href*="/profile.php"], a[href*="facebook.com/"]');
    const userMenus = document.querySelectorAll('[data-testid="user_menu"], [aria-label*="perfil"]');
    
    // Extrair nome do usuário se disponível
    const nameElements = document.querySelectorAll('[data-testid="left_nav_menu_item"] span, .x1heor9g, .x1qlqyl8');
    for (const element of nameElements) {
      if (element.textContent && element.textContent.trim().length > 0 && element.textContent.trim().length < 50) {
        sessionData.userInfo.name = element.textContent.trim();
        break;
      }
    }

    // Extrair ID do usuário se disponível nos links
    for (const link of profileLinks) {
      const href = link.href;
      if (href.includes('profile.php?id=')) {
        const match = href.match(/profile\.php\?id=(\d+)/);
        if (match) {
          sessionData.userInfo.userId = match[1];
          break;
        }
      }
    }
  } catch (e) {
    console.warn('Erro ao extrair informações do usuário:', e);
  }

  return sessionData;
}

// Função para verificar se o usuário está logado
function isLoggedIn() {
  try {
    // Verificar se existe cookie de sessão
    const hasCookie = document.cookie.includes('c_user=') || document.cookie.includes('xs=');
    
    // Verificar se não está na página de login
    const notLoginPage = !window.location.href.includes('/login') && !window.location.href.includes('/checkpoint');
    
    // Verificar se existem elementos típicos de usuário logado (mais seletores)
    const userSelectors = [
      '[data-testid="user_menu"]',
      '[aria-label*="perfil"]',
      '[aria-label*="profile"]',
      'a[href*="/profile.php"]',
      '[data-testid="left_nav_menu_item"]',
      '.x1heor9g', // Classe comum em elementos de usuário
      '[role="navigation"] [role="button"]', // Menu de navegação
      'div[data-pagelet="LeftRail"]' // Barra lateral esquerda
    ];
    
    const hasUserElements = userSelectors.some(selector => {
      try {
        return document.querySelector(selector) !== null;
      } catch (e) {
        return false;
      }
    });
    
    // Log para debug
    console.log('Login check:', {
      hasCookie,
      notLoginPage,
      hasUserElements,
      url: window.location.href
    });

    return hasCookie && notLoginPage && hasUserElements;
  } catch (error) {
    console.error('Erro ao verificar login:', error);
    return false;
  }
}

// Listener para mensagens do popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractData') {
    const isLogged = isLoggedIn();
    const sessionData = isLogged ? extractSessionInfo() : null;
    
    sendResponse({
      success: true,
      isLoggedIn: isLogged,
      data: sessionData,
      message: isLogged ? 'Dados extraídos com sucesso!' : 'Usuário não está logado no Facebook'
    });
  }
  
  if (request.action === 'checkLogin') {
    sendResponse({
      isLoggedIn: isLoggedIn(),
      url: window.location.href
    });
  }
});

// Verificar automaticamente se o usuário está logado quando a página carrega
setTimeout(() => {
  if (isLoggedIn()) {
    chrome.runtime.sendMessage({
      action: 'userLoggedIn',
      data: extractSessionInfo()
    });
  }
}, 2000);