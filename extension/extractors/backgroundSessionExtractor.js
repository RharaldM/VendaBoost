/**
 * VendaBoost Extension - Background Session Extractor
 * Extrai dados de sessão apenas usando APIs do Chrome (cookies, storage)
 * Funciona 100% no background script sem precisar de DOM
 */

class BackgroundSessionExtractor {
  constructor() {
    this.extractionAttempts = 0;
    this.maxRetries = 3;
    this.lastExtractionTime = null;
    this.cachedSession = null;
    
    // Configuration
    this.config = {
      minExtractionInterval: 5 * 60 * 1000,     // 5 minutos
      maxSessionAge: 24 * 60 * 60 * 1000,       // 24 horas
      retryDelay: 2000,                         // 2 segundos
      
      // Data types to extract (background-only)
      extractTypes: {
        cookies: true,
        basicUserInfo: true,
        sessionValidation: true,
        metadata: true
      }
    };
    
    logger.info('BACKGROUND_SESSION_EXTRACTOR', 'BackgroundSessionExtractor initialized');
  }

  /**
   * Main extraction method - works entirely in background
   */
  async extractSession(options = {}) {
    const startTime = performance.now();
    logger.startTimer('backgroundSessionExtraction');
    
    try {
      // Validate extraction conditions
      if (!this.shouldExtract(options.force)) {
        return this.getCachedSession();
      }

      logger.info('BACKGROUND_SESSION_EXTRACTOR', '🔍 Starting background session extraction');
      this.extractionAttempts++;

      // Extract session data using Chrome APIs only
      const sessionData = await this.performBackgroundExtraction();
      
      // Validate extracted data
      const validatedData = await this.validateSessionData(sessionData);

      if (!validatedData.isValid) {
        throw new Error(`Session validation failed: ${validatedData.errors.join(', ')}`);
      }

      // Cache and return
      this.cacheSession(sessionData);
      this.lastExtractionTime = Date.now();
      
      const duration = logger.endTimer('backgroundSessionExtraction', 'BACKGROUND_SESSION_EXTRACTOR');
      logger.info('BACKGROUND_SESSION_EXTRACTOR', '✅ Background session extraction completed', {
        userId: sessionData.userId,
        cookieCount: sessionData.cookies?.length || 0,
        duration: `${duration.toFixed(2)}ms`,
        attempts: this.extractionAttempts
      });

      return sessionData;

    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('BACKGROUND_SESSION_EXTRACTOR', 'Background session extraction failed', {
        attempts: this.extractionAttempts,
        duration: `${duration.toFixed(2)}ms`,
        error: error.message
      }, error);

      // Retry logic
      if (this.extractionAttempts < this.maxRetries && !options.noRetry) {
        logger.info('BACKGROUND_SESSION_EXTRACTOR', `Retrying extraction (${this.extractionAttempts}/${this.maxRetries})`);
        
        await this.delay(this.config.retryDelay * this.extractionAttempts);
        return await this.extractSession({ ...options, noRetry: false });
      }

      throw error;
    }
  }

  /**
   * Perform extraction using only background APIs
   */
  async performBackgroundExtraction() {
    const sessionData = {
      timestamp: new Date().toISOString(),
      source: 'background_extractor_v2',
      extractionMethod: 'background_apis_only',
      version: '2.0.0'
    };

    try {
      // Extract cookies using Chrome API
      if (this.config.extractTypes.cookies) {
        logger.debug('BACKGROUND_SESSION_EXTRACTOR', 'Extracting cookies via Chrome API...');
        sessionData.cookies = await this.extractCookiesViaAPI();
      }

      // Extract basic user info from cookies
      if (this.config.extractTypes.basicUserInfo) {
        logger.debug('BACKGROUND_SESSION_EXTRACTOR', 'Extracting user info from cookies...');
        sessionData.userInfo = await this.extractUserInfoFromCookies(sessionData.cookies);
        sessionData.userId = sessionData.userInfo.id;
      }

      // Validate session
      if (this.config.extractTypes.sessionValidation) {
        logger.debug('BACKGROUND_SESSION_EXTRACTOR', 'Validating session...');
        sessionData.validation = await this.validateSession(sessionData.cookies);
      }

      // Add metadata
      if (this.config.extractTypes.metadata) {
        logger.debug('BACKGROUND_SESSION_EXTRACTOR', 'Adding metadata...');
        sessionData.metadata = await this.extractMetadata();
      }

      return sessionData;

    } catch (error) {
      throw new Error(`Background extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract cookies using Chrome API
   */
  async extractCookiesViaAPI() {
    try {
      if (!chrome.cookies) {
        throw new Error('Chrome cookies API not available');
      }

      // Get cookies from all Facebook domains
      const [domainCookies, wwwCookies, mCookies, baseCookies] = await Promise.all([
        chrome.cookies.getAll({ domain: '.facebook.com' }),
        chrome.cookies.getAll({ domain: 'www.facebook.com' }),
        chrome.cookies.getAll({ domain: 'm.facebook.com' }),
        chrome.cookies.getAll({ domain: 'facebook.com' })
      ]);
      
      // Combine and deduplicate
      const allCookies = [...domainCookies, ...wwwCookies, ...mCookies, ...baseCookies];
      const cookieMap = new Map();
      
      allCookies.forEach(cookie => {
        if (!cookieMap.has(cookie.name) || cookie.domain.startsWith('.')) {
          cookieMap.set(cookie.name, cookie);
        }
      });
      
      const uniqueCookies = Array.from(cookieMap.values());
      
      // Format cookies
      const formattedCookies = uniqueCookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        expires: cookie.expirationDate,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
        extractedAt: Date.now()
      }));
      
      // Log important cookies
      const importantCookies = ['c_user', 'xs', 'datr', 'fr', 'sb'];
      const foundImportant = formattedCookies.filter(c => importantCookies.includes(c.name));
      
      logger.debug('BACKGROUND_SESSION_EXTRACTOR', `Extracted ${formattedCookies.length} cookies`, {
        important: foundImportant.map(c => c.name)
      });
      
      return formattedCookies;
      
    } catch (error) {
      throw new Error(`Cookie extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract user info from cookies (no DOM needed)
   */
  async extractUserInfoFromCookies(cookies) {
    const userInfo = {
      id: '',
      name: '',
      email: '',
      profileUrl: '',
      avatarUrl: '',
      extractionMethod: 'cookies_only'
    };

    try {
      // Get user ID from c_user cookie
      const cUserCookie = cookies.find(c => c.name === 'c_user');
      if (cUserCookie && cUserCookie.value) {
        userInfo.id = cUserCookie.value;
        userInfo.profileUrl = `https://www.facebook.com/profile.php?id=${userInfo.id}`;
      }

      // Try to get additional info from other cookies if available
      // Note: Most user info is not available in cookies alone
      
      return userInfo;

    } catch (error) {
      logger.error('BACKGROUND_SESSION_EXTRACTOR', 'Error extracting user info from cookies', null, error);
      return userInfo;
    }
  }

  /**
   * Validate session using cookies
   */
  async validateSession(cookies) {
    const validation = {
      isValid: false,
      reasons: [],
      score: 0,
      cookieChecks: {}
    };

    try {
      // Check essential cookies
      const essentialCookies = ['c_user', 'xs', 'datr'];
      let validCookies = 0;

      for (const essential of essentialCookies) {
        const cookie = cookies.find(c => c.name === essential);
        
        if (cookie) {
          // Check if cookie is not expired
          const isExpired = cookie.expires && (Date.now() / 1000) > cookie.expires;
          
          validation.cookieChecks[essential] = {
            present: true,
            expired: isExpired,
            valid: !isExpired
          };
          
          if (!isExpired) {
            validCookies++;
          }
        } else {
          validation.cookieChecks[essential] = {
            present: false,
            expired: null,
            valid: false
          };
        }
      }

      // Calculate validation score
      validation.score = validCookies / essentialCookies.length;
      validation.isValid = validation.score >= 0.66; // At least 2/3 essential cookies

      if (!validation.isValid) {
        validation.reasons.push('Missing or expired essential cookies');
      }

      // Additional checks
      const totalCookies = cookies.length;
      if (totalCookies < 3) {
        validation.reasons.push('Too few Facebook cookies');
        validation.score *= 0.5;
      }

      // Check for session age
      const sessionCookie = cookies.find(c => c.name === 'sb');
      if (sessionCookie && sessionCookie.expires) {
        const timeToExpiry = (sessionCookie.expires * 1000) - Date.now();
        if (timeToExpiry < 24 * 60 * 60 * 1000) { // Less than 24 hours
          validation.reasons.push('Session expires soon');
          validation.score *= 0.9;
        }
      }

      return validation;

    } catch (error) {
      validation.isValid = false;
      validation.reasons.push(`Validation error: ${error.message}`);
      return validation;
    }
  }

  /**
   * Extract metadata (background-safe)
   */
  async extractMetadata() {
    return {
      extractionTimestamp: Date.now(),
      extractorVersion: '2.0.0',
      chromeVersion: navigator.userAgent,
      extractionContext: 'background_script',
      
      // System info (background-safe)
      platform: navigator.platform || 'unknown',
      language: navigator.language || 'unknown',
      cookiesEnabled: true, // Always true in background
      
      // Extension info
      extensionId: chrome.runtime.id,
      manifestVersion: chrome.runtime.getManifest().version,
      
      // Memory info if available
      memoryInfo: await this.getMemoryInfo()
    };
  }

  /**
   * Get memory info (background-safe)
   */
  async getMemoryInfo() {
    try {
      if (chrome.system && chrome.system.memory) {
        const memInfo = await chrome.system.memory.getInfo();
        return {
          availableCapacity: memInfo.availableCapacity,
          capacity: memInfo.capacity
        };
      }
    } catch (error) {
      // Memory API not available
    }
    
    return { available: false };
  }

  /**
   * Validate session data
   */
  async validateSessionData(sessionData) {
    const errors = [];

    // Required fields validation
    if (!sessionData.userId) {
      errors.push('User ID not found');
    }

    if (!sessionData.cookies || sessionData.cookies.length === 0) {
      errors.push('No cookies extracted');
    }

    if (!sessionData.timestamp) {
      errors.push('Timestamp missing');
    }

    // Cookie validation
    if (sessionData.cookies) {
      const requiredCookies = ['c_user'];
      const cookieNames = sessionData.cookies.map(c => c.name);
      
      for (const required of requiredCookies) {
        if (!cookieNames.includes(required)) {
          errors.push(`Required cookie missing: ${required}`);
        }
      }
    }

    // Session validation
    if (sessionData.validation && !sessionData.validation.isValid) {
      errors.push('Session validation failed');
    }

    return {
      isValid: errors.length === 0,
      errors,
      score: this.calculateValidationScore(sessionData, errors)
    };
  }

  calculateValidationScore(sessionData, errors) {
    let score = 1.0;
    score -= (errors.length * 0.2);
    
    // Bonus for having validation info
    if (sessionData.validation && sessionData.validation.score) {
      score = (score + sessionData.validation.score) / 2;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Check if extraction should proceed
   */
  shouldExtract(force = false) {
    if (force) return true;

    // Check minimum interval
    if (this.lastExtractionTime) {
      const timeSinceLastExtraction = Date.now() - this.lastExtractionTime;
      if (timeSinceLastExtraction < this.config.minExtractionInterval) {
        logger.debug('BACKGROUND_SESSION_EXTRACTOR', 'Extraction skipped - too soon');
        return false;
      }
    }

    // Check if cached session is still valid
    if (this.cachedSession && this.isSessionFresh(this.cachedSession)) {
      logger.debug('BACKGROUND_SESSION_EXTRACTOR', 'Using cached session - still fresh');
      return false;
    }

    return true;
  }

  /**
   * Utility methods
   */
  isSessionFresh(session) {
    if (!session?.timestamp) return false;
    
    const age = Date.now() - new Date(session.timestamp).getTime();
    return age < this.config.maxSessionAge;
  }

  cacheSession(sessionData) {
    this.cachedSession = {
      ...sessionData,
      cachedAt: Date.now()
    };
  }

  getCachedSession() {
    if (this.cachedSession && this.isSessionFresh(this.cachedSession)) {
      logger.debug('BACKGROUND_SESSION_EXTRACTOR', 'Returning cached session');
      return this.cachedSession;
    }
    return null;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Public interface methods
   */
  async getSessionData(force = false) {
    return await this.extractSession({ force });
  }

  clearCache() {
    this.cachedSession = null;
    this.lastExtractionTime = null;
    logger.info('BACKGROUND_SESSION_EXTRACTOR', 'Cache cleared');
  }

  getExtractionStats() {
    return {
      attempts: this.extractionAttempts,
      lastExtraction: this.lastExtractionTime,
      hasCachedSession: !!this.cachedSession,
      cacheAge: this.cachedSession ? Date.now() - this.cachedSession.cachedAt : null,
      extractionMethod: 'background_apis_only'
    };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('BACKGROUND_SESSION_EXTRACTOR', 'Configuration updated', newConfig);
  }

  /**
   * Check if user is logged in (using cookies only)
   */
  async isLoggedIn() {
    try {
      const cookies = await this.extractCookiesViaAPI();
      const cUserCookie = cookies.find(c => c.name === 'c_user');
      
      if (!cUserCookie) return false;
      
      // Check if cookie is not expired
      const isExpired = cUserCookie.expires && (Date.now() / 1000) > cUserCookie.expires;
      
      return !isExpired;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current user ID (cookies only)
   */
  async getCurrentUserId() {
    try {
      const cookies = await this.extractCookiesViaAPI();
      const cUserCookie = cookies.find(c => c.name === 'c_user');
      
      return cUserCookie ? cUserCookie.value : null;
    } catch (error) {
      logger.error('BACKGROUND_SESSION_EXTRACTOR', 'Error getting user ID', null, error);
      return null;
    }
  }

  /**
   * Extract cookies via Chrome API (duplicate method for independence)
   */
  async extractCookiesViaAPI() {
    if (!chrome.cookies) {
      throw new Error('Chrome cookies API not available');
    }

    const [domainCookies, wwwCookies, mCookies, baseCookies] = await Promise.all([
      chrome.cookies.getAll({ domain: '.facebook.com' }),
      chrome.cookies.getAll({ domain: 'www.facebook.com' }),
      chrome.cookies.getAll({ domain: 'm.facebook.com' }),
      chrome.cookies.getAll({ domain: 'facebook.com' })
    ]);
    
    const allCookies = [...domainCookies, ...wwwCookies, ...mCookies, ...baseCookies];
    const cookieMap = new Map();
    
    allCookies.forEach(cookie => {
      if (!cookieMap.has(cookie.name) || cookie.domain.startsWith('.')) {
        cookieMap.set(cookie.name, cookie);
      }
    });
    
    return Array.from(cookieMap.values());
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BackgroundSessionExtractor;
} else {
  globalThis.BackgroundSessionExtractor = BackgroundSessionExtractor;
}