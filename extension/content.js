// Content script for Facebook - v2.0 (Background-Only Mode)
console.log('🔍 VendaBoost v2.0: Content script loaded (detection-only mode)');

// Only detect login state - NO automatic extraction
if (window.location.hostname.includes('facebook.com')) {
  console.log('📱 VendaBoost: Facebook detected - monitoring login state only');
  
  // Wait for page to load completely
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLoginDetection);
  } else {
    initializeLoginDetection();
  }
  
  // Monitor for login state changes only
  let lastLoginState = false;
  let lastUrl = location.href;
  
  new MutationObserver(() => {
    const url = location.href;
    const currentLoginState = checkIfLoggedIn();
    
    // Only notify on login state change
    if (url !== lastUrl || currentLoginState !== lastLoginState) {
      lastUrl = url;
      
      if (currentLoginState !== lastLoginState) {
        lastLoginState = currentLoginState;
        notifyBackgroundLoginChange(currentLoginState);
      }
    }
  }).observe(document, { subtree: true, childList: true });
}

function initializeLoginDetection() {
  console.log('🚀 VendaBoost v2.0: Initializing login detection (background-only mode)');
  
  // Only detect initial login state - no automatic extraction
  setTimeout(() => {
    const isLoggedIn = checkIfLoggedIn();
    notifyBackgroundLoginChange(isLoggedIn);
    
    if (isLoggedIn) {
      console.log('✅ VendaBoost: User logged in - notified background script');
    } else {
      console.log('⏳ VendaBoost: User not logged in - monitoring for changes');
    }
  }, 2000);
}

// Notify background script about login state change
function notifyBackgroundLoginChange(isLoggedIn) {
  try {
    chrome.runtime.sendMessage({
      action: 'loginStateChanged',
      data: {
        isLoggedIn,
        timestamp: Date.now(),
        url: window.location.href,
        userId: isLoggedIn ? getUserIdFromPage() : null
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('⚠️ VendaBoost: Could not notify background script');
      } else {
        console.log('📡 VendaBoost: Background script notified of login change');
      }
    });
  } catch (error) {
    console.error('❌ VendaBoost: Error notifying background script:', error);
  }
}

// Helper function to get user ID from page (lightweight)
function getUserIdFromPage() {
  try {
    // Quick user ID extraction without full session data
    const cUserCookie = document.cookie.split(';').find(c => c.trim().startsWith('c_user='));
    if (cUserCookie) {
      return cUserCookie.split('=')[1].trim();
    }
    
    // Fallback: try to get from scripts
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent || '';
      const match = content.match(/"USER_ID":"(\d+)"/);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// LEGACY FUNCTION - Only used when background requests manual extraction
async function extractAndSendSessionData() {
  console.log('🔄 VendaBoost: Manual extraction requested by background script');
  
  try {
    const sessionData = await extractFacebookSession();
    
    if (sessionData) {
      // Send to background script
      chrome.runtime.sendMessage({ 
        action: 'userLoggedIn', 
        data: sessionData 
      });
      
      console.log('✅ VendaBoost: Manual extraction completed');
    } else {
      console.warn('⚠️ VendaBoost: Manual extraction failed');
    }
  } catch (error) {
    console.error('❌ VendaBoost: Manual extraction error:', error);
  }
}

async function extractFacebookSession() {
  try {
    // First check if user is logged in
    if (!checkIfLoggedIn()) {
      console.warn('⚠️ Usuário não está logado no Facebook');
      return null;
    }
    
    // Extract user info from Facebook page
    const userInfo = extractUserInfo();
    
    // If we couldn't get ID from DOM, try to get from cookies
    if (!userInfo.id) {
      const cUserCookie = document.cookie.split(';').find(c => c.trim().startsWith('c_user='));
      if (cUserCookie) {
        userInfo.id = cUserCookie.split('=')[1].trim();
        console.log('Got user ID from cookie:', userInfo.id);
      }
    }
    
    if (!userInfo.id) {
      console.warn('⚠️ Não foi possível obter o ID do usuário');
      // Still continue with extraction even without ID
    }

    // Get all cookies
    const cookies = await getAllCookies();
    
    // Get localStorage and sessionStorage
    const localStorage = getLocalStorageData();
    const sessionStorage = getSessionStorageData();
    
    const sessionData = {
      userId: userInfo.id,
      timestamp: new Date().toISOString(),
      cookies: cookies,
      userInfo: userInfo,
      localStorage: localStorage,
      sessionStorage: sessionStorage,
      userAgent: navigator.userAgent,
      url: window.location.href,
      source: 'extension'
    };
    
    return sessionData;
    
  } catch (error) {
    console.error('❌ Erro ao extrair sessão:', error);
    return null;
  }
}

function extractUserInfo() {
  const userInfo = {
    id: '',
    name: '',
    email: '',
    profileUrl: '',
    avatarUrl: ''
  };
  
  try {
    // Try multiple methods to get user ID
    // Method 1: From cookies
    const cUserCookie = document.cookie.split(';').find(c => c.trim().startsWith('c_user='));
    if (cUserCookie) {
      userInfo.id = cUserCookie.split('=')[1];
    }
    
    // Method 2: From page scripts (more reliable)
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const content = script.textContent || '';
      
      // Look for user ID in various formats
      const patterns = [
        /"USER_ID":"(\d+)"/,
        /"userID":"(\d+)"/,
        /"actorID":"(\d+)"/,
        /"viewerID":"(\d+)"/
      ];
      
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match && match[1] && !userInfo.id) {
          userInfo.id = match[1];
          break;
        }
      }
      
      if (userInfo.id) break;
    }
    
    // Method 3: From meta tags
    const metaUserId = document.querySelector('meta[property="al:ios:url"]');
    if (metaUserId && !userInfo.id) {
      const content = metaUserId.getAttribute('content');
      if (content) {
        const match = content.match(/profile\/(\d+)/);
        if (match) {
          userInfo.id = match[1];
        }
      }
    }
    
    // Method 4: From localStorage/sessionStorage data
    try {
      const fbData = localStorage.getItem('Session') || sessionStorage.getItem('Session');
      if (fbData && !userInfo.id) {
        const match = fbData.match(/"USER_ID":"(\d+)"/);
        if (match) {
          userInfo.id = match[1];
        }
      }
    } catch (e) {
      // Ignore storage access errors
    }
    
    // Get user name - Try multiple selectors
    const nameSelectors = [
      '[role="banner"] h1',
      'div[role="main"] h1',
      'a[href*="/profile"] span',
      'div[role="banner"] div[dir="auto"] > span',
      // For newer Facebook UI
      'div[role="main"] div[dir="auto"] h1',
      'div[aria-label] h1 span'
    ];
    
    for (const selector of nameSelectors) {
      const nameElement = document.querySelector(selector);
      if (nameElement && nameElement.textContent) {
        const name = nameElement.textContent.trim();
        if (name && name.length > 0 && name.length < 100 && !name.includes('Facebook')) {
          userInfo.name = name;
          break;
        }
      }
    }
    
    // If no name found, try extracting from document title
    if (!userInfo.name) {
      const titleMatch = document.title.match(/^(.+?)\s*[\|\-\•]\s*Facebook/);
      if (titleMatch) {
        userInfo.name = titleMatch[1].trim();
      }
    }
    
    // Get profile URL
    if (userInfo.id) {
      userInfo.profileUrl = `https://www.facebook.com/profile.php?id=${userInfo.id}`;
    }
    
    // Get avatar URL
    const avatarImg = document.querySelector('[data-pagelet="ProfileActions"] img, [role="banner"] img[src*="profile"]');
    if (avatarImg) {
      userInfo.avatarUrl = avatarImg.src;
    }
    
  } catch (error) {
    console.error('❌ Erro ao extrair informações do usuário:', error);
  }
  
  return userInfo;
}

async function getAllCookies() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getCookies' }, (response) => {
      resolve(response.cookies || []);
    });
  });
}

function getLocalStorageData() {
  const data = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        data[key] = localStorage.getItem(key);
      }
    }
  } catch (error) {
    console.error('❌ Erro ao acessar localStorage:', error);
  }
  return data;
}

function getSessionStorageData() {
  const data = {};
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        data[key] = sessionStorage.getItem(key);
      }
    }
  } catch (error) {
    console.error('❌ Erro ao acessar sessionStorage:', error);
  }
  return data;
}

async function sendSessionToLocalhost(sessionData) {
  // First try to send via background script (avoids CORS)
  try {
    console.log('📡 VendaBoost: Enviando dados via background script...');
    
    const response = await chrome.runtime.sendMessage({ 
      action: 'sendToLocalhost', 
      data: sessionData 
    });
    
    if (response && response.success) {
      console.log('✅ VendaBoost: Dados enviados com sucesso via background!');
      showNotification('✅ Sessão enviada para VendaBoost Desktop!', 'success');
      return true;
    }
  } catch (error) {
    console.log('⚠️ VendaBoost: Erro ao enviar via background:', error);
  }
  
  // Fallback: Try direct fetch (might have CORS issues)
  const localhostUrls = [
    'http://localhost:3000/api/facebook-session',
    'http://localhost:3001/api/facebook-session'
  ];
  
  for (const url of localhostUrls) {
    try {
      console.log(`📡 VendaBoost: Tentando envio direto para ${url}...`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ VendaBoost: Dados enviados com sucesso (direto):', result);
        showNotification('✅ Sessão enviada para VendaBoost Desktop!', 'success');
        return true;
      }
    } catch (error) {
      console.log(`⏳ VendaBoost: ${url} não disponível (direto)`);
    }
  }
  
  // If all attempts failed, save locally and notify
  console.warn('⚠️ VendaBoost: Servidor local não encontrado, salvando dados localmente');
  showNotification('⚠️ Dados salvos localmente. Inicie o servidor VendaBoost.', 'warning');
  
  // Save to extension storage
  chrome.runtime.sendMessage({ 
    action: 'userLoggedIn', 
    data: sessionData 
  });
  
  return false;
}

function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    font-family: Arial, sans-serif;
    font-size: 14px;
    max-width: 300px;
    word-wrap: break-word;
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // Remove after 5 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 5000);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkFacebook') {
    const isFacebook = window.location.hostname.includes('facebook.com');
    sendResponse({ isFacebook });
    return true;
  }
  
  if (request.action === 'checkLogin') {
    // Check if user is logged in
    const isLoggedIn = checkIfLoggedIn();
    sendResponse({ isLoggedIn });
    return true;
  }
  
  if (request.action === 'extractData') {
    extractFacebookSession().then(sessionData => {
      if (sessionData) {
        sendResponse({ success: true, data: sessionData });
      } else {
        sendResponse({ success: false, message: 'Não foi possível extrair dados' });
      }
    });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'extractSession') {
    extractAndSendSessionData();
    sendResponse({ success: true });
    return true;
  }
});

// Get essential cookies for comparison (excluding frequently changing ones)
function getEssentialCookies(cookies) {
  // Only compare cookies that actually indicate session/login changes
  const essential = ['c_user', 'xs', 'datr']; // Removed 'fr' as it changes frequently
  const cookieMap = {};
  
  cookies.forEach(cookie => {
    if (essential.includes(cookie.name)) {
      cookieMap[cookie.name] = cookie.value;
    }
  });
  
  return cookieMap;
}

// Check if session data has changed significantly
function hasSessionDataChanged(newData, previousData) {
  // Different user = definitely changed
  if (newData.userId !== previousData.userId) {
    return true;
  }
  
  // Compare essential cookies (only those that indicate real session changes)
  const newEssential = getEssentialCookies(newData.cookies);
  const prevEssential = previousData.essentialCookies || {};
  
  const criticalCookies = ['c_user', 'xs', 'datr']; // Removed 'fr' - changes too frequently
  for (const cookieName of criticalCookies) {
    if (newEssential[cookieName] !== prevEssential[cookieName]) {
      console.log(`🔄 VendaBoost: Cookie crítico '${cookieName}' mudou - sessão alterada`);
      return true;
    }
  }
  
  // Check if more than 4 hours passed (longer interval for production stability)
  if (previousData.timestamp) {
    const timeDiff = new Date(newData.timestamp).getTime() - new Date(previousData.timestamp).getTime();
    const refreshInterval = 4 * 60 * 60 * 1000; // 4 hours
    
    if (timeDiff > refreshInterval) {
      console.log('⏰ VendaBoost: Mais de 4 horas desde última sessão - refresh necessário');
      return true;
    }
  }
  
  return false;
}

// Check if user is logged in
function checkIfLoggedIn() {
  // Multiple ways to check if logged in
  
  // 1. Check for c_user cookie
  const hasUserCookie = document.cookie.includes('c_user=');
  
  // 2. Check for profile elements
  const hasProfileElements = !!(
    document.querySelector('[role="banner"]') ||
    document.querySelector('[data-pagelet="ProfileActions"]') ||
    document.querySelector('div[role="main"]') ||
    document.querySelector('a[href*="/me/"]')
  );
  
  // 3. Check for navigation elements that only appear when logged in
  const hasNavElements = !!(
    document.querySelector('a[href="/"]') ||
    document.querySelector('div[role="navigation"]') ||
    document.querySelector('[aria-label="Facebook"]')
  );
  
  // 4. Check if NOT on login page
  const notOnLoginPage = !window.location.pathname.includes('/login') && 
                         !window.location.pathname.includes('/reg');
  
  console.log('Login check:', {
    hasUserCookie,
    hasProfileElements,
    hasNavElements,
    notOnLoginPage,
    url: window.location.href
  });
  
  return hasUserCookie || (hasProfileElements && notOnLoginPage) || (hasNavElements && notOnLoginPage);
}