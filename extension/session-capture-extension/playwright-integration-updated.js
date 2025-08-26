/**
 * Playwright Integration for Facebook Session Auto-Capture
 * 
 * This script shows how to use the captured session data with Playwright
 * to bypass Facebook login and 2FA.
 */

const { chromium } = require('playwright');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  // Path to session files saved by the bridge
  SESSION_DIR: path.join(process.cwd(), '..', '..', 'data', 'sessions'),
  // Or use the current session file directly
  CURRENT_SESSION_FILE: path.join(process.cwd(), '..', '..', 'data', 'sessions', 'current-session.json'),
  // Headless mode (set to false to see the browser)
  HEADLESS: false,
  // Viewport settings
  VIEWPORT: { width: 1280, height: 720 }
};

/**
 * Load the most recent session file for a specific user
 * @param {string} userId - The Facebook user ID
 * @returns {Object} Session data
 */
async function loadSessionByUserId(userId) {
  try {
    const files = await fs.readdir(CONFIG.SESSION_DIR);
    const sessionFiles = files.filter(f => 
      f.startsWith('session-') && 
      f.endsWith('.json') &&
      f.includes(userId)
    );
    
    if (sessionFiles.length === 0) {
      throw new Error(`No session found for user ${userId}`);
    }
    
    // Sort by timestamp (newest first)
    sessionFiles.sort().reverse();
    const latestFile = sessionFiles[0];
    
    const sessionData = await fs.readFile(
      path.join(CONFIG.SESSION_DIR, latestFile),
      'utf-8'
    );
    
    return JSON.parse(sessionData);
  } catch (error) {
    console.error('Error loading session:', error);
    throw error;
  }
}

/**
 * Load the current active session
 * @returns {Object} Session data
 */
async function loadCurrentSession() {
  try {
    const sessionData = await fs.readFile(CONFIG.CURRENT_SESSION_FILE, 'utf-8');
    return JSON.parse(sessionData);
  } catch (error) {
    console.error('Error loading current session:', error);
    throw error;
  }
}

/**
 * Convert session cookies to Playwright format
 * @param {Array} cookies - Cookies from session data
 * @returns {Array} Playwright-formatted cookies
 */
function formatCookiesForPlaywright(cookies) {
  return cookies.map(cookie => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    expires: cookie.expires === -1 ? undefined : cookie.expires / 1000,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite
  }));
}

/**
 * Create a Playwright browser context with session data
 * @param {Object} sessionData - Session data from the extension
 * @returns {Object} Browser context
 */
async function createAuthenticatedContext(sessionData) {
  const browser = await chromium.launch({
    headless: CONFIG.HEADLESS,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=site-per-process'
    ]
  });

  // Create context with saved cookies
  const context = await browser.newContext({
    viewport: CONFIG.VIEWPORT,
    userAgent: sessionData.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // Add cookies
    storageState: {
      cookies: formatCookiesForPlaywright(sessionData.cookies),
      origins: []
    }
  });

  // Inject localStorage and sessionStorage if available
  if (sessionData.localStorage || sessionData.sessionStorage) {
    context.on('page', async (page) => {
      // Wait for navigation before injecting storage
      page.once('load', async () => {
        try {
          await page.evaluate(({ localStorage, sessionStorage }) => {
            // Inject localStorage
            if (localStorage) {
              Object.entries(localStorage).forEach(([key, item]) => {
                try {
                  if (item.type === 'json') {
                    window.localStorage.setItem(key, JSON.stringify(item.value));
                  } else {
                    window.localStorage.setItem(key, item.value);
                  }
                } catch (e) {
                  console.warn(`Could not set localStorage item ${key}:`, e);
                }
              });
            }
            
            // Inject sessionStorage
            if (sessionStorage) {
              Object.entries(sessionStorage).forEach(([key, item]) => {
                try {
                  if (item.type === 'json') {
                    window.sessionStorage.setItem(key, JSON.stringify(item.value));
                  } else {
                    window.sessionStorage.setItem(key, item.value);
                  }
                } catch (e) {
                  console.warn(`Could not set sessionStorage item ${key}:`, e);
                }
              });
            }
          }, {
            localStorage: sessionData.localStorage,
            sessionStorage: sessionData.sessionStorage
          });
        } catch (error) {
          console.warn('Could not inject storage:', error);
        }
      });
    });
  }

  return { browser, context };
}

/**
 * Main example: Navigate to Facebook with saved session
 */
async function main() {
  try {
    console.log('Loading Facebook session...');
    
    // Load the current session (or use loadSessionByUserId for a specific user)
    const sessionData = await loadCurrentSession();
    
    console.log(`Session loaded for user: ${sessionData.userId}`);
    console.log(`User name: ${sessionData.userInfo?.name || 'Unknown'}`);
    console.log(`Cookies: ${sessionData.cookies.length}`);
    
    // Create authenticated browser context
    const { browser, context } = await createAuthenticatedContext(sessionData);
    
    // Create a new page
    const page = await context.newPage();
    
    // Navigate to Facebook
    console.log('Navigating to Facebook...');
    await page.goto('https://www.facebook.com', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    
    // Check if we're logged in
    await page.waitForTimeout(3000); // Wait for redirects
    
    const url = page.url();
    console.log('Current URL:', url);
    
    // Check for login indicators
    const isLoggedIn = await page.evaluate(() => {
      // Check for various login indicators
      const loggedInSelectors = [
        '[data-testid="user_menu"]',
        '[data-pagelet="LeftRail"]',
        'a[href*="/profile.php"]',
        '[role="main"]'
      ];
      
      return loggedInSelectors.some(selector => 
        document.querySelector(selector) !== null
      );
    });
    
    if (isLoggedIn) {
      console.log('✅ Successfully logged in to Facebook!');
      
      // Example: Navigate to your profile
      const profileLink = await page.$('a[href*="/profile.php"], a[href^="/profile"]');
      if (profileLink) {
        console.log('Navigating to profile...');
        await profileLink.click();
        await page.waitForLoadState('networkidle');
        console.log('Profile loaded:', page.url());
      }
      
      // Example: Get some data
      const userName = await page.evaluate(() => {
        const title = document.title;
        if (title && title.includes('|')) {
          return title.split('|')[0].trim();
        }
        return null;
      });
      
      if (userName) {
        console.log('Profile name from page:', userName);
      }
      
    } else {
      console.log('⚠️ Not logged in - session may have expired');
      console.log('The extension will capture a new session next time you log in manually');
    }
    
    // Keep browser open for manual inspection (remove in production)
    console.log('\nPress Ctrl+C to close the browser...');
    await page.waitForTimeout(300000); // Wait 5 minutes
    
    // Clean up
    await context.close();
    await browser.close();
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

/**
 * Helper function to wait for new session capture
 * Monitors the session directory for new files
 */
async function waitForNewSession(userId = null, timeout = 60000) {
  console.log(`Waiting for new session${userId ? ` for user ${userId}` : ''}...`);
  console.log('Please log in to Facebook in Chrome with the extension installed');
  
  const startTime = Date.now();
  let lastModified = null;
  
  try {
    // Get initial state
    const stats = await fs.stat(CONFIG.CURRENT_SESSION_FILE);
    lastModified = stats.mtimeMs;
  } catch (error) {
    // File doesn't exist yet
  }
  
  while (Date.now() - startTime < timeout) {
    try {
      const stats = await fs.stat(CONFIG.CURRENT_SESSION_FILE);
      
      if (!lastModified || stats.mtimeMs > lastModified) {
        // File was created or updated
        const sessionData = await loadCurrentSession();
        
        if (!userId || sessionData.userId === userId) {
          console.log('✅ New session captured!');
          return sessionData;
        }
      }
      
      lastModified = stats.mtimeMs;
    } catch (error) {
      // File doesn't exist yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Check every second
  }
  
  throw new Error('Timeout waiting for new session');
}

/**
 * Example: Using the session in a real automation scenario
 */
async function automationExample() {
  try {
    // Wait for a new session or load existing
    let sessionData;
    try {
      sessionData = await loadCurrentSession();
      console.log('Using existing session');
    } catch {
      console.log('No existing session found');
      sessionData = await waitForNewSession(null, 120000); // Wait 2 minutes
    }
    
    const { browser, context } = await createAuthenticatedContext(sessionData);
    const page = await context.newPage();
    
    // Navigate to Facebook
    await page.goto('https://www.facebook.com', { waitUntil: 'networkidle' });
    
    // Your automation tasks here
    // Example: Go to marketplace
    await page.goto('https://www.facebook.com/marketplace', { waitUntil: 'networkidle' });
    console.log('Navigated to marketplace');
    
    // Example: Search for something
    const searchBox = await page.$('[placeholder*="Search"], [aria-label*="Search"]');
    if (searchBox) {
      await searchBox.type('laptop');
      await page.keyboard.press('Enter');
      await page.waitForLoadState('networkidle');
      console.log('Searched for laptops');
    }
    
    // Keep open for inspection
    await page.waitForTimeout(60000);
    
    await browser.close();
  } catch (error) {
    console.error('Automation error:', error);
  }
}

// Export functions for use in other scripts
module.exports = {
  loadSessionByUserId,
  loadCurrentSession,
  createAuthenticatedContext,
  waitForNewSession,
  formatCookiesForPlaywright
};

// Run the example if this file is executed directly
if (require.main === module) {
  // Choose which example to run
  const args = process.argv.slice(2);
  
  if (args[0] === 'wait') {
    waitForNewSession().then(session => {
      console.log('Session captured:', session.userId);
    }).catch(console.error);
  } else if (args[0] === 'automation') {
    automationExample().catch(console.error);
  } else {
    main().catch(console.error);
  }
}