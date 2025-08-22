/**
 * VendaBoost Extension - Session Data Extractor
 * Especializado na extração de dados de sessão do Facebook
 */

class SessionExtractor {
  constructor() {
    this.extractionAttempts = 0;
    this.maxRetries = 3;
    this.lastExtractionTime = null;
    this.cachedSession = null;
    
    // Configuration
    this.config = {
      minExtractionInterval: 5 * 60 * 1000, // 5 minutos
      maxSessionAge: 24 * 60 * 60 * 1000,   // 24 horas
      retryDelay: 2000,                      // 2 segundos
      
      // Data types to extract
      extractTypes: {
        userInfo: true,
        cookies: true,
        localStorage: true,
        sessionStorage: true,
        metadata: true
      }
    };
    
    logger.info('SESSION_EXTRACTOR', 'SessionExtractor initialized');
  }

  /**
   * Main extraction method - coordenates the entire process
   */
  async extractSession(options = {}) {
    const startTime = performance.now();
    logger.startTimer('sessionExtraction');
    
    try {
      // Validate extraction conditions
      if (!this.shouldExtract(options.force)) {
        return this.getCachedSession();
      }

      logger.info('SESSION_EXTRACTOR', '🔍 Starting session extraction');
      this.extractionAttempts++;

      // Pre-extraction validation
      const validationResult = await this.validateExtractionEnvironment();
      if (!validationResult.valid) {
        throw new Error(`Extraction environment invalid: ${validationResult.reason}`);
      }

      // Extract session data
      const sessionData = await this.performExtraction();
      
      // Post-process and validate
      const processedData = await this.processSessionData(sessionData);
      const validatedData = await this.validateSessionData(processedData);

      if (!validatedData.isValid) {
        throw new Error(`Session validation failed: ${validatedData.errors.join(', ')}`);
      }

      // Cache and return
      this.cacheSession(processedData);
      this.lastExtractionTime = Date.now();
      
      const duration = logger.endTimer('sessionExtraction', 'SESSION_EXTRACTOR');
      logger.info('SESSION_EXTRACTOR', '✅ Session extraction completed', {
        userId: processedData.userId,
        cookieCount: processedData.cookies?.length || 0,
        duration: `${duration.toFixed(2)}ms`,
        attempts: this.extractionAttempts
      });

      return processedData;

    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('SESSION_EXTRACTOR', 'Session extraction failed', {
        attempts: this.extractionAttempts,
        duration: `${duration.toFixed(2)}ms`,
        error: error.message
      }, error);

      // Retry logic
      if (this.extractionAttempts < this.maxRetries && !options.noRetry) {
        logger.info('SESSION_EXTRACTOR', `Retrying extraction (${this.extractionAttempts}/${this.maxRetries})`);
        
        await this.delay(this.config.retryDelay * this.extractionAttempts);
        return await this.extractSession({ ...options, noRetry: false });
      }

      throw error;
    }
  }

  /**
   * Validates if extraction should proceed
   */
  shouldExtract(force = false) {
    if (force) return true;

    // Check minimum interval
    if (this.lastExtractionTime) {
      const timeSinceLastExtraction = Date.now() - this.lastExtractionTime;
      if (timeSinceLastExtraction < this.config.minExtractionInterval) {
        logger.debug('SESSION_EXTRACTOR', 'Extraction skipped - too soon', {
          timeSinceLastExtraction: `${timeSinceLastExtraction}ms`,
          minInterval: `${this.config.minExtractionInterval}ms`
        });
        return false;
      }
    }

    // Check if cached session is still valid
    if (this.cachedSession && this.isSessionFresh(this.cachedSession)) {
      logger.debug('SESSION_EXTRACTOR', 'Using cached session - still fresh');
      return false;
    }

    return true;
  }

  /**
   * Validates the extraction environment
   */
  async validateExtractionEnvironment() {
    try {
      // Check if we're on Facebook
      if (!window.location.hostname.includes('facebook.com')) {
        return { valid: false, reason: 'Not on Facebook domain' };
      }

      // Check if user is logged in
      if (!this.checkIfLoggedIn()) {
        return { valid: false, reason: 'User not logged in' };
      }

      // Check if page is loaded
      if (document.readyState !== 'complete') {
        return { valid: false, reason: 'Page not fully loaded' };
      }

      // Check for anti-bot indicators
      const antiDetectionCheck = await this.checkAntiDetection();
      if (!antiDetectionCheck.safe) {
        return { valid: false, reason: `Anti-detection triggered: ${antiDetectionCheck.reason}` };
      }

      return { valid: true };

    } catch (error) {
      return { valid: false, reason: `Validation error: ${error.message}` };
    }
  }

  /**
   * Main extraction logic
   */
  async performExtraction() {
    const extractionData = {
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      source: 'session_extractor_v2'
    };

    // Extract user information
    if (this.config.extractTypes.userInfo) {
      logger.debug('SESSION_EXTRACTOR', 'Extracting user info...');
      extractionData.userInfo = await this.extractUserInfo();
    }

    // Extract cookies via background script
    if (this.config.extractTypes.cookies) {
      logger.debug('SESSION_EXTRACTOR', 'Extracting cookies...');
      extractionData.cookies = await this.extractCookies();
    }

    // Extract localStorage
    if (this.config.extractTypes.localStorage) {
      logger.debug('SESSION_EXTRACTOR', 'Extracting localStorage...');
      extractionData.localStorage = this.extractLocalStorage();
    }

    // Extract sessionStorage
    if (this.config.extractTypes.sessionStorage) {
      logger.debug('SESSION_EXTRACTOR', 'Extracting sessionStorage...');
      extractionData.sessionStorage = this.extractSessionStorage();
    }

    // Extract metadata
    if (this.config.extractTypes.metadata) {
      logger.debug('SESSION_EXTRACTOR', 'Extracting metadata...');
      extractionData.metadata = await this.extractMetadata();
    }

    return extractionData;
  }

  /**
   * Extract user information from Facebook page
   */
  async extractUserInfo() {
    const userInfo = {
      id: '',
      name: '',
      email: '',
      profileUrl: '',
      avatarUrl: '',
      extractionMethods: []
    };

    try {
      // Method 1: From cookies
      const cUserCookie = document.cookie.split(';').find(c => c.trim().startsWith('c_user='));
      if (cUserCookie) {
        userInfo.id = cUserCookie.split('=')[1].trim();
        userInfo.extractionMethods.push('cookie');
      }

      // Method 2: From page scripts
      if (!userInfo.id) {
        userInfo.id = await this.extractUserIdFromScripts();
        if (userInfo.id) userInfo.extractionMethods.push('scripts');
      }

      // Method 3: From meta tags
      if (!userInfo.id) {
        userInfo.id = this.extractUserIdFromMeta();
        if (userInfo.id) userInfo.extractionMethods.push('meta');
      }

      // Method 4: From localStorage/sessionStorage
      if (!userInfo.id) {
        userInfo.id = this.extractUserIdFromStorage();
        if (userInfo.id) userInfo.extractionMethods.push('storage');
      }

      // Extract user name
      userInfo.name = this.extractUserName();
      
      // Build profile URL
      if (userInfo.id) {
        userInfo.profileUrl = `https://www.facebook.com/profile.php?id=${userInfo.id}`;
      }

      // Extract avatar
      userInfo.avatarUrl = this.extractAvatarUrl();

      logger.debug('SESSION_EXTRACTOR', 'User info extracted', {
        hasId: !!userInfo.id,
        hasName: !!userInfo.name,
        methods: userInfo.extractionMethods
      });

      return userInfo;

    } catch (error) {
      logger.error('SESSION_EXTRACTOR', 'Error extracting user info', null, error);
      return userInfo;
    }
  }

  /**
   * Extract user ID from page scripts
   */
  async extractUserIdFromScripts() {
    const scripts = document.querySelectorAll('script');
    
    for (const script of scripts) {
      const content = script.textContent || '';
      
      // Look for user ID in various formats
      const patterns = [
        /"USER_ID":"(\d+)"/,
        /"userID":"(\d+)"/,
        /"actorID":"(\d+)"/,
        /"viewerID":"(\d+)"/,
        /"pageID":"(\d+)"/
      ];
      
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
    }
    
    return null;
  }

  /**
   * Extract user ID from meta tags
   */
  extractUserIdFromMeta() {
    const metaUserId = document.querySelector('meta[property="al:ios:url"]');
    if (metaUserId) {
      const content = metaUserId.getAttribute('content');
      if (content) {
        const match = content.match(/profile\/(\d+)/);
        if (match) return match[1];
      }
    }
    return null;
  }

  /**
   * Extract user ID from storage
   */
  extractUserIdFromStorage() {
    try {
      // Check localStorage
      const fbData = localStorage.getItem('Session') || sessionStorage.getItem('Session');
      if (fbData) {
        const match = fbData.match(/"USER_ID":"(\d+)"/);
        if (match) return match[1];
      }
    } catch (error) {
      // Ignore storage access errors
    }
    return null;
  }

  /**
   * Extract user name
   */
  extractUserName() {
    const nameSelectors = [
      '[role="banner"] h1',
      'div[role="main"] h1',
      'a[href*="/profile"] span',
      'div[role="banner"] div[dir="auto"] > span',
      'div[role="main"] div[dir="auto"] h1',
      'div[aria-label] h1 span',
      '[data-pagelet="ProfileActions"] h1'
    ];
    
    for (const selector of nameSelectors) {
      const nameElement = document.querySelector(selector);
      if (nameElement && nameElement.textContent) {
        const name = nameElement.textContent.trim();
        if (name && name.length > 0 && name.length < 100 && !name.includes('Facebook')) {
          return name;
        }
      }
    }
    
    // Fallback: extract from document title
    const titleMatch = document.title.match(/^(.+?)\s*[\|\-\•]\s*Facebook/);
    if (titleMatch) {
      return titleMatch[1].trim();
    }
    
    return '';
  }

  /**
   * Extract avatar URL
   */
  extractAvatarUrl() {
    const avatarSelectors = [
      '[data-pagelet="ProfileActions"] img',
      '[role="banner"] img[src*="profile"]',
      'img[src*="scontent"]'
    ];
    
    for (const selector of avatarSelectors) {
      const avatarImg = document.querySelector(selector);
      if (avatarImg && avatarImg.src) {
        return avatarImg.src;
      }
    }
    
    return '';
  }

  /**
   * Extract cookies via background script
   */
  async extractCookies() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getCookies' }, (response) => {
        resolve(response.cookies || []);
      });
    });
  }

  /**
   * Extract localStorage data
   */
  extractLocalStorage() {
    const data = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          // Only store non-sensitive data
          if (!this.isSensitiveKey(key)) {
            data[key] = localStorage.getItem(key);
          }
        }
      }
    } catch (error) {
      logger.error('SESSION_EXTRACTOR', 'Error accessing localStorage', null, error);
    }
    return data;
  }

  /**
   * Extract sessionStorage data
   */
  extractSessionStorage() {
    const data = {};
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          // Only store non-sensitive data
          if (!this.isSensitiveKey(key)) {
            data[key] = sessionStorage.getItem(key);
          }
        }
      }
    } catch (error) {
      logger.error('SESSION_EXTRACTOR', 'Error accessing sessionStorage', null, error);
    }
    return data;
  }

  /**
   * Extract metadata
   */
  async extractMetadata() {
    return {
      pageTitle: document.title,
      pageUrl: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      cookiesEnabled: navigator.cookieEnabled,
      onlineStatus: navigator.onLine,
      extractionTimestamp: Date.now()
    };
  }

  /**
   * Process extracted session data
   */
  async processSessionData(rawData) {
    const processedData = {
      ...rawData,
      userId: rawData.userInfo?.id || 'unknown',
      version: '2.0.0',
      extractionId: this.generateExtractionId(),
      
      // Add computed fields
      sessionAge: rawData.timestamp ? Date.now() - new Date(rawData.timestamp).getTime() : 0,
      cookieCount: rawData.cookies?.length || 0,
      
      // Security fields
      isSecureContext: window.isSecureContext,
      hasHttpsCookies: rawData.cookies?.some(c => c.secure) || false,
      
      // Performance metrics
      pageLoadTime: performance.timing?.loadEventEnd - performance.timing?.navigationStart || 0,
      domReadyTime: performance.timing?.domContentLoadedEventEnd - performance.timing?.navigationStart || 0
    };

    return processedData;
  }

  /**
   * Validate session data
   */
  async validateSessionData(sessionData) {
    const errors = [];

    // Required fields validation
    if (!sessionData.userId || sessionData.userId === 'unknown') {
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
      const requiredCookies = ['c_user', 'xs'];
      const cookieNames = sessionData.cookies.map(c => c.name);
      
      for (const required of requiredCookies) {
        if (!cookieNames.includes(required)) {
          errors.push(`Required cookie missing: ${required}`);
        }
      }
    }

    // Data integrity validation
    if (sessionData.userInfo?.id && sessionData.userId !== sessionData.userInfo.id) {
      errors.push('User ID mismatch between sources');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warningCount: 0, // TODO: Add warning validations
      score: this.calculateValidationScore(sessionData, errors)
    };
  }

  /**
   * Calculate validation score (0-1)
   */
  calculateValidationScore(sessionData, errors) {
    let score = 1.0;
    
    // Deduct for errors
    score -= (errors.length * 0.2);
    
    // Bonus for having user name
    if (sessionData.userInfo?.name) score += 0.1;
    
    // Bonus for having avatar
    if (sessionData.userInfo?.avatarUrl) score += 0.1;
    
    // Bonus for secure cookies
    if (sessionData.hasHttpsCookies) score += 0.1;
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Check if user is logged in
   */
  checkIfLoggedIn() {
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
    
    // 3. Check for navigation elements
    const hasNavElements = !!(
      document.querySelector('a[href="/"]') ||
      document.querySelector('div[role="navigation"]') ||
      document.querySelector('[aria-label="Facebook"]')
    );
    
    // 4. Check if NOT on login page
    const notOnLoginPage = !window.location.pathname.includes('/login') && 
                           !window.location.pathname.includes('/reg');
    
    const isLoggedIn = hasUserCookie || (hasProfileElements && notOnLoginPage) || (hasNavElements && notOnLoginPage);
    
    logger.debug('SESSION_EXTRACTOR', 'Login check result', {
      hasUserCookie,
      hasProfileElements,
      hasNavElements,
      notOnLoginPage,
      isLoggedIn,
      url: window.location.pathname
    });
    
    return isLoggedIn;
  }

  /**
   * Check for anti-detection indicators
   */
  async checkAntiDetection() {
    try {
      // Check for rate limiting indicators
      const rateLimitIndicators = [
        'rate limit',
        'too many requests',
        'please slow down',
        'suspicious activity'
      ];
      
      const pageText = document.body.textContent.toLowerCase();
      for (const indicator of rateLimitIndicators) {
        if (pageText.includes(indicator)) {
          return { safe: false, reason: `Rate limit indicator found: ${indicator}` };
        }
      }
      
      // Check for captcha
      const captchaElements = document.querySelectorAll('[data-testid*="captcha"], .captcha, #captcha');
      if (captchaElements.length > 0) {
        return { safe: false, reason: 'Captcha detected' };
      }
      
      // Check for security checkpoint
      if (window.location.href.includes('checkpoint')) {
        return { safe: false, reason: 'Security checkpoint detected' };
      }
      
      return { safe: true };
      
    } catch (error) {
      return { safe: true }; // Assume safe if check fails
    }
  }

  /**
   * Utility methods
   */
  isSensitiveKey(key) {
    const sensitivePatterns = [
      'password',
      'token',
      'secret',
      'auth',
      'credential',
      'private',
      'key'
    ];
    
    const lowerKey = key.toLowerCase();
    return sensitivePatterns.some(pattern => lowerKey.includes(pattern));
  }

  generateExtractionId() {
    return `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

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
      logger.debug('SESSION_EXTRACTOR', 'Returning cached session');
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
    logger.info('SESSION_EXTRACTOR', 'Cache cleared');
  }

  getExtractionStats() {
    return {
      attempts: this.extractionAttempts,
      lastExtraction: this.lastExtractionTime,
      hasCachedSession: !!this.cachedSession,
      cacheAge: this.cachedSession ? Date.now() - this.cachedSession.cachedAt : null
    };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('SESSION_EXTRACTOR', 'Configuration updated', newConfig);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SessionExtractor;
} else {
  globalThis.SessionExtractor = SessionExtractor;
}