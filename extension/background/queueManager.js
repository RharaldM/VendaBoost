/**
 * VendaBoost Extension - Queue Manager
 * Sistema avançado de filas para processamento assíncrono de extrações
 */

class QueueManager {
  constructor() {
    this.queues = new Map();
    this.workers = new Map();
    this.processing = new Map();
    this.completedTasks = [];
    this.failedTasks = [];
    this.isRunning = false;
    
    // Configuration
    this.config = {
      // Queue settings
      maxQueueSize: 1000,
      maxConcurrentWorkers: 3,
      defaultPriority: 'medium',
      
      // Worker settings
      workerTimeout: 5 * 60 * 1000,     // 5 minutes
      maxRetries: 3,
      retryDelay: 30000,                // 30 seconds
      backoffMultiplier: 1.5,
      
      // Performance settings
      batchSize: 5,
      processingInterval: 1000,         // 1 second
      maxHistorySize: 1000,
      enableMetrics: true,
      
      // Priority levels
      priorities: {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
        background: 4
      },
      
      // Queue types
      queueTypes: {
        extraction: {
          maxConcurrent: 2,
          timeout: 3 * 60 * 1000,       // 3 minutes
          retries: 3
        },
        processing: {
          maxConcurrent: 3,
          timeout: 1 * 60 * 1000,       // 1 minute
          retries: 2
        },
        api: {
          maxConcurrent: 5,
          timeout: 30 * 1000,           // 30 seconds
          retries: 5
        },
        cleanup: {
          maxConcurrent: 1,
          timeout: 10 * 60 * 1000,      // 10 minutes
          retries: 1
        }
      }
    };
    
    // Statistics
    this.stats = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      retriedTasks: 0,
      averageProcessingTime: 0,
      currentlyProcessing: 0,
      queuedTasks: 0,
      uptime: Date.now()
    };
    
    // Initialize default queues
    this.initializeQueues();
    
    logger.info('QUEUE_MANAGER', 'QueueManager initialized', {
      queueTypes: Object.keys(this.config.queueTypes).length,
      maxWorkers: this.config.maxConcurrentWorkers
    });
  }

  /**
   * Initialize default queues
   */
  initializeQueues() {
    for (const [queueType, queueConfig] of Object.entries(this.config.queueTypes)) {
      this.queues.set(queueType, {
        name: queueType,
        tasks: [],
        config: queueConfig,
        stats: {
          totalAdded: 0,
          totalProcessed: 0,
          totalFailed: 0,
          averageWaitTime: 0,
          currentSize: 0
        }
      });
    }
    
    logger.debug('QUEUE_MANAGER', 'Default queues initialized', {
      queues: Array.from(this.queues.keys())
    });
  }

  /**
   * Start the queue manager
   */
  async start() {
    if (this.isRunning) {
      logger.warn('QUEUE_MANAGER', 'Queue manager is already running');
      return;
    }
    
    this.isRunning = true;
    this.stats.uptime = Date.now();
    
    // Start processing loop
    this.startProcessingLoop();
    
    // Setup cleanup interval
    this.setupCleanupInterval();
    
    logger.info('QUEUE_MANAGER', '▶️ Queue manager started');
  }

  /**
   * Stop the queue manager
   */
  async stop() {
    if (!this.isRunning) {
      logger.warn('QUEUE_MANAGER', 'Queue manager is not running');
      return;
    }
    
    this.isRunning = false;
    
    // Wait for current tasks to complete
    await this.waitForCurrentTasks();
    
    // Clear intervals
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    logger.info('QUEUE_MANAGER', '⏹️ Queue manager stopped');
  }

  /**
   * Add task to queue
   */
  async addTask(task) {
    try {
      // Validate task
      if (!this.validateTask(task)) {
        throw new Error('Invalid task structure');
      }
      
      // Get or create queue
      const queueType = task.type || 'processing';
      let queue = this.queues.get(queueType);
      
      if (!queue) {
        queue = this.createQueue(queueType);
      }
      
      // Check queue size limit
      if (queue.tasks.length >= this.config.maxQueueSize) {
        throw new Error(`Queue ${queueType} is full`);
      }
      
      // Enrich task with metadata
      const enrichedTask = this.enrichTask(task);
      
      // Add to queue in priority order
      this.insertTaskInPriorityOrder(queue, enrichedTask);
      
      // Update statistics
      queue.stats.totalAdded++;
      queue.stats.currentSize = queue.tasks.length;
      this.stats.totalTasks++;
      this.stats.queuedTasks++;
      
      logger.debug('QUEUE_MANAGER', `Task added to ${queueType} queue`, {
        taskId: enrichedTask.id,
        priority: enrichedTask.priority,
        queueSize: queue.tasks.length
      });
      
      return enrichedTask.id;
      
    } catch (error) {
      logger.error('QUEUE_MANAGER', 'Failed to add task to queue', { task }, error);
      throw error;
    }
  }

  /**
   * Add multiple tasks in batch
   */
  async addBatch(tasks) {
    const results = [];
    
    for (const task of tasks) {
      try {
        const taskId = await this.addTask(task);
        results.push({ success: true, taskId });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }
    
    logger.info('QUEUE_MANAGER', 'Batch tasks added', {
      total: tasks.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });
    
    return results;
  }

  /**
   * Main processing loop
   */
  startProcessingLoop() {
    this.processingInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        await this.processQueues();
      } catch (error) {
        logger.error('QUEUE_MANAGER', 'Error in processing loop', null, error);
      }
    }, this.config.processingInterval);
  }

  /**
   * Process all queues
   */
  async processQueues() {
    // Get available worker slots
    const availableWorkers = this.config.maxConcurrentWorkers - this.processing.size;
    
    if (availableWorkers <= 0) {
      return; // No available workers
    }
    
    // Sort queues by priority (critical tasks first)
    const sortedQueues = Array.from(this.queues.values())
      .filter(queue => queue.tasks.length > 0)
      .sort((a, b) => {
        const aMinPriority = Math.min(...a.tasks.map(t => this.config.priorities[t.priority] || 2));
        const bMinPriority = Math.min(...b.tasks.map(t => this.config.priorities[t.priority] || 2));
        return aMinPriority - bMinPriority;
      });
    
    // Process tasks from queues
    let workersAssigned = 0;
    
    for (const queue of sortedQueues) {
      if (workersAssigned >= availableWorkers) break;
      
      const queueConfig = queue.config;
      const currentlyProcessingInQueue = Array.from(this.processing.values())
        .filter(task => task.type === queue.name).length;
      
      // Check queue-specific concurrency limit
      if (currentlyProcessingInQueue >= queueConfig.maxConcurrent) {
        continue;
      }
      
      // Get next task from queue
      const task = queue.tasks.shift();
      if (!task) continue;
      
      // Update queue stats
      queue.stats.currentSize = queue.tasks.length;
      this.stats.queuedTasks--;
      
      // Start processing task
      await this.processTask(task);
      workersAssigned++;
    }
  }

  /**
   * Process individual task
   */
  async processTask(task) {
    const startTime = Date.now();
    const workerId = this.generateWorkerId();
    
    try {
      // Add to processing map
      this.processing.set(workerId, {
        ...task,
        workerId,
        startTime,
        timeout: setTimeout(() => {
          this.handleTaskTimeout(workerId);
        }, task.timeout || this.config.workerTimeout)
      });
      
      this.stats.currentlyProcessing++;
      
      logger.debug('QUEUE_MANAGER', `Processing task: ${task.id}`, {
        workerId,
        type: task.type,
        priority: task.priority
      });
      
      // Execute task
      const result = await this.executeTask(task);
      
      // Task completed successfully
      await this.handleTaskSuccess(workerId, task, result, startTime);
      
    } catch (error) {
      // Task failed
      await this.handleTaskFailure(workerId, task, error, startTime);
    }
  }

  /**
   * Execute task based on its type
   */
  async executeTask(task) {
    switch (task.action) {
      case 'extract_session':
        return await this.executeSessionExtraction(task);
        
      case 'extract_groups':
        return await this.executeGroupsExtraction(task);
        
      case 'extract_profile':
        return await this.executeProfileExtraction(task);
        
      case 'process_data':
        return await this.executeDataProcessing(task);
        
      case 'send_api':
        return await this.executeApiCall(task);
        
      case 'cleanup':
        return await this.executeCleanup(task);
        
      default:
        if (task.handler && typeof task.handler === 'function') {
          return await task.handler(task.payload);
        }
        
        throw new Error(`Unknown task action: ${task.action}`);
    }
  }

  /**
   * Task execution handlers
   */
  async executeSessionExtraction(task) {
    if (!globalThis.SessionExtractor) {
      throw new Error('SessionExtractor not available');
    }
    
    const extractor = new globalThis.SessionExtractor();
    const options = task.payload?.options || {};
    
    return await extractor.extractSession(options);
  }

  async executeGroupsExtraction(task) {
    if (!globalThis.GroupsExtractor) {
      throw new Error('GroupsExtractor not available');
    }
    
    const extractor = new globalThis.GroupsExtractor();
    const userId = task.payload?.userId;
    const options = task.payload?.options || {};
    
    return await extractor.extractGroups(userId, options);
  }

  async executeProfileExtraction(task) {
    if (!globalThis.ProfileExtractor) {
      throw new Error('ProfileExtractor not available');
    }
    
    const extractor = new globalThis.ProfileExtractor();
    const userId = task.payload?.userId;
    const options = task.payload?.options || {};
    
    return await extractor.extractProfile(userId, options);
  }

  async executeDataProcessing(task) {
    const data = task.payload?.data;
    const processor = task.payload?.processor;
    
    if (!data || !processor) {
      throw new Error('Data processing requires data and processor');
    }
    
    // Execute data processing function
    if (typeof processor === 'function') {
      return await processor(data);
    }
    
    throw new Error('Invalid processor function');
  }

  async executeApiCall(task) {
    const { url, method = 'POST', data, headers = {} } = task.payload;
    
    if (!url) {
      throw new Error('API call requires URL');
    }
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: data ? JSON.stringify(data) : undefined
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }

  async executeCleanup(task) {
    const cleanupType = task.payload?.type || 'general';
    let result = { type: cleanupType, actions: 0 };
    
    switch (cleanupType) {
      case 'cache':
        if (globalThis.cacheManager) {
          await globalThis.cacheManager.cleanup();
          result.actions++;
        }
        break;
        
      case 'history':
        this.cleanupHistory();
        result.actions++;
        break;
        
      case 'logs':
        if (globalThis.logger) {
          globalThis.logger.clearHistory();
          result.actions++;
        }
        break;
        
      default:
        // General cleanup
        if (globalThis.cacheManager) {
          await globalThis.cacheManager.cleanup();
          result.actions++;
        }
        this.cleanupHistory();
        result.actions++;
    }
    
    return result;
  }

  /**
   * Handle task completion
   */
  async handleTaskSuccess(workerId, task, result, startTime) {
    const processingTime = Date.now() - startTime;
    const processingTask = this.processing.get(workerId);
    
    if (processingTask?.timeout) {
      clearTimeout(processingTask.timeout);
    }
    
    // Remove from processing
    this.processing.delete(workerId);
    this.stats.currentlyProcessing--;
    
    // Add to completed tasks
    const completedTask = {
      ...task,
      workerId,
      result,
      completedAt: new Date().toISOString(),
      processingTime,
      success: true
    };
    
    this.completedTasks.push(completedTask);
    
    // Update statistics
    this.stats.completedTasks++;
    this.updateAverageProcessingTime(processingTime);
    
    // Update queue statistics
    const queue = this.queues.get(task.type);
    if (queue) {
      queue.stats.totalProcessed++;
      
      const waitTime = startTime - task.createdAt;
      queue.stats.averageWaitTime = 
        ((queue.stats.averageWaitTime * (queue.stats.totalProcessed - 1)) + waitTime) / queue.stats.totalProcessed;
    }
    
    logger.info('QUEUE_MANAGER', `✅ Task completed: ${task.id}`, {
      workerId,
      type: task.type,
      processingTime: `${processingTime}ms`,
      result: result?.summary || 'No summary'
    });
    
    // Trigger task completion event
    this.emitTaskEvent('completed', completedTask);
  }

  /**
   * Handle task failure
   */
  async handleTaskFailure(workerId, task, error, startTime) {
    const processingTime = Date.now() - startTime;
    const processingTask = this.processing.get(workerId);
    
    if (processingTask?.timeout) {
      clearTimeout(processingTask.timeout);
    }
    
    // Remove from processing
    this.processing.delete(workerId);
    this.stats.currentlyProcessing--;
    
    // Increment retry count
    task.retryCount = (task.retryCount || 0) + 1;
    
    logger.error('QUEUE_MANAGER', `❌ Task failed: ${task.id}`, {
      workerId,
      type: task.type,
      retryCount: task.retryCount,
      processingTime: `${processingTime}ms`,
      error: error.message
    }, error);
    
    // Check if should retry
    if (task.retryCount < (task.maxRetries || this.config.maxRetries)) {
      // Schedule retry
      await this.scheduleRetry(task);
      this.stats.retriedTasks++;
    } else {
      // Task permanently failed
      const failedTask = {
        ...task,
        workerId,
        error: {
          message: error.message,
          stack: error.stack
        },
        failedAt: new Date().toISOString(),
        processingTime,
        success: false
      };
      
      this.failedTasks.push(failedTask);
      this.stats.failedTasks++;
      
      // Update queue statistics
      const queue = this.queues.get(task.type);
      if (queue) {
        queue.stats.totalFailed++;
      }
      
      // Trigger task failure event
      this.emitTaskEvent('failed', failedTask);
    }
  }

  /**
   * Handle task timeout
   */
  async handleTaskTimeout(workerId) {
    const task = this.processing.get(workerId);
    if (!task) return;
    
    logger.warn('QUEUE_MANAGER', `⏰ Task timeout: ${task.id}`, {
      workerId,
      type: task.type,
      processingTime: Date.now() - task.startTime
    });
    
    // Treat timeout as failure
    await this.handleTaskFailure(workerId, task, new Error('Task timeout'), task.startTime);
  }

  /**
   * Schedule task retry
   */
  async scheduleRetry(task) {
    const retryDelay = this.config.retryDelay * Math.pow(this.config.backoffMultiplier, task.retryCount - 1);
    
    logger.info('QUEUE_MANAGER', `⏳ Scheduling retry for task: ${task.id}`, {
      retryCount: task.retryCount,
      delay: `${retryDelay}ms`
    });
    
    setTimeout(async () => {
      // Add task back to queue
      const queue = this.queues.get(task.type);
      if (queue) {
        this.insertTaskInPriorityOrder(queue, task);
        queue.stats.currentSize = queue.tasks.length;
        this.stats.queuedTasks++;
      }
    }, retryDelay);
  }

  /**
   * Utility methods
   */
  validateTask(task) {
    if (!task || typeof task !== 'object') return false;
    if (!task.action && !task.handler) return false;
    if (!task.type) return false;
    
    return true;
  }

  enrichTask(task) {
    return {
      id: task.id || this.generateTaskId(),
      type: task.type,
      action: task.action,
      priority: task.priority || this.config.defaultPriority,
      payload: task.payload || {},
      handler: task.handler,
      maxRetries: task.maxRetries || this.config.maxRetries,
      timeout: task.timeout || this.config.queueTypes[task.type]?.timeout || this.config.workerTimeout,
      retryCount: 0,
      createdAt: Date.now(),
      metadata: task.metadata || {}
    };
  }

  insertTaskInPriorityOrder(queue, task) {
    const taskPriority = this.config.priorities[task.priority] || 2;
    
    // Find insertion point based on priority
    let insertIndex = 0;
    for (let i = 0; i < queue.tasks.length; i++) {
      const existingPriority = this.config.priorities[queue.tasks[i].priority] || 2;
      if (taskPriority <= existingPriority) {
        insertIndex = i;
        break;
      }
      insertIndex = i + 1;
    }
    
    queue.tasks.splice(insertIndex, 0, task);
  }

  createQueue(queueType) {
    const queue = {
      name: queueType,
      tasks: [],
      config: this.config.queueTypes.processing, // Default config
      stats: {
        totalAdded: 0,
        totalProcessed: 0,
        totalFailed: 0,
        averageWaitTime: 0,
        currentSize: 0
      }
    };
    
    this.queues.set(queueType, queue);
    
    logger.info('QUEUE_MANAGER', `Created new queue: ${queueType}`);
    
    return queue;
  }

  generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateWorkerId() {
    return `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  updateAverageProcessingTime(processingTime) {
    const totalCompleted = this.stats.completedTasks + this.stats.failedTasks;
    this.stats.averageProcessingTime = 
      ((this.stats.averageProcessingTime * (totalCompleted - 1)) + processingTime) / totalCompleted;
  }

  emitTaskEvent(eventType, task) {
    // Emit custom events for task lifecycle
    const event = new CustomEvent(`queue.task.${eventType}`, {
      detail: task
    });
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(event);
    }
  }

  async waitForCurrentTasks() {
    while (this.processing.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  cleanupHistory() {
    if (this.completedTasks.length > this.config.maxHistorySize) {
      this.completedTasks = this.completedTasks.slice(-this.config.maxHistorySize);
    }
    
    if (this.failedTasks.length > this.config.maxHistorySize) {
      this.failedTasks = this.failedTasks.slice(-this.config.maxHistorySize);
    }
  }

  setupCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupHistory();
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Public interface methods
   */
  getQueueStatus(queueType = null) {
    if (queueType) {
      const queue = this.queues.get(queueType);
      if (!queue) return null;
      
      return {
        name: queue.name,
        size: queue.tasks.length,
        processing: Array.from(this.processing.values()).filter(t => t.type === queueType).length,
        stats: queue.stats,
        config: queue.config
      };
    }
    
    // Return status for all queues
    const allQueues = {};
    for (const [queueType, queue] of this.queues.entries()) {
      allQueues[queueType] = this.getQueueStatus(queueType);
    }
    
    return allQueues;
  }

  getStats() {
    const uptime = Date.now() - this.stats.uptime;
    const throughput = this.stats.completedTasks > 0 
      ? (this.stats.completedTasks / (uptime / 1000 / 60)).toFixed(2) // tasks per minute
      : 0;
    
    return {
      ...this.stats,
      uptime,
      uptimeFormatted: this.formatDuration(uptime),
      throughput: `${throughput} tasks/min`,
      successRate: this.stats.totalTasks > 0 
        ? `${((this.stats.completedTasks / this.stats.totalTasks) * 100).toFixed(2)}%`
        : '0%',
      averageProcessingTimeFormatted: `${this.stats.averageProcessingTime.toFixed(2)}ms`,
      isRunning: this.isRunning
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
    logger.info('QUEUE_MANAGER', 'Configuration updated', newConfig);
  }

  // Task management methods
  async cancelTask(taskId) {
    // Find and remove task from queues
    for (const queue of this.queues.values()) {
      const taskIndex = queue.tasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        const cancelledTask = queue.tasks.splice(taskIndex, 1)[0];
        queue.stats.currentSize = queue.tasks.length;
        this.stats.queuedTasks--;
        
        logger.info('QUEUE_MANAGER', `Task cancelled: ${taskId}`);
        return cancelledTask;
      }
    }
    
    // Check if task is currently processing
    for (const [workerId, task] of this.processing.entries()) {
      if (task.id === taskId) {
        // Can't cancel running task, but mark for cancellation
        task.cancelled = true;
        logger.warn('QUEUE_MANAGER', `Task marked for cancellation (currently running): ${taskId}`);
        return task;
      }
    }
    
    return null;
  }

  async pauseQueue(queueType) {
    const queue = this.queues.get(queueType);
    if (queue) {
      queue.paused = true;
      logger.info('QUEUE_MANAGER', `Queue paused: ${queueType}`);
    }
  }

  async resumeQueue(queueType) {
    const queue = this.queues.get(queueType);
    if (queue) {
      queue.paused = false;
      logger.info('QUEUE_MANAGER', `Queue resumed: ${queueType}`);
    }
  }

  async clearQueue(queueType) {
    const queue = this.queues.get(queueType);
    if (queue) {
      const clearedCount = queue.tasks.length;
      queue.tasks = [];
      queue.stats.currentSize = 0;
      this.stats.queuedTasks -= clearedCount;
      
      logger.info('QUEUE_MANAGER', `Queue cleared: ${queueType}`, {
        clearedTasks: clearedCount
      });
      
      return clearedCount;
    }
    
    return 0;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QueueManager;
} else {
  globalThis.QueueManager = QueueManager;
}