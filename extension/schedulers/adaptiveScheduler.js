/**
 * VendaBoost Extension - Adaptive Scheduler
 * Sistema inteligente que aprende padrões de atividade e otimiza extrações automaticamente
 */

class AdaptiveScheduler {
  constructor() {
    this.activityPatterns = new Map();
    this.learningData = [];
    this.currentSchedule = new Map();
    this.isLearning = true;
    this.isRunning = false;
    
    // Configuration
    this.config = {
      // Learning settings
      learningPeriodDays: 7,           // Aprender por 7 dias
      minDataPoints: 50,               // Mínimo 50 pontos para padrões confiáveis
      confidenceThreshold: 0.7,        // 70% confiança mínima
      
      // Activity detection
      inactivityThreshold: 30 * 60 * 1000,  // 30 minutos de inatividade
      activityWindow: 60 * 60 * 1000,       // Janela de 1 hora para análise
      
      // Adaptive intervals
      baseIntervals: {
        session: 15,     // 15 minutos base
        groups: 30,      // 30 minutos base
        profile: 60      // 60 minutos base
      },
      
      // Dynamic adjustment factors
      adjustmentFactors: {
        highActivity: 0.5,     // Reduz intervalo em 50% quando ativo
        mediumActivity: 0.75,  // Reduz intervalo em 25%
        lowActivity: 1.5,      // Aumenta intervalo em 50%
        inactive: 3.0          // Aumenta intervalo em 200%
      },
      
      // Time-based patterns
      timeSlots: {
        morning: { start: 6, end: 12 },
        afternoon: { start: 12, end: 18 },
        evening: { start: 18, end: 23 },
        night: { start: 23, end: 6 }
      },
      
      // Machine learning parameters
      decayFactor: 0.95,              // Peso de dados antigos
      adaptationSpeed: 0.1,           // Velocidade de adaptação
      maxScheduleAdjustment: 5.0,     // Máximo 5x ajuste de intervalo
      
      // Performance settings
      evaluationInterval: 5 * 60 * 1000,   // Avalia a cada 5 minutos
      patternUpdateInterval: 60 * 60 * 1000, // Atualiza padrões a cada hora
      maxHistorySize: 10000,                 // Máximo 10k pontos de dados
      
      // Quality settings
      enablePredictiveScheduling: true,
      enableSeasonalAdjustments: true,
      enableWorkdayDetection: true
    };
    
    // Activity tracking
    this.activityTracker = {
      lastActivity: Date.now(),
      totalActivities: 0,
      activitiesPerHour: new Map(),
      activitiesPerDay: new Map(),
      facebookSessions: [],
      extractionSuccess: new Map(),
      
      // Current session tracking
      currentSession: null,
      sessionStart: null,
      sessionDuration: 0
    };
    
    // Pattern recognition
    this.patterns = {
      hourlyActivity: new Array(24).fill(0),
      dailyActivity: new Array(7).fill(0),
      extractionOptimalTimes: new Map(),
      userBehaviorProfile: {
        mostActiveHours: [],
        preferredDays: [],
        averageSessionDuration: 0,
        activityLevel: 'medium'
      }
    };
    
    // Statistics
    this.stats = {
      totalPredictions: 0,
      correctPredictions: 0,
      adaptationsMade: 0,
      intervalAdjustments: 0,
      learningProgress: 0,
      patternConfidence: 0,
      averageExtractionSuccess: 0,
      uptime: Date.now()
    };
    
    logger.info('ADAPTIVE_SCHEDULER', 'AdaptiveScheduler initialized', {
      learningPeriod: `${this.config.learningPeriodDays} days`,
      evaluationInterval: `${this.config.evaluationInterval / 1000 / 60} minutes`
    });
  }

  /**
   * Initialize and start the adaptive scheduler
   */
  async initialize() {
    try {
      logger.info('ADAPTIVE_SCHEDULER', '🧠 Initializing adaptive scheduler');
      
      // Load existing learning data
      await this.loadLearningData();
      
      // Initialize activity tracking
      this.initializeActivityTracking();
      
      // Start learning and adaptation loops
      await this.start();
      
      logger.info('ADAPTIVE_SCHEDULER', '✅ Adaptive scheduler initialized successfully', {
        learningDataPoints: this.learningData.length,
        isLearning: this.isLearning,
        patterns: Object.keys(this.patterns).length
      });
      
    } catch (error) {
      logger.error('ADAPTIVE_SCHEDULER', 'Failed to initialize adaptive scheduler', null, error);
      throw error;
    }
  }

  /**
   * Start the adaptive scheduler
   */
  async start() {
    if (this.isRunning) {
      logger.warn('ADAPTIVE_SCHEDULER', 'Adaptive scheduler is already running');
      return;
    }
    
    this.isRunning = true;
    this.stats.uptime = Date.now();
    
    // Start evaluation loop
    this.startEvaluationLoop();
    
    // Start pattern update loop
    this.startPatternUpdateLoop();
    
    // Setup activity listeners
    this.setupActivityListeners();
    
    logger.info('ADAPTIVE_SCHEDULER', '▶️ Adaptive scheduler started');
  }

  /**
   * Stop the adaptive scheduler
   */
  async stop() {
    if (!this.isRunning) {
      logger.warn('ADAPTIVE_SCHEDULER', 'Adaptive scheduler is not running');
      return;
    }
    
    this.isRunning = false;
    
    // Clear intervals
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
    }
    
    if (this.patternUpdateInterval) {
      clearInterval(this.patternUpdateInterval);
    }
    
    // Save learning data
    await this.saveLearningData();
    
    logger.info('ADAPTIVE_SCHEDULER', '⏹️ Adaptive scheduler stopped');
  }

  /**
   * Initialize activity tracking
   */
  initializeActivityTracking() {
    // Setup tab monitoring
    if (chrome.tabs && chrome.tabs.onUpdated) {
      chrome.tabs.onUpdated.addListener(this.handleTabActivity.bind(this));
    }
    
    // Setup alarm monitoring  
    if (chrome.alarms && chrome.alarms.onAlarm) {
      chrome.alarms.onAlarm.addListener(this.handleAlarmActivity.bind(this));
    }
    
    // Setup message monitoring
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(this.handleMessageActivity.bind(this));
    }
    
    logger.debug('ADAPTIVE_SCHEDULER', 'Activity tracking initialized');
  }

  /**
   * Handle tab activity events
   */
  handleTabActivity(tabId, changeInfo, tab) {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('facebook.com')) {
      this.recordActivity('facebook_tab_active', {
        tabId,
        url: this.sanitizeUrl(tab.url),
        timestamp: Date.now()
      });
      
      // Start Facebook session tracking
      this.startFacebookSession(tabId);
    }
  }

  /**
   * Handle alarm activity (from cron scheduler)
   */
  handleAlarmActivity(alarm) {
    if (alarm.name.startsWith('cron_')) {
      this.recordActivity('scheduled_extraction', {
        alarmName: alarm.name,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Handle message activity
   */
  handleMessageActivity(request, sender, sendResponse) {
    if (request.action && request.action.includes('extract')) {
      this.recordActivity('manual_extraction', {
        action: request.action,
        source: sender.tab ? 'content' : 'popup',
        timestamp: Date.now()
      });
    }
  }

  /**
   * Record activity for learning
   */
  recordActivity(type, data) {
    const now = Date.now();
    const activity = {
      type,
      timestamp: now,
      hour: new Date(now).getHours(),
      day: new Date(now).getDay(),
      data
    };
    
    this.learningData.push(activity);
    this.activityTracker.lastActivity = now;
    this.activityTracker.totalActivities++;
    
    // Update hourly activity tracking
    const hour = activity.hour;
    this.activityTracker.activitiesPerHour.set(hour, 
      (this.activityTracker.activitiesPerHour.get(hour) || 0) + 1);
    
    // Update daily activity tracking
    const day = activity.day;
    this.activityTracker.activitiesPerDay.set(day,
      (this.activityTracker.activitiesPerDay.get(day) || 0) + 1);
    
    // Maintain data size limit
    if (this.learningData.length > this.config.maxHistorySize) {
      this.learningData.shift();
    }
    
    logger.debug('ADAPTIVE_SCHEDULER', `Activity recorded: ${type}`, {
      hour,
      day,
      totalActivities: this.activityTracker.totalActivities
    });
  }

  /**
   * Start Facebook session tracking
   */
  startFacebookSession(tabId) {
    if (this.activityTracker.currentSession) {
      this.endFacebookSession();
    }
    
    this.activityTracker.currentSession = {
      tabId,
      startTime: Date.now(),
      activities: []
    };
    
    this.activityTracker.sessionStart = Date.now();
    
    logger.debug('ADAPTIVE_SCHEDULER', 'Facebook session started', { tabId });
  }

  /**
   * End Facebook session tracking
   */
  endFacebookSession() {
    if (!this.activityTracker.currentSession) return;
    
    const session = this.activityTracker.currentSession;
    const duration = Date.now() - session.startTime;
    
    this.activityTracker.facebookSessions.push({
      ...session,
      endTime: Date.now(),
      duration
    });
    
    this.activityTracker.sessionDuration = duration;
    this.activityTracker.currentSession = null;
    
    // Record session activity
    this.recordActivity('facebook_session_end', {
      duration,
      activitiesCount: session.activities.length
    });
    
    logger.debug('ADAPTIVE_SCHEDULER', 'Facebook session ended', {
      duration: `${Math.round(duration / 1000)}s`,
      activities: session.activities.length
    });
  }

  /**
   * Main evaluation loop
   */
  startEvaluationLoop() {
    this.evaluationInterval = setInterval(async () => {
      try {
        await this.evaluateAndAdapt();
      } catch (error) {
        logger.error('ADAPTIVE_SCHEDULER', 'Error in evaluation loop', null, error);
      }
    }, this.config.evaluationInterval);
  }

  /**
   * Pattern update loop
   */
  startPatternUpdateLoop() {
    this.patternUpdateInterval = setInterval(async () => {
      try {
        await this.updatePatterns();
      } catch (error) {
        logger.error('ADAPTIVE_SCHEDULER', 'Error updating patterns', null, error);
      }
    }, this.config.patternUpdateInterval);
  }

  /**
   * Main evaluation and adaptation logic
   */
  async evaluateAndAdapt() {
    if (!this.isRunning) return;
    
    const now = Date.now();
    const currentHour = new Date(now).getHours();
    const currentDay = new Date(now).getDay();
    
    // Determine current activity level
    const activityLevel = this.getCurrentActivityLevel();
    
    // Predict optimal extraction times
    const predictions = await this.predictOptimalExtractionTimes();
    
    // Adapt scheduling based on current conditions
    const adaptations = await this.adaptScheduling(activityLevel, predictions);
    
    // Update statistics
    this.updateStatistics(adaptations);
    
    logger.debug('ADAPTIVE_SCHEDULER', 'Evaluation completed', {
      activityLevel,
      adaptations: adaptations.length,
      currentHour,
      predictions: predictions.length
    });
  }

  /**
   * Determine current activity level
   */
  getCurrentActivityLevel() {
    const now = Date.now();
    const windowStart = now - this.config.activityWindow;
    
    // Count recent activities
    const recentActivities = this.learningData.filter(
      activity => activity.timestamp >= windowStart
    );
    
    // Calculate activity score
    const activityScore = recentActivities.length;
    
    // Determine level based on score and patterns
    if (activityScore >= 10) return 'high';
    if (activityScore >= 5) return 'medium';
    if (activityScore >= 1) return 'low';
    
    // Check if user is currently inactive
    const timeSinceLastActivity = now - this.activityTracker.lastActivity;
    if (timeSinceLastActivity > this.config.inactivityThreshold) {
      return 'inactive';
    }
    
    return 'low';
  }

  /**
   * Predict optimal extraction times using learned patterns
   */
  async predictOptimalExtractionTimes() {
    const predictions = [];
    const now = Date.now();
    const currentHour = new Date(now).getHours();
    
    // Analyze historical extraction success rates
    for (const [extractionType, successData] of this.activityTracker.extractionSuccess.entries()) {
      const optimalHours = this.findOptimalHours(successData);
      
      for (const hour of optimalHours) {
        if (hour > currentHour || hour < currentHour - 1) { // Not current hour
          predictions.push({
            type: extractionType,
            hour,
            confidence: this.calculatePredictionConfidence(extractionType, hour),
            expectedSuccess: this.getExpectedSuccess(extractionType, hour)
          });
        }
      }
    }
    
    // Sort by confidence and expected success
    return predictions
      .filter(p => p.confidence >= this.config.confidenceThreshold)
      .sort((a, b) => (b.confidence * b.expectedSuccess) - (a.confidence * a.expectedSuccess))
      .slice(0, 10); // Top 10 predictions
  }

  /**
   * Adapt scheduling based on current conditions
   */
  async adaptScheduling(activityLevel, predictions) {
    const adaptations = [];
    
    // Get current adjustment factor
    const adjustmentFactor = this.config.adjustmentFactors[activityLevel] || 1.0;
    
    // Adapt each extraction type
    for (const [extractionType, baseInterval] of Object.entries(this.config.baseIntervals)) {
      const currentInterval = this.currentSchedule.get(extractionType) || baseInterval;
      
      // Calculate new interval
      let newInterval = Math.round(baseInterval * adjustmentFactor);
      
      // Apply prediction-based adjustments
      const relevantPredictions = predictions.filter(p => p.type === extractionType);
      if (relevantPredictions.length > 0 && this.config.enablePredictiveScheduling) {
        const avgConfidence = relevantPredictions.reduce((sum, p) => sum + p.confidence, 0) / relevantPredictions.length;
        const predictionFactor = 1 - (avgConfidence * 0.3); // Up to 30% reduction
        newInterval = Math.round(newInterval * predictionFactor);
      }
      
      // Apply constraints
      newInterval = Math.max(1, Math.min(newInterval, baseInterval * this.config.maxScheduleAdjustment));
      
      // Only adapt if significant change
      const changeThreshold = Math.max(1, currentInterval * 0.1); // 10% minimum change
      if (Math.abs(newInterval - currentInterval) >= changeThreshold) {
        this.currentSchedule.set(extractionType, newInterval);
        
        // Notify cron scheduler about interval change
        await this.notifySchedulerChange(extractionType, newInterval);
        
        adaptations.push({
          type: extractionType,
          oldInterval: currentInterval,
          newInterval,
          factor: adjustmentFactor,
          activityLevel,
          timestamp: Date.now()
        });
        
        this.stats.intervalAdjustments++;
      }
    }
    
    if (adaptations.length > 0) {
      logger.info('ADAPTIVE_SCHEDULER', '⚡ Schedule adapted', {
        activityLevel,
        adaptations: adaptations.length,
        intervals: Object.fromEntries(this.currentSchedule)
      });
    }
    
    return adaptations;
  }

  /**
   * Update learned patterns
   */
  async updatePatterns() {
    if (!this.isRunning || this.learningData.length < this.config.minDataPoints) {
      return;
    }
    
    // Update hourly activity patterns
    this.updateHourlyPatterns();
    
    // Update daily activity patterns
    this.updateDailyPatterns();
    
    // Update user behavior profile
    this.updateUserBehaviorProfile();
    
    // Calculate learning progress
    this.updateLearningProgress();
    
    logger.debug('ADAPTIVE_SCHEDULER', 'Patterns updated', {
      dataPoints: this.learningData.length,
      confidence: this.stats.patternConfidence,
      progress: this.stats.learningProgress
    });
  }

  /**
   * Update hourly activity patterns
   */
  updateHourlyPatterns() {
    const hourlyData = new Array(24).fill(0);
    
    // Count activities per hour
    for (const activity of this.learningData) {
      if (activity.hour !== undefined) {
        hourlyData[activity.hour]++;
      }
    }
    
    // Apply decay factor to existing patterns
    for (let i = 0; i < 24; i++) {
      this.patterns.hourlyActivity[i] = 
        (this.patterns.hourlyActivity[i] * this.config.decayFactor) + 
        (hourlyData[i] * this.config.adaptationSpeed);
    }
    
    // Find most active hours
    const sortedHours = Array.from({length: 24}, (_, i) => ({
      hour: i,
      activity: this.patterns.hourlyActivity[i]
    })).sort((a, b) => b.activity - a.activity);
    
    this.patterns.userBehaviorProfile.mostActiveHours = sortedHours.slice(0, 6).map(h => h.hour);
  }

  /**
   * Update daily activity patterns
   */
  updateDailyPatterns() {
    const dailyData = new Array(7).fill(0);
    
    // Count activities per day
    for (const activity of this.learningData) {
      if (activity.day !== undefined) {
        dailyData[activity.day]++;
      }
    }
    
    // Apply decay factor to existing patterns
    for (let i = 0; i < 7; i++) {
      this.patterns.dailyActivity[i] = 
        (this.patterns.dailyActivity[i] * this.config.decayFactor) + 
        (dailyData[i] * this.config.adaptationSpeed);
    }
    
    // Find preferred days
    const sortedDays = Array.from({length: 7}, (_, i) => ({
      day: i,
      activity: this.patterns.dailyActivity[i]
    })).sort((a, b) => b.activity - a.activity);
    
    this.patterns.userBehaviorProfile.preferredDays = sortedDays.slice(0, 5).map(d => d.day);
  }

  /**
   * Update user behavior profile
   */
  updateUserBehaviorProfile() {
    const profile = this.patterns.userBehaviorProfile;
    
    // Calculate average session duration
    if (this.activityTracker.facebookSessions.length > 0) {
      const totalDuration = this.activityTracker.facebookSessions.reduce(
        (sum, session) => sum + session.duration, 0
      );
      profile.averageSessionDuration = totalDuration / this.activityTracker.facebookSessions.length;
    }
    
    // Determine activity level
    const recentActivities = this.learningData.filter(
      activity => activity.timestamp > Date.now() - (7 * 24 * 60 * 60 * 1000) // Last 7 days
    );
    
    const avgActivitiesPerDay = recentActivities.length / 7;
    
    if (avgActivitiesPerDay >= 20) profile.activityLevel = 'high';
    else if (avgActivitiesPerDay >= 10) profile.activityLevel = 'medium';
    else profile.activityLevel = 'low';
  }

  /**
   * Update learning progress
   */
  updateLearningProgress() {
    const requiredDataPoints = this.config.minDataPoints * this.config.learningPeriodDays;
    const currentDataPoints = this.learningData.length;
    
    this.stats.learningProgress = Math.min(1.0, currentDataPoints / requiredDataPoints);
    
    // Calculate pattern confidence
    const hourlyVariance = this.calculateVariance(this.patterns.hourlyActivity);
    const dailyVariance = this.calculateVariance(this.patterns.dailyActivity);
    
    this.stats.patternConfidence = Math.max(0, 1 - Math.sqrt(hourlyVariance + dailyVariance) / 100);
    
    // Check if learning phase should end
    if (this.isLearning && 
        this.stats.learningProgress >= 1.0 && 
        this.stats.patternConfidence >= this.config.confidenceThreshold) {
      
      this.isLearning = false;
      logger.info('ADAPTIVE_SCHEDULER', '🎓 Learning phase completed', {
        dataPoints: currentDataPoints,
        confidence: this.stats.patternConfidence
      });
    }
  }

  /**
   * Utility methods
   */
  findOptimalHours(successData) {
    const hourlySuccess = new Array(24).fill(0);
    const hourlyCounts = new Array(24).fill(0);
    
    for (const [hour, successes] of successData.entries()) {
      hourlySuccess[hour] = successes.reduce((sum, s) => sum + (s ? 1 : 0), 0);
      hourlyCounts[hour] = successes.length;
    }
    
    // Calculate success rates
    const successRates = hourlySuccess.map((successes, hour) => 
      hourlyCounts[hour] > 0 ? successes / hourlyCounts[hour] : 0
    );
    
    // Find hours with success rate above average
    const avgSuccessRate = successRates.reduce((sum, rate) => sum + rate, 0) / 24;
    
    return successRates
      .map((rate, hour) => ({ hour, rate }))
      .filter(item => item.rate >= avgSuccessRate * 1.2) // 20% above average
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 6) // Top 6 hours
      .map(item => item.hour);
  }

  calculatePredictionConfidence(extractionType, hour) {
    const successData = this.activityTracker.extractionSuccess.get(extractionType);
    if (!successData || !successData.has(hour)) return 0;
    
    const hourData = successData.get(hour);
    if (hourData.length < 3) return 0; // Need at least 3 data points
    
    const successRate = hourData.reduce((sum, s) => sum + (s ? 1 : 0), 0) / hourData.length;
    const dataConfidence = Math.min(1.0, hourData.length / 10); // Confidence increases with data
    
    return successRate * dataConfidence;
  }

  getExpectedSuccess(extractionType, hour) {
    const successData = this.activityTracker.extractionSuccess.get(extractionType);
    if (!successData || !successData.has(hour)) return 0.5; // Default 50%
    
    const hourData = successData.get(hour);
    return hourData.reduce((sum, s) => sum + (s ? 1 : 0), 0) / hourData.length;
  }

  calculateVariance(array) {
    const mean = array.reduce((sum, val) => sum + val, 0) / array.length;
    const variance = array.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / array.length;
    return variance;
  }

  sanitizeUrl(url) {
    try {
      const urlObj = new URL(url);
      return `${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return 'invalid-url';
    }
  }

  updateStatistics(adaptations) {
    this.stats.adaptationsMade += adaptations.length;
    this.stats.totalPredictions++;
    
    // Update success tracking (would be called by external systems)
    // this.recordExtractionResult(type, success);
  }

  async notifySchedulerChange(extractionType, newInterval) {
    // Notify cron scheduler about interval change
    if (globalThis.cronScheduler) {
      try {
        const jobId = `${extractionType}_extraction`;
        await globalThis.cronScheduler.rescheduleJob(jobId, newInterval);
        
        logger.debug('ADAPTIVE_SCHEDULER', `Notified scheduler: ${jobId}`, {
          newInterval: `${newInterval} minutes`
        });
      } catch (error) {
        logger.debug('ADAPTIVE_SCHEDULER', 'Failed to notify scheduler', null, error);
      }
    }
  }

  setupActivityListeners() {
    // Additional activity listeners can be setup here
    logger.debug('ADAPTIVE_SCHEDULER', 'Activity listeners setup completed');
  }

  /**
   * Public interface methods
   */
  async recordExtractionResult(extractionType, success, hour = null) {
    const extractionHour = hour || new Date().getHours();
    
    if (!this.activityTracker.extractionSuccess.has(extractionType)) {
      this.activityTracker.extractionSuccess.set(extractionType, new Map());
    }
    
    const typeData = this.activityTracker.extractionSuccess.get(extractionType);
    if (!typeData.has(extractionHour)) {
      typeData.set(extractionHour, []);
    }
    
    typeData.get(extractionHour).push(success);
    
    // Limit data size per hour
    const hourData = typeData.get(extractionHour);
    if (hourData.length > 50) {
      hourData.shift();
    }
    
    // Update average success rate
    const totalResults = Array.from(typeData.values()).flat();
    const successCount = totalResults.filter(s => s).length;
    this.stats.averageExtractionSuccess = successCount / totalResults.length;
    
    logger.debug('ADAPTIVE_SCHEDULER', 'Extraction result recorded', {
      type: extractionType,
      success,
      hour: extractionHour,
      totalResults: totalResults.length
    });
  }

  getCurrentSchedule() {
    return Object.fromEntries(this.currentSchedule);
  }

  getAdaptiveStats() {
    const uptime = Date.now() - this.stats.uptime;
    
    return {
      ...this.stats,
      uptime,
      uptimeFormatted: this.formatDuration(uptime),
      isLearning: this.isLearning,
      dataPoints: this.learningData.length,
      activityLevel: this.patterns.userBehaviorProfile.activityLevel,
      mostActiveHours: this.patterns.userBehaviorProfile.mostActiveHours,
      currentSchedule: this.getCurrentSchedule(),
      predictionAccuracy: this.stats.totalPredictions > 0 
        ? `${((this.stats.correctPredictions / this.stats.totalPredictions) * 100).toFixed(2)}%`
        : '0%'
    };
  }

  getActivityPatterns() {
    return {
      hourlyActivity: [...this.patterns.hourlyActivity],
      dailyActivity: [...this.patterns.dailyActivity],
      userProfile: { ...this.patterns.userBehaviorProfile },
      recentSessions: this.activityTracker.facebookSessions.slice(-10)
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

  async loadLearningData() {
    try {
      const result = await chrome.storage.local.get(['adaptive_learning_data']);
      if (result.adaptive_learning_data) {
        const data = result.adaptive_learning_data;
        this.learningData = data.learningData || [];
        this.patterns = { ...this.patterns, ...data.patterns };
        this.stats = { ...this.stats, ...data.stats };
        
        logger.info('ADAPTIVE_SCHEDULER', 'Learning data loaded', {
          dataPoints: this.learningData.length
        });
      }
    } catch (error) {
      logger.error('ADAPTIVE_SCHEDULER', 'Failed to load learning data', null, error);
    }
  }

  async saveLearningData() {
    try {
      const data = {
        learningData: this.learningData,
        patterns: this.patterns,
        stats: this.stats,
        savedAt: Date.now()
      };
      
      await chrome.storage.local.set({
        adaptive_learning_data: data
      });
      
      logger.debug('ADAPTIVE_SCHEDULER', 'Learning data saved');
    } catch (error) {
      logger.error('ADAPTIVE_SCHEDULER', 'Failed to save learning data', null, error);
    }
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('ADAPTIVE_SCHEDULER', 'Configuration updated', newConfig);
  }

  resetLearning() {
    this.learningData = [];
    this.patterns.hourlyActivity.fill(0);
    this.patterns.dailyActivity.fill(0);
    this.stats.learningProgress = 0;
    this.stats.patternConfidence = 0;
    this.isLearning = true;
    
    logger.info('ADAPTIVE_SCHEDULER', 'Learning data reset');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdaptiveScheduler;
} else {
  globalThis.AdaptiveScheduler = AdaptiveScheduler;
}