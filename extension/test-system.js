/**
 * VendaBoost Extension - Sistema de Teste
 * Script para testar todos os componentes do sistema v2.0
 */

class SystemTester {
  constructor() {
    this.testResults = [];
    this.errors = [];
  }

  async runAllTests() {
    console.log('🧪 Starting VendaBoost v2.0 System Tests');
    console.log('=====================================');
    
    try {
      // Test 1: Basic imports
      await this.testImports();
      
      // Test 2: Configuration system
      await this.testConfiguration();
      
      // Test 3: Logger system
      await this.testLogger();
      
      // Test 4: Cache manager
      await this.testCacheManager();
      
      // Test 5: Extractors
      await this.testExtractors();
      
      // Test 6: Schedulers
      await this.testSchedulers();
      
      // Test 7: Queue manager
      await this.testQueueManager();
      
      // Test 8: Automation orchestrator
      await this.testAutomationOrchestrator();
      
      // Show results
      this.showResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.errors.push({ test: 'TestSuite', error: error.message });
      this.showResults();
    }
  }

  async testImports() {
    console.log('📦 Testing imports...');
    
    const components = [
      'logger', 'config', 'CacheManager', 'SessionExtractor',
      'GroupsExtractor', 'ProfileExtractor', 'CronScheduler',
      'AdaptiveScheduler', 'PriorityQueue', 'QueueManager',
      'AutomationOrchestrator'
    ];
    
    for (const component of components) {
      try {
        if (globalThis[component]) {
          this.testResults.push({ test: `Import ${component}`, status: 'PASS' });
        } else {
          this.testResults.push({ test: `Import ${component}`, status: 'FAIL', error: 'Not found' });
        }
      } catch (error) {
        this.testResults.push({ test: `Import ${component}`, status: 'ERROR', error: error.message });
      }
    }
  }

  async testConfiguration() {
    console.log('⚙️ Testing configuration system...');
    
    try {
      if (!globalThis.config) {
        throw new Error('Config not available');
      }
      
      await config.initialize();
      const status = config.getStatus();
      
      this.testResults.push({ test: 'Config Initialize', status: 'PASS', data: status });
      
      // Test config operations
      const testValue = 'test_value_' + Date.now();
      await config.set('test.value', testValue);
      const retrievedValue = config.get('test.value');
      
      if (retrievedValue === testValue) {
        this.testResults.push({ test: 'Config Set/Get', status: 'PASS' });
      } else {
        this.testResults.push({ test: 'Config Set/Get', status: 'FAIL' });
      }
      
    } catch (error) {
      this.testResults.push({ test: 'Configuration', status: 'ERROR', error: error.message });
    }
  }

  async testLogger() {
    console.log('📝 Testing logger system...');
    
    try {
      if (!globalThis.logger) {
        throw new Error('Logger not available');
      }
      
      // Test log levels
      logger.info('TESTER', 'Test info message');
      logger.warn('TESTER', 'Test warning message');
      logger.error('TESTER', 'Test error message');
      
      const stats = logger.getLogStats();
      this.testResults.push({ test: 'Logger Basic', status: 'PASS', data: stats });
      
      // Test timers
      logger.startTimer('testTimer');
      await new Promise(resolve => setTimeout(resolve, 100));
      const duration = logger.endTimer('testTimer');
      
      if (duration > 90 && duration < 200) {
        this.testResults.push({ test: 'Logger Timers', status: 'PASS' });
      } else {
        this.testResults.push({ test: 'Logger Timers', status: 'FAIL', data: { duration } });
      }
      
    } catch (error) {
      this.testResults.push({ test: 'Logger', status: 'ERROR', error: error.message });
    }
  }

  async testCacheManager() {
    console.log('💾 Testing cache manager...');
    
    try {
      const cacheManager = new CacheManager();
      await cacheManager.initialize();
      
      this.testResults.push({ test: 'Cache Initialize', status: 'PASS' });
      
      // Test cache operations
      const testData = { test: true, timestamp: Date.now() };
      await cacheManager.set('test_key', testData, 'test');
      
      const retrieved = await cacheManager.get('test_key', 'test');
      
      if (JSON.stringify(retrieved) === JSON.stringify(testData)) {
        this.testResults.push({ test: 'Cache Set/Get', status: 'PASS' });
      } else {
        this.testResults.push({ test: 'Cache Set/Get', status: 'FAIL' });
      }
      
      const stats = cacheManager.getStats();
      this.testResults.push({ test: 'Cache Stats', status: 'PASS', data: stats });
      
    } catch (error) {
      this.testResults.push({ test: 'CacheManager', status: 'ERROR', error: error.message });
    }
  }

  async testExtractors() {
    console.log('🔍 Testing extractors...');
    
    // Test SessionExtractor
    try {
      const sessionExtractor = new SessionExtractor();
      const stats = sessionExtractor.getExtractionStats();
      this.testResults.push({ test: 'SessionExtractor Init', status: 'PASS', data: stats });
    } catch (error) {
      this.testResults.push({ test: 'SessionExtractor', status: 'ERROR', error: error.message });
    }
    
    // Test GroupsExtractor
    try {
      const groupsExtractor = new GroupsExtractor();
      const stats = groupsExtractor.getExtractionStats();
      this.testResults.push({ test: 'GroupsExtractor Init', status: 'PASS', data: stats });
    } catch (error) {
      this.testResults.push({ test: 'GroupsExtractor', status: 'ERROR', error: error.message });
    }
    
    // Test ProfileExtractor
    try {
      const profileExtractor = new ProfileExtractor();
      const stats = profileExtractor.getExtractionStats();
      this.testResults.push({ test: 'ProfileExtractor Init', status: 'PASS', data: stats });
    } catch (error) {
      this.testResults.push({ test: 'ProfileExtractor', status: 'ERROR', error: error.message });
    }
  }

  async testSchedulers() {
    console.log('⏰ Testing schedulers...');
    
    // Test CronScheduler
    try {
      const cronScheduler = new CronScheduler();
      await cronScheduler.initialize();
      const stats = cronScheduler.getSchedulerStats();
      this.testResults.push({ test: 'CronScheduler Init', status: 'PASS', data: stats });
    } catch (error) {
      this.testResults.push({ test: 'CronScheduler', status: 'ERROR', error: error.message });
    }
    
    // Test AdaptiveScheduler
    try {
      const adaptiveScheduler = new AdaptiveScheduler();
      await adaptiveScheduler.initialize();
      const stats = adaptiveScheduler.getAdaptiveStats();
      this.testResults.push({ test: 'AdaptiveScheduler Init', status: 'PASS', data: stats });
    } catch (error) {
      this.testResults.push({ test: 'AdaptiveScheduler', status: 'ERROR', error: error.message });
    }
    
    // Test PriorityQueue
    try {
      const priorityQueue = new PriorityQueue();
      const stats = priorityQueue.getPriorityStats();
      this.testResults.push({ test: 'PriorityQueue Init', status: 'PASS', data: stats });
    } catch (error) {
      this.testResults.push({ test: 'PriorityQueue', status: 'ERROR', error: error.message });
    }
  }

  async testQueueManager() {
    console.log('🔄 Testing queue manager...');
    
    try {
      const queueManager = new QueueManager();
      await queueManager.start();
      
      // Test adding a task
      await queueManager.addTask({
        type: 'test',
        action: 'test_action',
        payload: { test: true },
        handler: async (payload) => ({ success: true, data: payload })
      });
      
      const stats = queueManager.getStats();
      this.testResults.push({ test: 'QueueManager Operations', status: 'PASS', data: stats });
      
      await queueManager.stop();
      
    } catch (error) {
      this.testResults.push({ test: 'QueueManager', status: 'ERROR', error: error.message });
    }
  }

  async testAutomationOrchestrator() {
    console.log('🎛️ Testing automation orchestrator...');
    
    try {
      const orchestrator = new AutomationOrchestrator();
      await orchestrator.initialize();
      
      const status = orchestrator.getSystemStatus();
      this.testResults.push({ test: 'Orchestrator Init', status: 'PASS', data: status });
      
      await orchestrator.start();
      const runningStatus = orchestrator.getSystemStatus();
      
      if (runningStatus.running) {
        this.testResults.push({ test: 'Orchestrator Start', status: 'PASS' });
      } else {
        this.testResults.push({ test: 'Orchestrator Start', status: 'FAIL' });
      }
      
      await orchestrator.stop();
      
    } catch (error) {
      this.testResults.push({ test: 'AutomationOrchestrator', status: 'ERROR', error: error.message });
    }
  }

  showResults() {
    console.log('\n🧪 TEST RESULTS');
    console.log('================');
    
    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;
    const errors = this.testResults.filter(r => r.status === 'ERROR').length;
    
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`💥 Errors: ${errors}`);
    console.log(`📊 Total: ${this.testResults.length}`);
    
    console.log('\nDetailed Results:');
    this.testResults.forEach(result => {
      const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '💥';
      console.log(`${emoji} ${result.test}: ${result.status}`);
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    if (errors === 0 && failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! System is ready!');
    } else {
      console.log('\n⚠️ Some tests failed. Check errors above.');
    }
  }
}

// Auto-run tests when loaded
if (typeof chrome !== 'undefined' && chrome.runtime) {
  const tester = new SystemTester();
  
  // Run tests after a short delay to allow system initialization
  setTimeout(() => {
    tester.runAllTests();
  }, 2000);
  
  // Make tester available globally
  globalThis.systemTester = tester;
}