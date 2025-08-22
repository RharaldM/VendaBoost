/**
 * VendaBoost Extension - Priority Queue System
 * Sistema avançado de priorização para extrações e processamento de dados
 */

class PriorityQueue {
  constructor() {
    this.priorities = new Map();
    this.queue = [];
    this.processing = new Set();
    this.completed = [];
    this.weights = new Map();
    
    // Configuration
    this.config = {
      // Priority levels (lower number = higher priority)
      priorityLevels: {
        CRITICAL: 0,      // Emergências, falhas críticas
        HIGH: 1,          // Sessões, dados essenciais
        MEDIUM: 2,        // Grupos, perfis
        LOW: 3,           // Limpeza, otimizações
        BACKGROUND: 4     // Tarefas de manutenção
      },
      
      // Priority weights and factors
      weights: {
        urgency: 0.4,           // Urgência da tarefa
        importance: 0.3,        // Importância do resultado
        resourceCost: 0.2,      // Custo computacional
        deadline: 0.1           // Proximidade do deadline
      },
      
      // Aging settings (prevent starvation)
      enableAging: true,
      agingFactor: 0.1,         // Aumenta prioridade com o tempo
      maxAgingBonus: 2.0,       // Máximo 2 níveis de boost
      agingInterval: 5 * 60 * 1000,  // 5 minutos
      
      // Context-aware priorities
      contextualPriorities: {
        userActive: {
          session: 'HIGH',
          groups: 'MEDIUM',
          profile: 'LOW'
        },
        userInactive: {
          session: 'MEDIUM',
          groups: 'HIGH',      // Aproveita inatividade
          profile: 'HIGH'
        },
        highLoad: {
          session: 'HIGH',
          groups: 'LOW',
          profile: 'BACKGROUND'
        },
        apiFailure: {
          session: 'CRITICAL',  // Recuperar sessão
          groups: 'LOW',
          profile: 'LOW'
        }
      },
      
      // Dynamic adjustment settings
      enableDynamicPriorities: true,
      adjustmentInterval: 2 * 60 * 1000,  // 2 minutos
      successRateThreshold: 0.8,          // 80% taxa de sucesso
      
      // Performance settings
      maxQueueSize: 500,
      maxProcessingTime: 10 * 60 * 1000,  // 10 minutos
      enableMetrics: true,
      historySize: 1000
    };
    
    // Priority calculation factors
    this.factors = {
      // Data freshness factors
      dataAge: {
        fresh: 1.0,        // < 30 min
        stale: 0.8,        // 30min - 2h
        old: 0.6,          // 2h - 6h
        expired: 0.4       // > 6h
      },
      
      // System load factors
      systemLoad: {
        low: 1.2,          // < 30% CPU/memory
        medium: 1.0,       // 30-70%
        high: 0.8,         // 70-90%
        critical: 0.6      // > 90%
      },
      
      // Success rate factors
      successRate: {
        excellent: 1.2,    // > 95%
        good: 1.0,         // 80-95%
        poor: 0.8,         // 50-80%
        failing: 0.6       // < 50%
      }
    };
    
    // Statistics
    this.stats = {
      totalTasks: 0,
      prioritizedTasks: 0,
      adjustmentsMade: 0,
      avgCalculationTime: 0,
      priorityDistribution: {},
      agingBoosts: 0,
      contextSwitches: 0,
      uptime: Date.now()
    };
    
    // Current context
    this.context = {
      userActivity: 'unknown',
      systemLoad: 'medium',
      apiHealth: 'healthy',
      extractionSuccess: new Map(),
      lastContextUpdate: Date.now()
    };
    
    this.initialize();
    
    logger.info('PRIORITY_QUEUE', 'PriorityQueue initialized', {
      priorityLevels: Object.keys(this.config.priorityLevels).length,
      enableAging: this.config.enableAging,
      enableDynamic: this.config.enableDynamicPriorities
    });
  }

  /**
   * Initialize priority queue system
   */
  initialize() {
    // Setup aging timer if enabled
    if (this.config.enableAging) {
      this.setupAging();
    }
    
    // Setup dynamic priority adjustment
    if (this.config.enableDynamicPriorities) {
      this.setupDynamicAdjustment();
    }
    
    // Initialize priority distributions
    for (const level of Object.keys(this.config.priorityLevels)) {
      this.stats.priorityDistribution[level] = 0;
    }
    
    logger.debug('PRIORITY_QUEUE', 'Priority queue system initialized');
  }

  /**
   * Add task to priority queue
   */
  async addTask(task) {
    try {
      const startTime = performance.now();
      
      // Validate task
      if (!this.validateTask(task)) {
        throw new Error('Invalid task structure');
      }
      
      // Calculate task priority
      const priorityInfo = await this.calculatePriority(task);
      
      // Enrich task with priority information
      const enrichedTask = {
        ...task,
        id: task.id || this.generateTaskId(),
        priority: priorityInfo.level,
        priorityScore: priorityInfo.score,
        priorityFactors: priorityInfo.factors,
        addedAt: Date.now(),
        aging: {
          baseScore: priorityInfo.score,
          currentBoost: 0,
          lastAged: Date.now()
        },
        metadata: {
          ...task.metadata,
          calculationTime: performance.now() - startTime
        }
      };
      
      // Insert into queue maintaining priority order
      this.insertInPriorityOrder(enrichedTask);
      
      // Update statistics
      this.updateStats(enrichedTask);
      
      logger.debug('PRIORITY_QUEUE', `Task added with priority ${enrichedTask.priority}`, {
        taskId: enrichedTask.id,
        type: enrichedTask.type,
        score: enrichedTask.priorityScore.toFixed(3),
        queueSize: this.queue.length
      });
      
      return enrichedTask.id;
      
    } catch (error) {
      logger.error('PRIORITY_QUEUE', 'Failed to add task to priority queue', { task }, error);
      throw error;
    }
  }

  /**
   * Get next highest priority task
   */
  getNextTask() {
    if (this.queue.length === 0) {
      return null;
    }
    
    // Apply aging before selection
    if (this.config.enableAging) {
      this.applyAging();
    }
    
    // Re-sort if aging was applied
    this.sortQueue();
    
    // Get highest priority task
    const task = this.queue.shift();
    
    if (task) {
      this.processing.add(task.id);
      
      logger.debug('PRIORITY_QUEUE', `Retrieved task: ${task.id}`, {
        priority: task.priority,
        score: task.priorityScore.toFixed(3),
        waitTime: Date.now() - task.addedAt
      });
    }
    
    return task;
  }

  /**
   * Mark task as completed
   */
  completeTask(taskId, result = null) {
    if (this.processing.has(taskId)) {
      this.processing.delete(taskId);
      
      // Find task in completed array or add completion info
      const completedTask = {
        id: taskId,
        completedAt: Date.now(),
        result: result,
        success: result && !result.error
      };
      
      this.completed.push(completedTask);
      
      // Maintain completed history size
      if (this.completed.length > this.config.historySize) {
        this.completed.shift();
      }
      
      logger.debug('PRIORITY_QUEUE', `Task completed: ${taskId}`, {
        success: completedTask.success
      });
      
      return true;
    }
    
    return false;
  }

  /**
   * Calculate task priority based on multiple factors
   */
  async calculatePriority(task) {
    const factors = {};
    let totalScore = 0;
    
    try {
      // Base priority from task type and context
      factors.base = this.getBasePriority(task);
      totalScore += factors.base * this.config.weights.importance;
      
      // Urgency factor
      factors.urgency = this.calculateUrgencyFactor(task);
      totalScore += factors.urgency * this.config.weights.urgency;
      
      // Resource cost factor
      factors.resourceCost = this.calculateResourceCostFactor(task);
      totalScore += factors.resourceCost * this.config.weights.resourceCost;
      
      // Deadline factor
      factors.deadline = this.calculateDeadlineFactor(task);
      totalScore += factors.deadline * this.config.weights.deadline;
      
      // Context-aware adjustments
      factors.contextual = await this.calculateContextualFactor(task);
      totalScore *= factors.contextual;
      
      // Data freshness factor
      factors.freshness = await this.calculateFreshnessFactor(task);
      totalScore *= factors.freshness;
      
      // Success rate factor
      factors.successRate = this.calculateSuccessRateFactor(task);
      totalScore *= factors.successRate;
      
      // System load factor
      factors.systemLoad = this.calculateSystemLoadFactor();
      totalScore *= factors.systemLoad;
      
      // Determine priority level
      const priorityLevel = this.scoreToPriorityLevel(totalScore);
      
      return {
        score: totalScore,
        level: priorityLevel,
        factors: factors
      };
      
    } catch (error) {
      logger.error('PRIORITY_QUEUE', 'Error calculating priority', { task }, error);
      
      // Fallback to medium priority
      return {
        score: 0.5,
        level: 'MEDIUM',
        factors: { error: error.message }
      };
    }
  }

  /**
   * Get base priority based on task type and context
   */
  getBasePriority(task) {
    const taskType = task.type || 'unknown';
    const context = this.getCurrentContext();
    
    // Get contextual priority
    const contextualPriorities = this.config.contextualPriorities[context];
    if (contextualPriorities && contextualPriorities[taskType]) {
      const priorityLevel = contextualPriorities[taskType];
      return this.priorityLevelToScore(priorityLevel);
    }
    
    // Default priorities by task type
    const defaultPriorities = {
      session: 'HIGH',
      groups: 'MEDIUM',
      profile: 'MEDIUM',
      api: 'HIGH',
      cleanup: 'LOW',
      processing: 'MEDIUM'
    };
    
    const defaultLevel = defaultPriorities[taskType] || 'MEDIUM';
    return this.priorityLevelToScore(defaultLevel);
  }

  /**
   * Calculate urgency factor
   */
  calculateUrgencyFactor(task) {
    // Check if task is time-sensitive
    if (task.urgent || task.priority === 'CRITICAL') {
      return 1.0;
    }
    
    // Check task age if it's a retry
    if (task.retryCount && task.retryCount > 0) {
      return Math.min(1.0, 0.5 + (task.retryCount * 0.2));
    }
    
    // Check if related to user activity
    if (task.userTriggered) {
      return 0.8;
    }
    
    return 0.5; // Default urgency
  }

  /**
   * Calculate resource cost factor (higher cost = lower priority)
   */
  calculateResourceCostFactor(task) {
    const resourceCosts = {
      session: 0.3,      // Low cost
      groups: 0.7,       // Medium cost
      profile: 0.6,      // Medium cost
      api: 0.2,          // Low cost
      cleanup: 0.4,      // Low-medium cost
      processing: 0.5    // Medium cost
    };
    
    const cost = resourceCosts[task.type] || 0.5;
    return 1.0 - cost; // Invert cost to priority
  }

  /**
   * Calculate deadline factor
   */
  calculateDeadlineFactor(task) {
    if (!task.deadline) {
      return 0.5; // No deadline = medium urgency
    }
    
    const now = Date.now();
    const timeToDeadline = task.deadline - now;
    
    if (timeToDeadline <= 0) {
      return 1.0; // Past deadline = highest urgency
    }
    
    // Urgency increases as deadline approaches
    const urgencyHours = 2 * 60 * 60 * 1000; // 2 hours
    if (timeToDeadline <= urgencyHours) {
      return 0.8 + (0.2 * (1 - timeToDeadline / urgencyHours));
    }
    
    return 0.3; // Distant deadline = lower urgency
  }

  /**
   * Calculate contextual factor based on current system context
   */
  async calculateContextualFactor(task) {
    const context = this.getCurrentContext();
    let factor = 1.0;
    
    // User activity context
    if (context === 'userActive') {
      if (task.type === 'session') factor *= 1.3; // Prioritize session when user active
      if (task.type === 'groups') factor *= 0.8;  // Deprioritize heavy tasks
    } else if (context === 'userInactive') {
      if (task.type === 'groups') factor *= 1.2;  // Good time for heavy tasks
      if (task.type === 'profile') factor *= 1.2;
    }
    
    // System load context
    if (this.context.systemLoad === 'high') {
      if (task.type === 'groups' || task.type === 'profile') {
        factor *= 0.7; // Reduce priority of heavy tasks
      }
    }
    
    // API health context
    if (this.context.apiHealth === 'degraded') {
      if (task.type === 'api') factor *= 0.5; // Reduce API tasks priority
    }
    
    return factor;
  }

  /**
   * Calculate data freshness factor
   */
  async calculateFreshnessFactor(task) {
    if (!task.dataType || !globalThis.cacheManager) {
      return 1.0; // No cache info = assume fresh needed
    }
    
    try {
      // Check cache age
      const cachedData = await globalThis.cacheManager.get(task.cacheKey || task.id, task.dataType);
      
      if (!cachedData) {
        return 1.2; // No cached data = higher priority
      }
      
      const dataAge = Date.now() - new Date(cachedData.timestamp || 0).getTime();
      
      // Apply freshness factors
      if (dataAge < 30 * 60 * 1000) return this.factors.dataAge.fresh;        // < 30 min
      if (dataAge < 2 * 60 * 60 * 1000) return this.factors.dataAge.stale;   // < 2 hours
      if (dataAge < 6 * 60 * 60 * 1000) return this.factors.dataAge.old;     // < 6 hours
      
      return this.factors.dataAge.expired; // > 6 hours
      
    } catch (error) {
      return 1.0; // Error checking cache = assume fresh needed
    }
  }

  /**
   * Calculate success rate factor
   */
  calculateSuccessRateFactor(task) {
    const successData = this.context.extractionSuccess.get(task.type);
    
    if (!successData || successData.length === 0) {
      return 1.0; // No history = neutral factor
    }
    
    const successRate = successData.filter(s => s).length / successData.length;
    
    if (successRate >= 0.95) return this.factors.successRate.excellent;
    if (successRate >= 0.80) return this.factors.successRate.good;
    if (successRate >= 0.50) return this.factors.successRate.poor;
    
    return this.factors.successRate.failing;
  }

  /**
   * Calculate system load factor
   */
  calculateSystemLoadFactor() {
    // This would integrate with system monitoring
    // For now, use configured system load
    const load = this.context.systemLoad;
    
    return this.factors.systemLoad[load] || 1.0;
  }

  /**
   * Convert priority score to priority level
   */
  scoreToPriorityLevel(score) {
    if (score >= 0.9) return 'CRITICAL';
    if (score >= 0.7) return 'HIGH';
    if (score >= 0.4) return 'MEDIUM';
    if (score >= 0.2) return 'LOW';
    return 'BACKGROUND';
  }

  /**
   * Convert priority level to score
   */
  priorityLevelToScore(level) {
    const scores = {
      'CRITICAL': 1.0,
      'HIGH': 0.8,
      'MEDIUM': 0.5,
      'LOW': 0.3,
      'BACKGROUND': 0.1
    };
    
    return scores[level] || 0.5;
  }

  /**
   * Get current system context
   */
  getCurrentContext() {
    // Determine context based on multiple factors
    const factors = [];
    
    if (this.context.userActivity === 'active') factors.push('userActive');
    else if (this.context.userActivity === 'inactive') factors.push('userInactive');
    
    if (this.context.systemLoad === 'high' || this.context.systemLoad === 'critical') {
      factors.push('highLoad');
    }
    
    if (this.context.apiHealth === 'degraded' || this.context.apiHealth === 'failing') {
      factors.push('apiFailure');
    }
    
    // Return most specific context
    if (factors.includes('apiFailure')) return 'apiFailure';
    if (factors.includes('highLoad')) return 'highLoad';
    if (factors.includes('userActive')) return 'userActive';
    if (factors.includes('userInactive')) return 'userInactive';
    
    return 'normal';
  }

  /**
   * Insert task in priority order
   */
  insertInPriorityOrder(task) {
    // Find insertion point
    let insertIndex = 0;
    
    for (let i = 0; i < this.queue.length; i++) {
      const existingTask = this.queue[i];
      
      // Compare priority scores (higher score = higher priority)
      if (task.priorityScore > existingTask.priorityScore) {
        insertIndex = i;
        break;
      }
      
      insertIndex = i + 1;
    }
    
    this.queue.splice(insertIndex, 0, task);
  }

  /**
   * Apply aging to tasks in queue
   */
  applyAging() {
    const now = Date.now();
    let agingApplied = false;
    
    for (const task of this.queue) {
      const timeSinceAdded = now - task.addedAt;
      const timeSinceLastAged = now - task.aging.lastAged;
      
      // Apply aging every interval
      if (timeSinceLastAged >= this.config.agingInterval) {
        const ageBoost = Math.min(
          this.config.maxAgingBonus,
          (timeSinceAdded / this.config.agingInterval) * this.config.agingFactor
        );
        
        // Update aging info
        task.aging.currentBoost = ageBoost;
        task.aging.lastAged = now;
        
        // Apply aging to priority score
        task.priorityScore = task.aging.baseScore + ageBoost;
        
        this.stats.agingBoosts++;
        agingApplied = true;
        
        logger.debug('PRIORITY_QUEUE', `Aging applied to task: ${task.id}`, {
          ageBoost: ageBoost.toFixed(3),
          newScore: task.priorityScore.toFixed(3)
        });
      }
    }
    
    return agingApplied;
  }

  /**
   * Sort queue by priority score
   */
  sortQueue() {
    this.queue.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Setup aging timer
   */
  setupAging() {
    setInterval(() => {
      if (this.queue.length > 0) {
        const agingApplied = this.applyAging();
        if (agingApplied) {
          this.sortQueue();
        }
      }
    }, this.config.agingInterval);
    
    logger.debug('PRIORITY_QUEUE', 'Aging system setup completed');
  }

  /**
   * Setup dynamic priority adjustment
   */
  setupDynamicAdjustment() {
    setInterval(() => {
      this.adjustDynamicPriorities();
    }, this.config.adjustmentInterval);
    
    logger.debug('PRIORITY_QUEUE', 'Dynamic priority adjustment setup completed');
  }

  /**
   * Adjust priorities dynamically based on performance
   */
  adjustDynamicPriorities() {
    // Analyze recent task performance
    const recentTasks = this.completed.filter(
      task => task.completedAt > Date.now() - this.config.adjustmentInterval
    );
    
    if (recentTasks.length === 0) return;
    
    // Calculate success rates by type
    const typeStats = new Map();
    
    for (const task of recentTasks) {
      if (!typeStats.has(task.type)) {
        typeStats.set(task.type, { total: 0, success: 0 });
      }
      
      const stats = typeStats.get(task.type);
      stats.total++;
      if (task.success) stats.success++;
    }
    
    // Adjust priorities based on success rates
    for (const [type, stats] of typeStats.entries()) {
      const successRate = stats.success / stats.total;
      
      if (successRate < this.config.successRateThreshold) {
        // Lower priority for failing task types
        this.adjustTaskTypePriority(type, -0.1);
        this.stats.adjustmentsMade++;
        
        logger.info('PRIORITY_QUEUE', `Lowered priority for ${type}`, {
          successRate: `${(successRate * 100).toFixed(1)}%`,
          adjustment: -0.1
        });
      } else if (successRate > 0.95) {
        // Slightly increase priority for very successful types
        this.adjustTaskTypePriority(type, 0.05);
        this.stats.adjustmentsMade++;
      }
    }
  }

  /**
   * Adjust priority for specific task type
   */
  adjustTaskTypePriority(taskType, adjustment) {
    // This would adjust base priorities in the configuration
    // For now, just log the adjustment
    logger.debug('PRIORITY_QUEUE', `Priority adjustment for ${taskType}`, {
      adjustment
    });
  }

  /**
   * Validate task structure
   */
  validateTask(task) {
    if (!task || typeof task !== 'object') return false;
    if (!task.type) return false;
    if (!task.action && !task.handler) return false;
    
    return true;
  }

  /**
   * Update statistics
   */
  updateStats(task) {
    this.stats.totalTasks++;
    this.stats.prioritizedTasks++;
    this.stats.priorityDistribution[task.priority]++;
    
    // Update average calculation time
    const calcTime = task.metadata?.calculationTime || 0;
    this.stats.avgCalculationTime = 
      ((this.stats.avgCalculationTime * (this.stats.totalTasks - 1)) + calcTime) / this.stats.totalTasks;
  }

  /**
   * Generate task ID
   */
  generateTaskId() {
    return `pq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Public interface methods
   */
  updateContext(contextUpdate) {
    this.context = { ...this.context, ...contextUpdate };
    this.context.lastContextUpdate = Date.now();
    this.stats.contextSwitches++;
    
    logger.debug('PRIORITY_QUEUE', 'Context updated', contextUpdate);
  }

  recordExtractionResult(taskType, success) {
    if (!this.context.extractionSuccess.has(taskType)) {
      this.context.extractionSuccess.set(taskType, []);
    }
    
    const results = this.context.extractionSuccess.get(taskType);
    results.push(success);
    
    // Keep only recent results
    if (results.length > 100) {
      results.shift();
    }
  }

  getQueueStatus() {
    return {
      queueSize: this.queue.length,
      processing: this.processing.size,
      completed: this.completed.length,
      priorityDistribution: { ...this.stats.priorityDistribution },
      topPriorities: this.queue.slice(0, 5).map(task => ({
        id: task.id,
        type: task.type,
        priority: task.priority,
        score: task.priorityScore.toFixed(3),
        waitTime: Date.now() - task.addedAt
      }))
    };
  }

  getPriorityStats() {
    const uptime = Date.now() - this.stats.uptime;
    
    return {
      ...this.stats,
      uptime,
      uptimeFormatted: this.formatDuration(uptime),
      avgCalculationTimeFormatted: `${this.stats.avgCalculationTime.toFixed(2)}ms`,
      context: { ...this.context },
      currentQueueSize: this.queue.length,
      processingTasks: this.processing.size
    };
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('PRIORITY_QUEUE', 'Configuration updated', newConfig);
  }

  clearQueue() {
    const clearedCount = this.queue.length;
    this.queue = [];
    
    logger.info('PRIORITY_QUEUE', 'Queue cleared', {
      clearedTasks: clearedCount
    });
    
    return clearedCount;
  }

  removeTask(taskId) {
    const index = this.queue.findIndex(task => task.id === taskId);
    
    if (index !== -1) {
      const removedTask = this.queue.splice(index, 1)[0];
      
      logger.debug('PRIORITY_QUEUE', `Task removed: ${taskId}`);
      return removedTask;
    }
    
    return null;
  }

  reprioritizeTask(taskId) {
    const taskIndex = this.queue.findIndex(task => task.id === taskId);
    
    if (taskIndex !== -1) {
      const task = this.queue[taskIndex];
      
      // Recalculate priority
      this.calculatePriority(task).then(priorityInfo => {
        task.priority = priorityInfo.level;
        task.priorityScore = priorityInfo.score;
        task.priorityFactors = priorityInfo.factors;
        
        // Remove and reinsert in correct position
        this.queue.splice(taskIndex, 1);
        this.insertInPriorityOrder(task);
        
        logger.debug('PRIORITY_QUEUE', `Task reprioritized: ${taskId}`, {
          newPriority: task.priority,
          newScore: task.priorityScore.toFixed(3)
        });
      });
      
      return true;
    }
    
    return false;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PriorityQueue;
} else {
  globalThis.PriorityQueue = PriorityQueue;
}