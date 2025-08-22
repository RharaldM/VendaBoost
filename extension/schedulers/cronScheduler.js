/**
 * VendaBoost Extension - Cron Scheduler
 * Sistema de agendamento automático baseado em tempo para extrações
 */

class CronScheduler {
  constructor() {
    this.jobs = new Map();
    this.activeAlarms = new Set();
    this.executionHistory = [];
    this.isRunning = false;
    
    // Configuration
    this.config = {
      // Default intervals (in minutes)
      defaultIntervals: {
        session: 15,        // Sessões a cada 15 minutos
        groups: 30,         // Grupos a cada 30 minutos
        profile: 60,        // Perfis a cada 1 hora
        cleanup: 360        // Cleanup a cada 6 horas
      },
      
      // Execution windows (24h format)
      activeHours: {
        start: 6,           // 6:00 AM
        end: 23             // 11:00 PM
      },
      
      // Days of week (0 = Sunday, 6 = Saturday)
      activeDays: [1, 2, 3, 4, 5, 6], // Monday to Saturday
      
      // Maximum concurrent jobs
      maxConcurrentJobs: 3,
      
      // Retry settings
      maxRetries: 3,
      retryDelayMinutes: 5,
      
      // Performance settings
      maxHistorySize: 500,
      enableMetrics: true,
      enableSmartDelays: true,
      
      // Anti-detection
      randomizeIntervals: true,
      maxRandomVariation: 0.2  // 20% variation
    };
    
    // Job statistics
    this.stats = {
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      retriedJobs: 0,
      averageExecutionTime: 0,
      lastExecution: null,
      uptime: Date.now()
    };
    
    // Job registry
    this.jobRegistry = {
      'session_extraction': {
        name: 'Session Data Extraction',
        type: 'session',
        interval: this.config.defaultIntervals.session,
        handler: this.executeSessionExtraction.bind(this),
        priority: 'high',
        concurrent: false
      },
      'groups_extraction': {
        name: 'Groups Data Extraction', 
        type: 'groups',
        interval: this.config.defaultIntervals.groups,
        handler: this.executeGroupsExtraction.bind(this),
        priority: 'medium',
        concurrent: true
      },
      'profile_extraction': {
        name: 'Profile Data Extraction',
        type: 'profile', 
        interval: this.config.defaultIntervals.profile,
        handler: this.executeProfileExtraction.bind(this),
        priority: 'low',
        concurrent: true
      },
      'system_cleanup': {
        name: 'System Cleanup',
        type: 'cleanup',
        interval: this.config.defaultIntervals.cleanup,
        handler: this.executeSystemCleanup.bind(this),
        priority: 'low',
        concurrent: false
      }
    };
    
    logger.info('CRON_SCHEDULER', 'CronScheduler initialized', {
      defaultJobs: Object.keys(this.jobRegistry).length,
      activeHours: `${this.config.activeHours.start}:00 - ${this.config.activeHours.end}:00`
    });
  }

  /**
   * Initialize and start the scheduler
   */
  async initialize() {
    try {
      logger.info('CRON_SCHEDULER', '🕐 Initializing cron scheduler');
      
      // Setup default jobs
      await this.setupDefaultJobs();
      
      // Start the scheduler
      await this.start();
      
      // Setup cleanup interval
      this.setupCleanupInterval();
      
      logger.info('CRON_SCHEDULER', '✅ Cron scheduler initialized successfully', {
        activeJobs: this.jobs.size,
        activeAlarms: this.activeAlarms.size
      });
      
    } catch (error) {
      logger.error('CRON_SCHEDULER', 'Failed to initialize cron scheduler', null, error);
      throw error;
    }
  }

  /**
   * Setup default extraction jobs
   */
  async setupDefaultJobs() {
    for (const [jobId, jobConfig] of Object.entries(this.jobRegistry)) {
      await this.scheduleJob(jobId, jobConfig);
    }
    
    logger.info('CRON_SCHEDULER', 'Default jobs configured', {
      jobsCount: Object.keys(this.jobRegistry).length
    });
  }

  /**
   * Schedule a new job
   */
  async scheduleJob(jobId, jobConfig) {
    try {
      // Calculate interval with randomization
      const interval = this.calculateInterval(jobConfig.interval);
      
      // Create alarm name
      const alarmName = `cron_${jobId}`;
      
      // Create Chrome alarm
      await chrome.alarms.create(alarmName, {
        delayInMinutes: this.getInitialDelay(jobConfig.priority),
        periodInMinutes: interval
      });
      
      // Store job configuration
      const job = {
        id: jobId,
        alarmName,
        config: jobConfig,
        interval,
        scheduledAt: Date.now(),
        lastExecution: null,
        executionCount: 0,
        failureCount: 0,
        isActive: true,
        nextExecution: Date.now() + (this.getInitialDelay(jobConfig.priority) * 60 * 1000)
      };
      
      this.jobs.set(jobId, job);
      this.activeAlarms.add(alarmName);
      
      logger.debug('CRON_SCHEDULER', `Job scheduled: ${jobId}`, {
        interval: `${interval} minutes`,
        nextExecution: new Date(job.nextExecution).toLocaleTimeString(),
        priority: jobConfig.priority
      });
      
      return job;
      
    } catch (error) {
      logger.error('CRON_SCHEDULER', `Failed to schedule job: ${jobId}`, null, error);
      throw error;
    }
  }

  /**
   * Start the scheduler
   */
  async start() {
    if (this.isRunning) {
      logger.warn('CRON_SCHEDULER', 'Scheduler is already running');
      return;
    }
    
    this.isRunning = true;
    this.stats.uptime = Date.now();
    
    // Setup alarm listener
    if (chrome.alarms && chrome.alarms.onAlarm) {
      chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));
    }
    
    logger.info('CRON_SCHEDULER', '▶️ Cron scheduler started');
  }

  /**
   * Stop the scheduler
   */
  async stop() {
    if (!this.isRunning) {
      logger.warn('CRON_SCHEDULER', 'Scheduler is not running');
      return;
    }
    
    // Clear all alarms
    for (const alarmName of this.activeAlarms) {
      try {
        await chrome.alarms.clear(alarmName);
      } catch (error) {
        logger.debug('CRON_SCHEDULER', `Failed to clear alarm: ${alarmName}`, null, error);
      }
    }
    
    this.activeAlarms.clear();
    this.isRunning = false;
    
    logger.info('CRON_SCHEDULER', '⏹️ Cron scheduler stopped');
  }

  /**
   * Handle alarm execution
   */
  async handleAlarm(alarm) {
    if (!this.isRunning) return;
    
    const alarmName = alarm.name;
    
    // Check if this is our alarm
    if (!alarmName.startsWith('cron_')) return;
    
    const jobId = alarmName.replace('cron_', '');
    const job = this.jobs.get(jobId);
    
    if (!job || !job.isActive) {
      logger.debug('CRON_SCHEDULER', `Alarm for inactive job: ${jobId}`);
      return;
    }
    
    // Check execution window
    if (!this.isExecutionAllowed()) {
      logger.debug('CRON_SCHEDULER', `Execution not allowed at this time: ${jobId}`);
      return;
    }
    
    logger.info('CRON_SCHEDULER', `⏰ Executing scheduled job: ${jobId}`);
    
    await this.executeJob(job);
  }

  /**
   * Execute a specific job
   */
  async executeJob(job) {
    const startTime = performance.now();
    const executionId = this.generateExecutionId();
    
    try {
      // Check concurrent execution limit
      if (!this.canExecuteConcurrently(job)) {
        logger.debug('CRON_SCHEDULER', `Concurrent limit reached for job: ${job.id}`);
        return;
      }
      
      // Update job statistics
      job.executionCount++;
      job.lastExecution = Date.now();
      this.stats.totalJobs++;
      
      logger.debug('CRON_SCHEDULER', `Starting job execution: ${job.id}`, {
        executionId,
        executionCount: job.executionCount
      });
      
      // Execute the job handler
      const result = await job.config.handler(executionId);
      
      // Calculate execution time
      const executionTime = performance.now() - startTime;
      this.updateAverageExecutionTime(executionTime);
      
      // Record successful execution
      const execution = {
        id: executionId,
        jobId: job.id,
        timestamp: new Date().toISOString(),
        duration: executionTime,
        success: true,
        result: result || {},
        error: null
      };
      
      this.addToHistory(execution);
      this.stats.successfulJobs++;
      this.stats.lastExecution = Date.now();
      
      // Update next execution time
      this.updateNextExecution(job);
      
      logger.info('CRON_SCHEDULER', `✅ Job completed successfully: ${job.id}`, {
        executionId,
        duration: `${executionTime.toFixed(2)}ms`,
        result: result?.summary || 'No summary'
      });
      
    } catch (error) {
      const executionTime = performance.now() - startTime;
      
      // Record failed execution
      const execution = {
        id: executionId,
        jobId: job.id,
        timestamp: new Date().toISOString(),
        duration: executionTime,
        success: false,
        result: null,
        error: {
          message: error.message,
          stack: error.stack
        }
      };
      
      this.addToHistory(execution);
      job.failureCount++;
      this.stats.failedJobs++;
      
      logger.error('CRON_SCHEDULER', `❌ Job execution failed: ${job.id}`, {
        executionId,
        duration: `${executionTime.toFixed(2)}ms`,
        failures: job.failureCount
      }, error);
      
      // Handle job failure
      await this.handleJobFailure(job, error);
    }
  }

  /**
   * Job execution handlers
   */
  async executeSessionExtraction(executionId) {
    logger.info('CRON_SCHEDULER', 'Executing autonomous session extraction', { executionId });
    
    try {
      // Check if cache is still valid first
      const cacheKey = 'current_user_session';
      const cachedData = await globalThis.cacheManager?.get(cacheKey, 'session');
      
      if (cachedData) {
        logger.debug('CRON_SCHEDULER', 'Session data still cached, skipping extraction');
        return { 
          summary: 'Skipped - cached data still valid',
          cached: true,
          cacheAge: Date.now() - new Date(cachedData.timestamp).getTime()
        };
      }
      
      // Use Background Session Extractor (no DOM needed)
      if (globalThis.BackgroundSessionExtractor) {
        const extractor = new globalThis.BackgroundSessionExtractor();
        const sessionData = await extractor.extractSession({ force: false });
        
        if (sessionData) {
          // Cache the result
          await globalThis.cacheManager?.set(cacheKey, sessionData, 'session');
          
          return {
            summary: 'Session extracted via background APIs',
            userId: sessionData.userId,
            cookieCount: sessionData.cookies?.length || 0,
            method: 'background_apis',
            validation: sessionData.validation
          };
        }
      }
      
      // Fallback: Direct cookies extraction
      logger.warn('CRON_SCHEDULER', 'Falling back to direct cookies extraction');
      return await this.executeCookiesOnlyExtraction();
      
    } catch (error) {
      throw new Error(`Session extraction failed: ${error.message}`);
    }
  }

  async executeCookiesOnlyExtraction() {
    try {
      // Extract only from cookies without needing Facebook page
      const cookies = await globalThis.vendaBoostCore?.extractFacebookCookies();
      
      if (!cookies || cookies.length === 0) {
        throw new Error('No Facebook cookies available');
      }
      
      // Get user ID from cookies
      const cUserCookie = cookies.find(c => c.name === 'c_user');
      if (!cUserCookie) {
        throw new Error('User not logged in (no c_user cookie)');
      }
      
      // Create minimal session data from cookies
      const sessionData = {
        userId: cUserCookie.value,
        timestamp: new Date().toISOString(),
        cookies: cookies,
        source: 'cookies_only',
        extractionMethod: 'background_autonomous',
        userAgent: 'background_process'
      };
      
      // Cache and return
      await globalThis.cacheManager?.set('current_user_session', sessionData, 'session');
      
      return {
        summary: 'Session extracted from cookies only',
        userId: sessionData.userId,
        cookieCount: sessionData.cookies.length,
        method: 'cookies_only'
      };
      
    } catch (error) {
      throw new Error(`Cookies-only extraction failed: ${error.message}`);
    }
  }

  async executeGroupsExtraction(executionId) {
    logger.info('CRON_SCHEDULER', 'Executing groups extraction', { executionId });
    
    try {
      // First check if user is logged in
      if (globalThis.BackgroundSessionExtractor) {
        const sessionExtractor = new globalThis.BackgroundSessionExtractor();
        const isLoggedIn = await sessionExtractor.isLoggedIn();
        
        if (!isLoggedIn) {
          return {
            summary: 'Skipped - User not logged in to Facebook',
            groupsCount: 0,
            strategy: 'skipped',
            reason: 'not_logged_in'
          };
        }
        
        const userId = await sessionExtractor.getCurrentUserId();
        
        // Use Silent Groups Extractor for real background extraction
        if (globalThis.SilentGroupsExtractor) {
          const extractor = new globalThis.SilentGroupsExtractor();
          const result = await extractor.extractGroupsSilently(userId, { 
            scheduledExecution: true,
            executionId 
          });
          
          if (result.success) {
            return {
              summary: 'Groups extracted silently via invisible tabs',
              groupsCount: result.groupsCount || 0,
              strategy: 'silent_extraction',
              dataSize: result.groupsCount * 200, // Estimate
              duration: result.duration,
              userId: result.userId
            };
          } else {
            throw new Error(result.error || 'Silent extraction failed');
          }
        }
      }
      
      // Fallback to regular GroupsExtractor
      if (globalThis.GroupsExtractor) {
        logger.warn('CRON_SCHEDULER', 'Falling back to regular groups extractor');
        
        const extractor = new globalThis.GroupsExtractor();
        const groupsData = await extractor.extractGroups(null, { force: false });
        
        if (groupsData) {
          return {
            summary: 'Groups extracted successfully (fallback)',
            groupsCount: groupsData.groups?.length || 0,
            strategy: groupsData.strategy,
            dataSize: JSON.stringify(groupsData).length
          };
        }
      }
      
      throw new Error('No groups extractor available');
      
    } catch (error) {
      throw new Error(`Groups extraction failed: ${error.message}`);
    }
  }

  async executeProfileExtraction(executionId) {
    logger.info('CRON_SCHEDULER', 'Executing profile extraction', { executionId });
    
    try {
      // Execute extraction using ProfileExtractor
      if (globalThis.ProfileExtractor) {
        const extractor = new globalThis.ProfileExtractor();
        const profileData = await extractor.extractProfile(null, { force: false });
        
        if (profileData) {
          return {
            summary: 'Profile extracted successfully',
            userId: profileData.userId,
            completenessScore: profileData.completenessScore || 0,
            dataSize: JSON.stringify(profileData).length
          };
        }
      }
      
      throw new Error('ProfileExtractor not available or extraction failed');
      
    } catch (error) {
      throw new Error(`Profile extraction failed: ${error.message}`);
    }
  }

  async executeSystemCleanup(executionId) {
    logger.info('CRON_SCHEDULER', 'Executing system cleanup', { executionId });
    
    try {
      let cleanupActions = 0;
      
      // Cache cleanup
      if (globalThis.cacheManager) {
        await globalThis.cacheManager.cleanup();
        cleanupActions++;
      }
      
      // Log cleanup
      if (globalThis.logger && this.executionHistory.length > this.config.maxHistorySize) {
        this.executionHistory = this.executionHistory.slice(-this.config.maxHistorySize);
        cleanupActions++;
      }
      
      // Chrome storage cleanup
      try {
        const usage = await chrome.storage.local.getBytesInUse();
        if (usage > 50 * 1024 * 1024) { // 50MB
          logger.warn('CRON_SCHEDULER', 'Storage usage high', { usage });
        }
      } catch (error) {
        // Ignore storage errors
      }
      
      return {
        summary: 'System cleanup completed',
        actionsPerformed: cleanupActions,
        historySize: this.executionHistory.length
      };
      
    } catch (error) {
      throw new Error(`System cleanup failed: ${error.message}`);
    }
  }

  /**
   * Utility methods
   */
  calculateInterval(baseInterval) {
    if (!this.config.randomizeIntervals) {
      return baseInterval;
    }
    
    const variation = baseInterval * this.config.maxRandomVariation;
    const randomOffset = (Math.random() - 0.5) * 2 * variation;
    
    return Math.max(1, Math.round(baseInterval + randomOffset));
  }

  getInitialDelay(priority) {
    switch (priority) {
      case 'high':
        return 1; // 1 minute
      case 'medium':
        return 2; // 2 minutes
      case 'low':
        return 5; // 5 minutes
      default:
        return 3; // 3 minutes
    }
  }

  isExecutionAllowed() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // Check active hours
    if (hour < this.config.activeHours.start || hour >= this.config.activeHours.end) {
      return false;
    }
    
    // Check active days
    if (!this.config.activeDays.includes(day)) {
      return false;
    }
    
    return true;
  }

  canExecuteConcurrently(job) {
    // If job doesn't allow concurrent execution
    if (!job.config.concurrent) {
      return true; // Single execution is always allowed
    }
    
    // Count currently running jobs
    const runningJobs = this.executionHistory
      .filter(exec => exec.timestamp > Date.now() - 5 * 60 * 1000) // Last 5 minutes
      .filter(exec => !exec.success && !exec.error); // Still running
    
    return runningJobs.length < this.config.maxConcurrentJobs;
  }

  updateNextExecution(job) {
    const interval = this.calculateInterval(job.config.interval);
    job.nextExecution = Date.now() + (interval * 60 * 1000);
    job.interval = interval;
  }

  async handleJobFailure(job, error) {
    // Increase failure count
    job.failureCount++;
    
    // If too many failures, temporarily disable job
    if (job.failureCount >= this.config.maxRetries) {
      logger.warn('CRON_SCHEDULER', `Job disabled due to repeated failures: ${job.id}`, {
        failures: job.failureCount
      });
      
      await this.disableJob(job.id);
      
      // Schedule re-enable after delay
      setTimeout(() => {
        this.enableJob(job.id);
      }, this.config.retryDelayMinutes * 60 * 1000);
    }
  }

  updateAverageExecutionTime(executionTime) {
    const totalExecutions = this.stats.successfulJobs + this.stats.failedJobs;
    this.stats.averageExecutionTime = 
      ((this.stats.averageExecutionTime * (totalExecutions - 1)) + executionTime) / totalExecutions;
  }

  addToHistory(execution) {
    this.executionHistory.push(execution);
    
    if (this.executionHistory.length > this.config.maxHistorySize) {
      this.executionHistory.shift();
    }
  }

  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setupCleanupInterval() {
    // Cleanup history every hour
    setInterval(() => {
      if (this.executionHistory.length > this.config.maxHistorySize) {
        this.executionHistory = this.executionHistory.slice(-this.config.maxHistorySize);
        logger.debug('CRON_SCHEDULER', 'Execution history cleaned up');
      }
    }, 60 * 60 * 1000);
  }

  /**
   * Public interface methods
   */
  async enableJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.isActive = true;
      job.failureCount = 0; // Reset failure count
      logger.info('CRON_SCHEDULER', `Job enabled: ${jobId}`);
    }
  }

  async disableJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.isActive = false;
      logger.info('CRON_SCHEDULER', `Job disabled: ${jobId}`);
    }
  }

  async rescheduleJob(jobId, newInterval) {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }
    
    // Clear existing alarm
    await chrome.alarms.clear(job.alarmName);
    
    // Update interval
    job.config.interval = newInterval;
    
    // Reschedule
    await this.scheduleJob(jobId, job.config);
    
    logger.info('CRON_SCHEDULER', `Job rescheduled: ${jobId}`, {
      newInterval: `${newInterval} minutes`
    });
  }

  getJobStatus(jobId = null) {
    if (jobId) {
      const job = this.jobs.get(jobId);
      if (!job) return null;
      
      return {
        id: job.id,
        name: job.config.name,
        isActive: job.isActive,
        interval: job.interval,
        executionCount: job.executionCount,
        failureCount: job.failureCount,
        lastExecution: job.lastExecution,
        nextExecution: job.nextExecution,
        priority: job.config.priority
      };
    }
    
    // Return status for all jobs
    const allJobs = {};
    for (const [jobId, job] of this.jobs.entries()) {
      allJobs[jobId] = this.getJobStatus(jobId);
    }
    
    return allJobs;
  }

  getSchedulerStats() {
    const uptime = Date.now() - this.stats.uptime;
    const successRate = this.stats.totalJobs > 0 
      ? ((this.stats.successfulJobs / this.stats.totalJobs) * 100).toFixed(2)
      : 0;
    
    return {
      ...this.stats,
      uptime: uptime,
      uptimeFormatted: this.formatDuration(uptime),
      successRate: `${successRate}%`,
      activeJobs: Array.from(this.jobs.values()).filter(j => j.isActive).length,
      totalJobs: this.jobs.size,
      averageExecutionTimeFormatted: `${this.stats.averageExecutionTime.toFixed(2)}ms`,
      isRunning: this.isRunning
    };
  }

  getExecutionHistory(jobId = null, limit = 50) {
    let history = [...this.executionHistory];
    
    if (jobId) {
      history = history.filter(exec => exec.jobId === jobId);
    }
    
    return history
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
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
    logger.info('CRON_SCHEDULER', 'Configuration updated', newConfig);
  }

  async restart() {
    logger.info('CRON_SCHEDULER', 'Restarting scheduler');
    await this.stop();
    await this.start();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CronScheduler;
} else {
  globalThis.CronScheduler = CronScheduler;
}