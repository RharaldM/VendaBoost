// Session Capture Extension - Content Script
// This runs in the context of web pages to extract storage data

(function() {
  'use strict';

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    if (request.action === 'getStorage') {
      try {
        const storageData = {
          localStorage: {},
          sessionStorage: {}
        };

        // Capture localStorage if requested
        if (request.getLocalStorage && typeof localStorage !== 'undefined') {
          storageData.localStorage = captureStorage(localStorage);
        }

        // Capture sessionStorage if requested
        if (request.getSessionStorage && typeof sessionStorage !== 'undefined') {
          storageData.sessionStorage = captureStorage(sessionStorage);
        }

        // Send response back to popup
        sendResponse(storageData);
        
      } catch (error) {
        console.error('Storage extraction error:', error);
        sendResponse({
          error: error.message,
          localStorage: {},
          sessionStorage: {}
        });
      }
      
      return true; // Keep message channel open for async response
    }

    if (request.action === 'getUserAgent') {
      try {
        sendResponse({ userAgent: navigator.userAgent });
      } catch (error) {
        console.error('User agent extraction error:', error);
        sendResponse({ userAgent: 'Unknown User Agent' });
      }
      
      return true;
    }

    if (request.action === 'extractUserName') {
      try {
        const userName = extractUserNameFromDOM();
        sendResponse({ userName: userName });
      } catch (error) {
        console.error('User name extraction error:', error);
        sendResponse({ userName: null });
      }
      
      return true;
    }
  });

  // Helper function to safely extract storage data
  function captureStorage(storage) {
    const data = {};
    
    try {
      // Get all keys from storage
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key) {
          try {
            const value = storage.getItem(key);
            
            // Try to parse JSON values for better structure
            try {
              const parsed = JSON.parse(value);
              data[key] = {
                type: 'json',
                value: parsed
              };
            } catch {
              // If not JSON, store as string
              data[key] = {
                type: 'string',
                value: value
              };
            }
          } catch (itemError) {
            console.warn(`Failed to get item ${key}:`, itemError);
            data[key] = {
              type: 'error',
              value: null,
              error: itemError.message
            };
          }
        }
      }
    } catch (error) {
      console.error('Storage iteration error:', error);
    }
    
    return data;
  }

  // Extract user name from DOM (Facebook-optimized)
  function extractUserNameFromDOM() {
    try {
      console.log('🔍 [USERNAME] Starting Facebook username extraction...');
      
      // Method 1: Try Facebook-specific profile menu/dropdown
      const profileMenuSelectors = [
        // Facebook profile menu button - most reliable
        '[aria-label*="Conta de"] span[dir="auto"]',
        '[aria-label*="Account settings"] span[dir="auto"]',
        
        // Profile menu with user's name
        '[data-testid="user_menu"] strong',
        '[data-testid="blue_bar_profile_link"] strong',
        '[data-testid="blue_bar_profile_link"]',
        
        // Navigation area profile name
        'div[role="navigation"] strong',
        'div[role="banner"] strong',
        
        // Left sidebar profile link (most common location)
        '[data-pagelet="LeftRail"] a[href*="/profile"] span:not(:empty)',
        '[data-pagelet="LeftRail"] a[role="link"] span[dir="auto"]',
        
        // Profile link in header
        'a[href*="/profile.php"] strong',
        'a[href^="/profile"] strong',
        
        // New Facebook layout selectors
        'div[role="main"] a[href*="profile"] span[dir="auto"]',
        'nav[role="navigation"] a[href*="profile"] span',
        
        // Specific Facebook header selectors (updated)
        '[data-pagelet="LeftRail"] strong',
        '[data-pagelet="Bluebar"] strong'
      ];
      
      for (const selector of profileMenuSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (element && element.textContent.trim()) {
            const text = element.textContent.trim();
            if (isValidFacebookName(text)) {
              console.log(`✅ [USERNAME] Found via selector "${selector}": ${text}`);
              return text;
            }
          }
        }
      }
      
      // Method 2: Search in profile URLs
      const profileLinks = document.querySelectorAll('a[href*="/profile"]');
      for (const link of profileLinks) {
        const titleAttr = link.getAttribute('title');
        const ariaLabel = link.getAttribute('aria-label');
        
        if (titleAttr && isValidFacebookName(titleAttr)) {
          console.log(`✅ [USERNAME] Found via profile link title: ${titleAttr}`);
          return titleAttr;
        }
        
        if (ariaLabel && isValidFacebookName(ariaLabel)) {
          console.log(`✅ [USERNAME] Found via profile link aria-label: ${ariaLabel}`);
          return ariaLabel;
        }
      }
      
      // Method 2.5: Try to find in the account switcher or menu
      try {
        // Look for account menu items that show the current user
        const accountSelectors = [
          // Account switcher shows current account
          '[role="dialog"] [aria-checked="true"] span[dir="auto"]',
          '[data-visualcompletion="ignore-dynamic"] [role="button"] span[dir="auto"]',
          // Profile picture menu area
          'div[aria-label*="Menu"] span[dir="auto"]:not(:empty)',
          // Settings menu with name
          '[role="navigation"] [aria-current="page"] span'
        ];
        
        for (const selector of accountSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            const text = element.textContent.trim();
            if (text && text.length >= 2 && text.length <= 100 && !text.includes('@')) {
              console.log(`✅ [USERNAME] Found via account selector "${selector}": ${text}`);
              return text;
            }
          }
        }
      } catch (e) {
        console.log('Could not check account selectors:', e);
      }
      
      // Method 3: Extract from page title (works for profile pages)
      const title = document.title;
      if (title) {
        // Facebook profile page: "Name | Facebook"
        if (title.includes(' | Facebook')) {
          const name = title.split(' | Facebook')[0].trim();
          if (isValidFacebookName(name)) {
            console.log(`✅ [USERNAME] Found via page title: ${name}`);
            return name;
          }
        }
        
        // Facebook page: "(1) Name | Facebook"
        const notificationMatch = title.match(/^\(\d+\)\s+(.+?)\s+\|\s+Facebook$/);
        if (notificationMatch && notificationMatch[1]) {
          const name = notificationMatch[1].trim();
          if (isValidFacebookName(name)) {
            console.log(`✅ [USERNAME] Found via notification title: ${name}`);
            return name;
          }
        }
      }
      
      // Method 4: Search for text that looks like a real name in common areas
      const nameAreas = [
        // Header area
        'div[role="banner"]',
        'div[role="navigation"]',
        // Left sidebar
        '[data-pagelet="LeftRail"]',
        // Any links with profile references
        'a[href*="profile"]'
      ];
      
      for (const areaSelector of nameAreas) {
        const area = document.querySelector(areaSelector);
        if (area) {
          const strongElements = area.querySelectorAll('strong, span[dir="auto"]');
          for (const element of strongElements) {
            const text = element.textContent.trim();
            if (isValidFacebookName(text)) {
              console.log(`✅ [USERNAME] Found via area search in ${areaSelector}: ${text}`);
              return text;
            }
          }
        }
      }
      
      // Method 5: Look for JSON data that might contain user info
      const scripts = document.querySelectorAll('script[type="application/json"]');
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent);
          const name = findNameInObject(data);
          if (name && isValidFacebookName(name)) {
            console.log(`✅ [USERNAME] Found via JSON data: ${name}`);
            return name;
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }
      
      console.warn('⚠️ [USERNAME] Could not find valid Facebook username');
      return null;
      
    } catch (error) {
      console.error('❌ [USERNAME] Error extracting user name:', error);
      return null;
    }
  }
  
  // Helper function to validate if a string looks like a real Facebook name
  function isValidFacebookName(text) {
    if (!text || typeof text !== 'string') return false;
    
    const trimmed = text.trim();
    
    // Must be reasonable length
    if (trimmed.length < 2 || trimmed.length > 100) return false;
    
    // Skip obviously obfuscated strings (too many random chars)
    const randomCharRatio = (trimmed.match(/[a-z]\d|\d[a-z]/gi) || []).length / trimmed.length;
    if (randomCharRatio > 0.3) {
      console.log(`🚫 [USERNAME] Rejecting obfuscated string: ${trimmed} (ratio: ${randomCharRatio})`);
      return false;
    }
    
    // Skip strings with too many consecutive numbers or letters
    if (/\d{4,}/.test(trimmed) || /[a-zA-Z]{15,}/.test(trimmed)) {
      console.log(`🚫 [USERNAME] Rejecting due to long sequences: ${trimmed}`);
      return false;
    }
    
    // Skip Facebook UI patterns (Portuguese and other languages)
    const uiPatterns = [
      // Portuguese patterns
      /^linha do tempo de\s+/i,           // "Linha do tempo de Name"
      /\s+linha do tempo$/i,              // "Name linha do tempo"
      /^timeline de\s+/i,                 // "Timeline de Name"
      /\s+timeline$/i,                    // "Name timeline"
      /^perfil de\s+/i,                   // "Perfil de Name"
      /\s+perfil$/i,                      // "Name perfil"
      
      // English patterns
      /^timeline of\s+/i,                 // "Timeline of Name"
      /\s+timeline$/i,                    // "Name timeline"
      /^profile of\s+/i,                  // "Profile of Name"
      /\s+profile$/i,                     // "Name profile"
      
      // Spanish patterns
      /^cronología de\s+/i,               // "Cronología de Name"
      /^perfil de\s+/i,                   // "Perfil de Name"
      
      // General patterns
      /^.+\s+(timeline|perfil|profile|cronología)\s*$/i
    ];
    
    // Check if text matches any UI pattern and extract clean name
    for (const pattern of uiPatterns) {
      if (pattern.test(trimmed)) {
        console.log(`🔍 [USERNAME] Detected UI pattern in: ${trimmed}`);
        
        // Try to extract just the name part
        let cleanName = trimmed;
        
        // Remove all known prefixes
        cleanName = cleanName.replace(/^linha do tempo de\s+/i, '');
        cleanName = cleanName.replace(/^timeline of\s+/i, '');
        cleanName = cleanName.replace(/^perfil de\s+/i, '');
        cleanName = cleanName.replace(/^profile of\s+/i, '');
        cleanName = cleanName.replace(/^cronología de\s+/i, '');
        
        // Remove all known suffixes
        cleanName = cleanName.replace(/\s+(timeline|perfil|profile|cronología|linha do tempo)\s*$/i, '');
        
        cleanName = cleanName.trim();
        
        // If we extracted a clean name that's different from original
        if (cleanName && cleanName !== trimmed && cleanName.length >= 2) {
          console.log(`🔧 [USERNAME] Extracted clean name "${cleanName}" from UI text: ${trimmed}`);
          
          // Validate the cleaned name (but avoid infinite recursion)
          // Check basic validation without calling isValidFacebookName recursively
          if (isBasicValidName(cleanName)) {
            console.log(`✅ [USERNAME] Clean name validated: ${cleanName}`);
            return cleanName; // Return the clean name directly
          } else {
            console.log(`🚫 [USERNAME] Extracted name failed validation: ${cleanName}`);
            return false;
          }
        } else {
          console.log(`🚫 [USERNAME] Could not extract clean name from: ${trimmed}`);
          return false;
        }
      }
    }
    
    // Skip common Facebook UI text (original logic)
    const skipWords = [
      'profile', 'menu', 'home', 'timeline', 'photos', 'about', 'friends',
      'settings', 'privacy', 'help', 'log out', 'logout', 'account',
      'facebook', 'notification', 'message', 'chat', 'search', 'create',
      'linha do tempo', 'perfil', 'cronología'
    ];
    
    const lowerText = trimmed.toLowerCase();
    if (skipWords.some(word => lowerText.includes(word))) {
      console.log(`🚫 [USERNAME] Rejecting UI text: ${trimmed}`);
      return false;
    }
    
    // Should contain mostly letters and spaces, some punctuation ok
    if (!/^[a-zA-ZÀ-ÿ\u0100-\u017F\u0180-\u024F\s\-.']{2,}$/.test(trimmed)) {
      console.log(`🚫 [USERNAME] Rejecting due to invalid characters: ${trimmed}`);
      return false;
    }
    
    console.log(`✅ [USERNAME] Valid name found: ${trimmed}`);
    return true;
  }
  
  // Helper function for basic name validation (without UI pattern checking to avoid recursion)
  function isBasicValidName(text) {
    if (!text || typeof text !== 'string') return false;
    
    const trimmed = text.trim();
    
    // Must be reasonable length
    if (trimmed.length < 2 || trimmed.length > 100) return false;
    
    // Skip obviously obfuscated strings (too many random chars)
    const randomCharRatio = (trimmed.match(/[a-z]\d|\d[a-z]/gi) || []).length / trimmed.length;
    if (randomCharRatio > 0.3) return false;
    
    // Skip strings with too many consecutive numbers or letters
    if (/\d{4,}/.test(trimmed) || /[a-zA-Z]{15,}/.test(trimmed)) return false;
    
    // Should contain mostly letters and spaces, some punctuation ok
    if (!/^[a-zA-ZÀ-ÿ\u0100-\u017F\u0180-\u024F\s\-.']{2,}$/.test(trimmed)) return false;
    
    return true;
  }
  
  // Helper function to search for name in nested objects
  function findNameInObject(obj, depth = 0) {
    if (depth > 3 || !obj || typeof obj !== 'object') return null;
    
    // Common keys that might contain user names
    const nameKeys = ['name', 'displayName', 'fullName', 'firstName', 'user_name', 'username'];
    
    for (const key of nameKeys) {
      if (obj[key] && typeof obj[key] === 'string' && isValidFacebookName(obj[key])) {
        return obj[key];
      }
    }
    
    // Recursively search nested objects
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        const found = findNameInObject(value, depth + 1);
        if (found) return found;
      }
    }
    
    return null;
  }

  // Optional: Detect and capture authentication tokens from common locations
  // This is disabled by default for security - uncomment if needed
  /*
  function findAuthTokens() {
    const tokens = {};
    
    // Check meta tags
    const metaTags = document.querySelectorAll('meta[name*="token"], meta[name*="csrf"]');
    metaTags.forEach(tag => {
      const name = tag.getAttribute('name');
      const content = tag.getAttribute('content');
      if (content) {
        tokens[`meta_${name}`] = content;
      }
    });
    
    // Check common cookie names (these will be captured via chrome.cookies API)
    // Just noting their presence here
    const cookieNames = document.cookie.split(';').map(c => c.trim().split('=')[0]);
    const authCookies = cookieNames.filter(name => 
      /token|auth|session|jwt/i.test(name)
    );
    
    if (authCookies.length > 0) {
      tokens.detectedAuthCookies = authCookies;
    }
    
    return tokens;
  }
  */

  // Send a ready signal to indicate content script is loaded
  chrome.runtime.sendMessage({ action: 'contentScriptReady' });

})();