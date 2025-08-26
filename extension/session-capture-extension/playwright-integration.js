/**
 * Playwright Integration Example
 * 
 * This file demonstrates how to use the captured session data with Playwright
 * to bypass authentication and restore the browser state.
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

/**
 * Load session data from the JSON file exported by the extension
 * @param {string} sessionFilePath - Path to the session JSON file
 * @returns {Object} Session data object
 */
async function loadSessionData(sessionFilePath) {
  try {
    const data = await fs.readFile(sessionFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading session file:', error);
    throw error;
  }
}

/**
 * Apply session data to a Playwright browser context
 * @param {BrowserContext} context - Playwright browser context
 * @param {Object} sessionData - Session data from the extension
 */
async function applySessionToContext(context, sessionData) {
  // 1. Add cookies to the context
  if (sessionData.playwrightCookies && sessionData.playwrightCookies.length > 0) {
    await context.addCookies(sessionData.playwrightCookies);
    console.log(`Added ${sessionData.playwrightCookies.length} cookies to context`);
  }

  // 2. Set up localStorage and sessionStorage injection
  const storageScript = `
    // Restore localStorage
    const localStorageData = ${JSON.stringify(sessionData.localStorage || {})};
    Object.entries(localStorageData).forEach(([key, item]) => {
      try {
        if (item.type === 'json') {
          localStorage.setItem(key, JSON.stringify(item.value));
        } else {
          localStorage.setItem(key, item.value);
        }
      } catch (e) {
        console.warn('Failed to set localStorage item:', key, e);
      }
    });

    // Restore sessionStorage
    const sessionStorageData = ${JSON.stringify(sessionData.sessionStorage || {})};
    Object.entries(sessionStorageData).forEach(([key, item]) => {
      try {
        if (item.type === 'json') {
          sessionStorage.setItem(key, JSON.stringify(item.value));
        } else {
          sessionStorage.setItem(key, item.value);
        }
      } catch (e) {
        console.warn('Failed to set sessionStorage item:', key, e);
      }
    });

    console.log('Storage data restored successfully');
  `;

  // Add the storage restoration script to run on every page
  await context.addInitScript(storageScript);
  console.log('Storage restoration script added to context');
}

/**
 * Main example function showing complete workflow
 */
async function main() {
  // Path to your captured session file
  const sessionFilePath = './session_example.com_2024-01-01T12-00-00-000Z.json';
  
  try {
    // Load the session data
    console.log('Loading session data...');
    const sessionData = await loadSessionData(sessionFilePath);
    console.log(`Session data loaded for: ${sessionData.domain}`);
    
    // Launch browser
    const browser = await chromium.launch({
      headless: false, // Set to true for headless mode
      devtools: true   // Open devtools to verify session is loaded
    });
    
    // Create a new context with session data
    const context = await browser.newContext({
      // Optional: Set viewport and user agent to match original session
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    
    // Apply the session data
    await applySessionToContext(context, sessionData);
    
    // Create a new page and navigate
    const page = await context.newPage();
    
    // Navigate to the original URL or a protected area
    console.log(`Navigating to ${sessionData.url}...`);
    await page.goto(sessionData.url, { waitUntil: 'networkidle' });
    
    // Verify authentication status
    // Add your own verification logic here
    await page.waitForTimeout(2000); // Wait to see the page load
    
    // Example: Check if we're logged in by looking for a specific element
    try {
      // Adjust selector based on your website
      await page.waitForSelector('[data-testid="user-menu"]', { timeout: 5000 });
      console.log('✅ Successfully authenticated using captured session!');
    } catch {
      console.log('⚠️ Could not verify authentication status');
    }
    
    // Your automation code here
    // ...
    
    // Keep browser open for inspection (remove in production)
    await page.waitForTimeout(30000);
    
    // Clean up
    await browser.close();
    
  } catch (error) {
    console.error('Error in main workflow:', error);
    process.exit(1);
  }
}

/**
 * Advanced example with error handling and retries
 */
async function advancedExample() {
  const sessionFilePath = './session.json';
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      const sessionData = await loadSessionData(sessionFilePath);
      
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-features=site-per-process'
        ]
      });
      
      const context = await browser.newContext({
        // Mimic real browser
        viewport: { width: 1920, height: 1080 },
        screen: { width: 1920, height: 1080 },
        userAgent: sessionData.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: ['geolocation', 'notifications']
      });
      
      // Apply session
      await applySessionToContext(context, sessionData);
      
      // Set up request interception for debugging
      context.on('request', request => {
        if (request.url().includes('/api/')) {
          console.log('API Request:', request.method(), request.url());
        }
      });
      
      context.on('response', response => {
        if (response.status() === 401 || response.status() === 403) {
          console.warn('Authentication issue detected:', response.url());
        }
      });
      
      const page = await context.newPage();
      
      // Navigate with retry logic
      try {
        await page.goto(sessionData.url, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        
        // Your automation logic here
        console.log('Page loaded successfully with session');
        
        // Success - break the retry loop
        break;
        
      } catch (navError) {
        console.error(`Navigation error (attempt ${retryCount + 1}):`, navError.message);
        retryCount++;
        
        if (retryCount >= maxRetries) {
          throw new Error('Max retries reached. Session may be expired.');
        }
        
        await browser.close();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait before retry
      }
      
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  }
}

/**
 * Utility function to validate session data before use
 */
function validateSessionData(sessionData) {
  const required = ['url', 'domain', 'cookies'];
  const missing = required.filter(field => !sessionData[field]);
  
  if (missing.length > 0) {
    throw new Error(`Invalid session data. Missing fields: ${missing.join(', ')}`);
  }
  
  // Check if cookies are not expired
  const now = Date.now() / 1000;
  const validCookies = sessionData.cookies.filter(cookie => {
    return !cookie.expirationDate || cookie.expirationDate > now;
  });
  
  if (validCookies.length === 0) {
    console.warn('Warning: All cookies appear to be expired');
  }
  
  return true;
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  loadSessionData,
  applySessionToContext,
  validateSessionData
};