/**
 * VendaBoost Extension - Autonomous Tab Manager
 * Gerencia criação e controle de abas invisíveis para extração independente
 */

class AutonomousTabManager {
  constructor() {
    this.activeTabs = new Map();
    this.tabQueue = [];
    this.isProcessing = false;
    this.sessionValidated = false;
    
    // Configuration
    this.config = {
      // Tab management
      maxConcurrentTabs: 3,
      tabTimeout: 2 * 60 * 1000,        // 2 minutos por tab
      reuseExistingTabs: true,
      closeTabsAfterUse: true,
      
      // Session validation
      validateSessionViaApi: true,
      sessionValidationUrl: 'https://www.facebook.com',
      maxValidationAttempts: 3,
      validationTimeout: 30000,
      
      // Navigation settings
      navigationTimeout: 30000,
      waitForLoadTimeout: 15000,
      retryNavigationAttempts: 2,
      
      // Anti-detection
      humanLikeDelay: true,
      randomUserAgent: false,        // Perigoso em extensões
      tabCreationDelay: 1000,        // 1 segundo entre tabs
      
      // Error handling
      enableAutoRecovery: true,
      maxConsecutiveErrors: 5,
      cooldownAfterErrors: 5 * 60 * 1000, // 5 minutos
      
      // Performance
      preloadTabs: false,
      enableTabPool: false,          // Para futuro
      enableResourceBlocking: true   // Bloquear imagens/CSS para performance
    };
    
    // State tracking
    this.state = {
      totalTabsCreated: 0,
      successfulNavigations: 0,
      failedNavigations: 0,
      currentlyActive: 0,
      lastError: null,
      consecutiveErrors: 0,
      cooldownUntil: null
    };
    
    logger.info('AUTONOMOUS_TAB_MANAGER', 'AutonomousTabManager initialized');
  }

  /**
   * Main entry point - execute action using autonomous tabs
   */
  async executeWithAutonomousTab(action, targetUrl, options = {}) {
    try {
      // Check if in cooldown
      if (this.isInCooldown()) {
        throw new Error('Tab manager in cooldown due to consecutive errors');
      }
      
      // Check concurrent limit
      if (this.activeTabs.size >= this.config.maxConcurrentTabs) {
        throw new Error('Maximum concurrent tabs limit reached');
      }
      
      logger.info('AUTONOMOUS_TAB_MANAGER', `🚀 Executing action with autonomous tab`, {
        action,
        targetUrl: this.sanitizeUrl(targetUrl),
        options
      });
      
      // Validate session first if needed
      if (!this.sessionValidated && this.config.validateSessionViaApi) {
        const sessionValid = await this.validateSession();
        if (!sessionValid) {
          throw new Error('Facebook session is not valid');
        }
      }
      
      // Create and manage tab
      const tabResult = await this.createAndManageTab(targetUrl, action, options);
      
      // Reset error counter on success
      this.state.consecutiveErrors = 0;
      this.state.successfulNavigations++;
      
      return tabResult;
      
    } catch (error) {
      this.handleTabError(error);
      throw error;
    }
  }

  /**
   * Validate Facebook session using invisible tab
   */
  async validateSession() {
    try {
      logger.info('AUTONOMOUS_TAB_MANAGER', '🔐 Validating Facebook session');
      
      // Check if we have valid cookies first
      const hasValidCookies = await this.checkValidCookies();
      if (!hasValidCookies) {
        logger.warn('AUTONOMOUS_TAB_MANAGER', 'No valid Facebook cookies found');
        return false;
      }
      
      // Create validation tab
      const validationTab = await this.createInvisibleTab(this.config.sessionValidationUrl);
      
      try {
        // Wait for page to load
        await this.waitForTabLoad(validationTab.id);
        
        // Check if logged in by injecting script
        const loginCheck = await this.checkLoginStatus(validationTab.id);
        
        if (loginCheck.isLoggedIn) {
          this.sessionValidated = true;
          logger.info('AUTONOMOUS_TAB_MANAGER', '✅ Session validation successful', {
            userId: loginCheck.userId
          });
          
          // Store user context for future use
          if (loginCheck.userId && globalThis.vendaBoostCore) {
            await globalThis.vendaBoostCore.updateAutomationContext();
          }
          
          return true;
        } else {
          logger.warn('AUTONOMOUS_TAB_MANAGER', '❌ Session validation failed - user not logged in');
          return false;
        }
        
      } finally {
        // Always close validation tab
        await this.closeTab(validationTab.id);
      }
      
    } catch (error) {
      logger.error('AUTONOMOUS_TAB_MANAGER', 'Session validation error', null, error);
      return false;
    }
  }

  /**
   * Check for valid Facebook cookies
   */
  async checkValidCookies() {
    try {
      const cookies = await chrome.cookies.getAll({ domain: '.facebook.com' });
      const essentialCookies = ['c_user', 'xs'];
      
      for (const essential of essentialCookies) {
        const cookie = cookies.find(c => c.name === essential);
        if (!cookie || this.isCookieExpired(cookie)) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if cookie is expired
   */
  isCookieExpired(cookie) {
    if (!cookie.expirationDate) return false;
    return Date.now() / 1000 > cookie.expirationDate;
  }

  /**
   * Create and manage tab for specific action
   */
  async createAndManageTab(targetUrl, action, options) {
    const tabId = await this.createInvisibleTab(targetUrl);
    
    try {
      // Register tab
      this.registerTab(tabId, action, targetUrl);
      
      // Wait for tab to load
      await this.waitForTabLoad(tabId);
      
      // Execute action based on type
      let result;
      switch (action) {
        case 'extract_groups':
          result = await this.executeGroupsExtraction(tabId, options);
          break;
        case 'extract_session':
          result = await this.executeSessionExtraction(tabId, options);
          break;
        case 'extract_profile':
          result = await this.executeProfileExtraction(tabId, options);
          break;
        case 'validate_session':
          result = await this.checkLoginStatus(tabId);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      
      return result;
      
    } finally {
      // Always cleanup tab
      await this.cleanupTab(tabId);
    }
  }

  /**
   * Create invisible tab
   */
  async createInvisibleTab(url) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Tab creation timeout'));
      }, 10000);
      
      // Tab creation options
      const createOptions = {
        url: url,
        active: false,      // Invisible
        pinned: false,
        
        // Optional: specific window (could create in background window)
        // windowId: backgroundWindowId
      };
      
      chrome.tabs.create(createOptions, (tab) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          this.state.totalTabsCreated++;
          this.state.currentlyActive++;
          
          logger.debug('AUTONOMOUS_TAB_MANAGER', `Invisible tab created: ${tab.id}`, {
            url: this.sanitizeUrl(url)
          });
          
          resolve(tab.id);
        }
      });
    });
  }

  /**
   * Wait for tab to load completely
   */
  async waitForTabLoad(tabId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Tab load timeout'));
      }, this.config.waitForLoadTimeout);
      
      const checkLoad = () => {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            clearTimeout(timeout);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (tab.status === 'complete') {
            clearTimeout(timeout);
            
            // Additional wait for JavaScript to execute
            setTimeout(() => {
              logger.debug('AUTONOMOUS_TAB_MANAGER', `Tab fully loaded: ${tabId}`);
              resolve();
            }, 2000);
          } else {
            setTimeout(checkLoad, 500);
          }
        });
      };
      
      checkLoad();
    });
  }

  /**
   * Execute groups extraction in tab
   */
  async executeGroupsExtraction(tabId, options) {
    try {
      logger.debug('AUTONOMOUS_TAB_MANAGER', `Executing groups extraction in tab: ${tabId}`);
      
      // Inject specialized extraction script
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        files: ['extractors/injectedExtractors.js']
      });
      
      // Execute groups extraction function
      const extractionResults = await chrome.scripting.executeScript({
        target: { tabId },
        func: extractGroupsFromGroupsPage,
        args: [{ 
          maxScrollAttempts: 15,
          scrollDelay: 2000,
          humanLikeScrolling: true,
          ...options
        }]
      });
      
      if (extractionResults && extractionResults[0] && extractionResults[0].result) {
        const extractedGroups = extractionResults[0].result;
        
        logger.info('AUTONOMOUS_TAB_MANAGER', '✅ Groups extraction completed', {
          tabId,
          groupsCount: extractedGroups.length
        });
        
        return {
          success: true,
          groups: extractedGroups,
          tabId,
          extractedAt: new Date().toISOString()
        };
      }
      
      return { success: false, error: 'No results from extraction script' };
      
    } catch (error) {
      logger.error('AUTONOMOUS_TAB_MANAGER', 'Groups extraction failed', { tabId }, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute session extraction in tab
   */
  async executeSessionExtraction(tabId, options) {
    try {
      logger.debug('AUTONOMOUS_TAB_MANAGER', `Executing session extraction in tab: ${tabId}`);
      
      // Inject specialized extraction script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['extractors/injectedExtractors.js']
      });
      
      // Execute session extraction function
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: extractSessionFromPage,
        args: []
      });
      
      if (results && results[0] && results[0].result) {
        const sessionData = results[0].result;
        
        // Merge with cookies from background
        if (globalThis.vendaBoostCore) {
          sessionData.cookies = await globalThis.vendaBoostCore.extractFacebookCookies();
        }
        
        logger.info('AUTONOMOUS_TAB_MANAGER', '✅ Session extraction completed', {
          tabId,
          userId: sessionData.userId
        });
        
        return {
          success: true,
          sessionData,
          tabId,
          extractedAt: new Date().toISOString()
        };
      }
      
      return { success: false, error: 'No results from extraction script' };
      
    } catch (error) {
      logger.error('AUTONOMOUS_TAB_MANAGER', 'Session extraction failed', { tabId }, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check login status in tab
   */
  async checkLoginStatus(tabId) {
    try {
      // Inject extraction functions first
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['extractors/injectedExtractors.js']
      });
      
      // Execute login check function
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: checkIfLoggedInOnPage,
        args: []
      });
      
      if (results && results[0] && results[0].result !== undefined) {
        const isLoggedIn = results[0].result;
        
        // Get user ID if logged in
        let userId = null;
        if (isLoggedIn) {
          const userIdResults = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
              const cUserCookie = document.cookie.split(';').find(c => c.trim().startsWith('c_user='));
              return cUserCookie ? cUserCookie.split('=')[1].trim() : null;
            }
          });
          
          if (userIdResults && userIdResults[0]) {
            userId = userIdResults[0].result;
          }
        }
        
        return {
          isLoggedIn,
          userId,
          url: 'facebook.com', // Don't expose full URL for privacy
          tabId
        };
      }
      
      return { isLoggedIn: false, userId: null };
      
    } catch (error) {
      logger.error('AUTONOMOUS_TAB_MANAGER', 'Login status check failed', { tabId }, error);
      return { isLoggedIn: false, userId: null, error: error.message };
    }
  }

  /**
   * Groups extraction script to inject into page
   */
  static groupsExtractionScript(config) {
    return new Promise(async (resolve) => {
      try {
        console.log('🕵️ VendaBoost: Silent groups extraction started');
        
        const groups = [];
        let scrollAttempts = 0;
        
        // Wait for page to stabilize
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Function to extract groups from current view
        const extractVisibleGroups = () => {
          const groupSelectors = [
            'a[href*="/groups/"][role="link"]',
            '[data-testid*="group"] a[href*="/groups/"]',
            'div[role="article"] a[href*="/groups/"]',
            // Additional selectors for different layouts
            'a[href*="/groups/"] div[dir="auto"]',
            '[data-pagelet*="group"] a[href*="/groups/"]'
          ];
          
          const extractedFromPage = [];
          
          for (const selector of groupSelectors) {
            const elements = document.querySelectorAll(selector);
            
            elements.forEach(element => {
              try {
                const groupData = {
                  id: '',
                  name: '',
                  url: element.href || element.closest('a')?.href || '',
                  memberCount: 0,
                  privacy: 'unknown',
                  description: '',
                  coverPhoto: '',
                  category: '',
                  extractedAt: new Date().toISOString(),
                  source: 'autonomous_tab'
                };
                
                // Extract URL and ID
                if (groupData.url) {
                  const urlObj = new URL(groupData.url);
                  const idMatch = urlObj.pathname.match(/\/groups\/(\d+)/);
                  if (idMatch) {
                    groupData.id = idMatch[1];
                  } else {
                    const nameMatch = urlObj.pathname.match(/\/groups\/([^\/\?]+)/);
                    if (nameMatch && nameMatch[1] !== 'feed' && nameMatch[1] !== 'browse') {
                      groupData.id = nameMatch[1];
                    }
                  }
                }
                
                // Extract name
                const nameElement = element.querySelector('[dir="auto"]') || 
                                   element.querySelector('strong') ||
                                   element;
                const name = nameElement.textContent?.trim() || '';
                
                if (name && name.length > 0 && name.length < 200) {
                  groupData.name = name;
                }
                
                // Extract member count
                const parentElement = element.closest('[role="article"]') || 
                                    element.closest('div') ||
                                    element.parentElement;
                
                if (parentElement) {
                  const text = parentElement.textContent || '';
                  const memberMatch = text.match(/(\d+(?:[,\.]\d+)*)\s*(?:member|membro|участник)/i);
                  if (memberMatch) {
                    groupData.memberCount = parseInt(memberMatch[1].replace(/[,\.]/g, ''));
                  }
                  
                  // Extract privacy
                  if (text.toLowerCase().includes('private') || text.toLowerCase().includes('privado')) {
                    groupData.privacy = 'private';
                  } else if (text.toLowerCase().includes('public') || text.toLowerCase().includes('público')) {
                    groupData.privacy = 'public';
                  }
                }
                
                // Extract cover photo
                const imgElement = element.querySelector('img') || 
                                 element.closest('div').querySelector('img');
                if (imgElement && imgElement.src && !imgElement.src.includes('data:')) {
                  groupData.coverPhoto = imgElement.src;
                }
                
                // Only add valid groups
                if (groupData.id && groupData.name && groupData.url) {
                  extractedFromPage.push(groupData);
                }
                
              } catch (error) {
                console.debug('Error extracting group element:', error);
              }
            });
          }
          
          return extractedFromPage;
        };
        
        // Function to perform smart scrolling
        const performSmartScroll = async () => {
          const currentScroll = window.pageYOffset;
          const documentHeight = document.body.scrollHeight;
          const viewportHeight = window.innerHeight;
          
          if (config.humanLikeScrolling) {
            // Human-like scrolling with randomization
            const scrollAmount = viewportHeight * (0.6 + Math.random() * 0.3); // 60-90% of viewport
            const targetScroll = Math.min(currentScroll + scrollAmount, documentHeight - viewportHeight);
            
            // Smooth scroll
            window.scrollTo({
              top: targetScroll,
              behavior: 'smooth'
            });
            
            // Random delay
            const delay = config.scrollDelay + (Math.random() * 1000);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            // Simple scroll
            window.scrollBy(0, viewportHeight);
            await new Promise(resolve => setTimeout(resolve, config.scrollDelay));
          }
          
          return window.pageYOffset;
        };
        
        // Initial extraction
        let currentGroups = extractVisibleGroups();
        groups.push(...currentGroups);
        
        console.log(`🔍 Initial extraction: ${currentGroups.length} groups found`);
        
        // Scroll and extract more
        let lastScrollPosition = 0;
        let noNewContentCount = 0;
        
        while (scrollAttempts < config.maxScrollAttempts) {
          const scrollPosition = await performSmartScroll();
          scrollAttempts++;
          
          // Check if actually scrolled
          if (scrollPosition === lastScrollPosition) {
            noNewContentCount++;
            if (noNewContentCount >= 3) {
              console.log('🏁 No more content to scroll, stopping');
              break;
            }
          } else {
            noNewContentCount = 0;
          }
          
          lastScrollPosition = scrollPosition;
          
          // Wait for new content to load
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Extract new groups
          const newGroups = extractVisibleGroups();
          
          // Filter out already found groups
          const uniqueNewGroups = newGroups.filter(newGroup => 
            !groups.some(existingGroup => 
              existingGroup.id === newGroup.id || 
              (existingGroup.url === newGroup.url && newGroup.url)
            )
          );
          
          groups.push(...uniqueNewGroups);
          
          console.log(`📜 Scroll ${scrollAttempts}: +${uniqueNewGroups.length} new groups (total: ${groups.length})`);
          
          // Stop if no new groups for several attempts
          if (uniqueNewGroups.length === 0) {
            noNewContentCount++;
            if (noNewContentCount >= 2) {
              console.log('🏁 No new groups found, stopping extraction');
              break;
            }
          }
          
          // Check if reached end
          if (window.pageYOffset + window.innerHeight >= document.body.scrollHeight - 200) {
            console.log('🏁 Reached end of page');
            break;
          }
        }
        
        console.log(`✅ Groups extraction completed: ${groups.length} groups extracted`);
        resolve(groups);
        
      } catch (error) {
        console.error('❌ Groups extraction script error:', error);
        resolve([]);
      }
    });
  }

  /**
   * Register tab for tracking
   */
  registerTab(tabId, action, url) {
    this.activeTabs.set(tabId, {
      id: tabId,
      action,
      url,
      createdAt: Date.now(),
      status: 'active'
    });
  }

  /**
   * Cleanup tab
   */
  async cleanupTab(tabId) {
    try {
      const tabInfo = this.activeTabs.get(tabId);
      
      if (this.config.closeTabsAfterUse) {
        await this.closeTab(tabId);
      }
      
      this.activeTabs.delete(tabId);
      this.state.currentlyActive--;
      
      if (tabInfo) {
        const duration = Date.now() - tabInfo.createdAt;
        logger.debug('AUTONOMOUS_TAB_MANAGER', `Tab cleaned up: ${tabId}`, {
          action: tabInfo.action,
          duration: `${duration}ms`
        });
      }
      
    } catch (error) {
      logger.debug('AUTONOMOUS_TAB_MANAGER', `Cleanup error for tab ${tabId}:`, error);
    }
  }

  /**
   * Close tab
   */
  async closeTab(tabId) {
    try {
      await chrome.tabs.remove(tabId);
      logger.debug('AUTONOMOUS_TAB_MANAGER', `Tab closed: ${tabId}`);
    } catch (error) {
      // Tab might already be closed
      logger.debug('AUTONOMOUS_TAB_MANAGER', `Tab close error (might be already closed): ${tabId}`);
    }
  }

  /**
   * Handle tab errors
   */
  handleTabError(error) {
    this.state.lastError = {
      message: error.message,
      timestamp: Date.now()
    };
    
    this.state.consecutiveErrors++;
    this.state.failedNavigations++;
    
    // Enter cooldown if too many consecutive errors
    if (this.state.consecutiveErrors >= this.config.maxConsecutiveErrors) {
      this.state.cooldownUntil = Date.now() + this.config.cooldownAfterErrors;
      
      logger.warn('AUTONOMOUS_TAB_MANAGER', '❄️ Entering cooldown due to consecutive errors', {
        errors: this.state.consecutiveErrors,
        cooldownUntil: new Date(this.state.cooldownUntil).toLocaleTimeString()
      });
    }
  }

  /**
   * Check if in cooldown period
   */
  isInCooldown() {
    return this.state.cooldownUntil && Date.now() < this.state.cooldownUntil;
  }

  /**
   * Utility methods
   */
  sanitizeUrl(url) {
    try {
      const urlObj = new URL(url);
      return `${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return 'invalid-url';
    }
  }

  /**
   * Public interface methods
   */
  async extractGroupsAutonomously(userId = null, options = {}) {
    return await this.executeWithAutonomousTab(
      'extract_groups',
      'https://www.facebook.com/groups/feed/',
      { ...options, userId }
    );
  }

  async extractSessionAutonomously(userId = null, options = {}) {
    return await this.executeWithAutonomousTab(
      'extract_session',
      'https://www.facebook.com',
      { ...options, userId }
    );
  }

  async validateSessionAutonomously() {
    return await this.executeWithAutonomousTab(
      'validate_session',
      'https://www.facebook.com'
    );
  }

  getManagerStats() {
    return {
      totalTabsCreated: this.state.totalTabsCreated,
      currentlyActive: this.state.currentlyActive,
      successfulNavigations: this.state.successfulNavigations,
      failedNavigations: this.state.failedNavigations,
      consecutiveErrors: this.state.consecutiveErrors,
      sessionValidated: this.sessionValidated,
      isInCooldown: this.isInCooldown(),
      cooldownUntil: this.state.cooldownUntil,
      activeTabs: Array.from(this.activeTabs.keys())
    };
  }

  async emergencyCleanup() {
    // Emergency cleanup - close all tabs
    const tabIds = Array.from(this.activeTabs.keys());
    
    for (const tabId of tabIds) {
      await this.closeTab(tabId);
    }
    
    this.activeTabs.clear();
    this.state.currentlyActive = 0;
    this.isProcessing = false;
    
    logger.warn('AUTONOMOUS_TAB_MANAGER', '🚨 Emergency cleanup performed', {
      tabsClosed: tabIds.length
    });
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('AUTONOMOUS_TAB_MANAGER', 'Configuration updated', newConfig);
  }

  resetErrorState() {
    this.state.consecutiveErrors = 0;
    this.state.cooldownUntil = null;
    this.state.lastError = null;
    
    logger.info('AUTONOMOUS_TAB_MANAGER', 'Error state reset');
  }

  forceSessionRevalidation() {
    this.sessionValidated = false;
    logger.info('AUTONOMOUS_TAB_MANAGER', 'Session revalidation forced');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AutonomousTabManager;
} else {
  globalThis.AutonomousTabManager = AutonomousTabManager;
}