/**
 * VendaBoost Extension - Groups Data Extractor
 * Especializado na extração de dados de grupos do Facebook
 */

class GroupsExtractor {
  constructor() {
    this.extractionAttempts = 0;
    this.maxRetries = 3;
    this.lastExtractionTime = null;
    this.cachedGroups = new Map(); // Cache por userId
    
    // Configuration
    this.config = {
      minExtractionInterval: 10 * 60 * 1000,    // 10 minutos
      maxGroupsAge: 60 * 60 * 1000,             // 1 hora
      retryDelay: 5000,                         // 5 segundos
      navigationTimeout: 20000,                 // 20 segundos
      scrollDelay: 2000,                        // 2 segundos entre scrolls
      maxScrollAttempts: 10,                    // Máximo 10 scrolls
      
      // Extraction strategies
      strategies: {
        domScraping: true,           // DOM scraping (mais seguro)
        graphqlInterception: false,  // GraphQL interception (mais arriscado)
        searchBased: true,           // Busca por grupos
        navigationBased: true        // Navegação por páginas
      },
      
      // Data types to extract
      extractTypes: {
        userGroups: true,          // Grupos do usuário
        groupDetails: true,        // Detalhes dos grupos
        membershipInfo: true,      // Info de participação
        activityLevel: true,       // Nível de atividade
        adminInfo: false,          // Info de admins (pode ser sensível)
        recentPosts: false         // Posts recentes (pesado)
      },
      
      // Anti-detection
      humanLikeScrolling: true,
      randomDelays: true,
      respectRateLimits: true
    };
    
    logger.info('GROUPS_EXTRACTOR', 'GroupsExtractor initialized');
  }

  /**
   * Main groups extraction method
   */
  async extractGroups(userId = null, options = {}) {
    const startTime = performance.now();
    logger.startTimer('groupsExtraction');
    
    try {
      // Validate extraction conditions
      if (!this.shouldExtract(userId, options.force)) {
        return this.getCachedGroups(userId);
      }

      logger.info('GROUPS_EXTRACTOR', '👥 Starting groups extraction', { userId });
      this.extractionAttempts++;

      // Determine target user
      const targetUserId = userId || await this.getCurrentUserId();
      if (!targetUserId) {
        throw new Error('No user ID provided and unable to detect current user');
      }

      // Choose extraction strategy
      const strategy = this.selectExtractionStrategy();
      logger.info('GROUPS_EXTRACTOR', `Using extraction strategy: ${strategy}`);

      // Perform extraction based on strategy
      let groupsData;
      switch (strategy) {
        case 'navigation':
          groupsData = await this.extractViaNavigation(targetUserId);
          break;
        case 'search':
          groupsData = await this.extractViaSearch(targetUserId);
          break;
        case 'graphql':
          groupsData = await this.extractViaGraphQL(targetUserId);
          break;
        default:
          groupsData = await this.extractViaDomScraping(targetUserId);
      }

      // Post-process and validate
      const processedData = await this.processGroupsData(groupsData, targetUserId);
      const validatedData = await this.validateGroupsData(processedData);

      if (!validatedData.isValid) {
        logger.warn('GROUPS_EXTRACTOR', 'Groups validation warnings', {
          errors: validatedData.errors,
          score: validatedData.score
        });
      }

      // Cache and return
      this.cacheGroups(targetUserId, processedData);
      this.lastExtractionTime = Date.now();
      
      const duration = logger.endTimer('groupsExtraction', 'GROUPS_EXTRACTOR');
      logger.info('GROUPS_EXTRACTOR', '✅ Groups extraction completed', {
        userId: targetUserId,
        groupsCount: processedData.groups?.length || 0,
        strategy: strategy,
        duration: `${duration.toFixed(2)}ms`,
        attempts: this.extractionAttempts
      });

      return processedData;

    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('GROUPS_EXTRACTOR', 'Groups extraction failed', {
        userId,
        attempts: this.extractionAttempts,
        duration: `${duration.toFixed(2)}ms`,
        error: error.message
      }, error);

      // Retry logic
      if (this.extractionAttempts < this.maxRetries && !options.noRetry) {
        logger.info('GROUPS_EXTRACTOR', `Retrying extraction (${this.extractionAttempts}/${this.maxRetries})`);
        
        await this.delay(this.config.retryDelay * this.extractionAttempts);
        return await this.extractGroups(userId, { ...options, noRetry: false });
      }

      throw error;
    }
  }

  /**
   * Check if extraction should proceed
   */
  shouldExtract(userId, force = false) {
    if (force) return true;

    // Check minimum interval
    if (this.lastExtractionTime) {
      const timeSinceLastExtraction = Date.now() - this.lastExtractionTime;
      if (timeSinceLastExtraction < this.config.minExtractionInterval) {
        logger.debug('GROUPS_EXTRACTOR', 'Extraction skipped - too soon');
        return false;
      }
    }

    // Check if cached groups are still valid
    const cachedGroups = this.getCachedGroups(userId);
    if (cachedGroups && this.areGroupsFresh(cachedGroups)) {
      logger.debug('GROUPS_EXTRACTOR', 'Using cached groups - still fresh');
      return false;
    }

    return true;
  }

  /**
   * Select best extraction strategy
   */
  selectExtractionStrategy() {
    // Choose strategy based on current page and configuration
    const currentUrl = window.location.href;
    
    if (currentUrl.includes('/groups/feed/') && this.config.strategies.navigationBased) {
      return 'navigation';
    }
    
    if (this.config.strategies.searchBased) {
      return 'search';
    }
    
    if (this.config.strategies.graphqlInterception) {
      return 'graphql';
    }
    
    return 'dom_scraping';
  }

  /**
   * Extract groups via navigation method
   */
  async extractViaNavigation(userId) {
    logger.info('GROUPS_EXTRACTOR', 'Starting navigation-based extraction');
    
    try {
      // Navigate to groups page
      const navigationResult = await this.navigateToGroupsPage();
      if (!navigationResult.success) {
        throw new Error(`Navigation failed: ${navigationResult.error}`);
      }

      // Wait for page to load
      await this.waitForGroupsPageLoad();

      // Scroll to load all groups
      const scrollResult = await this.scrollToLoadAllGroups();
      
      // Extract groups from DOM
      const groups = await this.extractGroupsFromDOM();
      
      return {
        groups,
        strategy: 'navigation',
        scrollAttempts: scrollResult.attempts,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Navigation extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract groups via search method
   */
  async extractViaSearch(userId) {
    logger.info('GROUPS_EXTRACTOR', 'Starting search-based extraction');
    
    try {
      // This is a fallback method - search for user's public groups
      const searchResults = await this.searchUserGroups(userId);
      
      return {
        groups: searchResults,
        strategy: 'search',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Search extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract groups via GraphQL interception
   */
  async extractViaGraphQL(userId) {
    logger.info('GROUPS_EXTRACTOR', 'Starting GraphQL-based extraction');
    
    try {
      // Monitor GraphQL requests for groups data
      const graphqlData = await this.interceptGraphQLRequests();
      
      return {
        groups: graphqlData,
        strategy: 'graphql',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`GraphQL extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract groups via DOM scraping
   */
  async extractViaDomScraping(userId) {
    logger.info('GROUPS_EXTRACTOR', 'Starting DOM scraping extraction');
    
    try {
      // Extract from current page
      const groups = await this.extractGroupsFromCurrentPage();
      
      return {
        groups,
        strategy: 'dom_scraping',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`DOM scraping failed: ${error.message}`);
    }
  }

  /**
   * Navigate to groups page
   */
  async navigateToGroupsPage() {
    try {
      const targetUrl = 'https://www.facebook.com/groups/feed/';
      const currentUrl = window.location.href;
      
      if (currentUrl.includes('/groups/feed/')) {
        logger.debug('GROUPS_EXTRACTOR', 'Already on groups page');
        return { success: true };
      }

      // Navigate using invisible tab or direct navigation
      logger.debug('GROUPS_EXTRACTOR', 'Navigating to groups page');
      
      // For now, use direct navigation (can be enhanced with invisible tabs)
      window.location.href = targetUrl;
      
      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Wait for groups page to load
   */
  async waitForGroupsPageLoad() {
    const maxWaitTime = this.config.navigationTimeout;
    const checkInterval = 500;
    let waitTime = 0;

    while (waitTime < maxWaitTime) {
      if (this.isGroupsPageLoaded()) {
        logger.debug('GROUPS_EXTRACTOR', 'Groups page loaded successfully');
        return true;
      }

      await this.delay(checkInterval);
      waitTime += checkInterval;
    }

    throw new Error('Groups page load timeout');
  }

  /**
   * Check if groups page is loaded
   */
  isGroupsPageLoaded() {
    const groupsPageIndicators = [
      '[data-pagelet="GroupsDiscover"]',
      '[data-pagelet="GroupsSidebar"]',
      'div[role="main"] div[data-pagelet]',
      'a[href*="/groups/"]'
    ];

    return groupsPageIndicators.some(selector => document.querySelector(selector));
  }

  /**
   * Scroll to load all groups
   */
  async scrollToLoadAllGroups() {
    let scrollAttempts = 0;
    let lastGroupsCount = 0;
    
    while (scrollAttempts < this.config.maxScrollAttempts) {
      // Count current groups
      const currentGroupsCount = this.countVisibleGroups();
      
      // If no new groups loaded, we're done
      if (currentGroupsCount === lastGroupsCount && scrollAttempts > 2) {
        logger.debug('GROUPS_EXTRACTOR', 'No new groups loaded, stopping scroll');
        break;
      }
      
      lastGroupsCount = currentGroupsCount;
      
      // Scroll down
      await this.performHumanLikeScroll();
      scrollAttempts++;
      
      // Wait for content to load
      await this.delay(this.config.scrollDelay);
      
      logger.debug('GROUPS_EXTRACTOR', `Scroll attempt ${scrollAttempts}, groups visible: ${currentGroupsCount}`);
    }
    
    return { attempts: scrollAttempts, groupsLoaded: lastGroupsCount };
  }

  /**
   * Count visible groups on page
   */
  countVisibleGroups() {
    const groupSelectors = [
      'a[href*="/groups/"]',
      '[data-testid*="group"]',
      'div[role="article"]'
    ];
    
    let count = 0;
    for (const selector of groupSelectors) {
      const elements = document.querySelectorAll(selector);
      count = Math.max(count, elements.length);
    }
    
    return count;
  }

  /**
   * Perform human-like scrolling
   */
  async performHumanLikeScroll() {
    if (!this.config.humanLikeScrolling) {
      window.scrollTo(0, document.body.scrollHeight);
      return;
    }

    // Human-like scrolling with random variations
    const currentScroll = window.pageYOffset;
    const documentHeight = document.body.scrollHeight;
    const viewportHeight = window.innerHeight;
    
    // Calculate scroll distance (70-90% of viewport)
    const scrollDistance = viewportHeight * (0.7 + Math.random() * 0.2);
    const targetScroll = Math.min(currentScroll + scrollDistance, documentHeight - viewportHeight);
    
    // Smooth scroll with slight randomness
    const scrollSteps = 5 + Math.floor(Math.random() * 5);
    const stepSize = (targetScroll - currentScroll) / scrollSteps;
    
    for (let i = 0; i < scrollSteps; i++) {
      const nextPosition = currentScroll + (stepSize * (i + 1));
      window.scrollTo(0, nextPosition);
      
      // Random small delay between steps
      if (this.config.randomDelays) {
        await this.delay(50 + Math.random() * 100);
      }
    }
  }

  /**
   * Extract groups from DOM
   */
  async extractGroupsFromDOM() {
    const groups = [];
    
    try {
      // Multiple selectors to find group elements
      const groupSelectors = [
        'a[href*="/groups/"][role="link"]',
        '[data-testid*="group"] a',
        'div[role="article"] a[href*="/groups/"]'
      ];
      
      let groupElements = [];
      for (const selector of groupSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > groupElements.length) {
          groupElements = Array.from(elements);
        }
      }
      
      logger.debug('GROUPS_EXTRACTOR', `Found ${groupElements.length} group elements`);
      
      // Extract data from each group element
      for (const element of groupElements) {
        try {
          const groupData = await this.extractGroupDataFromElement(element);
          if (groupData && groupData.id) {
            groups.push(groupData);
          }
        } catch (error) {
          logger.debug('GROUPS_EXTRACTOR', 'Error extracting group element', null, error);
        }
      }
      
      // Remove duplicates
      const uniqueGroups = this.removeDuplicateGroups(groups);
      
      logger.info('GROUPS_EXTRACTOR', `Extracted ${uniqueGroups.length} unique groups`);
      
      return uniqueGroups;

    } catch (error) {
      logger.error('GROUPS_EXTRACTOR', 'Error extracting groups from DOM', null, error);
      return groups;
    }
  }

  /**
   * Extract group data from a single element
   */
  async extractGroupDataFromElement(element) {
    try {
      const groupData = {
        id: '',
        name: '',
        url: '',
        memberCount: 0,
        privacy: 'unknown',
        description: '',
        coverPhoto: '',
        category: '',
        joinDate: '',
        activityLevel: 'unknown',
        extractedAt: new Date().toISOString()
      };

      // Extract basic info
      groupData.url = element.href || '';
      groupData.id = this.extractGroupIdFromUrl(groupData.url);
      
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
      
      // Extract description (if visible)
      const descElement = element.parentElement?.querySelector('[data-testid="group-description"]');
      if (descElement) {
        groupData.description = descElement.textContent?.trim() || '';
      }

      return groupData;

    } catch (error) {
      logger.debug('GROUPS_EXTRACTOR', 'Error extracting group data from element', null, error);
      return null;
    }
  }

  /**
   * Extract group ID from URL
   */
  extractGroupIdFromUrl(url) {
    if (!url) return '';
    
    try {
      const urlObj = new URL(url);
      
      // Pattern 1: /groups/123456789/
      const idMatch = urlObj.pathname.match(/\/groups\/(\d+)/);
      if (idMatch) {
        return idMatch[1];
      }
      
      // Pattern 2: /groups/groupname/
      const nameMatch = urlObj.pathname.match(/\/groups\/([^\/]+)/);
      if (nameMatch && nameMatch[1] !== 'feed') {
        return nameMatch[1];
      }
      
      return '';
    } catch (error) {
      return '';
    }
  }

  /**
   * Remove duplicate groups
   */
  removeDuplicateGroups(groups) {
    const seen = new Set();
    return groups.filter(group => {
      const key = group.id || group.url;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Extract groups from current page (fallback method)
   */
  async extractGroupsFromCurrentPage() {
    // Simplified extraction for current page
    const groups = [];
    
    const groupLinks = document.querySelectorAll('a[href*="/groups/"]');
    
    for (const link of groupLinks) {
      const groupData = await this.extractGroupDataFromElement(link);
      if (groupData && groupData.id) {
        groups.push(groupData);
      }
    }
    
    return this.removeDuplicateGroups(groups);
  }

  /**
   * Search user groups (placeholder)
   */
  async searchUserGroups(userId) {
    // TODO: Implement search-based group discovery
    logger.debug('GROUPS_EXTRACTOR', 'Search-based extraction not yet implemented');
    return [];
  }

  /**
   * Intercept GraphQL requests (placeholder)
   */
  async interceptGraphQLRequests() {
    // TODO: Implement GraphQL interception
    logger.debug('GROUPS_EXTRACTOR', 'GraphQL interception not yet implemented');
    return [];
  }

  /**
   * Get current user ID
   */
  async getCurrentUserId() {
    try {
      const cUserCookie = document.cookie.split(';').find(c => c.trim().startsWith('c_user='));
      if (cUserCookie) {
        return cUserCookie.split('=')[1].trim();
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Process groups data
   */
  async processGroupsData(rawData, userId) {
    const processedData = {
      ...rawData,
      userId: userId,
      version: '2.0.0',
      extractionId: this.generateExtractionId(),
      
      // Add computed fields
      totalGroups: rawData.groups?.length || 0,
      publicGroups: rawData.groups?.filter(g => g.privacy === 'public').length || 0,
      privateGroups: rawData.groups?.filter(g => g.privacy === 'private').length || 0,
      
      // Statistics
      averageGroupSize: this.calculateAverageGroupSize(rawData.groups),
      largestGroup: this.findLargestGroup(rawData.groups),
      categories: this.categorizeGroups(rawData.groups),
      
      // Processing metadata
      processingTime: Date.now(),
      extractorVersion: '2.0.0'
    };

    return processedData;
  }

  /**
   * Validate groups data
   */
  async validateGroupsData(groupsData) {
    const errors = [];
    const warnings = [];

    // Required fields validation
    if (!groupsData.userId) {
      errors.push('User ID missing');
    }

    if (!groupsData.groups || !Array.isArray(groupsData.groups)) {
      errors.push('Groups array missing or invalid');
    }

    if (!groupsData.timestamp) {
      errors.push('Timestamp missing');
    }

    // Data quality checks
    if (groupsData.groups && groupsData.groups.length === 0) {
      warnings.push('No groups found');
    }

    if (groupsData.groups) {
      const groupsWithoutId = groupsData.groups.filter(g => !g.id);
      if (groupsWithoutId.length > 0) {
        warnings.push(`${groupsWithoutId.length} groups without ID`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: this.calculateValidationScore(groupsData, errors, warnings)
    };
  }

  // Utility methods
  calculateAverageGroupSize(groups) {
    if (!groups || groups.length === 0) return 0;
    
    const totalMembers = groups.reduce((sum, group) => sum + (group.memberCount || 0), 0);
    return Math.round(totalMembers / groups.length);
  }

  findLargestGroup(groups) {
    if (!groups || groups.length === 0) return null;
    
    return groups.reduce((largest, group) => {
      return (group.memberCount || 0) > (largest.memberCount || 0) ? group : largest;
    });
  }

  categorizeGroups(groups) {
    if (!groups) return {};
    
    const categories = {};
    groups.forEach(group => {
      const category = group.category || 'unknown';
      categories[category] = (categories[category] || 0) + 1;
    });
    
    return categories;
  }

  calculateValidationScore(data, errors, warnings) {
    let score = 1.0;
    score -= (errors.length * 0.3);
    score -= (warnings.length * 0.1);
    return Math.max(0, Math.min(1, score));
  }

  generateExtractionId() {
    return `groups_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  areGroupsFresh(groupsData) {
    if (!groupsData?.timestamp) return false;
    const age = Date.now() - new Date(groupsData.timestamp).getTime();
    return age < this.config.maxGroupsAge;
  }

  cacheGroups(userId, groupsData) {
    this.cachedGroups.set(userId, {
      ...groupsData,
      cachedAt: Date.now()
    });
  }

  getCachedGroups(userId) {
    const cached = this.cachedGroups.get(userId);
    if (cached && this.areGroupsFresh(cached)) {
      logger.debug('GROUPS_EXTRACTOR', 'Returning cached groups');
      return cached;
    }
    return null;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Public interface methods
   */
  async getGroupsData(userId = null, force = false) {
    return await this.extractGroups(userId, { force });
  }

  clearCache(userId = null) {
    if (userId) {
      this.cachedGroups.delete(userId);
    } else {
      this.cachedGroups.clear();
    }
    this.lastExtractionTime = null;
    logger.info('GROUPS_EXTRACTOR', 'Cache cleared', { userId });
  }

  getExtractionStats() {
    return {
      attempts: this.extractionAttempts,
      lastExtraction: this.lastExtractionTime,
      cachedUsers: this.cachedGroups.size,
      cacheKeys: Array.from(this.cachedGroups.keys())
    };
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('GROUPS_EXTRACTOR', 'Configuration updated', newConfig);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GroupsExtractor;
} else {
  globalThis.GroupsExtractor = GroupsExtractor;
}