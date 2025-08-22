/**
 * VendaBoost Extension - Session Validator
 * Valida sessão do Facebook usando apenas cookies - totalmente independente
 */

class SessionValidator {
  constructor() {
    this.lastValidation = null;
    this.validationCache = new Map();
    this.isValidating = false;
    
    // Configuration
    this.config = {
      validationInterval: 5 * 60 * 1000,    // 5 minutos
      cacheValidationFor: 2 * 60 * 1000,    // Cache por 2 minutos
      requiredCookies: ['c_user', 'xs'],
      optionalCookies: ['datr', 'fr', 'sb'],
      
      // Validation methods
      cookieValidation: true,
      apiValidation: false,        // Pode implementar depois
      tabValidation: true,         // Usar tab invisível se necessário
      
      // Timeouts
      validationTimeout: 30000,
      tabCreationTimeout: 10000
    };
    
    // State
    this.state = {
      lastKnownUserId: null,
      lastKnownLoginState: false,
      validationAttempts: 0,
      successfulValidations: 0,
      failedValidations: 0
    };
    
    logger.info('SESSION_VALIDATOR', 'SessionValidator initialized');
  }

  /**
   * Main validation method - completely independent
   */
  async validateSession(force = false) {
    try {
      // Check cache first
      if (!force && this.isValidationCached()) {
        const cached = this.getValidationFromCache();
        logger.debug('SESSION_VALIDATOR', 'Using cached validation result', cached);
        return cached;
      }
      
      if (this.isValidating) {
        logger.debug('SESSION_VALIDATOR', 'Validation already in progress');
        return { isValid: false, reason: 'validation_in_progress' };
      }
      
      this.isValidating = true;
      this.state.validationAttempts++;
      
      logger.info('SESSION_VALIDATOR', '🔐 Starting independent session validation');
      
      // Step 1: Cookie-based validation (fastest)
      const cookieValidation = await this.validateViaCookies();
      
      if (!cookieValidation.isValid) {
        logger.info('SESSION_VALIDATOR', '❌ Cookie validation failed', cookieValidation);
        return this.cacheAndReturn(cookieValidation);
      }
      
      // Step 2: Enhanced validation if needed
      let enhancedValidation = cookieValidation;
      
      if (this.config.tabValidation && cookieValidation.confidence < 0.9) {
        logger.debug('SESSION_VALIDATOR', 'Running enhanced tab validation');
        enhancedValidation = await this.validateViaTab(cookieValidation);
      }
      
      // Update state
      this.updateValidationState(enhancedValidation);
      
      logger.info('SESSION_VALIDATOR', '✅ Session validation completed', {
        isValid: enhancedValidation.isValid,
        confidence: enhancedValidation.confidence,
        userId: enhancedValidation.userId
      });
      
      return this.cacheAndReturn(enhancedValidation);
      
    } catch (error) {
      this.state.failedValidations++;
      logger.error('SESSION_VALIDATOR', 'Session validation error', null, error);
      
      const errorResult = {
        isValid: false,
        error: error.message,
        timestamp: Date.now(),
        confidence: 0
      };
      
      return this.cacheAndReturn(errorResult);
      
    } finally {
      this.isValidating = false;
    }
  }

  /**
   * Validate session using cookies only
   */
  async validateViaCookies() {
    try {
      logger.debug('SESSION_VALIDATOR', 'Validating via cookies');
      
      // Get Facebook cookies
      const cookies = await this.getFacebookCookies();
      
      if (!cookies || cookies.length === 0) {
        return {
          isValid: false,
          reason: 'no_facebook_cookies',
          confidence: 0,
          timestamp: Date.now()
        };
      }
      
      // Check required cookies
      const validation = {
        isValid: false,
        userId: null,
        confidence: 0,
        cookieChecks: {},
        timestamp: Date.now(),
        method: 'cookies_only'
      };
      
      let validCookiesCount = 0;
      
      // Check each required cookie
      for (const cookieName of this.config.requiredCookies) {
        const cookie = cookies.find(c => c.name === cookieName);
        
        if (cookie) {
          const isExpired = this.isCookieExpired(cookie);
          const isValid = !isExpired && cookie.value && cookie.value.length > 0;
          
          validation.cookieChecks[cookieName] = {
            present: true,
            expired: isExpired,
            valid: isValid,
            value: isValid ? cookie.value : null
          };
          
          if (isValid) {
            validCookiesCount++;
            
            // Extract user ID from c_user cookie
            if (cookieName === 'c_user') {
              validation.userId = cookie.value;
            }
          }
        } else {
          validation.cookieChecks[cookieName] = {
            present: false,
            expired: null,
            valid: false
          };
        }
      }
      
      // Calculate confidence based on required cookies
      validation.confidence = validCookiesCount / this.config.requiredCookies.length;
      validation.isValid = validation.confidence >= 1.0; // All required cookies must be valid
      
      // Bonus confidence from optional cookies
      let optionalCookiesValid = 0;
      for (const cookieName of this.config.optionalCookies) {
        const cookie = cookies.find(c => c.name === cookieName);
        if (cookie && !this.isCookieExpired(cookie)) {
          optionalCookiesValid++;
        }
      }
      
      // Add bonus confidence (up to 0.2)
      const bonusConfidence = (optionalCookiesValid / this.config.optionalCookies.length) * 0.2;
      validation.confidence = Math.min(1.0, validation.confidence + bonusConfidence);
      
      // Additional checks
      if (validation.isValid) {
        // Check cookie age
        const cUserCookie = cookies.find(c => c.name === 'c_user');
        if (cUserCookie && cUserCookie.expirationDate) {
          const timeToExpiry = (cUserCookie.expirationDate * 1000) - Date.now();
          const daysToExpiry = timeToExpiry / (24 * 60 * 60 * 1000);
          
          if (daysToExpiry < 7) {
            validation.confidence *= 0.9; // Reduce confidence if expires soon
            validation.warnings = validation.warnings || [];
            validation.warnings.push('Session expires in less than 7 days');
          }
        }
        
        // Check domain consistency
        const domains = [...new Set(cookies.map(c => c.domain))];
        if (!domains.some(d => d.includes('facebook.com'))) {
          validation.isValid = false;
          validation.reason = 'invalid_cookie_domains';
        }
      }
      
      return validation;
      
    } catch (error) {
      return {
        isValid: false,
        error: error.message,
        confidence: 0,
        timestamp: Date.now(),
        method: 'cookies_error'
      };
    }
  }

  /**
   * Enhanced validation using invisible tab
   */
  async validateViaTab(cookieValidation) {
    try {
      logger.debug('SESSION_VALIDATOR', 'Running enhanced validation via tab');
      
      // Create invisible tab for validation
      const tabId = await this.createValidationTab();
      
      try {
        // Wait for tab to load
        await this.waitForTabLoad(tabId);
        
        // Check login status in tab
        const loginStatus = await this.checkLoginInTab(tabId);
        
        // Enhance validation with tab results
        const enhancedValidation = {
          ...cookieValidation,
          tabValidation: loginStatus,
          method: 'cookies_and_tab',
          confidence: this.calculateEnhancedConfidence(cookieValidation, loginStatus)
        };
        
        // Override validity if tab validation disagrees
        if (loginStatus.isLoggedIn !== cookieValidation.isValid) {
          enhancedValidation.isValid = loginStatus.isLoggedIn;
          enhancedValidation.reason = loginStatus.isLoggedIn 
            ? 'tab_validation_override_positive'
            : 'tab_validation_override_negative';
        }
        
        // Update user ID if found in tab
        if (loginStatus.userId && loginStatus.userId !== cookieValidation.userId) {
          enhancedValidation.userId = loginStatus.userId;
          enhancedValidation.userIdSource = 'tab_validation';
        }
        
        return enhancedValidation;
        
      } finally {
        // Always close validation tab
        await this.closeValidationTab(tabId);
      }
      
    } catch (error) {
      logger.warn('SESSION_VALIDATOR', 'Tab validation failed, using cookie validation', null, error);
      
      // Return cookie validation with note about tab failure
      return {
        ...cookieValidation,
        tabValidationError: error.message,
        method: 'cookies_only_tab_failed'
      };
    }
  }

  /**
   * Create validation tab
   */
  async createValidationTab() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Validation tab creation timeout'));
      }, this.config.tabCreationTimeout);
      
      chrome.tabs.create({
        url: 'https://www.facebook.com',
        active: false  // Invisible
      }, (tab) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          logger.debug('SESSION_VALIDATOR', `Validation tab created: ${tab.id}`);
          resolve(tab.id);
        }
      });
    });
  }

  /**
   * Wait for validation tab to load
   */
  async waitForTabLoad(tabId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Tab load timeout'));
      }, this.config.validationTimeout);
      
      const checkLoad = () => {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            clearTimeout(timeout);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (tab.status === 'complete') {
            clearTimeout(timeout);
            // Extra wait for JavaScript to execute
            setTimeout(resolve, 2000);
          } else {
            setTimeout(checkLoad, 500);
          }
        });
      };
      
      checkLoad();
    });
  }

  /**
   * Check login status in validation tab
   */
  async checkLoginInTab(tabId) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          // Simple login check that works in any Facebook page
          const hasUserCookie = document.cookie.includes('c_user=');
          
          // Check for login indicators
          const loginIndicators = [
            '[role="banner"]',
            '[data-pagelet="ProfileActions"]', 
            'div[role="navigation"]',
            'a[href="/"]',
            'a[href*="/me/"]',
            '[aria-label="Facebook"]'
          ];
          
          const hasLoginElements = loginIndicators.some(selector => 
            document.querySelector(selector)
          );
          
          // Check if NOT on login page
          const notOnLoginPage = !window.location.pathname.includes('/login') && 
                                 !window.location.pathname.includes('/reg');
          
          // Get user ID
          let userId = null;
          if (hasUserCookie) {
            const cUserCookie = document.cookie.split(';').find(c => c.trim().startsWith('c_user='));
            if (cUserCookie) {
              userId = cUserCookie.split('=')[1].trim();
            }
          }
          
          const isLoggedIn = hasUserCookie && hasLoginElements && notOnLoginPage;
          
          return {
            isLoggedIn,
            userId,
            hasUserCookie,
            hasLoginElements,
            notOnLoginPage,
            url: window.location.href,
            title: document.title
          };
        }
      });
      
      if (results && results[0] && results[0].result) {
        return results[0].result;
      }
      
      return { isLoggedIn: false, userId: null };
      
    } catch (error) {
      logger.error('SESSION_VALIDATOR', 'Tab login check failed', { tabId }, error);
      return { isLoggedIn: false, userId: null, error: error.message };
    }
  }

  /**
   * Close validation tab
   */
  async closeValidationTab(tabId) {
    try {
      await chrome.tabs.remove(tabId);
      logger.debug('SESSION_VALIDATOR', `Validation tab closed: ${tabId}`);
    } catch (error) {
      logger.debug('SESSION_VALIDATOR', `Error closing validation tab ${tabId}:`, error);
    }
  }

  /**
   * Get Facebook cookies
   */
  async getFacebookCookies() {
    try {
      const [domainCookies, wwwCookies, mCookies] = await Promise.all([
        chrome.cookies.getAll({ domain: '.facebook.com' }),
        chrome.cookies.getAll({ domain: 'www.facebook.com' }),
        chrome.cookies.getAll({ domain: 'm.facebook.com' })
      ]);
      
      // Combine and deduplicate
      const allCookies = [...domainCookies, ...wwwCookies, ...mCookies];
      const cookieMap = new Map();
      
      allCookies.forEach(cookie => {
        if (!cookieMap.has(cookie.name) || cookie.domain.startsWith('.')) {
          cookieMap.set(cookie.name, cookie);
        }
      });
      
      return Array.from(cookieMap.values());
      
    } catch (error) {
      throw new Error(`Failed to get Facebook cookies: ${error.message}`);
    }
  }

  /**
   * Check if cookie is expired
   */
  isCookieExpired(cookie) {
    if (!cookie.expirationDate) return false;
    return (Date.now() / 1000) > cookie.expirationDate;
  }

  /**
   * Calculate enhanced confidence
   */
  calculateEnhancedConfidence(cookieValidation, tabValidation) {
    let confidence = cookieValidation.confidence;
    
    // Boost confidence if tab validation confirms
    if (tabValidation.isLoggedIn === cookieValidation.isValid) {
      confidence = Math.min(1.0, confidence + 0.3);
    } else {
      confidence = Math.max(0.0, confidence - 0.2);
    }
    
    // Boost confidence for strong login indicators
    if (tabValidation.hasUserCookie && tabValidation.hasLoginElements && tabValidation.notOnLoginPage) {
      confidence = Math.min(1.0, confidence + 0.1);
    }
    
    return confidence;
  }

  /**
   * Cache validation result
   */
  cacheAndReturn(validationResult) {
    this.validationCache.set('current', {
      ...validationResult,
      cachedAt: Date.now()
    });
    
    this.lastValidation = Date.now();
    
    if (validationResult.isValid) {
      this.state.successfulValidations++;
      this.state.lastKnownUserId = validationResult.userId;
      this.state.lastKnownLoginState = true;
    } else {
      this.state.failedValidations++;
      this.state.lastKnownLoginState = false;
    }
    
    return validationResult;
  }

  /**
   * Check if validation is cached and still valid
   */
  isValidationCached() {
    const cached = this.validationCache.get('current');
    if (!cached) return false;
    
    const age = Date.now() - cached.cachedAt;
    return age < this.config.cacheValidationFor;
  }

  /**
   * Get cached validation result
   */
  getValidationFromCache() {
    return this.validationCache.get('current');
  }

  /**
   * Update validation state
   */
  updateValidationState(validation) {
    if (validation.userId) {
      this.state.lastKnownUserId = validation.userId;
    }
    
    this.state.lastKnownLoginState = validation.isValid;
  }

  /**
   * Public interface methods
   */
  async isLoggedIn(force = false) {
    const validation = await this.validateSession(force);
    return validation.isValid;
  }

  async getCurrentUserId(force = false) {
    const validation = await this.validateSession(force);
    return validation.userId || this.state.lastKnownUserId;
  }

  async getSessionInfo(force = false) {
    const validation = await this.validateSession(force);
    
    return {
      isLoggedIn: validation.isValid,
      userId: validation.userId,
      confidence: validation.confidence,
      lastValidation: this.lastValidation,
      method: validation.method,
      cached: !force && this.isValidationCached()
    };
  }

  getValidationStats() {
    return {
      lastValidation: this.lastValidation,
      validationAttempts: this.state.validationAttempts,
      successfulValidations: this.state.successfulValidations,
      failedValidations: this.state.failedValidations,
      successRate: this.state.validationAttempts > 0 
        ? (this.state.successfulValidations / this.state.validationAttempts * 100).toFixed(2) + '%'
        : '0%',
      lastKnownUserId: this.state.lastKnownUserId,
      lastKnownLoginState: this.state.lastKnownLoginState,
      isValidating: this.isValidating,
      cacheSize: this.validationCache.size
    };
  }

  /**
   * Monitor cookies for changes
   */
  startCookieMonitoring() {
    if (!chrome.cookies || !chrome.cookies.onChanged) {
      logger.warn('SESSION_VALIDATOR', 'Cookie monitoring not available');
      return;
    }
    
    chrome.cookies.onChanged.addListener((changeInfo) => {
      if (changeInfo.cookie.domain.includes('facebook.com')) {
        const isImportantCookie = this.config.requiredCookies.includes(changeInfo.cookie.name) ||
                                 this.config.optionalCookies.includes(changeInfo.cookie.name);
        
        if (isImportantCookie) {
          logger.info('SESSION_VALIDATOR', '🍪 Important Facebook cookie changed', {
            cookie: changeInfo.cookie.name,
            removed: changeInfo.removed
          });
          
          // Invalidate cache on important cookie changes
          this.invalidateCache();
          
          // Trigger revalidation after delay
          setTimeout(() => {
            this.validateSession(true);
          }, 2000);
        }
      }
    });
    
    logger.info('SESSION_VALIDATOR', '👀 Cookie monitoring started');
  }

  /**
   * Invalidate validation cache
   */
  invalidateCache() {
    this.validationCache.clear();
    logger.debug('SESSION_VALIDATOR', 'Validation cache invalidated');
  }

  /**
   * Force revalidation
   */
  async forceRevalidation() {
    this.invalidateCache();
    return await this.validateSession(true);
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('SESSION_VALIDATOR', 'Configuration updated', newConfig);
  }

  clearState() {
    this.state.lastKnownUserId = null;
    this.state.lastKnownLoginState = false;
    this.invalidateCache();
    
    logger.info('SESSION_VALIDATOR', 'State cleared');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SessionValidator;
} else {
  globalThis.SessionValidator = SessionValidator;
}