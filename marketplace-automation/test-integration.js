const http = require('http');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Test configuration
const BACKEND_URL = 'http://localhost:7849';
const WEB_PORTAL_URL = 'http://localhost:3000';
const DESKTOP_APP_URL = 'http://localhost:3001';

// Test results
const testResults = {
  backend: {
    health: false,
    items: false,
    logs: false,
    automation: false,
    fileUpload: false
  },
  webPortal: {
    accessible: false,
    socketIO: false
  },
  desktopApp: {
    accessible: false
  },
  integration: {
    backendToPortal: false,
    backendToDesktop: false
  }
};

// Helper function to make HTTP requests
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data
        });
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Test backend health endpoint
async function testBackendHealth() {
  console.log('\n🔍 Testing Backend Health...');
  try {
    const response = await makeRequest(`${BACKEND_URL}/api/health`);
    if (response.statusCode === 200) {
      console.log('✅ Backend health check passed');
      testResults.backend.health = true;
    } else {
      console.log(`❌ Backend health check failed: ${response.statusCode}`);
    }
  } catch (error) {
    console.log(`❌ Backend health check failed: ${error.message}`);
  }
}

// Test backend items endpoint
async function testBackendItems() {
  console.log('\n🔍 Testing Backend Items API...');
  try {
    // Test GET /api/items/status
    const getResponse = await makeRequest(`${BACKEND_URL}/api/items/status`);
    if (getResponse.statusCode === 200) {
      console.log('✅ GET /api/items/status works');
      
      // Test POST /api/items/schedule
      const testItem = {
        title: 'Test Product',
        price: '100',
        location: 'Test Location',
        description: 'Test Description',
        category: 'Electronics'
      };
      
      const postResponse = await makeRequest(`${BACKEND_URL}/api/items/schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testItem)
      });
      
      if (postResponse.statusCode === 200 || postResponse.statusCode === 201) {
        console.log('✅ POST /api/items/schedule works');
        testResults.backend.items = true;
      } else {
        console.log(`❌ POST /api/items/schedule failed: ${postResponse.statusCode}`);
      }
    } else {
      console.log(`❌ GET /api/items/status failed: ${getResponse.statusCode}`);
    }
  } catch (error) {
    console.log(`❌ Backend items test failed: ${error.message}`);
  }
}

// Test backend logs endpoint
async function testBackendLogs() {
  console.log('\n🔍 Testing Backend Logs API...');
  try {
    const response = await makeRequest(`${BACKEND_URL}/api/logs`);
    if (response.statusCode === 200) {
      console.log('✅ GET /api/logs works');
      testResults.backend.logs = true;
    } else {
      console.log(`❌ GET /api/logs failed: ${response.statusCode}`);
    }
  } catch (error) {
    console.log(`❌ Backend logs test failed: ${error.message}`);
  }
}

// Test backend automation endpoint
async function testBackendAutomation() {
  console.log('\n🔍 Testing Backend Automation API...');
  try {
    // Test automation status
    const statusResponse = await makeRequest(`${BACKEND_URL}/api/items/status`);
    if (statusResponse.statusCode === 200) {
      console.log('✅ GET /api/items/status (automation) works');
      
      // Test automation cancel (this tests the automation control endpoint)
      const cancelResponse = await makeRequest(`${BACKEND_URL}/api/items/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      
      if (cancelResponse.statusCode === 200 || cancelResponse.statusCode === 400) {
        console.log('✅ POST /api/items/cancel endpoint works');
        testResults.backend.automation = true;
      } else {
        console.log(`❌ POST /api/items/cancel failed: ${cancelResponse.statusCode}`);
      }
    } else {
      console.log(`❌ GET /api/items/status (automation) failed: ${statusResponse.statusCode}`);
    }
  } catch (error) {
    console.log(`❌ Backend automation test failed: ${error.message}`);
  }
}

// Test web portal accessibility
async function testWebPortal() {
  console.log('\n🔍 Testing Web Portal...');
  try {
    const response = await makeRequest(WEB_PORTAL_URL);
    if (response.statusCode === 200) {
      console.log('✅ Web portal is accessible');
      testResults.webPortal.accessible = true;
    } else {
      console.log(`❌ Web portal failed: ${response.statusCode}`);
    }
  } catch (error) {
    console.log(`❌ Web portal test failed: ${error.message}`);
  }
}

// Test desktop app accessibility
async function testDesktopApp() {
  console.log('\n🔍 Testing Desktop App...');
  try {
    const response = await makeRequest(DESKTOP_APP_URL);
    if (response.statusCode === 200) {
      console.log('✅ Desktop app is accessible');
      testResults.desktopApp.accessible = true;
    } else {
      console.log(`❌ Desktop app failed: ${response.statusCode}`);
    }
  } catch (error) {
    console.log(`❌ Desktop app test failed: ${error.message}`);
  }
}

// Generate test report
function generateReport() {
  console.log('\n📊 INTEGRATION TEST REPORT');
  console.log('=' .repeat(50));
  
  console.log('\n🔧 Backend Services:');
  console.log(`  Health Check: ${testResults.backend.health ? '✅' : '❌'}`);
  console.log(`  Items API: ${testResults.backend.items ? '✅' : '❌'}`);
  console.log(`  Logs API: ${testResults.backend.logs ? '✅' : '❌'}`);
  console.log(`  Automation API: ${testResults.backend.automation ? '✅' : '❌'}`);
  
  console.log('\n🌐 Frontend Services:');
  console.log(`  Web Portal: ${testResults.webPortal.accessible ? '✅' : '❌'}`);
  console.log(`  Desktop App: ${testResults.desktopApp.accessible ? '✅' : '❌'}`);
  
  const backendScore = Object.values(testResults.backend).filter(Boolean).length;
  const frontendScore = Object.values(testResults.webPortal).filter(Boolean).length + 
                       Object.values(testResults.desktopApp).filter(Boolean).length;
  const totalScore = backendScore + frontendScore;
  const maxScore = Object.keys(testResults.backend).length + 
                   Object.keys(testResults.webPortal).length + 
                   Object.keys(testResults.desktopApp).length;
  
  console.log('\n📈 Overall Score:');
  console.log(`  Backend: ${backendScore}/${Object.keys(testResults.backend).length}`);
  console.log(`  Frontend: ${frontendScore}/${Object.keys(testResults.webPortal).length + Object.keys(testResults.desktopApp).length}`);
  console.log(`  Total: ${totalScore}/${maxScore} (${Math.round(totalScore/maxScore*100)}%)`);
  
  console.log('\n🔍 Issues Found:');
  const issues = [];
  
  if (!testResults.backend.health) issues.push('Backend health endpoint not responding');
  if (!testResults.backend.items) issues.push('Backend items API not working');
  if (!testResults.backend.logs) issues.push('Backend logs API not working');
  if (!testResults.backend.automation) issues.push('Backend automation API not working');
  if (!testResults.webPortal.accessible) issues.push('Web portal not accessible');
  if (!testResults.desktopApp.accessible) issues.push('Desktop app not accessible');
  
  if (issues.length === 0) {
    console.log('  🎉 No issues found! All services are working correctly.');
  } else {
    issues.forEach(issue => console.log(`  ❌ ${issue}`));
  }
  
  console.log('\n' + '=' .repeat(50));
}

// Main test function
async function runIntegrationTests() {
  console.log('🚀 Starting Integration Tests for Marketplace Automation System');
  console.log('Testing Backend:', BACKEND_URL);
  console.log('Testing Web Portal:', WEB_PORTAL_URL);
  console.log('Testing Desktop App:', DESKTOP_APP_URL);
  
  await testBackendHealth();
  await testBackendItems();
  await testBackendLogs();
  await testBackendAutomation();
  await testWebPortal();
  await testDesktopApp();
  
  generateReport();
}

// Run the tests
runIntegrationTests().catch(console.error);