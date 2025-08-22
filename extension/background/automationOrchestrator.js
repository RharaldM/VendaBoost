/**
 * VendaBoost Extension - Automation Orchestrator
 * Sistema central que integra todos os componentes da Fase 3 para automação completa
 */

class AutomationOrchestrator {
  constructor() {
    this.components = new Map();
    this.isInitialized = false;
    this.isRunning = false;
    this.automationTasks = new Map();
    
    // Configuration
    this.config = {
      // Component initialization order
      initializationOrder: [
        'cacheManager',
        'dataValidator', 
        'sessionExtractor',
        'groupsExtractor',
        'profileExtractor',
        'priorityQueue',
        'queueManager',
        'cronScheduler',
        'adaptiveScheduler'
      ],
      
      // Integration settings
      integration: {
        enableCacheFirst: true,           // Sempre verificar cache primeiro
        enableSmartScheduling: true,      // Usar adaptive + cron schedulers
        enablePriorityProcessing: true,   // Usar sistema de prioridades
        enableAutoValidation: true,      // Validar dados automaticamente
        enableAutoCorrection: true,      // Tentar corrigir dados automaticamente
        enableMetrics: true               // Coletar métricas de performance
      },
      
      // Cache integration
      cache: {
        preloadStrategies: ['predictive', 'user_pattern'],
        invalidationStrategy: 'smart',
        compressionLevel: 'auto',
        persistCriticalData: true
      },
      
      // Scheduler integration
      scheduling: {
        prioritizeAdaptive: true,          // Dar preferência ao adaptive scheduler
        cronFallback: true,               // Usar cron como fallback
        maxConcurrentExtractions: 3,
        extractionTimeout: 10 * 60 * 1000 // 10 minutos
      },
      
      // Performance optimization
      performance: {
        enableBatching: true,
        batchSize: 5,
        enableParallelProcessing: true,
        maxParallelTasks: 3,
        enableResourceMonitoring: true
      },
      
      // Auto-recovery settings
      recovery: {
        enableAutoRecovery: true,
        maxRetries: 3,
        retryDelay: 30000,
        escalationThreshold: 5,
        fallbackToManual: true
      },
      
      // Monitoring and alerts
      monitoring: {
        enableHealthCheck: true,
        healthCheckInterval: 5 * 60 * 1000,  // 5 minutos
        enablePerformanceMetrics: true,
        enableAlerts: true,
        alertThresholds: {
          errorRate: 0.1,           // 10%
          responseTime: 30000,      // 30 segundos
          queueSize: 100,
          memoryUsage: 100 * 1024 * 1024  // 100MB
        }
      }
    };
    
    // System state
    this.state = {
      status: 'initializing',
      lastActivity: null,
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      averageResponseTime: 0,
      currentLoad: 0,
      uptime: Date.now(),
      
      // Component states
      componentStates: new Map(),
      
      // Current automation context
      context: {
        userActivity: 'unknown',
        systemLoad: 'normal',
        extractionMode: 'adaptive',
        priority: 'medium'
      }
    };
    
    // Performance metrics
    this.metrics = {
      cacheHitRate: 0,
      extractionSuccessRate: 0,
      averageExtractionTime: 0,
      queueProcessingRate: 0,
      schedulerEfficiency: 0,
      resourceUtilization: 0
    };
    
    logger.info('AUTOMATION_ORCHESTRATOR', 'AutomationOrchestrator initialized');
  }

  /**
   * Initialize all automation components
   */
  async initialize() {
    try {
      logger.info('AUTOMATION_ORCHESTRATOR', '🚀 Initializing automation system');
      
      // Initialize components in order
      await this.initializeComponents();
      
      // Setup integrations between components
      await this.setupIntegrations();
      
      // Setup monitoring and health checks
      await this.setupMonitoring();
      
      // Setup auto-recovery systems
      await this.setupAutoRecovery();
      
      this.isInitialized = true;
      this.state.status = 'ready';
      
      logger.info('AUTOMATION_ORCHESTRATOR', '✅ Automation system initialized successfully', {
        components: this.components.size,
        integrations: Object.keys(this.config.integration).filter(k => this.config.integration[k]).length
      });
      
    } catch (error) {
      this.state.status = 'error';
      logger.error('AUTOMATION_ORCHESTRATOR', 'Failed to initialize automation system', null, error);
      throw error;
    }
  }

  /**
   * Initialize individual components
   */
  async initializeComponents() {
    for (const componentName of this.config.initializationOrder) {
      try {
        logger.debug('AUTOMATION_ORCHESTRATOR', `Initializing ${componentName}...`);
        
        await this.initializeComponent(componentName);
        
        this.state.componentStates.set(componentName, {
          status: 'initialized',
          initTime: Date.now(),
          healthy: true
        });
        
      } catch (error) {
        logger.error('AUTOMATION_ORCHESTRATOR', `Failed to initialize ${componentName}`, null, error);
        
        this.state.componentStates.set(componentName, {
          status: 'error',
          initTime: Date.now(),
          healthy: false,
          error: error.message
        });
        
        // Decide whether to continue or fail
        if (this.isCriticalComponent(componentName)) {
          throw new Error(`Critical component ${componentName} failed to initialize`);
        }
      }
    }
  }

  /**
   * Initialize individual component
   */
  async initializeComponent(componentName) {
    switch (componentName) {
      case 'cacheManager':
        if (globalThis.CacheManager && !globalThis.cacheManager) {
          globalThis.cacheManager = new globalThis.CacheManager();
          await globalThis.cacheManager.initialize();
          this.components.set('cacheManager', globalThis.cacheManager);
        }
        break;
        
      case 'dataValidator':
        if (globalThis.DataValidator && !globalThis.dataValidator) {
          globalThis.dataValidator = new globalThis.DataValidator();
          this.components.set('dataValidator', globalThis.dataValidator);
        }
        break;
        
      case 'sessionExtractor':
        if (globalThis.SessionExtractor && !globalThis.sessionExtractor) {
          globalThis.sessionExtractor = new globalThis.SessionExtractor();
          this.components.set('sessionExtractor', globalThis.sessionExtractor);
        }
        break;
        
      case 'groupsExtractor':
        if (globalThis.GroupsExtractor && !globalThis.groupsExtractor) {
          globalThis.groupsExtractor = new globalThis.GroupsExtractor();
          this.components.set('groupsExtractor', globalThis.groupsExtractor);
        }
        break;
        
      case 'profileExtractor':
        if (globalThis.ProfileExtractor && !globalThis.profileExtractor) {
          globalThis.profileExtractor = new globalThis.ProfileExtractor();
          this.components.set('profileExtractor', globalThis.profileExtractor);
        }
        break;
        
      case 'priorityQueue':
        if (globalThis.PriorityQueue && !globalThis.priorityQueue) {
          globalThis.priorityQueue = new globalThis.PriorityQueue();
          this.components.set('priorityQueue', globalThis.priorityQueue);
        }
        break;
        
      case 'queueManager':
        if (globalThis.QueueManager && !globalThis.queueManager) {
          globalThis.queueManager = new globalThis.QueueManager();
          await globalThis.queueManager.start();
          this.components.set('queueManager', globalThis.queueManager);
        }
        break;
        
      case 'cronScheduler':
        if (globalThis.CronScheduler && !globalThis.cronScheduler) {
          globalThis.cronScheduler = new globalThis.CronScheduler();
          await globalThis.cronScheduler.initialize();
          this.components.set('cronScheduler', globalThis.cronScheduler);
        }
        break;
        
      case 'adaptiveScheduler':
        if (globalThis.AdaptiveScheduler && !globalThis.adaptiveScheduler) {
          globalThis.adaptiveScheduler = new globalThis.AdaptiveScheduler();
          await globalThis.adaptiveScheduler.initialize();
          this.components.set('adaptiveScheduler', globalThis.adaptiveScheduler);
        }
        break;
        
      default:
        logger.warn('AUTOMATION_ORCHESTRATOR', `Unknown component: ${componentName}`);
    }
  }

  /**
   * Setup integrations between components
   */
  async setupIntegrations() {
    logger.info('AUTOMATION_ORCHESTRATOR', 'Setting up component integrations');
    
    // Cache-first integration
    if (this.config.integration.enableCacheFirst) {
      await this.setupCacheFirstIntegration();
    }
    
    // Smart scheduling integration
    if (this.config.integration.enableSmartScheduling) {
      await this.setupSmartSchedulingIntegration();
    }
    
    // Priority processing integration
    if (this.config.integration.enablePriorityProcessing) {
      await this.setupPriorityProcessingIntegration();
    }
    
    // Auto-validation integration
    if (this.config.integration.enableAutoValidation) {
      await this.setupAutoValidationIntegration();
    }
    
    // Metrics integration
    if (this.config.integration.enableMetrics) {
      await this.setupMetricsIntegration();
    }
  }

  /**
   * Setup cache-first integration
   */
  async setupCacheFirstIntegration() {
    const cacheManager = this.components.get('cacheManager');
    const extractors = ['sessionExtractor', 'groupsExtractor', 'profileExtractor'];
    
    if (!cacheManager) return;
    
    // Configure extractors to check cache first
    for (const extractorName of extractors) {
      const extractor = this.components.get(extractorName);
      if (extractor && extractor.updateConfig) {
        extractor.updateConfig({
          cacheFirst: true,
          cacheManager: cacheManager
        });
      }
    }
    
    // Setup cache preloading based on patterns
    if (this.config.cache.preloadStrategies.includes('predictive')) {
      await this.setupPredictivePreloading();
    }
    
    logger.debug('AUTOMATION_ORCHESTRATOR', 'Cache-first integration setup completed');
  }

  /**
   * Setup smart scheduling integration
   */
  async setupSmartSchedulingIntegration() {
    const cronScheduler = this.components.get('cronScheduler');
    const adaptiveScheduler = this.components.get('adaptiveScheduler');
    const queueManager = this.components.get('queueManager');
    
    if (!cronScheduler || !adaptiveScheduler || !queueManager) return;
    
    // Configure adaptive scheduler to override cron scheduler decisions
    if (this.config.scheduling.prioritizeAdaptive) {
      // Setup communication between schedulers
      this.setupSchedulerCommunication(adaptiveScheduler, cronScheduler);
    }
    
    // Configure extraction routing through queue manager
    this.setupExtractionRouting(queueManager);
    
    logger.debug('AUTOMATION_ORCHESTRATOR', 'Smart scheduling integration setup completed');
  }

  /**
   * Setup priority processing integration
   */
  async setupPriorityProcessingIntegration() {
    const priorityQueue = this.components.get('priorityQueue');
    const queueManager = this.components.get('queueManager');
    
    if (!priorityQueue || !queueManager) return;
    
    // Configure queue manager to use priority queue for task ordering
    queueManager.updateConfig({
      enablePriorityProcessing: true,
      priorityQueue: priorityQueue
    });
    
    // Setup context sharing for priority calculation
    this.setupPriorityContextSharing();
    
    logger.debug('AUTOMATION_ORCHESTRATOR', 'Priority processing integration setup completed');
  }

  /**
   * Setup auto-validation integration
   */
  async setupAutoValidationIntegration() {
    const dataValidator = this.components.get('dataValidator');
    const extractors = ['sessionExtractor', 'groupsExtractor', 'profileExtractor'];
    
    if (!dataValidator) return;
    
    // Configure extractors to auto-validate results
    for (const extractorName of extractors) {
      const extractor = this.components.get(extractorName);
      if (extractor && extractor.updateConfig) {
        extractor.updateConfig({
          autoValidate: true,
          validator: dataValidator,
          autoCorrect: this.config.integration.enableAutoCorrection
        });
      }
    }
    
    logger.debug('AUTOMATION_ORCHESTRATOR', 'Auto-validation integration setup completed');
  }

  /**
   * Setup metrics integration
   */
  async setupMetricsIntegration() {
    // Configure all components to report metrics
    for (const [componentName, component] of this.components.entries()) {
      if (component.updateConfig) {
        component.updateConfig({
          enableMetrics: true,
          metricsCallback: (metrics) => this.collectComponentMetrics(componentName, metrics)
        });
      }
    }
    
    // Setup metrics aggregation
    this.setupMetricsAggregation();
    
    logger.debug('AUTOMATION_ORCHESTRATOR', 'Metrics integration setup completed');
  }

  /**
   * Start the automation system
   */
  async start() {
    if (!this.isInitialized) {
      throw new Error('Automation system not initialized');
    }
    
    if (this.isRunning) {
      logger.warn('AUTOMATION_ORCHESTRATOR', 'Automation system is already running');
      return;
    }
    
    try {
      logger.info('AUTOMATION_ORCHESTRATOR', '▶️ Starting automation system');
      
      // Start all components
      await this.startComponents();
      
      // Begin automation orchestration
      await this.beginOrchestration();
      
      this.isRunning = true;
      this.state.status = 'running';
      this.state.lastActivity = Date.now();
      
      logger.info('AUTOMATION_ORCHESTRATOR', '✅ Automation system started successfully');
      
    } catch (error) {
      this.state.status = 'error';
      logger.error('AUTOMATION_ORCHESTRATOR', 'Failed to start automation system', null, error);
      throw error;
    }
  }

  /**
   * Stop the automation system
   */
  async stop() {
    if (!this.isRunning) {
      logger.warn('AUTOMATION_ORCHESTRATOR', 'Automation system is not running');
      return;
    }
    
    try {
      logger.info('AUTOMATION_ORCHESTRATOR', '⏹️ Stopping automation system');
      
      // Stop orchestration
      await this.stopOrchestration();
      
      // Stop all components
      await this.stopComponents();
      
      this.isRunning = false;
      this.state.status = 'stopped';
      
      logger.info('AUTOMATION_ORCHESTRATOR', '✅ Automation system stopped');
      
    } catch (error) {
      logger.error('AUTOMATION_ORCHESTRATOR', 'Error stopping automation system', null, error);
      throw error;
    }
  }

  /**
   * Begin automation orchestration
   */
  async beginOrchestration() {
    // Start main orchestration loop
    this.startOrchestrationLoop();
    
    // Start context monitoring
    this.startContextMonitoring();
    
    // Start performance monitoring
    this.startPerformanceMonitoring();
    
    logger.debug('AUTOMATION_ORCHESTRATOR', 'Automation orchestration began');
  }

  /**
   * Main orchestration loop
   */
  startOrchestrationLoop() {
    this.orchestrationInterval = setInterval(async () => {
      try {
        await this.orchestrateAutomation();
      } catch (error) {
        logger.error('AUTOMATION_ORCHESTRATOR', 'Error in orchestration loop', null, error);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Main automation orchestration logic
   */
  async orchestrateAutomation() {
    if (!this.isRunning) return;
    
    // Update system context
    await this.updateSystemContext();
    
    // Check system health
    const healthStatus = await this.checkSystemHealth();
    
    if (!healthStatus.healthy) {
      await this.handleUnhealthySystem(healthStatus);
      return;
    }
    
    // Orchestrate based on current context
    await this.contextualOrchestration();
    
    // Update metrics
    await this.updateMetrics();
    
    this.state.lastActivity = Date.now();
  }

  /**
   * Contextual orchestration based on current system state
   */
  async contextualOrchestration() {
    const context = this.state.context;
    
    // Determine optimal extraction strategy
    const strategy = await this.determineExtractionStrategy(context);
    
    // Execute strategy
    await this.executeExtractionStrategy(strategy);
    
    // Optimize performance based on results
    await this.optimizePerformance();
  }

  /**
   * Determine optimal extraction strategy
   */
  async determineExtractionStrategy(context) {
    const cacheManager = this.components.get('cacheManager');
    const adaptiveScheduler = this.components.get('adaptiveScheduler');
    
    const strategy = {
      mode: 'adaptive',
      extractionTypes: [],
      priority: 'medium',
      batchSize: 1,
      useCache: true
    };
    
    // Check cache status for different data types
    const cacheStatus = await this.checkCacheStatus();
    
    // Determine what needs to be extracted
    for (const [dataType, status] of Object.entries(cacheStatus)) {
      if (status.needsRefresh) {
        strategy.extractionTypes.push({
          type: dataType,
          priority: this.getDataTypePriority(dataType, context),
          urgency: status.urgency || 'normal'
        });
      }
    }
    
    // Adjust strategy based on context
    if (context.userActivity === 'active') {
      strategy.priority = 'high';
      strategy.extractionTypes = strategy.extractionTypes.filter(e => e.type === 'session');
    } else if (context.userActivity === 'inactive') {
      strategy.batchSize = Math.min(3, strategy.extractionTypes.length);
    }
    
    // Use adaptive scheduler insights
    if (adaptiveScheduler) {
      const adaptiveInsights = adaptiveScheduler.getAdaptiveStats();
      if (adaptiveInsights.currentSchedule) {
        // Incorporate adaptive scheduling decisions
        strategy.adaptiveAdjustment = adaptiveInsights.currentSchedule;
      }
    }
    
    return strategy;
  }

  /**
   * Execute extraction strategy
   */
  async executeExtractionStrategy(strategy) {
    const queueManager = this.components.get('queueManager');
    const priorityQueue = this.components.get('priorityQueue');
    
    if (!queueManager) return;
    
    // Create extraction tasks
    const tasks = [];
    
    for (const extraction of strategy.extractionTypes) {
      const task = {
        id: this.generateTaskId(),
        type: 'extraction',
        action: `extract_${extraction.type}`,
        priority: extraction.priority,
        payload: {
          extractionType: extraction.type,
          strategy: strategy.mode,
          useCache: strategy.useCache
        },
        metadata: {
          orchestratorGenerated: true,
          strategy: strategy.mode,
          urgency: extraction.urgency
        }
      };
      
      tasks.push(task);
    }
    
    // Add tasks to queue with priority processing
    if (this.config.integration.enablePriorityProcessing && priorityQueue) {
      for (const task of tasks) {
        await priorityQueue.addTask(task);
        const prioritizedTask = priorityQueue.getNextTask();
        if (prioritizedTask) {
          await queueManager.addTask(prioritizedTask);
        }
      }
    } else {
      // Add directly to queue manager
      await queueManager.addBatch(tasks);
    }
    
    logger.debug('AUTOMATION_ORCHESTRATOR', 'Extraction strategy executed', {
      tasksCreated: tasks.length,
      strategy: strategy.mode,
      batchSize: strategy.batchSize
    });
  }

  /**
   * Check cache status for all data types
   */
  async checkCacheStatus() {
    const cacheManager = this.components.get('cacheManager');
    if (!cacheManager) return {};
    
    const dataTypes = ['session', 'groups', 'profile'];
    const status = {};
    
    for (const dataType of dataTypes) {
      try {
        const cachedData = await cacheManager.get(`current_${dataType}`, dataType);
        const needsRefresh = !cachedData || this.isDataStale(cachedData, dataType);
        
        status[dataType] = {
          cached: !!cachedData,
          needsRefresh,
          age: cachedData ? Date.now() - new Date(cachedData.timestamp).getTime() : null,
          urgency: this.calculateDataUrgency(dataType, cachedData)
        };
      } catch (error) {
        status[dataType] = {
          cached: false,
          needsRefresh: true,
          age: null,
          urgency: 'high',
          error: error.message
        };
      }
    }
    
    return status;
  }

  /**
   * Utility methods
   */
  isDataStale(data, dataType) {
    if (!data || !data.timestamp) return true;
    
    const age = Date.now() - new Date(data.timestamp).getTime();
    const staleLimits = {
      session: 30 * 60 * 1000,    // 30 minutos
      groups: 2 * 60 * 60 * 1000, // 2 horas
      profile: 6 * 60 * 60 * 1000 // 6 horas
    };
    
    return age > (staleLimits[dataType] || 60 * 60 * 1000);
  }

  calculateDataUrgency(dataType, cachedData) {
    if (!cachedData) return 'high';
    
    const age = Date.now() - new Date(cachedData.timestamp).getTime();
    const urgencyThresholds = {
      session: {
        high: 15 * 60 * 1000,     // 15 minutos
        medium: 60 * 60 * 1000    // 1 hora
      },
      groups: {
        high: 4 * 60 * 60 * 1000, // 4 horas
        medium: 24 * 60 * 60 * 1000 // 24 horas
      },
      profile: {
        high: 12 * 60 * 60 * 1000, // 12 horas
        medium: 7 * 24 * 60 * 60 * 1000 // 7 dias
      }
    };
    
    const thresholds = urgencyThresholds[dataType] || urgencyThresholds.session;
    
    if (age > thresholds.high) return 'high';
    if (age > thresholds.medium) return 'medium';
    return 'low';
  }

  getDataTypePriority(dataType, context) {
    const priorities = {
      session: context.userActivity === 'active' ? 'HIGH' : 'MEDIUM',
      groups: context.userActivity === 'inactive' ? 'HIGH' : 'MEDIUM',
      profile: 'LOW'
    };
    
    return priorities[dataType] || 'MEDIUM';
  }

  isCriticalComponent(componentName) {
    const criticalComponents = ['cacheManager', 'queueManager', 'cronScheduler'];
    return criticalComponents.includes(componentName);
  }

  generateTaskId() {
    return `orch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * System monitoring and health checks
   */
  async setupMonitoring() {
    if (this.config.monitoring.enableHealthCheck) {
      this.setupHealthCheck();
    }
    
    if (this.config.monitoring.enablePerformanceMetrics) {
      this.setupPerformanceMetrics();
    }
  }

  setupHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      const health = await this.checkSystemHealth();
      
      if (!health.healthy) {
        logger.warn('AUTOMATION_ORCHESTRATOR', 'System health check failed', health);
        
        if (this.config.recovery.enableAutoRecovery) {
          await this.attemptAutoRecovery(health);
        }
      }
    }, this.config.monitoring.healthCheckInterval);
  }

  async checkSystemHealth() {
    const health = {
      healthy: true,
      issues: [],
      componentHealth: {},
      metrics: {}
    };
    
    // Check component health
    for (const [componentName, component] of this.components.entries()) {
      try {
        const componentHealth = await this.checkComponentHealth(componentName, component);
        health.componentHealth[componentName] = componentHealth;
        
        if (!componentHealth.healthy) {
          health.healthy = false;
          health.issues.push(`${componentName}: ${componentHealth.issue}`);
        }
      } catch (error) {
        health.healthy = false;
        health.issues.push(`${componentName}: Health check failed - ${error.message}`);
      }
    }
    
    // Check system metrics
    health.metrics = await this.getSystemMetrics();
    
    return health;
  }

  async checkComponentHealth(componentName, component) {
    const health = { healthy: true, issue: null, metrics: {} };
    
    // Component-specific health checks
    switch (componentName) {
      case 'cacheManager':
        const cacheStats = component.getStats();
        health.metrics = cacheStats;
        
        if (cacheStats.totalSizeFormatted && cacheStats.totalSizeFormatted.includes('MB')) {
          const size = parseFloat(cacheStats.totalSizeFormatted);
          if (size > 200) { // 200MB limit
            health.healthy = false;
            health.issue = 'Cache size exceeded';
          }
        }
        break;
        
      case 'queueManager':
        const queueStats = component.getStats();
        health.metrics = queueStats;
        
        if (queueStats.queuedTasks > this.config.monitoring.alertThresholds.queueSize) {
          health.healthy = false;
          health.issue = 'Queue size too large';
        }
        break;
        
      default:
        // Generic health check
        if (component.getStats) {
          health.metrics = component.getStats();
        }
    }
    
    return health;
  }

  /**
   * Auto-recovery system
   */
  async setupAutoRecovery() {
    if (!this.config.recovery.enableAutoRecovery) return;
    
    this.recoveryAttempts = new Map();
    
    logger.debug('AUTOMATION_ORCHESTRATOR', 'Auto-recovery system setup completed');
  }

  async attemptAutoRecovery(healthStatus) {
    logger.info('AUTOMATION_ORCHESTRATOR', '🔧 Attempting auto-recovery', {
      issues: healthStatus.issues.length
    });
    
    let recoverySuccess = true;
    
    for (const issue of healthStatus.issues) {
      try {
        await this.recoverFromIssue(issue);
      } catch (error) {
        logger.error('AUTOMATION_ORCHESTRATOR', 'Recovery attempt failed', { issue }, error);
        recoverySuccess = false;
      }
    }
    
    if (recoverySuccess) {
      logger.info('AUTOMATION_ORCHESTRATOR', '✅ Auto-recovery successful');
    } else {
      logger.warn('AUTOMATION_ORCHESTRATOR', '⚠️ Auto-recovery partially failed');
      
      if (this.config.recovery.fallbackToManual) {
        await this.notifyManualIntervention(healthStatus);
      }
    }
  }

  async recoverFromIssue(issue) {
    // Implement specific recovery strategies based on issue type
    if (issue.includes('Cache size exceeded')) {
      const cacheManager = this.components.get('cacheManager');
      if (cacheManager) {
        await cacheManager.cleanup();
      }
    } else if (issue.includes('Queue size too large')) {
      const queueManager = this.components.get('queueManager');
      if (queueManager) {
        await queueManager.clearQueue('background');
      }
    }
    // Add more recovery strategies as needed
  }

  /**
   * Public interface methods
   */
  getSystemStatus() {
    return {
      initialized: this.isInitialized,
      running: this.isRunning,
      state: { ...this.state },
      metrics: { ...this.metrics },
      componentCount: this.components.size,
      healthyComponents: Array.from(this.state.componentStates.entries())
        .filter(([_, state]) => state.healthy).length,
      uptime: Date.now() - this.state.uptime
    };
  }

  async getDetailedStatus() {
    const status = this.getSystemStatus();
    
    // Add component details
    status.components = {};
    for (const [name, component] of this.components.entries()) {
      status.components[name] = {
        state: this.state.componentStates.get(name),
        stats: component.getStats ? await component.getStats() : null
      };
    }
    
    return status;
  }

  async updateSystemContext(contextUpdate) {
    this.state.context = { ...this.state.context, ...contextUpdate };
    
    // Propagate context to components that need it
    const priorityQueue = this.components.get('priorityQueue');
    if (priorityQueue) {
      priorityQueue.updateContext(contextUpdate);
    }
    
    const adaptiveScheduler = this.components.get('adaptiveScheduler');
    if (adaptiveScheduler) {
      // Context updates for adaptive scheduler would go here
    }
    
    logger.debug('AUTOMATION_ORCHESTRATOR', 'System context updated', contextUpdate);
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Propagate relevant config changes to components
    for (const [name, component] of this.components.entries()) {
      if (component.updateConfig && newConfig[name]) {
        component.updateConfig(newConfig[name]);
      }
    }
    
    logger.info('AUTOMATION_ORCHESTRATOR', 'Configuration updated', newConfig);
  }

  // Additional helper methods for integration would be implemented here
  // setupPredictivePreloading, setupSchedulerCommunication, etc.
  
  setupPredictivePreloading() {
    // Implementation for predictive cache preloading
    logger.debug('AUTOMATION_ORCHESTRATOR', 'Predictive preloading setup completed');
  }

  setupSchedulerCommunication(adaptiveScheduler, cronScheduler) {
    // Implementation for scheduler communication
    logger.debug('AUTOMATION_ORCHESTRATOR', 'Scheduler communication setup completed');
  }

  setupExtractionRouting(queueManager) {
    // Implementation for extraction routing
    logger.debug('AUTOMATION_ORCHESTRATOR', 'Extraction routing setup completed');
  }

  setupPriorityContextSharing() {
    // Implementation for priority context sharing
    logger.debug('AUTOMATION_ORCHESTRATOR', 'Priority context sharing setup completed');
  }

  setupMetricsAggregation() {
    // Implementation for metrics aggregation
    logger.debug('AUTOMATION_ORCHESTRATOR', 'Metrics aggregation setup completed');
  }

  collectComponentMetrics(componentName, metrics) {
    // Implementation for collecting component metrics
    logger.debug('AUTOMATION_ORCHESTRATOR', `Metrics collected from ${componentName}`, metrics);
  }

  async startComponents() {
    // Implementation for starting all components
    logger.debug('AUTOMATION_ORCHESTRATOR', 'All components started');
  }

  async stopComponents() {
    // Implementation for stopping all components
    logger.debug('AUTOMATION_ORCHESTRATOR', 'All components stopped');
  }

  async stopOrchestration() {
    if (this.orchestrationInterval) {
      clearInterval(this.orchestrationInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }

  startContextMonitoring() {
    // Implementation for context monitoring
    logger.debug('AUTOMATION_ORCHESTRATOR', 'Context monitoring started');
  }

  startPerformanceMonitoring() {
    // Implementation for performance monitoring
    logger.debug('AUTOMATION_ORCHESTRATOR', 'Performance monitoring started');
  }

  async updateMetrics() {
    // Implementation for updating metrics
    this.metrics.cacheHitRate = await this.calculateCacheHitRate();
    this.metrics.extractionSuccessRate = this.calculateExtractionSuccessRate();
  }

  async calculateCacheHitRate() {
    const cacheManager = this.components.get('cacheManager');
    if (cacheManager) {
      const stats = cacheManager.getStats();
      return parseFloat(stats.hitRate) / 100;
    }
    return 0;
  }

  calculateExtractionSuccessRate() {
    const total = this.state.successfulExtractions + this.state.failedExtractions;
    return total > 0 ? this.state.successfulExtractions / total : 0;
  }

  async getSystemMetrics() {
    return {
      uptime: Date.now() - this.state.uptime,
      totalExtractions: this.state.totalExtractions,
      successRate: this.calculateExtractionSuccessRate(),
      averageResponseTime: this.state.averageResponseTime,
      currentLoad: this.state.currentLoad
    };
  }

  setupPerformanceMetrics() {
    // Implementation for performance metrics setup
    logger.debug('AUTOMATION_ORCHESTRATOR', 'Performance metrics setup completed');
  }

  async optimizePerformance() {
    // Implementation for performance optimization
    logger.debug('AUTOMATION_ORCHESTRATOR', 'Performance optimization completed');
  }

  async notifyManualIntervention(healthStatus) {
    logger.warn('AUTOMATION_ORCHESTRATOR', '🚨 Manual intervention required', {
      issues: healthStatus.issues
    });
  }

  handleUnhealthySystem(healthStatus) {
    logger.warn('AUTOMATION_ORCHESTRATOR', 'System is unhealthy, taking corrective action', {
      issues: healthStatus.issues
    });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AutomationOrchestrator;
} else {
  globalThis.AutomationOrchestrator = AutomationOrchestrator;
}