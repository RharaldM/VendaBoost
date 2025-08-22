/**
 * VendaBoost Extension - Central Debugging System
 * Sistema avançado de debugging para toda a extensão
 */

class DebugSystem {
  constructor() {
    this.debugSessions = new Map();
    this.breakpoints = new Map();
    this.watchList = new Map();
    this.executionTrace = [];
    this.isDebugging = false;
    
    // Configuration
    this.config = {
      // Debug levels
      levels: {
        TRACE: 0,
        DEBUG: 1,
        INFO: 2,
        WARN: 3,
        ERROR: 4
      },
      
      // Debug modes
      modes: {
        FULL: 'full',           // Log everything
        COMPONENTS: 'components', // Only component interactions
        ERRORS: 'errors',       // Only errors and warnings
        PERFORMANCE: 'performance', // Performance metrics only
        EXTRACTION: 'extraction'  // Only extraction-related logs
      },
      
      // Performance settings
      maxTraceSize: 5000,
      maxSessionHistory: 100,
      enableStackTrace: true,
      enablePerformanceTrace: true,
      enableMemoryTracking: true,
      
      // Real-time debugging
      enableRealTimeDebugging: false,
      realTimeInterval: 1000,
      enableRemoteDebugging: false,
      
      // Export settings
      enableExport: true,
      exportFormat: 'json',
      includeStackTraces: true,
      includePerfMetrics: true
    };
    
    // Current debug session
    this.currentSession = {
      id: null,
      startTime: null,
      mode: this.config.modes.FULL,
      level: this.config.levels.DEBUG,
      componentFilter: null,
      captures: []
    };
    
    // Debug statistics
    this.stats = {
      totalSessions: 0,
      totalLogs: 0,
      totalErrors: 0,
      avgSessionDuration: 0,
      largestTrace: 0,
      debuggerUptime: Date.now()
    };
    
    logger.info('DEBUG_SYSTEM', 'DebugSystem initialized', {
      modes: Object.keys(this.config.modes).length,
      levels: Object.keys(this.config.levels).length
    });
  }

  /**
   * Start debugging session
   */
  startSession(options = {}) {
    try {
      // End current session if exists
      if (this.currentSession.id) {
        this.endSession();
      }
      
      // Create new session
      const sessionId = this.generateSessionId();
      this.currentSession = {
        id: sessionId,
        startTime: Date.now(),
        mode: options.mode || this.config.modes.FULL,
        level: options.level || this.config.levels.DEBUG,
        componentFilter: options.components || null,
        captures: [],
        metadata: {
          userAgent: navigator.userAgent,
          url: window.location?.href || 'background',
          options: options
        }
      };
      
      this.isDebugging = true;
      this.stats.totalSessions++;
      
      // Setup session logging
      this.setupSessionLogging();
      
      // Setup component monitoring
      this.setupComponentMonitoring();
      
      // Setup performance monitoring
      if (this.config.enablePerformanceTrace) {
        this.setupPerformanceMonitoring();
      }
      
      logger.info('DEBUG_SYSTEM', `🐛 Debug session started: ${sessionId}`, {
        mode: this.currentSession.mode,
        level: Object.keys(this.config.levels)[this.currentSession.level],
        componentFilter: this.currentSession.componentFilter
      });
      
      return sessionId;
      
    } catch (error) {
      logger.error('DEBUG_SYSTEM', 'Failed to start debug session', null, error);
      throw error;
    }
  }

  /**
   * End debugging session
   */
  endSession() {
    if (!this.currentSession.id) {
      logger.warn('DEBUG_SYSTEM', 'No active debug session to end');
      return null;
    }
    
    try {
      const sessionId = this.currentSession.id;
      const duration = Date.now() - this.currentSession.startTime;
      
      // Store session data
      const sessionData = {
        ...this.currentSession,
        endTime: Date.now(),
        duration,
        totalCaptures: this.currentSession.captures.length,
        finalStats: this.generateSessionStats()
      };
      
      this.debugSessions.set(sessionId, sessionData);
      
      // Update statistics
      this.updateStats(sessionData);
      
      // Clear current session
      this.currentSession = {
        id: null,
        startTime: null,
        mode: this.config.modes.FULL,
        level: this.config.levels.DEBUG,
        componentFilter: null,
        captures: []
      };
      
      this.isDebugging = false;
      
      logger.info('DEBUG_SYSTEM', `🏁 Debug session ended: ${sessionId}`, {
        duration: this.formatDuration(duration),
        captures: sessionData.totalCaptures
      });
      
      return sessionData;
      
    } catch (error) {
      logger.error('DEBUG_SYSTEM', 'Error ending debug session', null, error);
      return null;
    }
  }

  /**
   * Capture debug information
   */
  capture(component, event, data = null, level = null) {
    if (!this.isDebugging || !this.currentSession.id) {
      return; // Not debugging
    }
    
    try {
      const captureLevel = level || this.config.levels.DEBUG;
      
      // Check if should capture based on session level
      if (captureLevel < this.currentSession.level) {
        return;
      }
      
      // Check component filter
      if (this.currentSession.componentFilter && 
          !this.currentSession.componentFilter.includes(component)) {
        return;
      }
      
      // Create capture
      const capture = {
        id: this.generateCaptureId(),
        timestamp: Date.now(),
        component,
        event,
        level: Object.keys(this.config.levels)[captureLevel],
        data: this.sanitizeData(data),
        stackTrace: this.config.enableStackTrace ? this.getStackTrace() : null,
        performance: this.config.enablePerformanceTrace ? this.getPerformanceSnapshot() : null,
        memory: this.config.enableMemoryTracking ? this.getMemorySnapshot() : null
      };
      
      // Add to current session
      this.currentSession.captures.push(capture);
      
      // Maintain trace size limit
      if (this.currentSession.captures.length > this.config.maxTraceSize) {
        this.currentSession.captures.shift();
      }
      
      // Real-time debugging output
      if (this.config.enableRealTimeDebugging) {
        this.outputRealTimeDebug(capture);
      }
      
    } catch (error) {
      // Don't let debugging break the main application
      console.error('Debug capture error:', error);
    }
  }

  /**
   * Add breakpoint
   */
  addBreakpoint(component, event, condition = null) {
    const breakpointId = `${component}:${event}`;
    
    this.breakpoints.set(breakpointId, {
      id: breakpointId,
      component,
      event,
      condition,
      hitCount: 0,
      enabled: true,
      createdAt: Date.now()
    });
    
    logger.info('DEBUG_SYSTEM', `🔴 Breakpoint added: ${breakpointId}`, {
      condition: condition ? 'conditional' : 'always'
    });
    
    return breakpointId;
  }

  /**
   * Check if breakpoint should trigger
   */
  checkBreakpoint(component, event, data = null) {
    const breakpointId = `${component}:${event}`;
    const breakpoint = this.breakpoints.get(breakpointId);
    
    if (!breakpoint || !breakpoint.enabled) {
      return false;
    }
    
    // Increment hit count
    breakpoint.hitCount++;
    
    // Check condition if exists
    if (breakpoint.condition) {
      try {
        const shouldBreak = typeof breakpoint.condition === 'function'
          ? breakpoint.condition(data)
          : this.evaluateCondition(breakpoint.condition, data);
        
        if (!shouldBreak) return false;
      } catch (error) {
        logger.error('DEBUG_SYSTEM', 'Error evaluating breakpoint condition', { breakpointId }, error);
        return false;
      }
    }
    
    // Trigger breakpoint
    this.triggerBreakpoint(breakpointId, data);
    return true;
  }

  /**
   * Trigger breakpoint
   */
  triggerBreakpoint(breakpointId, data) {
    const breakpoint = this.breakpoints.get(breakpointId);
    
    logger.warn('DEBUG_SYSTEM', `🛑 Breakpoint hit: ${breakpointId}`, {
      hitCount: breakpoint.hitCount,
      data: this.sanitizeData(data)
    });
    
    // Capture full system state at breakpoint
    this.captureSystemSnapshot(breakpointId, data);
    
    // Pause execution if in real-time debug mode
    if (this.config.enableRealTimeDebugging) {
      debugger; // Trigger browser debugger
    }
  }

  /**
   * Add variable to watch list
   */
  addWatch(name, getter, component = 'global') {
    const watchId = `${component}:${name}`;
    
    this.watchList.set(watchId, {
      id: watchId,
      name,
      component,
      getter,
      history: [],
      lastValue: null,
      createdAt: Date.now()
    });
    
    logger.debug('DEBUG_SYSTEM', `👁️ Watch added: ${watchId}`);
    
    return watchId;
  }

  /**
   * Update watch values
   */
  updateWatches() {
    for (const [watchId, watch] of this.watchList.entries()) {
      try {
        const currentValue = typeof watch.getter === 'function' 
          ? watch.getter()
          : this.evaluateExpression(watch.getter);
        
        // Check if value changed
        if (JSON.stringify(currentValue) !== JSON.stringify(watch.lastValue)) {
          watch.history.push({
            timestamp: Date.now(),
            oldValue: watch.lastValue,
            newValue: currentValue
          });
          
          watch.lastValue = currentValue;
          
          // Limit history size
          if (watch.history.length > 100) {
            watch.history.shift();
          }
          
          logger.debug('DEBUG_SYSTEM', `👁️ Watch value changed: ${watchId}`, {
            newValue: this.sanitizeData(currentValue)
          });
        }
        
      } catch (error) {
        logger.debug('DEBUG_SYSTEM', `Watch evaluation error: ${watchId}`, null, error);
      }
    }
  }

  /**
   * Setup session logging
   */
  setupSessionLogging() {
    // Override console methods to capture logs
    if (this.currentSession.mode === this.config.modes.FULL ||
        this.currentSession.mode === this.config.modes.COMPONENTS) {
      
      this.setupConsoleCapture();
    }
  }

  /**
   * Setup component monitoring
   */
  setupComponentMonitoring() {
    // Monitor component interactions
    if (globalThis.vendaBoostCore && globalThis.vendaBoostCore.components) {
      for (const [componentName, component] of globalThis.vendaBoostCore.components.entries()) {
        this.instrumentComponent(componentName, component);
      }
    }
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    // Monitor performance marks and measures
    if (typeof performance !== 'undefined') {
      this.monitorPerformanceMarks();
    }
  }

  /**
   * Instrument component for debugging
   */
  instrumentComponent(componentName, component) {
    if (!component || typeof component !== 'object') return;
    
    // Wrap key methods for monitoring
    const methodsToWrap = ['initialize', 'start', 'stop', 'process', 'execute', 'extract'];
    
    for (const methodName of methodsToWrap) {
      if (typeof component[methodName] === 'function') {
        const originalMethod = component[methodName];
        
        component[methodName] = async (...args) => {
          const startTime = performance.now();
          
          this.capture(componentName, `${methodName}_start`, {
            args: this.sanitizeData(args)
          });
          
          try {
            const result = await originalMethod.apply(component, args);
            const duration = performance.now() - startTime;
            
            this.capture(componentName, `${methodName}_success`, {
              duration: `${duration.toFixed(2)}ms`,
              result: this.sanitizeData(result)
            });
            
            return result;
            
          } catch (error) {
            const duration = performance.now() - startTime;
            
            this.capture(componentName, `${methodName}_error`, {
              duration: `${duration.toFixed(2)}ms`,
              error: error.message
            }, this.config.levels.ERROR);
            
            throw error;
          }
        };
      }
    }
  }

  /**
   * Monitor performance marks
   */
  monitorPerformanceMarks() {
    // TODO: Implement performance monitoring
    // Would use PerformanceObserver to track marks and measures
  }

  /**
   * Capture system snapshot
   */
  captureSystemSnapshot(trigger, data = null) {
    const snapshot = {
      trigger,
      timestamp: Date.now(),
      systemState: globalThis.vendaBoostCore ? {
        ...globalThis.vendaBoostCore.systemState
      } : null,
      componentStates: this.captureComponentStates(),
      memory: this.getMemorySnapshot(),
      performance: this.getPerformanceSnapshot(),
      triggerData: this.sanitizeData(data)
    };
    
    this.executionTrace.push(snapshot);
    
    // Maintain trace size
    if (this.executionTrace.length > this.config.maxTraceSize) {
      this.executionTrace.shift();
    }
    
    logger.debug('DEBUG_SYSTEM', `📸 System snapshot captured: ${trigger}`);
    
    return snapshot;
  }

  /**
   * Capture current component states
   */
  captureComponentStates() {
    const states = {};
    
    if (globalThis.vendaBoostCore && globalThis.vendaBoostCore.components) {
      for (const [componentName, component] of globalThis.vendaBoostCore.components.entries()) {
        try {
          states[componentName] = {
            hasStats: typeof component.getStats === 'function',
            hasStatus: typeof component.getStatus === 'function',
            isRunning: component.isRunning,
            initialized: component.initialized,
            lastActivity: component.lastActivity || component.lastUpdate || null
          };
          
          // Capture stats if available
          if (typeof component.getStats === 'function') {
            states[componentName].stats = component.getStats();
          }
          
        } catch (error) {
          states[componentName] = { error: error.message };
        }
      }
    }
    
    return states;
  }

  /**
   * Get memory snapshot
   */
  getMemorySnapshot() {
    try {
      if (typeof performance !== 'undefined' && performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
        };
      }
    } catch (error) {
      // Memory API not available
    }
    
    return { available: false };
  }

  /**
   * Get performance snapshot
   */
  getPerformanceSnapshot() {
    try {
      if (typeof performance !== 'undefined') {
        return {
          now: performance.now(),
          timeOrigin: performance.timeOrigin,
          navigationStart: performance.timing?.navigationStart,
          loadEventEnd: performance.timing?.loadEventEnd
        };
      }
    } catch (error) {
      // Performance API not available
    }
    
    return { available: false };
  }

  /**
   * Get stack trace
   */
  getStackTrace(limit = 10) {
    try {
      const stack = new Error().stack;
      if (stack) {
        return stack.split('\n')
          .slice(2, limit + 2) // Skip Error() and getStackTrace()
          .map(line => line.trim())
          .filter(line => line.length > 0);
      }
    } catch (error) {
      // Stack trace not available
    }
    
    return [];
  }

  /**
   * Sanitize data for logging
   */
  sanitizeData(data) {
    if (data === null || data === undefined) return data;
    
    try {
      // Create safe copy
      const sanitized = JSON.parse(JSON.stringify(data, (key, value) => {
        // Remove sensitive data
        if (typeof key === 'string') {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes('password') || 
              lowerKey.includes('token') || 
              lowerKey.includes('secret') ||
              lowerKey.includes('cookie') ||
              lowerKey.includes('auth')) {
            return '[REDACTED]';
          }
        }
        
        // Limit large objects
        if (typeof value === 'string' && value.length > 1000) {
          return value.substring(0, 1000) + '...[TRUNCATED]';
        }
        
        return value;
      }));
      
      return sanitized;
      
    } catch (error) {
      return { error: 'Failed to sanitize data', type: typeof data };
    }
  }

  /**
   * Setup console capture
   */
  setupConsoleCapture() {
    // Store original console methods
    this.originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };
    
    // Override console methods
    const self = this;
    
    console.log = function(...args) {
      self.captureConsoleCall('log', args);
      self.originalConsole.log.apply(console, args);
    };
    
    console.info = function(...args) {
      self.captureConsoleCall('info', args);
      self.originalConsole.info.apply(console, args);
    };
    
    console.warn = function(...args) {
      self.captureConsoleCall('warn', args);
      self.originalConsole.warn.apply(console, args);
    };
    
    console.error = function(...args) {
      self.captureConsoleCall('error', args);
      self.originalConsole.error.apply(console, args);
    };
    
    console.debug = function(...args) {
      self.captureConsoleCall('debug', args);
      self.originalConsole.debug.apply(console, args);
    };
  }

  /**
   * Capture console calls
   */
  captureConsoleCall(level, args) {
    this.capture('CONSOLE', `console_${level}`, {
      args: this.sanitizeData(args),
      message: args.join(' ')
    }, this.config.levels[level.toUpperCase()] || this.config.levels.DEBUG);
  }

  /**
   * Generate session statistics
   */
  generateSessionStats() {
    const captures = this.currentSession.captures;
    const stats = {
      totalCaptures: captures.length,
      capturesByLevel: {},
      capturesByComponent: {},
      errorCount: 0,
      warningCount: 0,
      performanceIssues: 0,
      memoryPeaks: []
    };
    
    // Analyze captures
    for (const capture of captures) {
      // Count by level
      stats.capturesByLevel[capture.level] = (stats.capturesByLevel[capture.level] || 0) + 1;
      
      // Count by component
      stats.capturesByComponent[capture.component] = (stats.capturesByComponent[capture.component] || 0) + 1;
      
      // Count errors and warnings
      if (capture.level === 'ERROR') stats.errorCount++;
      if (capture.level === 'WARN') stats.warningCount++;
      
      // Track performance issues
      if (capture.performance && capture.performance.now > 5000) { // > 5 seconds
        stats.performanceIssues++;
      }
      
      // Track memory peaks
      if (capture.memory && capture.memory.usedJSHeapSize) {
        stats.memoryPeaks.push(capture.memory.usedJSHeapSize);
      }
    }
    
    return stats;
  }

  /**
   * Export debug session
   */
  exportSession(sessionId = null) {
    const targetSessionId = sessionId || this.currentSession.id;
    
    if (!targetSessionId) {
      throw new Error('No session ID provided and no active session');
    }
    
    const sessionData = sessionId 
      ? this.debugSessions.get(sessionId)
      : this.currentSession;
    
    if (!sessionData) {
      throw new Error(`Session not found: ${targetSessionId}`);
    }
    
    const exportData = {
      sessionId: targetSessionId,
      exportedAt: new Date().toISOString(),
      version: '2.0.0',
      session: {
        ...sessionData,
        captures: this.config.includeStackTraces 
          ? sessionData.captures
          : sessionData.captures.map(c => ({ ...c, stackTrace: null }))
      },
      systemInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        extensionVersion: globalThis.vendaBoostCore?.systemState?.version
      },
      statistics: this.getDebugStats()
    };
    
    return exportData;
  }

  /**
   * Import debug session
   */
  importSession(exportData) {
    try {
      if (exportData.version !== '2.0.0') {
        logger.warn('DEBUG_SYSTEM', 'Import version mismatch', {
          expected: '2.0.0',
          received: exportData.version
        });
      }
      
      this.debugSessions.set(exportData.sessionId, exportData.session);
      
      logger.info('DEBUG_SYSTEM', `📥 Debug session imported: ${exportData.sessionId}`);
      
      return exportData.sessionId;
      
    } catch (error) {
      logger.error('DEBUG_SYSTEM', 'Failed to import debug session', null, error);
      throw error;
    }
  }

  /**
   * Utility methods
   */
  generateSessionId() {
    return `debug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateCaptureId() {
    return `cap_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  updateStats(sessionData) {
    const duration = sessionData.duration;
    this.stats.avgSessionDuration = 
      ((this.stats.avgSessionDuration * (this.stats.totalSessions - 1)) + duration) / this.stats.totalSessions;
    
    this.stats.totalLogs += sessionData.totalCaptures;
    this.stats.totalErrors += sessionData.finalStats.errorCount;
    this.stats.largestTrace = Math.max(this.stats.largestTrace, sessionData.totalCaptures);
  }

  outputRealTimeDebug(capture) {
    const prefix = `[${capture.component}]`;
    const message = `${capture.event}`;
    const data = capture.data;
    
    switch (capture.level) {
      case 'ERROR':
        console.error(`🔴 ${prefix} ${message}`, data);
        break;
      case 'WARN':
        console.warn(`🟡 ${prefix} ${message}`, data);
        break;
      case 'INFO':
        console.info(`🔵 ${prefix} ${message}`, data);
        break;
      default:
        console.debug(`⚫ ${prefix} ${message}`, data);
    }
  }

  evaluateCondition(condition, data) {
    // Simple condition evaluation
    // In production, would use a safe expression evaluator
    return true;
  }

  evaluateExpression(expression) {
    // Simple expression evaluation for watches
    // In production, would use a safe expression evaluator
    return null;
  }

  /**
   * Public interface methods
   */
  getDebugStats() {
    const uptime = Date.now() - this.stats.debuggerUptime;
    
    return {
      ...this.stats,
      uptime,
      uptimeFormatted: this.formatDuration(uptime),
      isDebugging: this.isDebugging,
      currentSessionId: this.currentSession.id,
      activeSessions: this.debugSessions.size,
      activeBreakpoints: this.breakpoints.size,
      activeWatches: this.watchList.size
    };
  }

  getSessionHistory() {
    return Array.from(this.debugSessions.values())
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, this.config.maxSessionHistory);
  }

  getCurrentCaptures(limit = 100) {
    return this.currentSession.captures.slice(-limit);
  }

  getRecentTrace(limit = 50) {
    return this.executionTrace.slice(-limit);
  }

  removeBreakpoint(breakpointId) {
    const removed = this.breakpoints.delete(breakpointId);
    if (removed) {
      logger.info('DEBUG_SYSTEM', `🗑️ Breakpoint removed: ${breakpointId}`);
    }
    return removed;
  }

  removeWatch(watchId) {
    const removed = this.watchList.delete(watchId);
    if (removed) {
      logger.info('DEBUG_SYSTEM', `🗑️ Watch removed: ${watchId}`);
    }
    return removed;
  }

  toggleBreakpoint(breakpointId) {
    const breakpoint = this.breakpoints.get(breakpointId);
    if (breakpoint) {
      breakpoint.enabled = !breakpoint.enabled;
      logger.info('DEBUG_SYSTEM', `🔄 Breakpoint toggled: ${breakpointId}`, {
        enabled: breakpoint.enabled
      });
      return breakpoint.enabled;
    }
    return false;
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('DEBUG_SYSTEM', 'Debug configuration updated', newConfig);
  }

  clearHistory() {
    this.debugSessions.clear();
    this.executionTrace = [];
    logger.info('DEBUG_SYSTEM', 'Debug history cleared');
  }
}

// Create global debug system instance
const debugSystem = new DebugSystem();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = debugSystem;
} else {
  globalThis.debugSystem = debugSystem;
}

// Add global debugging helpers
globalThis.startDebug = (options) => debugSystem.startSession(options);
globalThis.endDebug = () => debugSystem.endSession();
globalThis.debugCapture = (component, event, data) => debugSystem.capture(component, event, data);
globalThis.addBreakpoint = (component, event, condition) => debugSystem.addBreakpoint(component, event, condition);
globalThis.addWatch = (name, getter, component) => debugSystem.addWatch(name, getter, component);
globalThis.exportDebug = (sessionId) => debugSystem.exportSession(sessionId);
globalThis.getDebugStats = () => debugSystem.getDebugStats();