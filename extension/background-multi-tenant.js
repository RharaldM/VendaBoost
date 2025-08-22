// VendaBoost Desktop Extension - Multi-Tenant Version
console.log('VendaBoost Multi-Tenant Extension loaded');

// Configuração do usuário (salva após login no site)
let userConfig = null;

// Carregar configuração do usuário
chrome.storage.local.get(['vendaboost_user_config'], (result) => {
  if (result.vendaboost_user_config) {
    userConfig = result.vendaboost_user_config;
    console.log('✅ Configuração do usuário carregada:', {
      userId: userConfig.userId,
      serverUrl: userConfig.serverUrl
    });
  } else {
    console.log('⚠️ Nenhuma configuração de usuário encontrada');
  }
});

// Ouvir mensagens do popup ou content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // Configurar usuário (vindo do popup após login no site)
  if (request.action === 'configureUser') {
    const { userId, userToken, serverUrl } = request.data;
    
    userConfig = {
      userId,
      userToken,
      serverUrl,
      endpoint: '/api/extension/session',
      configuredAt: new Date().toISOString()
    };
    
    // Salvar configuração
    chrome.storage.local.set({
      vendaboost_user_config: userConfig
    }, () => {
      console.log('✅ Usuário configurado:', userId);
      sendResponse({ success: true, message: 'Usuário configurado com sucesso' });
    });
    
    return true;
  }
  
  // Capturar e enviar sessão do Facebook
  if (request.action === 'userLoggedIn') {
    if (!userConfig) {
      console.error('❌ Extensão não configurada. Configure primeiro no site.');
      sendResponse({ 
        success: false, 
        error: 'Extensão não configurada. Faça login no VendaBoost primeiro.' 
      });
      return true;
    }
    
    console.log('📤 Enviando sessão para o servidor do usuário:', userConfig.userId);
    
    // Enviar para o servidor do usuário específico
    sendSessionToUserServer(request.data).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    
    return true;
  }
  
  // Obter configuração atual
  if (request.action === 'getConfig') {
    sendResponse({ 
      configured: !!userConfig,
      config: userConfig 
    });
    return true;
  }
  
  // Limpar configuração (logout)
  if (request.action === 'clearConfig') {
    userConfig = null;
    chrome.storage.local.remove(['vendaboost_user_config'], () => {
      console.log('🗑️ Configuração do usuário removida');
      sendResponse({ success: true });
    });
    return true;
  }
  
  // Extrair cookies
  if (request.action === 'getCookies') {
    extractFacebookCookies().then(cookies => {
      sendResponse({ cookies });
    }).catch(error => {
      sendResponse({ cookies: [], error: error.message });
    });
    return true;
  }
});

/**
 * Enviar sessão para o servidor específico do usuário
 */
async function sendSessionToUserServer(sessionData) {
  if (!userConfig) {
    throw new Error('Usuário não configurado');
  }
  
  const url = userConfig.serverUrl + userConfig.endpoint;
  
  try {
    console.log(`📡 Enviando para: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': userConfig.userToken
      },
      body: JSON.stringify(sessionData)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Sessão enviada com sucesso:', result);
      
      // Mostrar notificação
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'VendaBoost',
        message: `Sessão do Facebook atualizada para ${result.userData.facebookName}`
      });
      
      return { success: true, result };
    } else {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao enviar sessão');
    }
  } catch (error) {
    console.error('❌ Erro ao enviar sessão:', error);
    throw error;
  }
}

/**
 * Extrair cookies do Facebook
 */
async function extractFacebookCookies() {
  try {
    const [domainCookies, wwwCookies, mCookies, baseCookies] = await Promise.all([
      chrome.cookies.getAll({ domain: '.facebook.com' }),
      chrome.cookies.getAll({ domain: 'www.facebook.com' }),
      chrome.cookies.getAll({ domain: 'm.facebook.com' }),
      chrome.cookies.getAll({ domain: 'facebook.com' })
    ]);
    
    const allCookies = [...domainCookies, ...wwwCookies, ...mCookies, ...baseCookies];
    
    // Deduplicate
    const cookieMap = new Map();
    allCookies.forEach(cookie => {
      if (!cookieMap.has(cookie.name) || cookie.domain.startsWith('.')) {
        cookieMap.set(cookie.name, cookie);
      }
    });
    
    const uniqueCookies = Array.from(cookieMap.values());
    
    const formattedCookies = uniqueCookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      expires: cookie.expirationDate,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite
    }));
    
    console.log(`✅ ${formattedCookies.length} cookies extraídos`);
    return formattedCookies;
    
  } catch (error) {
    console.error('❌ Erro ao extrair cookies:', error);
    throw error;
  }
}

/**
 * Monitorar abas do Facebook
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && 
      tab.url && 
      tab.url.includes('facebook.com') &&
      userConfig) {
    
    console.log('📱 Facebook detectado para usuário:', userConfig.userId);
    
    // Injetar content script se necessário
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).catch(() => {
      console.log('Content script já injetado');
    });
  }
});

/**
 * Verificar periodicamente se o usuário ainda está logado
 */
setInterval(() => {
  if (userConfig) {
    // Verificar se o token ainda é válido
    fetch(userConfig.serverUrl + '/api/user/verify', {
      method: 'GET',
      headers: {
        'X-User-Token': userConfig.userToken
      }
    }).then(response => {
      if (!response.ok) {
        console.warn('⚠️ Token expirado, limpando configuração');
        userConfig = null;
        chrome.storage.local.remove(['vendaboost_user_config']);
      }
    }).catch(() => {
      console.log('Servidor offline');
    });
  }
}, 30 * 60 * 1000); // A cada 30 minutos