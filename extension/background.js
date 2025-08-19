// VendaBoost Cookie Extractor - Background Script
console.log('VendaBoost Background Script carregado');

// Armazenar dados da sessão
let sessionData = null;
let lastUpdate = null;

// Função para extrair cookies específicos do Facebook
async function getFacebookCookies() {
  try {
    if (!chrome.cookies) {
      console.warn('API de cookies não disponível');
      return {};
    }

    const cookies = await chrome.cookies.getAll({
      domain: '.facebook.com'
    });
    
    const importantCookies = {};
    const cookieNames = ['c_user', 'xs', 'fr', 'sb', 'datr', 'wd', 'dpr', 'locale'];
    
    cookies.forEach(cookie => {
      if (cookieNames.includes(cookie.name) || cookie.name.startsWith('_fb')) {
        importantCookies[cookie.name] = {
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
          expirationDate: cookie.expirationDate
        };
      }
    });
    
    return importantCookies;
  } catch (error) {
    console.error('Erro ao extrair cookies:', error);
    return {};
  }
}

// Função para salvar dados no storage
async function saveToStorage(data) {
  try {
    await chrome.storage.local.set({
      vendaboost_session: data.sessionData,
      vendaboost_last_update: data.lastUpdate
    });
    return true;
  } catch (error) {
    console.error('Erro ao salvar no storage:', error);
    return false;
  }
}

// Função para carregar dados do storage
async function loadFromStorage() {
  try {
    const result = await chrome.storage.local.get(['vendaboost_session', 'vendaboost_last_update']);
    if (result.vendaboost_session) {
      sessionData = result.vendaboost_session;
      lastUpdate = result.vendaboost_last_update;
      console.log('Dados de sessão carregados do storage');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Erro ao carregar dados do storage:', error);
    return false;
  }
}

// Listener único para todas as mensagens
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Função assíncrona para lidar com as mensagens
  (async () => {
    try {
      if (request.action === 'userLoggedIn') {
        sessionData = request.data;
        lastUpdate = new Date().toISOString();
        
        const saved = await saveToStorage({ sessionData, lastUpdate });
        console.log('Dados de sessão atualizados:', sessionData);
        sendResponse({ success: saved });
      }
      
      else if (request.action === 'getSessionData') {
        sendResponse({
          data: sessionData,
          lastUpdate: lastUpdate
        });
      }
      
      else if (request.action === 'clearSessionData') {
        sessionData = null;
        lastUpdate = null;
        try {
          await chrome.storage.local.remove(['vendaboost_session', 'vendaboost_last_update']);
          sendResponse({ success: true });
        } catch (error) {
          console.error('Erro ao limpar storage:', error);
          sendResponse({ success: false, error: error.message });
        }
      }
      
      else if (request.action === 'getCookies') {
        const cookies = await getFacebookCookies();
        sendResponse({ cookies });
      }
      
      else {
        sendResponse({ error: 'Ação não reconhecida' });
      }
    } catch (error) {
      console.error('Erro no background script:', error);
      sendResponse({ error: error.message });
    }
  })();
  
  // Retorna true para indicar resposta assíncrona
  return true;
});

// Inicialização quando o service worker é carregado
(async () => {
  try {
    await loadFromStorage();
    console.log('Background script inicializado com sucesso');
  } catch (error) {
    console.error('Erro na inicialização:', error);
  }
})();

// Monitorar mudanças de cookies (com verificação de disponibilidade)
try {
  if (chrome.cookies && chrome.cookies.onChanged) {
    chrome.cookies.onChanged.addListener((changeInfo) => {
      try {
        if (changeInfo.cookie && changeInfo.cookie.domain && changeInfo.cookie.domain.includes('facebook.com')) {
          console.log('Cookie do Facebook alterado:', changeInfo.cookie.name);
        }
      } catch (error) {
        console.error('Erro no listener de cookies:', error);
      }
    });
  }
} catch (error) {
  console.error('Erro ao configurar listener de cookies:', error);
}