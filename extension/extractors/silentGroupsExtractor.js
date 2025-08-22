/**
 * VendaBoost Extension - Silent Groups Extractor
 * Extração de grupos usando tabs invisíveis - funcionamento real como FewFeed V2
 */

class SilentGroupsExtractor {
  constructor() {
    this.isExtracting = false;
    this.extractionQueue = [];
    this.extractedGroups = new Map();
    
    // Configuration
    this.config = {
      // Navigation settings
      invisibleTabs: true,
      tabTimeout: 60000,        // 1 minuto por tab
      maxConcurrentTabs: 2,     // Máximo 2 tabs invisíveis
      
      // Extraction settings
      maxScrollAttempts: 15,    // Máximo 15 scrolls
      scrollDelay: 2000,        // 2 segundos entre scrolls
      humanLikeScrolling: true,
      loadMoreDelay: 3000,      // 3 segundos aguardar carregar
      
      // URLs para extração
      extractionUrls: [
        'https://www.facebook.com/groups/feed/',
        'https://www.facebook.com/groups/browse/',
        'https://www.facebook.com/groups/discover/'
      ],
      
      // Anti-detection
      userAgentRotation: false,  // Perigoso em extensões
      randomDelays: true,
      respectRateLimits: true,
      maxExtractionsPerHour: 10,
      
      // Data processing
      deduplication: true,
      dataValidation: true,
      cacheResults: true,
      sendToApi: true
    };
    
    // State tracking
    this.state = {
      lastExtraction: null,
      extractionsToday: 0,
      totalGroups: 0,
      activeTabs: new Set(),
      errors: []
    };
    
    logger.info('SILENT_GROUPS_EXTRACTOR', 'SilentGroupsExtractor initialized');
  }

  /**
   * Main extraction method - creates invisible tabs and extracts groups
   */
  async extractGroupsSilently(userId = null, options = {}) {
    if (this.isExtracting) {
      logger.warn('SILENT_GROUPS_EXTRACTOR', 'Extraction already in progress');
      return { success: false, reason: 'extraction_in_progress' };
    }

    try {
      this.isExtracting = true;
      const startTime = Date.now();
      
      logger.info('SILENT_GROUPS_EXTRACTOR', '🕵️ Starting silent groups extraction', { userId });
      
      // Check rate limits
      if (!this.canExtract()) {
        return { success: false, reason: 'rate_limited' };
      }
      
      // Get target user ID
      const targetUserId = userId || await this.getCurrentUserId();
      if (!targetUserId) {
        throw new Error('No user ID available for extraction');
      }
      
      // Extract groups using invisible tabs
      const results = await this.extractUsingInvisibleTabs(targetUserId);
      
      // Process and validate results
      const processedResults = await this.processExtractionResults(results, targetUserId);
      
      // Cache results
      if (this.config.cacheResults && globalThis.cacheManager) {
        await globalThis.cacheManager.set(
          `groups_${targetUserId}`, 
          processedResults, 
          'groups'
        );
      }
      
      // Send to API if enabled
      if (this.config.sendToApi) {
        await this.sendResultsToApi(processedResults);
      }
      
      // Update state
      this.updateExtractionState(processedResults);
      
      const duration = Date.now() - startTime;
      
      logger.info('SILENT_GROUPS_EXTRACTOR', '✅ Silent extraction completed', {
        userId: targetUserId,
        groupsFound: processedResults.groups?.length || 0,
        duration: `${duration}ms`,
        tabsUsed: results.tabsUsed
      });
      
      return {
        success: true,
        userId: targetUserId,
        groupsCount: processedResults.groups?.length || 0,
        duration,
        extractionId: processedResults.extractionId
      };
      
    } catch (error) {
      logger.error('SILENT_GROUPS_EXTRACTOR', 'Silent extraction failed', null, error);
      
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
      
    } finally {
      this.isExtracting = false;
      await this.cleanupTabs();
    }
  }

  /**
   * Extract groups using invisible tabs
   */
  async extractUsingInvisibleTabs(userId) {
    const allGroups = [];
    const tabsUsed = [];
    
    for (const url of this.config.extractionUrls) {
      try {
        logger.debug('SILENT_GROUPS_EXTRACTOR', `Creating invisible tab for: ${url}`);
        
        // Create invisible tab
        const tab = await this.createInvisibleTab(url);
        tabsUsed.push(tab.id);
        this.state.activeTabs.add(tab.id);
        
        // Wait for tab to load
        await this.waitForTabLoad(tab.id);
        
        // Extract groups from this tab
        const groupsFromTab = await this.extractGroupsFromTab(tab.id);
        
        allGroups.push(...groupsFromTab);
        
        logger.debug('SILENT_GROUPS_EXTRACTOR', `Extracted ${groupsFromTab.length} groups from ${url}`);
        
        // Close tab
        await this.closeTab(tab.id);
        this.state.activeTabs.delete(tab.id);
        
        // Delay between tabs to avoid detection
        if (this.config.randomDelays) {
          const delay = 3000 + Math.random() * 2000; // 3-5 seconds
          await this.delay(delay);
        }
        
      } catch (error) {
        logger.error('SILENT_GROUPS_EXTRACTOR', `Error extracting from ${url}`, null, error);
        this.state.errors.push({ url, error: error.message, timestamp: Date.now() });
      }
    }
    
    return {
      groups: allGroups,
      tabsUsed: tabsUsed.length,
      errors: this.state.errors
    };
  }

  /**
   * Create invisible tab
   */
  async createInvisibleTab(url) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Tab creation timeout'));
      }, 10000);
      
      chrome.tabs.create({
        url: url,
        active: false,  // Invisible tab
        pinned: false
      }, (tab) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          logger.debug('SILENT_GROUPS_EXTRACTOR', `Invisible tab created: ${tab.id}`);
          resolve(tab);
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
      }, this.config.tabTimeout);
      
      const checkLoad = () => {
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError) {
            clearTimeout(timeout);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          if (tab.status === 'complete') {
            clearTimeout(timeout);
            logger.debug('SILENT_GROUPS_EXTRACTOR', `Tab loaded: ${tabId}`);
            resolve();
          } else {
            // Check again in 500ms
            setTimeout(checkLoad, 500);
          }
        });
      };
      
      checkLoad();
    });
  }

  /**
   * Extract groups from specific tab
   */
  async extractGroupsFromTab(tabId) {
    try {
      // Inject extraction script into tab
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: this.extractGroupsFromPage,
        args: [this.config]
      });
      
      if (results && results[0] && results[0].result) {
        return results[0].result;
      }
      
      return [];
      
    } catch (error) {
      logger.error('SILENT_GROUPS_EXTRACTOR', `Error injecting script into tab ${tabId}`, null, error);
      return [];
    }
  }

  /**
   * Function to inject into page for groups extraction
   */
  static extractGroupsFromPage(config) {
    return new Promise(async (resolve) => {
      try {
        console.log('🔍 VendaBoost: Starting groups extraction on page');
        
        const groups = [];
        let scrollAttempts = 0;
        let lastGroupsCount = 0;
        
        // Function to extract groups from current DOM
        const extractCurrentGroups = () => {
          const groupElements = document.querySelectorAll([
            'a[href*="/groups/"][role="link"]',
            '[data-testid*="group"] a',
            'div[role="article"] a[href*="/groups/"]'
          ].join(', '));
          
          const currentGroups = [];
          
          groupElements.forEach(element => {
            try {
              const groupData = {
                id: '',
                name: '',
                url: element.href || '',
                memberCount: 0,
                privacy: 'unknown',
                description: '',
                coverPhoto: '',
                extractedAt: new Date().toISOString()
              };
              
              // Extract group ID from URL
              if (groupData.url) {
                const idMatch = groupData.url.match(/\/groups\/(\d+)/);
                if (idMatch) {
                  groupData.id = idMatch[1];
                } else {
                  const nameMatch = groupData.url.match(/\/groups\/([^\/]+)/);
                  if (nameMatch && nameMatch[1] !== 'feed') {
                    groupData.id = nameMatch[1];
                  }
                }
              }
              
              // Extract name
              const nameElement = element.querySelector('[dir="auto"]') || element;
              groupData.name = nameElement.textContent?.trim() || '';
              
              // Extract member count
              const memberText = element.textContent || '';
              const memberMatch = memberText.match(/(\d+(?:,\d+)*)\s*members?/i);
              if (memberMatch) {
                groupData.memberCount = parseInt(memberMatch[1].replace(/,/g, ''));
              }
              
              // Extract privacy
              if (memberText.includes('Private')) {
                groupData.privacy = 'private';
              } else if (memberText.includes('Public')) {
                groupData.privacy = 'public';
              }
              
              // Extract cover photo
              const imgElement = element.querySelector('img');
              if (imgElement && imgElement.src) {
                groupData.coverPhoto = imgElement.src;
              }
              
              // Only add if has valid ID and name
              if (groupData.id && groupData.name && groupData.name.length > 0) {
                currentGroups.push(groupData);
              }
              
            } catch (error) {
              console.debug('Error extracting group element:', error);
            }
          });
          
          return currentGroups;
        };
        
        // Function to scroll page
        const scrollPage = () => {
          return new Promise((resolve) => {
            const currentScroll = window.pageYOffset;
            const documentHeight = document.body.scrollHeight;
            const viewportHeight = window.innerHeight;
            
            if (config.humanLikeScrolling) {
              // Human-like scrolling
              const scrollDistance = viewportHeight * (0.7 + Math.random() * 0.2);
              const targetScroll = Math.min(currentScroll + scrollDistance, documentHeight - viewportHeight);
              
              window.scrollTo({
                top: targetScroll,
                behavior: 'smooth'
              });
            } else {
              // Simple scroll
              window.scrollBy(0, viewportHeight);
            }
            
            setTimeout(resolve, config.scrollDelay || 2000);
          });
        };
        
        // Initial extraction
        groups.push(...extractCurrentGroups());
        lastGroupsCount = groups.length;
        
        console.log(`🔍 Initial groups found: ${groups.length}`);
        
        // Scroll and extract more groups
        while (scrollAttempts < (config.maxScrollAttempts || 15)) {
          await scrollPage();
          scrollAttempts++;
          
          // Wait for content to load
          await new Promise(resolve => setTimeout(resolve, config.loadMoreDelay || 3000));
          
          // Extract new groups
          const newGroups = extractCurrentGroups();
          
          // Remove duplicates and add new groups
          const uniqueNewGroups = newGroups.filter(newGroup => 
            !groups.some(existingGroup => 
              existingGroup.id === newGroup.id || 
              existingGroup.url === newGroup.url
            )
          );
          
          groups.push(...uniqueNewGroups);
          
          console.log(`🔄 Scroll ${scrollAttempts}: +${uniqueNewGroups.length} new groups (total: ${groups.length})`);
          
          // Stop if no new groups found
          if (uniqueNewGroups.length === 0 && scrollAttempts > 5) {
            console.log('🏁 No more groups found, stopping extraction');
            break;
          }
          
          // Stop if reached bottom
          if (window.pageYOffset + window.innerHeight >= document.body.scrollHeight - 100) {
            console.log('🏁 Reached bottom of page');
            break;
          }
        }
        
        console.log(`✅ Groups extraction completed: ${groups.length} groups found`);
        resolve(groups);
        
      } catch (error) {
        console.error('❌ Groups extraction failed:', error);
        resolve([]);
      }
    });
  }

  /**
   * Process extraction results
   */
  async processExtractionResults(results, userId) {
    const processedData = {
      userId,
      timestamp: new Date().toISOString(),
      extractionId: this.generateExtractionId(),
      groups: results.groups || [],
      
      // Metadata
      tabsUsed: results.tabsUsed || 0,
      errors: results.errors || [],
      
      // Statistics
      totalGroups: results.groups?.length || 0,
      publicGroups: results.groups?.filter(g => g.privacy === 'public').length || 0,
      privateGroups: results.groups?.filter(g => g.privacy === 'private').length || 0,
      
      // Processing info
      processedAt: Date.now(),
      source: 'silent_extraction',
      version: '2.0.0'
    };
    
    // Validate data if validator available
    if (this.config.dataValidation && globalThis.dataValidator) {
      const validation = await globalThis.dataValidator.validate(processedData, 'groups');
      processedData.validation = validation;
      
      if (!validation.isValid) {
        logger.warn('SILENT_GROUPS_EXTRACTOR', 'Validation warnings', {
          errors: validation.errors,
          score: validation.score
        });
      }
    }
    
    // Deduplication
    if (this.config.deduplication) {
      processedData.groups = this.deduplicateGroups(processedData.groups);
    }
    
    return processedData;
  }

  /**
   * Send results to API
   */
  async sendResultsToApi(results) {
    try {
      // Use existing localhost bridge
      if (globalThis.vendaBoostCore) {
        const apiResult = await globalThis.vendaBoostCore.sendToLocalhostServer({
          type: 'facebook_groups',
          data: results,
          timestamp: new Date().toISOString()
        });
        
        if (apiResult.success) {
          logger.info('SILENT_GROUPS_EXTRACTOR', '📡 Groups data sent to API successfully');
        } else {
          logger.warn('SILENT_GROUPS_EXTRACTOR', '⚠️ API send failed', { error: apiResult.error });
        }
        
        return apiResult;
      }
      
    } catch (error) {
      logger.error('SILENT_GROUPS_EXTRACTOR', 'Error sending to API', null, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Close tab safely
   */
  async closeTab(tabId) {
    try {
      await chrome.tabs.remove(tabId);
      logger.debug('SILENT_GROUPS_EXTRACTOR', `Tab closed: ${tabId}`);
    } catch (error) {
      logger.debug('SILENT_GROUPS_EXTRACTOR', `Error closing tab ${tabId}:`, error);
    }
  }

  /**
   * Cleanup all active tabs
   */
  async cleanupTabs() {
    const tabsToClose = Array.from(this.state.activeTabs);
    
    for (const tabId of tabsToClose) {
      await this.closeTab(tabId);
      this.state.activeTabs.delete(tabId);
    }
    
    if (tabsToClose.length > 0) {
      logger.debug('SILENT_GROUPS_EXTRACTOR', `Cleaned up ${tabsToClose.length} tabs`);
    }
  }

  /**
   * Check if extraction is allowed (rate limiting)
   */
  canExtract() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    // Reset daily counter at midnight
    const today = new Date().toDateString();
    const lastExtractionDate = this.state.lastExtraction 
      ? new Date(this.state.lastExtraction).toDateString()
      : null;
    
    if (lastExtractionDate !== today) {
      this.state.extractionsToday = 0;
    }
    
    // Check hourly limit
    if (this.state.lastExtraction) {
      const timeSinceLastExtraction = now - this.state.lastExtraction;
      if (timeSinceLastExtraction < oneHour && 
          this.state.extractionsToday >= this.config.maxExtractionsPerHour) {
        logger.warn('SILENT_GROUPS_EXTRACTOR', 'Rate limit exceeded', {
          extractionsToday: this.state.extractionsToday,
          maxPerHour: this.config.maxExtractionsPerHour
        });
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get current user ID from background
   */
  async getCurrentUserId() {
    try {
      // Get from background script
      if (globalThis.vendaBoostCore?.sessionData?.userId) {
        return globalThis.vendaBoostCore.sessionData.userId;
      }
      
      // Try to get from cookies
      const cookies = await globalThis.vendaBoostCore?.extractFacebookCookies();
      if (cookies) {
        const cUserCookie = cookies.find(c => c.name === 'c_user');
        if (cUserCookie) {
          return cUserCookie.value;
        }
      }
      
      return null;
    } catch (error) {
      logger.error('SILENT_GROUPS_EXTRACTOR', 'Error getting user ID', null, error);
      return null;
    }
  }

  /**
   * Deduplicate groups
   */
  deduplicateGroups(groups) {
    const seen = new Set();
    const unique = [];
    
    for (const group of groups) {
      const key = group.id || group.url || group.name;
      if (key && !seen.has(key)) {
        seen.add(key);
        unique.push(group);
      }
    }
    
    logger.debug('SILENT_GROUPS_EXTRACTOR', 'Deduplication completed', {
      original: groups.length,
      unique: unique.length,
      duplicatesRemoved: groups.length - unique.length
    });
    
    return unique;
  }

  /**
   * Update extraction state
   */
  updateExtractionState(results) {
    this.state.lastExtraction = Date.now();
    this.state.extractionsToday++;
    this.state.totalGroups += results.groups?.length || 0;
    
    // Store in extracted groups map
    if (results.userId && results.groups) {
      this.extractedGroups.set(results.userId, {
        groups: results.groups,
        timestamp: results.timestamp,
        extractionId: results.extractionId
      });
    }
  }

  /**
   * Utility methods
   */
  generateExtractionId() {
    return `silent_groups_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Public interface methods
   */
  async getExtractedGroups(userId) {
    return this.extractedGroups.get(userId) || null;
  }

  getExtractionStats() {
    return {
      isExtracting: this.isExtracting,
      lastExtraction: this.state.lastExtraction,
      extractionsToday: this.state.extractionsToday,
      totalGroups: this.state.totalGroups,
      activeTabs: this.state.activeTabs.size,
      errorsCount: this.state.errors.length,
      cachedUsers: this.extractedGroups.size
    };
  }

  async forceExtraction(userId, options = {}) {
    // Force extraction bypassing rate limits
    const originalCanExtract = this.canExtract;
    this.canExtract = () => true;
    
    try {
      return await this.extractGroupsSilently(userId, { ...options, force: true });
    } finally {
      this.canExtract = originalCanExtract;
    }
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('SILENT_GROUPS_EXTRACTOR', 'Configuration updated', newConfig);
  }

  clearCache() {
    this.extractedGroups.clear();
    this.state.errors = [];
    logger.info('SILENT_GROUPS_EXTRACTOR', 'Cache cleared');
  }

  async emergencyCleanup() {
    // Emergency cleanup in case of errors
    await this.cleanupTabs();
    this.isExtracting = false;
    
    logger.warn('SILENT_GROUPS_EXTRACTOR', 'Emergency cleanup performed');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SilentGroupsExtractor;
} else {
  globalThis.SilentGroupsExtractor = SilentGroupsExtractor;
}