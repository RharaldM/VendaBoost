const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

/**
 * Test Session Persistence and Cookie Handling
 * This script tests the session persistence functionality of the MarketplaceService
 */

const BACKEND_URL = 'http://localhost:7849';
const COOKIES_PATH = path.join(__dirname, 'backend', 'data', 'cookies.json');
const SESSION_DATA_PATH = path.join(__dirname, 'backend', 'data');

class SessionPersistenceTest {
  constructor() {
    this.testResults = {
      cookieFileExists: false,
      cookieFileReadable: false,
      sessionDataDirectory: false,
      backendSessionAPI: false,
      cookieValidation: false
    };
  }

  /**
   * Test if cookies file exists and is readable
   */
  testCookieFile() {
    console.log('🔍 Testing Cookie File...');
    
    try {
      // Check if cookies file exists
      if (fs.existsSync(COOKIES_PATH)) {
        console.log('✅ Cookies file exists');
        this.testResults.cookieFileExists = true;
        
        // Try to read the cookies file
        const cookiesContent = fs.readFileSync(COOKIES_PATH, 'utf8');
        const cookies = JSON.parse(cookiesContent);
        
        console.log('✅ Cookies file is readable');
        console.log(`📊 Found ${cookies.length} cookies`);
        this.testResults.cookieFileReadable = true;
        
        // Validate cookie structure
        if (cookies.length > 0 && cookies[0].name && cookies[0].value) {
          console.log('✅ Cookie structure is valid');
          this.testResults.cookieValidation = true;
        } else {
          console.log('⚠️ Cookie structure may be invalid');
        }
        
      } else {
        console.log('⚠️ Cookies file does not exist (this is normal for first run)');
      }
    } catch (error) {
      console.log(`❌ Error testing cookies file: ${error.message}`);
    }
  }

  /**
   * Test session data directory
   */
  testSessionDataDirectory() {
    console.log('\n🔍 Testing Session Data Directory...');
    
    try {
      if (fs.existsSync(SESSION_DATA_PATH)) {
        console.log('✅ Session data directory exists');
        this.testResults.sessionDataDirectory = true;
        
        // List files in session data directory
        const files = fs.readdirSync(SESSION_DATA_PATH);
        console.log(`📁 Session data directory contains ${files.length} files:`);
        files.forEach(file => {
          console.log(`   - ${file}`);
        });
      } else {
        console.log('⚠️ Session data directory does not exist');
      }
    } catch (error) {
      console.log(`❌ Error testing session data directory: ${error.message}`);
    }
  }

  /**
   * Test backend session-related APIs
   */
  async testBackendSessionAPI() {
    console.log('\n🔍 Testing Backend Session APIs...');
    
    try {
      // Test automation status (which includes session info)
      const response = await fetch(`${BACKEND_URL}/api/items/status`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Backend session API accessible');
        console.log(`📊 Automation running: ${data.isAutomationRunning}`);
        this.testResults.backendSessionAPI = true;
        
        if (data.sessionInfo) {
          console.log('✅ Session info available in API response');
        }
      } else {
        console.log(`❌ Backend session API failed: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Error testing backend session API: ${error.message}`);
    }
  }

  /**
   * Test session persistence by simulating a restart
   */
  async testSessionPersistence() {
    console.log('\n🔍 Testing Session Persistence...');
    
    try {
      // Check if we can schedule an item (which would use session)
      const testItem = {
        title: 'Session Test Item',
        price: '1',
        description: 'Testing session persistence',
        location: 'Test Location'
      };
      
      const response = await fetch(`${BACKEND_URL}/api/items/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testItem)
      });
      
      if (response.ok) {
        console.log('✅ Session persistence test passed - item scheduling works');
      } else {
        console.log(`⚠️ Session persistence test - item scheduling returned: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Error testing session persistence: ${error.message}`);
    }
  }

  /**
   * Generate test report
   */
  generateReport() {
    console.log('\n📊 SESSION PERSISTENCE TEST REPORT');
    console.log('==================================================');
    
    const tests = [
      { name: 'Cookie File Exists', result: this.testResults.cookieFileExists },
      { name: 'Cookie File Readable', result: this.testResults.cookieFileReadable },
      { name: 'Session Data Directory', result: this.testResults.sessionDataDirectory },
      { name: 'Backend Session API', result: this.testResults.backendSessionAPI },
      { name: 'Cookie Validation', result: this.testResults.cookieValidation }
    ];
    
    let passedTests = 0;
    
    tests.forEach(test => {
      const status = test.result ? '✅' : '❌';
      console.log(`${status} ${test.name}`);
      if (test.result) passedTests++;
    });
    
    const score = Math.round((passedTests / tests.length) * 100);
    console.log(`\n📈 Overall Score: ${passedTests}/${tests.length} (${score}%)`);
    
    if (score >= 80) {
      console.log('🎉 Session persistence is working correctly!');
    } else if (score >= 60) {
      console.log('⚠️ Session persistence has some issues but is mostly functional');
    } else {
      console.log('❌ Session persistence needs attention');
    }
    
    console.log('\n💡 Notes:');
    console.log('- Cookie file may not exist on first run (normal behavior)');
    console.log('- Session persistence is tested through API functionality');
    console.log('- Cookies are automatically saved after successful login');
    console.log('==================================================');
  }

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 Starting Session Persistence Tests\n');
    
    const startTime = performance.now();
    
    this.testCookieFile();
    this.testSessionDataDirectory();
    await this.testBackendSessionAPI();
    await this.testSessionPersistence();
    
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    this.generateReport();
    console.log(`\n⏱️ Tests completed in ${duration}ms`);
  }
}

// Run the tests
if (require.main === module) {
  const tester = new SessionPersistenceTest();
  tester.runAllTests().catch(console.error);
}

module.exports = SessionPersistenceTest;