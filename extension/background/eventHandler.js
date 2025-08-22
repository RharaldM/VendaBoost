/**
 * VendaBoost Extension - Event Handler
 * Gerencia todos os eventos da extensão de forma modular
 */

class EventHandler {
  constructor(core) {
    this.core = core;
    this.eventHandlers = new Map();
    this.setupHandlers();
  }

  setupHandlers() {
    // Extension lifecycle handlers
    this.eventHandlers.set('runtime.onInstalled', this.handleInstalled.bind(this));
    this.eventHandlers.set('runtime.onStartup', this.handleStartup.bind(this));
    this.eventHandlers.set('runtime.onMessage', this.handleMessage.bind(this));
    
    // Chrome alarms
    this.eventHandlers.set('alarms.onAlarm', this.handleAlarm.bind(this));
    
    // Tab monitoring
    this.eventHandlers.set('tabs.onUpdated', this.handleTabUpdated.bind(this));
    this.eventHandlers.set('tabs.onCreated', this.handleTabCreated.bind(this));
    this.eventHandlers.set('tabs.onRemoved', this.handleTabRemoved.bind(this));
    
    // Cookie monitoring
    this.eventHandlers.set('cookies.onChanged', this.handleCookieChanged.bind(this));
    
    // Web request monitoring
    this.eventHandlers.set('webRequest.onBeforeRequest', this.handleWebRequest.bind(this));
    
    logger.info('EVENT_HANDLER', 'Event handlers configured', {
      handlersCount: this.eventHandlers.size
    });
  }

  // Extension Lifecycle Events
  async handleInstalled(details) {
    logger.info('EVENT_HANDLER', `🔧 Extension ${details.reason}`, {
      version: chrome.runtime.getManifest().version,
      reason: details.reason,
      previousVersion: details.previousVersion
    });

    try {
      if (details.reason === 'install') {
        await this.onFirstInstall();
      } else if (details.reason === 'update') {
        await this.onUpdate(details.previousVersion);
      }
    } catch (error) {
      logger.error('EVENT_HANDLER', 'Error in installation handler', null, error);
    }
  }

  async handleStartup() {
    logger.info('EVENT_HANDLER', '🌅 Extension startup detected');
    
    try {
      // Reinitialize core systems
      await this.core.performHealthCheck();
      
      // Resume any interrupted operations
      await this.resumeOperations();
      
    } catch (error) {
      logger.error('EVENT_HANDLER', 'Error in startup handler', null, error);
    }
  }

  async handleMessage(request, sender, sendResponse) {
    const startTime = performance.now();
    
    try {
      logger.debug('EVENT_HANDLER', 'Message received', {
        action: request.action,
        from: sender.tab ? 'content' : (sender.id ? 'extension' : 'popup'),
        tabId: sender.tab?.id,
        url: sender.tab?.url
      });

      const response = await this.routeMessage(request, sender);
      
      const duration = performance.now() - startTime;
      logger.debug('EVENT_HANDLER', 'Message processed', {
        action: request.action,
        duration: `${duration.toFixed(2)}ms`,
        success: response.success !== false
      });
      
      sendResponse(response);
      
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('EVENT_HANDLER', 'Error processing message', {
        action: request.action,
        duration: `${duration.toFixed(2)}ms`
      }, error);
      
      sendResponse({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async routeMessage(request, sender) {
    const { action } = request;
    
    // Core system messages
    if (action.startsWith('system.')) {
      return await this.handleSystemMessage(request, sender);
    }
    
    // Extraction messages
    if (action.startsWith('extract.')) {
      return await this.handleExtractionMessage(request, sender);
    }
    
    // Configuration messages
    if (action.startsWith('config.')) {
      return await this.handleConfigMessage(request, sender);
    }
    
    // Legacy compatibility
    switch (action) {
      case 'userLoggedIn':
        return await this.core.handleUserLoggedIn(request.data);
        
      case 'getCookies':
        const cookies = await this.core.extractFacebookCookies();
        return { cookies };
        
      case 'getSessionData':
        return {
          data: this.core.sessionData,
          lastUpdate: this.core.lastUpdate
        };
        
      case 'clearSessionData':
        return await this.core.handleClearSessionData();
        
      case 'sendToLocalhost':
        return await this.core.sendToLocalhostServer(request.data);
        
      case 'getSystemStatus':
        return this.core.getSystemStatus();
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async handleSystemMessage(request, sender) {
    const action = request.action.replace('system.', '');
    
    switch (action) {
      case 'status':
        return this.core.getSystemStatus();
        
      case 'health':
        return await this.core.performHealthCheck();
        
      case 'restart':
        return await this.restartSystem();
        
      case 'logs':
        return {
          logs: logger.getLogHistory(request.component, request.level),
          stats: logger.getLogStats()
        };
        
      default:
        throw new Error(`Unknown system action: ${action}`);
    }
  }

  async handleExtractionMessage(request, sender) {
    const action = request.action.replace('extract.', '');
    
    switch (action) {
      case 'trigger':
        return await this.triggerExtraction(request.type, request.options);
        
      case 'status':
        return this.getExtractionStatus();
        
      case 'schedule':
        return await this.scheduleExtraction(request.schedule);
        
      default:
        throw new Error(`Unknown extraction action: ${action}`);
    }
  }

  async handleConfigMessage(request, sender) {
    const action = request.action.replace('config.', '');
    
    switch (action) {
      case 'get':
        return { value: config.get(request.path) };
        
      case 'set':
        await config.set(request.path, request.value);
        return { success: true };
        
      case 'export':
        return config.exportConfig();
        
      case 'import':
        await config.importConfig(request.data);
        return { success: true };
        
      case 'reset':
        await config.resetToDefaults();
        return { success: true };
        
      default:
        throw new Error(`Unknown config action: ${action}`);
    }
  }

  // Alarm Events
  async handleAlarm(alarm) {
    logger.info('EVENT_HANDLER', `⏰ Alarm triggered: ${alarm.name}`);
    
    try {
      switch (alarm.name) {
        case 'mainExtraction':
          await this.core.performScheduledExtraction();
          break;
          
        case 'healthCheck':
          await this.core.performHealthCheck();
          break;
          
        case 'cleanup':
          await this.performSystemCleanup();
          break;
          
        case 'adaptiveScheduling':
          await this.handleAdaptiveScheduling();
          break;
          
        default:
          logger.warn('EVENT_HANDLER', 'Unknown alarm', { name: alarm.name });
      }
    } catch (error) {
      logger.error('EVENT_HANDLER', 'Error handling alarm', { alarm: alarm.name }, error);
    }
  }

  // Tab Events
  async handleTabUpdated(tabId, changeInfo, tab) {
    if (changeInfo.status !== 'complete' || !tab.url) return;
    
    // Facebook tab detection
    if (tab.url.includes('facebook.com')) {
      logger.info('EVENT_HANDLER', '📱 Facebook tab detected', {
        tabId,
        url: this.sanitizeUrl(tab.url)
      });
      
      await this.onFacebookTabReady(tabId, tab);
    }
    
    // Other site monitoring (futuro)
    if (config.get('features.advancedMonitoring')) {
      await this.monitorTabActivity(tabId, changeInfo, tab);
    }
  }

  async handleTabCreated(tab) {
    logger.debug('EVENT_HANDLER', 'Tab created', {
      tabId: tab.id,
      url: this.sanitizeUrl(tab.url)
    });
  }

  async handleTabRemoved(tabId, removeInfo) {
    logger.debug('EVENT_HANDLER', 'Tab removed', {
      tabId,
      isWindowClosing: removeInfo.isWindowClosing
    });
    
    // Cleanup any tab-specific data
    await this.cleanupTabData(tabId);
  }

  // Cookie Events
  async handleCookieChanged(changeInfo) {
    if (!changeInfo.cookie.domain.includes('facebook.com')) return;
    
    const importantCookies = ['c_user', 'xs', 'datr', 'fr', 'sb'];
    
    if (importantCookies.includes(changeInfo.cookie.name)) {
      logger.info('EVENT_HANDLER', '🍪 Important Facebook cookie changed', {
        cookie: changeInfo.cookie.name,
        removed: changeInfo.removed,
        domain: changeInfo.cookie.domain
      });
      
      await this.onImportantCookieChanged(changeInfo);
    }
  }

  // Web Request Events
  async handleWebRequest(details) {
    if (!config.get('features.advancedMonitoring')) return;
    
    // Monitor GraphQL requests
    if (details.url.includes('graphql') && details.method === 'POST') {
      logger.debug('EVENT_HANDLER', 'GraphQL request detected', {
        url: details.url,
        tabId: details.tabId
      });
      
      // Future: Analyze GraphQL queries for data extraction opportunities
    }
  }

  // Event Handler Utilities
  async onFirstInstall() {
    logger.info('EVENT_HANDLER', '🎉 First installation detected');
    
    // Setup default configuration
    await config.initialize();
    
    // Create welcome notification
    if (chrome.notifications) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon128.png',
        title: 'VendaBoost Extension Installed',
        message: 'Extension ready for Facebook automation!'
      });
    }
  }

  async onUpdate(previousVersion) {
    logger.info('EVENT_HANDLER', '⬆️ Extension updated', {
      from: previousVersion,
      to: chrome.runtime.getManifest().version
    });
    
    // Handle version-specific migrations
    if (previousVersion && previousVersion.startsWith('1.')) {
      await this.migrateFromV1();
    }
  }

  async resumeOperations() {
    // Resume any interrupted extractions
    // TODO: Implement operation recovery
    logger.info('EVENT_HANDLER', 'Operations resumed');
  }

  async onFacebookTabReady(tabId, tab) {
    try {
      // Inject content script if auto-extraction is enabled
      if (config.get('extraction.autoExtractEnabled')) {
        await this.injectContentScript(tabId);
        
        // Schedule extraction after delay
        setTimeout(() => {
          this.core.extractFromTab(tabId);
        }, config.get('antiDetection.rateLimiting.baseDelayMs') || 3000);
      }
    } catch (error) {
      logger.error('EVENT_HANDLER', 'Error handling Facebook tab', { tabId }, error);
    }
  }

  async injectContentScript(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      
      logger.debug('EVENT_HANDLER', 'Content script injected', { tabId });
    } catch (error) {
      // Script might already be injected
      logger.debug('EVENT_HANDLER', 'Content script injection skipped', { tabId });
    }
  }

  async onImportantCookieChanged(changeInfo) {
    const { cookie, removed } = changeInfo;
    
    // User logged in
    if (cookie.name === 'c_user' && !removed) {
      logger.info('EVENT_HANDLER', '👤 User login detected via cookie');
      
      // Trigger session refresh after delay
      setTimeout(() => {
        this.core.triggerSessionRefresh();
      }, 2000);
    }
    
    // User logged out
    if (cookie.name === 'c_user' && removed) {
      logger.info('EVENT_HANDLER', '👋 User logout detected');
      // Could clear local session data here
    }
  }

  async triggerExtraction(type, options = {}) {
    logger.info('EVENT_HANDLER', 'Manual extraction triggered', { type, options });
    
    switch (type) {
      case 'session':
        return await this.core.performScheduledExtraction();
      case 'groups':
        // TODO: Implement groups extraction
        throw new Error('Groups extraction not yet implemented');
      default:
        throw new Error(`Unknown extraction type: ${type}`);
    }
  }

  getExtractionStatus() {
    return {
      isRunning: false, // TODO: Track extraction state
      lastRun: this.core.lastUpdate,
      nextScheduled: null, // TODO: Get next scheduled time
      extractionCount: this.core.systemState.extractionCount
    };
  }

  async handleAdaptiveScheduling() {
    // TODO: Implement adaptive scheduling logic
    logger.info('EVENT_HANDLER', 'Adaptive scheduling check');
  }

  async performSystemCleanup() {
    logger.info('EVENT_HANDLER', '🧹 Performing system cleanup');
    
    // Cleanup old logs
    if (logger.getLogHistory().length > config.get('logging.maxHistorySize')) {
      logger.clearHistory();
    }
    
    // TODO: Implement storage cleanup
  }

  async restartSystem() {
    logger.info('EVENT_HANDLER', '🔄 System restart requested');
    
    try {
      // Reinitialize core
      await this.core.initialize();
      return { success: true, message: 'System restarted successfully' };
    } catch (error) {
      throw new Error(`System restart failed: ${error.message}`);
    }
  }

  async migrateFromV1() {
    logger.info('EVENT_HANDLER', '📦 Migrating from v1.x');
    
    // TODO: Implement migration logic
    // - Move old session data to new format
    // - Update configuration structure
    // - Cleanup old files
  }

  async monitorTabActivity(tabId, changeInfo, tab) {
    // TODO: Implement advanced tab monitoring
    // - Track user activity patterns
    // - Detect automation opportunities
    // - Monitor for anti-bot signals
  }

  async cleanupTabData(tabId) {
    // TODO: Cleanup any tab-specific cached data
    logger.debug('EVENT_HANDLER', 'Cleaning up tab data', { tabId });
  }

  sanitizeUrl(url) {
    if (!url) return 'unknown';
    
    try {
      const urlObj = new URL(url);
      return `${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return 'invalid-url';
    }
  }
}

// Export for use in core
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventHandler;
} else {
  globalThis.EventHandler = EventHandler;
}