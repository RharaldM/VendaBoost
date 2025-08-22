// VendaBoost Desktop Extension - Background Script
console.log('VendaBoost Desktop Extension background script loaded');

// Store session data
let sessionData = null;
let lastUpdate = null;

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('VendaBoost Desktop Extension installed');
  // Set up periodic session refresh
  chrome.alarms.create('sessionRefresh', { periodInMinutes: 30 });
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('VendaBoost Desktop Extension started');
  chrome.alarms.create('sessionRefresh', { periodInMinutes: 30 });
});

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'userLoggedIn') {
    console.log('User logged in to Facebook:', request.data);
    sessionData = request.data;
    lastUpdate = new Date().toISOString();
    saveToStorage({ sessionData, lastUpdate });
    sendResponse({ success: true });
    return true;
  }
  
  // Handle cookie extraction requests
  if (request.action === 'getCookies') {
    extractFacebookCookies().then(cookies => {
      sendResponse({ cookies });
    }).catch(error => {
      console.error('Error extracting cookies:', error);
      sendResponse({ cookies: [], error: error.message });
    });
    return true; // Keep the message channel open for async response
  }
  
  // Handle session data requests from popup
  if (request.action === 'getSessionData') {
    // Load from storage if not in memory
    if (!sessionData) {
      loadFromStorage().then(() => {
        sendResponse({ data: sessionData, lastUpdate });
      });
      return true;
    }
    sendResponse({ data: sessionData, lastUpdate });
    return true;
  }
  
  // Clear session data
  if (request.action === 'clearSessionData') {
    sessionData = null;
    lastUpdate = null;
    chrome.storage.local.clear().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  // Send data to localhost (avoids CORS)
  if (request.action === 'sendToLocalhost') {
    console.log('Background: Recebido pedido para enviar ao localhost');
    sendToLocalhostServer(request.data).then(result => {
      console.log('Background: Resultado do envio:', result);
      sendResponse(result);
    }).catch(error => {
      console.error('Background: Erro ao enviar:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
});

// Function to extract Facebook cookies
async function extractFacebookCookies() {
  try {
    if (!chrome.cookies) {
      console.warn('Cookies API not available');
      return [];
    }

    // Get cookies from ALL Facebook domains
    const [domainCookies, wwwCookies, mCookies, baseCookies] = await Promise.all([
      chrome.cookies.getAll({ domain: '.facebook.com' }),
      chrome.cookies.getAll({ domain: 'www.facebook.com' }),
      chrome.cookies.getAll({ domain: 'm.facebook.com' }),
      chrome.cookies.getAll({ domain: 'facebook.com' })
    ]);
    
    // Combine all cookies
    const allCookies = [...domainCookies, ...wwwCookies, ...mCookies, ...baseCookies];
    
    // Deduplicate cookies (keep the one with most specific domain)
    const cookieMap = new Map();
    allCookies.forEach(cookie => {
      const key = `${cookie.name}-${cookie.domain}`;
      if (!cookieMap.has(cookie.name) || cookie.domain.startsWith('.')) {
        cookieMap.set(cookie.name, cookie);
      }
    });
    
    const uniqueCookies = Array.from(cookieMap.values());
    
    // Convert to our format
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
    
    // Log important cookies for debugging
    const importantCookies = ['c_user', 'xs', 'datr', 'fr', 'sb'];
    const foundImportant = formattedCookies.filter(c => importantCookies.includes(c.name));
    console.log('🍪 Important cookies found:', foundImportant.map(c => c.name));
    
    console.log(`✅ Extracted ${formattedCookies.length} Facebook cookies`);
    return formattedCookies;
    
  } catch (error) {
    console.error('❌ Error extracting Facebook cookies:', error);
    throw error;
  }
}

// Function to save data to storage
async function saveToStorage(data) {
  try {
    await chrome.storage.local.set({
      vendaboost_session: data.sessionData,
      vendaboost_last_update: data.lastUpdate
    });
    console.log('✅ Session data saved to storage');
  } catch (error) {
    console.error('❌ Error saving to storage:', error);
  }
}

// Function to load data from storage
async function loadFromStorage() {
  try {
    const result = await chrome.storage.local.get([
      'vendaboost_session',
      'vendaboost_last_update'
    ]);
    
    sessionData = result.vendaboost_session || null;
    lastUpdate = result.vendaboost_last_update || null;
    
    console.log('📥 Session data loaded from storage');
  } catch (error) {
    console.error('❌ Error loading from storage:', error);
  }
}

// Monitor Facebook tabs for automatic extraction
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && 
      tab.url && 
      tab.url.includes('facebook.com')) {
    
    console.log('📱 VendaBoost: Facebook detectado, iniciando extração automática');
    
    // Inject content script if needed
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).then(() => {
      console.log('✅ VendaBoost: Content script injetado');
    }).catch((error) => {
      // Script might already be injected
      console.log('ℹ️ VendaBoost: Content script já está ativo');
    });
    
    // Also check with a delay
    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, { action: 'checkAutoExtract' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('⏳ VendaBoost: Aguardando página carregar completamente');
        } else {
          console.log('✅ VendaBoost: Extração automática em andamento');
        }
      });
    }, 3000);
  }
});

// Handle alarm for periodic session refresh
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'sessionRefresh') {
    console.log('🔄 Refreshing Facebook session data');
    refreshSessionData();
  }
});

// Function to refresh session data periodically
async function refreshSessionData() {
  try {
    const tabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
    
    if (tabs.length === 0) {
      console.log('📭 No Facebook tabs open for session refresh');
      return;
    }
    
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { action: 'extractSession' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('⚠️ Could not refresh session for tab:', tab.id);
        } else {
          console.log('✅ Session refreshed for tab:', tab.id);
        }
      });
    }
  } catch (error) {
    console.error('❌ Error refreshing session data:', error);
  }
}

// Initialize extension
(async () => {
  try {
    await loadFromStorage();
    console.log('🚀 VendaBoost Desktop Extension initialized');
  } catch (error) {
    console.error('❌ Error initializing extension:', error);
  }
})();

// Function to send data to localhost server (from background to avoid CORS)
async function sendToLocalhostServer(data) {
  const urls = [
    'http://localhost:3000/api/facebook-session',
    'http://localhost:3001/api/facebook-session',
    'http://127.0.0.1:3000/api/facebook-session',
    'http://127.0.0.1:3001/api/facebook-session'
  ];
  
  for (const url of urls) {
    try {
      console.log(`📡 Background: Tentando enviar para ${url}...`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Background: Dados enviados com sucesso:', result);
        return { success: true, result };
      }
    } catch (error) {
      console.log(`⏳ Background: ${url} não disponível`);
    }
  }
  
  return { success: false, error: 'Servidor não encontrado' };
}

// Monitor cookie changes for important Facebook cookies
try {
  chrome.cookies.onChanged.addListener((changeInfo) => {
    if (changeInfo.cookie.domain.includes('facebook.com')) {
      const importantCookies = ['c_user', 'xs', 'datr', 'fr'];
      if (importantCookies.includes(changeInfo.cookie.name)) {
        console.log(`🍪 Important Facebook cookie changed: ${changeInfo.cookie.name}`);
        
        // Trigger session refresh if user is logged in
        if (changeInfo.cookie.name === 'c_user' && !changeInfo.removed) {
          setTimeout(() => {
            refreshSessionData();
          }, 1000);
        }
      }
    }
  });
} catch (error) {
  console.error('❌ Error setting up cookie listener:', error);
}