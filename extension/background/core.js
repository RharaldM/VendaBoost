/**
 * VendaBoost Extension - Core Background Script
 * Orquestração principal e inicialização do sistema
 */

// Import all system components
importScripts(
  // Core utilities
  '../utils/logger.js', 
  '../utils/config.js',
  '../utils/validator.js',
  
  // Storage layer
  '../storage/cacheManager.js',
  
  // Extraction engines
  '../extractors/sessionExtractor.js',
  '../extractors/backgroundSessionExtractor.js',
  '../extractors/groupsExtractor.js', 
  '../extractors/profileExtractor.js',
  '../extractors/silentGroupsExtractor.js',
  
  // Scheduling system
  '../schedulers/cronScheduler.js',
  '../schedulers/adaptiveScheduler.js',
  '../schedulers/priorityQueue.js',
  
  // Queue management
  'queueManager.js',
  
  // Autonomous tab management
  'autonomousTabManager.js',
  
  // Session validation
  'sessionValidator.js',
  
  // Event handling
  'eventHandler.js',
  
  // Automation orchestrator
  'automationOrchestrator.js',
  
  // Test system (debug only)
  '../test-system.js'
);

class VendaBoostCore {
  constructor() {
    this.initialized = false;
    this.components = new Map();
    this.sessionData = null;
    this.lastUpdate = null;
    
    // Automation orchestrator (main system controller)
    this.automationOrchestrator = null;
    
    // Estado do sistema
    this.systemState = {
      status: 'initializing',
      lastActivity: null,
      extractionCount: 0,
      errorCount: 0,
      uptime: Date.now(),
      automationEnabled: true,
      version: '2.0.0'
    };
  }

  async initialize() {
    try {
      logger.info('CORE', '🚀 Initializing VendaBoost Extension v2.0 - Full Automation System');
      
      // 1. Inicializar configurações
      await config.initialize();
      logger.setContext('environment', config.get('debug.enabled') ? 'development' : 'production');
      
      // 2. Carregar dados existentes (compatibilidade v1)
      await this.loadExistingData();
      
      // 3. Inicializar sistema de automação completo
      await this.initializeAutomationSystem();
      
      // 4. Configurar listeners legados (compatibilidade)
      this.setupEventListeners();
      
      // 5. Inicializar validação de sessão independente
      await this.initializeSessionValidation();
      
      // 6. Iniciar sistema de automação
      await this.startAutomationSystem();
      
      // 7. Verificar saúde do sistema
      await this.performHealthCheck();
      
      this.initialized = true;
      this.systemState.status = 'running';
      
      logger.info('CORE', '✅ VendaBoost Extension v2.0 initialized successfully', {
        uptime: Date.now() - this.systemState.uptime,
        automationEnabled: this.systemState.automationEnabled,
        componentsLoaded: this.components.size,
        version: this.systemState.version
      });
      
    } catch (error) {
      this.systemState.status = 'error';
      logger.critical('CORE', '❌ Failed to initialize extension v2.0', null, error);
      throw error;
    }
  }

  /**
   * Initialize the complete automation system
   */
  async initializeAutomationSystem() {
    try {
      logger.info('CORE', '🤖 Initializing automation orchestrator');
      
      // Create and initialize automation orchestrator
      this.automationOrchestrator = new AutomationOrchestrator();
      await this.automationOrchestrator.initialize();
      
      // Register orchestrator as main component
      this.components.set('automationOrchestrator', this.automationOrchestrator);
      
      logger.info('CORE', '✅ Automation system initialized');
      
    } catch (error) {
      logger.error('CORE', 'Failed to initialize automation system', null, error);
      
      // Fallback to basic operation if automation fails
      logger.warn('CORE', '⚠️ Falling back to basic operation mode');
      this.systemState.automationEnabled = false;
      await this.initializeLegacyComponents();
    }
  }

  /**
   * Start the automation system
   */
  async startAutomationSystem() {
    if (!this.systemState.automationEnabled || !this.automationOrchestrator) {
      logger.warn('CORE', 'Automation system not available, using legacy mode');
      return;
    }
    
    try {
      logger.info('CORE', '▶️ Starting automation system');
      
      await this.automationOrchestrator.start();
      
      // Update system context with initial state
      await this.updateAutomationContext();
      
      logger.info('CORE', '🚀 Automation system started successfully');
      
    } catch (error) {
      logger.error('CORE', 'Failed to start automation system', null, error);
      this.systemState.automationEnabled = false;
    }
  }

  /**
   * Initialize independent session validation
   */
  async initializeSessionValidation() {
    try {
      logger.info('CORE', '🔐 Initializing independent session validation');
      
      // Create session validator
      if (globalThis.SessionValidator) {
        globalThis.sessionValidator = new globalThis.SessionValidator();
        
        // Start cookie monitoring
        globalThis.sessionValidator.startCookieMonitoring();
        
        // Perform initial validation
        const sessionInfo = await globalThis.sessionValidator.getSessionInfo(true);
        
        if (sessionInfo.isLoggedIn) {
          logger.info('CORE', '✅ Facebook session validated independently', {
            userId: sessionInfo.userId,
            confidence: sessionInfo.confidence,
            method: sessionInfo.method
          });
          
          // Update session data from validation
          this.sessionData = {
            userId: sessionInfo.userId,
            timestamp: new Date().toISOString(),
            source: 'independent_validation',
            method: sessionInfo.method
          };
          
          this.lastUpdate = new Date().toISOString();
          logger.setContext('userId', sessionInfo.userId);
          
          // Save session data
          await this.saveToStorage({ 
            sessionData: this.sessionData, 
            lastUpdate: this.lastUpdate 
          });
          
        } else {
          logger.warn('CORE', '⚠️ No valid Facebook session found', {
            reason: sessionInfo.reason || 'Unknown'
          });
        }
        
        this.components.set('sessionValidator', globalThis.sessionValidator);
        
      } else {
        logger.error('CORE', 'SessionValidator not available');
      }
      
    } catch (error) {
      logger.error('CORE', 'Failed to initialize session validation', null, error);
      // Continue without session validation
    }
  }

  /**
   * Initialize legacy components (fallback mode)
   */
  async initializeLegacyComponents() {
    logger.info('CORE', 'Initializing legacy components');
    // Previous component initialization logic would go here
  }

  /**
   * Update automation context based on current state
   */
  async updateAutomationContext() {
    if (!this.automationOrchestrator) return;
    
    const context = {
      userActivity: this.detectUserActivity(),
      systemLoad: await this.getSystemLoad(),
      hasActiveSession: !!this.sessionData,
      lastExtractionTime: this.lastUpdate
    };
    
    await this.automationOrchestrator.updateSystemContext(context);
    
    logger.debug('CORE', 'Automation context updated', context);
  }

  /**
   * Detect user activity level
   */
  detectUserActivity() {
    // Simple activity detection based on recent actions
    const timeSinceLastActivity = this.systemState.lastActivity 
      ? Date.now() - this.systemState.lastActivity 
      : Infinity;
    
    if (timeSinceLastActivity < 5 * 60 * 1000) return 'active';     // < 5 min
    if (timeSinceLastActivity < 30 * 60 * 1000) return 'idle';     // < 30 min
    return 'inactive';                                              // > 30 min
  }

  /**
   * Get system load estimate
   */
  async getSystemLoad() {
    try {
      // Basic system load estimation
      const queueManager = globalThis.queueManager;
      if (queueManager) {
        const stats = queueManager.getStats();
        if (stats.currentlyProcessing > 2) return 'high';
        if (stats.queuedTasks > 10) return 'medium';
      }
      
      return 'low';
    } catch (error) {
      return 'unknown';
    }
  }

  async loadExistingData() {
    try {
      const result = await chrome.storage.local.get([
        'vendaboost_session',
        'vendaboost_last_update'
      ]);
      
      this.sessionData = result.vendaboost_session || null;
      this.lastUpdate = result.vendaboost_last_update || null;
      
      if (this.sessionData) {
        logger.setContext('userId', this.sessionData.userId);
        logger.info('CORE', '📥 Existing session data loaded', {
          userId: this.sessionData.userId,
          lastUpdate: this.lastUpdate
        });
      }
      
    } catch (error) {
      logger.error('CORE', 'Failed to load existing data', null, error);
    }
  }

  async initializeComponents() {
    logger.info('CORE', 'Initializing core components...');
    
    // Componentes serão inicializados aqui conforme implementados
    // this.components.set('scheduler', await this.loadScheduler());
    // this.components.set('extractor', await this.loadExtractor());
    // this.components.set('antiDetection', await this.loadAntiDetection());
    
    logger.info('CORE', `📦 Components initialized: ${this.components.size}`);
  }

  setupEventListeners() {
    // Extension lifecycle events
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstalled(details);
    });

    chrome.runtime.onStartup.addListener(() => {
      this.handleStartup();
    });

    // Message handling
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep channel open for async responses
    });

    // Alarm handling
    chrome.alarms.onAlarm.addListener((alarm) => {
      this.handleAlarm(alarm);
    });

    // Tab monitoring
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdated(tabId, changeInfo, tab);
    });

    // Cookie monitoring
    if (chrome.cookies && chrome.cookies.onChanged) {
      chrome.cookies.onChanged.addListener((changeInfo) => {
        this.handleCookieChanged(changeInfo);
      });
    }

    logger.info('CORE', '🎧 Event listeners configured');
  }

  setupScheduling() {
    const schedulingConfig = config.getSchedulingConfig();
    
    if (schedulingConfig.enabled) {
      // Setup main extraction alarm
      if (schedulingConfig.strategies.fixed.enabled) {
        chrome.alarms.create('mainExtraction', {
          periodInMinutes: schedulingConfig.strategies.fixed.interval
        });
        
        logger.info('CORE', '⏰ Fixed scheduling enabled', {
          interval: schedulingConfig.strategies.fixed.interval
        });
      }
      
      // Setup adaptive scheduling (será implementado depois)
      if (schedulingConfig.strategies.adaptive.enabled) {
        // TODO: Implementar adaptive scheduler
        logger.info('CORE', '🧠 Adaptive scheduling prepared');
      }
    }
  }

  async performHealthCheck() {
    const healthData = {
      timestamp: new Date().toISOString(),
      memory: await this.getMemoryUsage(),
      storage: await this.getStorageUsage(),
      configuration: config.getStatus(),
      lastSessionAge: this.lastUpdate ? Date.now() - new Date(this.lastUpdate).getTime() : null
    };

    logger.info('CORE', '🏥 Health check completed', healthData);
    
    // Alertas se necessário
    if (healthData.memory > config.get('performance.memoryLimit') * 1024 * 1024) {
      logger.warn('CORE', 'Memory usage high', { current: healthData.memory });
    }

    return healthData;
  }

  // Event Handlers
  handleInstalled(details) {
    logger.info('CORE', `🔧 Extension ${details.reason}`, {
      version: chrome.runtime.getManifest().version,
      reason: details.reason
    });

    if (details.reason === 'install') {
      this.onFirstInstall();
    } else if (details.reason === 'update') {
      this.onUpdate(details.previousVersion);
    }
  }

  handleStartup() {
    logger.info('CORE', '🌅 Extension startup detected');
    this.systemState.lastActivity = Date.now();
  }

  async handleMessage(request, sender, sendResponse) {
    this.systemState.lastActivity = Date.now();
    
    try {
      logger.debug('CORE', 'Message received', {
        action: request.action,
        from: sender.tab ? 'content' : 'popup'
      });

      switch (request.action) {
        case 'userLoggedIn':
          await this.handleUserLoggedIn(request.data, sendResponse);
          break;
          
        case 'loginStateChanged':
          await this.handleLoginStateChanged(request.data, sendResponse);
          break;
          
        case 'getCookies':
          await this.handleGetCookies(sendResponse);
          break;
          
        case 'getSessionData':
          await this.handleGetSessionData(sendResponse);
          break;
          
        case 'clearSessionData':
          await this.handleClearSessionData(sendResponse);
          break;
          
        case 'sendToLocalhost':
          await this.handleSendToLocalhost(request.data, sendResponse);
          break;
          
        case 'getSystemStatus':
          sendResponse(await this.getSystemStatus());
          break;
          
        case 'getAutomationStatus':
          sendResponse(await this.getAutomationStatus());
          break;
          
        case 'getDetailedStatus':
          sendResponse(await this.getDetailedSystemStatus());
          break;
          
        case 'enableAutomation':
          await this.enableAutomation();
          sendResponse({ success: true, message: 'Automation enabled' });
          break;
          
        case 'disableAutomation':
          await this.disableAutomation();
          sendResponse({ success: true, message: 'Automation disabled' });
          break;
          
        case 'triggerExtraction':
          await this.triggerManualExtraction(request.type, request.options);
          sendResponse({ success: true, message: 'Extraction triggered' });
          break;
          
        case 'triggerAutonomousExtraction':
          await this.triggerAutonomousExtraction(request.type, request.options);
          sendResponse({ success: true, message: 'Autonomous extraction triggered' });
          break;
          
        case 'getComponentStats':
          sendResponse(await this.getComponentStats(request.component));
          break;
          
        default:
          logger.warn('CORE', 'Unknown message action', { action: request.action });
          sendResponse({ success: false, error: 'Unknown action' });
      }
      
    } catch (error) {
      this.systemState.errorCount++;
      logger.error('CORE', 'Error handling message', { action: request.action }, error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleAlarm(alarm) {
    logger.info('CORE', `⏰ Alarm triggered: ${alarm.name}`);
    this.systemState.lastActivity = Date.now();
    
    try {
      switch (alarm.name) {
        case 'mainExtraction':
          await this.performScheduledExtraction();
          break;
          
        case 'healthCheck':
          await this.performHealthCheck();
          break;
          
        case 'cleanup':
          await this.performCleanup();
          break;
          
        default:
          logger.warn('CORE', 'Unknown alarm', { name: alarm.name });
      }
    } catch (error) {
      this.systemState.errorCount++;
      logger.error('CORE', 'Error handling alarm', { alarm: alarm.name }, error);
    }
  }

  handleTabUpdated(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && 
        tab.url && 
        tab.url.includes('facebook.com')) {
      
      logger.info('CORE', '📱 Facebook tab detected', { tabId, url: tab.url });
      
      // Trigger auto-extraction if enabled
      if (config.get('extraction.autoExtractEnabled')) {
        this.scheduleExtraction(tabId);
      }
    }
  }

  handleCookieChanged(changeInfo) {
    if (changeInfo.cookie.domain.includes('facebook.com')) {
      const importantCookies = ['c_user', 'xs', 'datr', 'fr'];
      
      if (importantCookies.includes(changeInfo.cookie.name)) {
        logger.info('CORE', '🍪 Important Facebook cookie changed', {
          cookie: changeInfo.cookie.name,
          removed: changeInfo.removed
        });
        
        // Trigger session refresh if user logged in
        if (changeInfo.cookie.name === 'c_user' && !changeInfo.removed) {
          setTimeout(() => {
            this.triggerSessionRefresh();
          }, 1000);
        }
      }
    }
  }

  // Core Operations
  async handleUserLoggedIn(data, sendResponse) {
    logger.info('CORE', '👤 User logged in to Facebook', { userId: data.userId });
    
    this.sessionData = data;
    this.lastUpdate = new Date().toISOString();
    logger.setContext('userId', data.userId);
    
    await this.saveToStorage({ sessionData: this.sessionData, lastUpdate: this.lastUpdate });
    this.systemState.extractionCount++;
    
    sendResponse({ success: true });
  }

  async handleLoginStateChanged(data, sendResponse) {
    logger.info('CORE', '🔄 Login state changed', { 
      isLoggedIn: data.isLoggedIn,
      userId: data.userId 
    });
    
    // Update system context
    this.systemState.lastActivity = Date.now();
    
    if (data.isLoggedIn && data.userId) {
      // User logged in - update context for automation system
      if (this.automationOrchestrator) {
        await this.updateAutomationContext();
      }
      
      // Trigger session extraction via automation system (not immediate)
      if (this.systemState.automationEnabled) {
        logger.info('CORE', '⏰ Scheduling session extraction after login detection');
        
        // Schedule extraction for 30 seconds later (avoid immediate extraction)
        setTimeout(async () => {
          await this.triggerManualExtraction('session', { 
            reason: 'login_detected',
            delay: true 
          });
        }, 30000);
      }
    } else {
      // User logged out
      logger.info('CORE', '👋 User logged out detected');
      
      // Could clear session data or mark as inactive
      if (this.automationOrchestrator) {
        await this.automationOrchestrator.updateSystemContext({
          userActivity: 'logged_out',
          hasActiveSession: false
        });
      }
    }
    
    sendResponse({ success: true, message: 'Login state processed' });
  }

  async handleGetCookies(sendResponse) {
    try {
      const cookies = await this.extractFacebookCookies();
      sendResponse({ cookies });
    } catch (error) {
      logger.error('CORE', 'Error extracting cookies', null, error);
      sendResponse({ cookies: [], error: error.message });
    }
  }

  async handleGetSessionData(sendResponse) {
    if (!this.sessionData) {
      await this.loadExistingData();
    }
    sendResponse({ data: this.sessionData, lastUpdate: this.lastUpdate });
  }

  async handleClearSessionData(sendResponse) {
    this.sessionData = null;
    this.lastUpdate = null;
    logger.setContext('userId', null);
    
    await chrome.storage.local.clear();
    logger.info('CORE', '🧹 Session data cleared');
    
    sendResponse({ success: true });
  }

  async handleSendToLocalhost(data, sendResponse) {
    try {
      const result = await this.sendToLocalhostServer(data);
      sendResponse(result);
    } catch (error) {
      logger.error('CORE', 'Error sending to localhost', null, error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // Core Functions (mantendo compatibilidade com versão anterior)
  async extractFacebookCookies() {
    try {
      if (!chrome.cookies) {
        logger.warn('CORE', 'Cookies API not available');
        return [];
      }

      const [domainCookies, wwwCookies, mCookies, baseCookies] = await Promise.all([
        chrome.cookies.getAll({ domain: '.facebook.com' }),
        chrome.cookies.getAll({ domain: 'www.facebook.com' }),
        chrome.cookies.getAll({ domain: 'm.facebook.com' }),
        chrome.cookies.getAll({ domain: 'facebook.com' })
      ]);
      
      const allCookies = [...domainCookies, ...wwwCookies, ...mCookies, ...baseCookies];
      
      // Deduplicate cookies
      const cookieMap = new Map();
      allCookies.forEach(cookie => {
        const key = `${cookie.name}-${cookie.domain}`;
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
      
      const importantCookies = ['c_user', 'xs', 'datr', 'fr', 'sb'];
      const foundImportant = formattedCookies.filter(c => importantCookies.includes(c.name));
      
      logger.info('CORE', `🍪 Extracted ${formattedCookies.length} Facebook cookies`, {
        total: formattedCookies.length,
        important: foundImportant.map(c => c.name)
      });
      
      return formattedCookies;
      
    } catch (error) {
      logger.error('CORE', 'Error extracting Facebook cookies', null, error);
      throw error;
    }
  }

  async saveToStorage(data) {
    try {
      await chrome.storage.local.set({
        vendaboost_session: data.sessionData,
        vendaboost_last_update: data.lastUpdate
      });
      logger.debug('CORE', 'Session data saved to storage');
    } catch (error) {
      logger.error('CORE', 'Error saving to storage', null, error);
      throw error;
    }
  }

  async sendToLocalhostServer(data) {
    const apiConfig = config.getApiConfig();
    const urls = apiConfig.endpoints.local.urls;
    
    for (const url of urls) {
      try {
        logger.debug('CORE', `📡 Attempting to send to ${url}...`);
        
        const response = await fetch(`${url}/api/facebook-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        if (response.ok) {
          const result = await response.json();
          logger.info('CORE', '✅ Data sent successfully to localhost', { url });
          return { success: true, result };
        }
      } catch (error) {
        logger.debug('CORE', `⏳ ${url} not available`);
      }
    }
    
    return { success: false, error: 'No localhost server found' };
  }

  // New Methods for v2.0
  async performScheduledExtraction() {
    if (!config.get('extraction.autoExtractEnabled')) {
      return;
    }

    logger.info('CORE', '🔄 Performing scheduled extraction');
    
    try {
      const tabs = await chrome.tabs.query({ url: '*://*.facebook.com/*' });
      
      if (tabs.length === 0) {
        logger.debug('CORE', 'No Facebook tabs open for extraction');
        return;
      }
      
      for (const tab of tabs) {
        await this.extractFromTab(tab.id);
      }
      
    } catch (error) {
      logger.error('CORE', 'Error in scheduled extraction', null, error);
    }
  }

  async extractFromTab(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'extractSession' });
      logger.debug('CORE', 'Extraction requested for tab', { tabId });
    } catch (error) {
      logger.debug('CORE', 'Could not extract from tab', { tabId, error: error.message });
    }
  }

  async scheduleExtraction(tabId) {
    // Inject content script if needed
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
      
      // Trigger extraction after delay
      setTimeout(() => {
        this.extractFromTab(tabId);
      }, 3000);
      
    } catch (error) {
      logger.debug('CORE', 'Content script already active or injection failed');
    }
  }

  triggerSessionRefresh() {
    logger.info('CORE', '🔄 Triggering session refresh');
    this.performScheduledExtraction();
  }

  async performCleanup() {
    logger.info('CORE', '🧹 Performing system cleanup');
    
    // Cleanup old logs
    const logs = logger.getLogHistory();
    if (logs.length > config.get('logging.maxHistorySize')) {
      logger.clearHistory();
    }
    
    // Cleanup storage if needed
    const storageConfig = config.getStorageConfig();
    // TODO: Implement storage cleanup based on TTL
  }

  // Enhanced System Status Methods
  async getSystemStatus() {
    const baseStatus = {
      initialized: this.initialized,
      state: this.systemState,
      config: config.getStatus(),
      session: {
        hasData: !!this.sessionData,
        userId: this.sessionData?.userId,
        lastUpdate: this.lastUpdate
      },
      components: Array.from(this.components.keys()),
      performance: {
        uptime: Date.now() - this.systemState.uptime,
        extractionCount: this.systemState.extractionCount,
        errorCount: this.systemState.errorCount
      }
    };

    // Add automation status if available
    if (this.automationOrchestrator) {
      baseStatus.automation = await this.automationOrchestrator.getSystemStatus();
    }

    return baseStatus;
  }

  async getAutomationStatus() {
    if (!this.automationOrchestrator) {
      return {
        enabled: false,
        status: 'not_available',
        message: 'Automation system not initialized'
      };
    }

    return await this.automationOrchestrator.getSystemStatus();
  }

  async getDetailedSystemStatus() {
    const status = await this.getSystemStatus();
    
    // Add detailed component statistics
    status.componentDetails = {};
    
    for (const [componentName, component] of this.components.entries()) {
      try {
        if (component.getStats) {
          status.componentDetails[componentName] = await component.getStats();
        } else if (component.getSystemStatus) {
          status.componentDetails[componentName] = await component.getSystemStatus();
        } else {
          status.componentDetails[componentName] = { status: 'active' };
        }
      } catch (error) {
        status.componentDetails[componentName] = { 
          status: 'error', 
          error: error.message 
        };
      }
    }

    // Add automation details if available
    if (this.automationOrchestrator) {
      status.automationDetails = await this.automationOrchestrator.getDetailedStatus();
    }

    return status;
  }

  async getComponentStats(componentName) {
    if (!componentName) {
      // Return stats for all components
      const allStats = {};
      for (const [name, component] of this.components.entries()) {
        try {
          if (component.getStats) {
            allStats[name] = await component.getStats();
          }
        } catch (error) {
          allStats[name] = { error: error.message };
        }
      }
      return allStats;
    }

    // Return stats for specific component
    const component = this.components.get(componentName);
    if (!component) {
      return { error: `Component ${componentName} not found` };
    }

    try {
      if (component.getStats) {
        return await component.getStats();
      } else {
        return { message: 'Component does not provide stats' };
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  // Automation Control Methods
  async enableAutomation() {
    if (!this.automationOrchestrator) {
      logger.warn('CORE', 'Cannot enable automation - orchestrator not available');
      return;
    }

    try {
      if (!this.systemState.automationEnabled) {
        await this.automationOrchestrator.start();
        this.systemState.automationEnabled = true;
        
        logger.info('CORE', '✅ Automation enabled');
      }
    } catch (error) {
      logger.error('CORE', 'Failed to enable automation', null, error);
      throw error;
    }
  }

  async disableAutomation() {
    if (!this.automationOrchestrator) {
      logger.warn('CORE', 'Cannot disable automation - orchestrator not available');
      return;
    }

    try {
      if (this.systemState.automationEnabled) {
        await this.automationOrchestrator.stop();
        this.systemState.automationEnabled = false;
        
        logger.info('CORE', '⏹️ Automation disabled');
      }
    } catch (error) {
      logger.error('CORE', 'Failed to disable automation', null, error);
      throw error;
    }
  }

  async triggerManualExtraction(extractionType = 'session', options = {}) {
    try {
      logger.info('CORE', `🔄 Manual extraction triggered: ${extractionType}`);
      
      // Update last activity
      this.systemState.lastActivity = Date.now();
      
      if (this.automationOrchestrator && this.systemState.automationEnabled) {
        // Use automation system for extraction
        const task = {
          type: 'extraction',
          action: `extract_${extractionType}`,
          priority: 'HIGH',
          payload: {
            extractionType,
            manual: true,
            ...options
          },
          metadata: {
            triggeredBy: 'manual',
            timestamp: Date.now()
          }
        };
        
        // Add task to automation system
        const queueManager = globalThis.queueManager;
        if (queueManager) {
          await queueManager.addTask(task);
        }
        
      } else {
        // Fallback to legacy extraction
        await this.performLegacyExtraction(extractionType, options);
      }
      
      logger.info('CORE', `✅ Manual extraction queued: ${extractionType}`);
      
    } catch (error) {
      logger.error('CORE', 'Failed to trigger manual extraction', { extractionType, options }, error);
      throw error;
    }
  }

  async triggerAutonomousExtraction(extractionType = 'session', options = {}) {
    try {
      logger.info('CORE', `🚀 Autonomous extraction triggered: ${extractionType}`, options);
      
      // Create autonomous tab manager
      if (!globalThis.AutonomousTabManager) {
        throw new Error('AutonomousTabManager not available');
      }
      
      const tabManager = new globalThis.AutonomousTabManager();
      let result;
      
      switch (extractionType) {
        case 'session':
          result = await tabManager.extractSessionAutonomously(null, options);
          break;
          
        case 'groups':
          result = await tabManager.extractGroupsAutonomously(null, options);
          break;
          
        case 'profile':
          // Profile extraction via autonomous tab
          result = await tabManager.executeWithAutonomousTab(
            'extract_profile',
            'https://www.facebook.com/me',
            options
          );
          break;
          
        case 'all':
          // Extract all data types sequentially
          result = await this.extractAllDataAutonomously(tabManager, options);
          break;
          
        default:
          throw new Error(`Unknown extraction type: ${extractionType}`);
      }
      
      if (result.success) {
        // Update system state
        this.systemState.lastActivity = Date.now();
        this.systemState.extractionCount++;
        
        // Update automation context
        if (this.automationOrchestrator) {
          await this.updateAutomationContext();
        }
        
        logger.info('CORE', `✅ Autonomous extraction completed: ${extractionType}`, {
          result: result.summary || 'Success'
        });
      } else {
        throw new Error(result.error || 'Autonomous extraction failed');
      }
      
      return result;
      
    } catch (error) {
      this.systemState.errorCount++;
      logger.error('CORE', 'Autonomous extraction failed', { extractionType, options }, error);
      throw error;
    }
  }

  async extractAllDataAutonomously(tabManager, options) {
    logger.info('CORE', '🔄 Extracting all data types autonomously');
    
    const results = {
      success: true,
      results: {},
      errors: [],
      totalDuration: 0
    };
    
    const extractionTypes = ['session', 'groups', 'profile'];
    const startTime = Date.now();
    
    for (const type of extractionTypes) {
      try {
        let typeResult;
        
        switch (type) {
          case 'session':
            typeResult = await tabManager.extractSessionAutonomously(null, options);
            break;
          case 'groups':
            typeResult = await tabManager.extractGroupsAutonomously(null, options);
            break;
          case 'profile':
            typeResult = await tabManager.executeWithAutonomousTab(
              'extract_profile',
              'https://www.facebook.com/me',
              options
            );
            break;
        }
        
        results.results[type] = typeResult;
        
        if (!typeResult.success) {
          results.errors.push({ type, error: typeResult.error });
        }
        
        // Delay between extractions to avoid detection
        if (type !== extractionTypes[extractionTypes.length - 1]) {
          await this.delay(3000 + Math.random() * 2000); // 3-5 seconds
        }
        
      } catch (error) {
        results.errors.push({ type, error: error.message });
        logger.error('CORE', `Error in autonomous extraction: ${type}`, null, error);
      }
    }
    
    results.totalDuration = Date.now() - startTime;
    results.success = results.errors.length < extractionTypes.length; // Success if at least one succeeded
    
    return results;
  }

  async performLegacyExtraction(extractionType, options) {
    // Legacy extraction logic for fallback
    switch (extractionType) {
      case 'session':
        await this.performScheduledExtraction();
        break;
      default:
        logger.warn('CORE', `Legacy extraction not implemented for: ${extractionType}`);
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getMemoryUsage() {
    try {
      const info = await chrome.system.memory.getInfo();
      return info.availableCapacity - info.capacity;
    } catch (error) {
      return 0;
    }
  }

  async getStorageUsage() {
    try {
      const usage = await chrome.storage.local.getBytesInUse();
      return usage;
    } catch (error) {
      return 0;
    }
  }

  // Lifecycle methods
  onFirstInstall() {
    logger.info('CORE', '🎉 First installation detected');
    // Setup initial configuration, welcome flow, etc.
  }

  onUpdate(previousVersion) {
    logger.info('CORE', '⬆️ Extension updated', {
      from: previousVersion,
      to: chrome.runtime.getManifest().version
    });
    // Handle migration, feature announcements, etc.
  }
}

// Initialize the core system
const vendaBoostCore = new VendaBoostCore();

// Start initialization when script loads
vendaBoostCore.initialize().catch(error => {
  console.error('❌ Fatal error during initialization:', error);
});

// Export for testing/debugging
globalThis.vendaBoostCore = vendaBoostCore;