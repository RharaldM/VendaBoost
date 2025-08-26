// Session Capture Extension - Popup Script
// This handles the UI interaction and coordinates data capture

document.addEventListener('DOMContentLoaded', async () => {
  const captureBtn = document.getElementById('captureBtn');
  const viewBtn = document.getElementById('viewBtn');
  const statusDiv = document.getElementById('status');
  const currentUrlDiv = document.getElementById('currentUrl');
  const captureBtnText = document.getElementById('captureBtnText');

  // Global variables for tab and URL access
  let currentTab = null;
  let currentUrl = null;

  // Get current tab URL with error handling
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      throw new Error('Cannot access current tab');
    }
    
    currentTab = tab;
    currentUrl = new URL(tab.url);
    currentUrlDiv.textContent = currentUrl.hostname;
    
    // Disable capture for non-HTTP(S) pages
    if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
      captureBtn.disabled = true;
      showStatus('Session capture only works on HTTP/HTTPS pages', 'error');
    }
  } catch (error) {
    console.error('Tab access error:', error);
    currentUrlDiv.textContent = 'Unknown';
    captureBtn.disabled = true;
    showStatus('Cannot access current tab. Please refresh and try again.', 'error');
  }

  // Capture button click handler
  captureBtn.addEventListener('click', async () => {
    try {
      // Check if we have valid tab data
      if (!currentTab || !currentUrl) {
        throw new Error('No valid tab information available. Please refresh and try again.');
      }

      // Update UI to show loading state
      captureBtn.disabled = true;
      captureBtnText.innerHTML = '<span class="loading"></span>Capturing...';
      showStatus('Capturing session data...', 'info');

      // Get selected options
      const captureCookies = document.getElementById('captureCookies').checked;
      const captureLocalStorage = document.getElementById('captureLocalStorage').checked;
      const captureSessionStorage = document.getElementById('captureSessionStorage').checked;

      // Get user agent from content script
      const userAgent = await getUserAgent(currentTab.id);

      // Capture cookies first to extract userId
      let rawCookies = [];
      if (captureCookies) {
        rawCookies = await getCookies(currentUrl);
      }

      // Extract userId from c_user cookie
      const userId = extractUserIdFromCookies(rawCookies);

      // Extract user name (you may want to customize this logic based on your needs)
      const userName = await extractUserName(currentTab.id) || 'Unknown User';

      // Initialize session data object in the required format
      const sessionData = {
        userId: userId,
        timestamp: new Date().toISOString(),
        userInfo: {
          id: userId,
          name: userName
        },
        userAgent: userAgent,
        url: currentTab.url,
        source: "extension",
        cookies: formatCookiesSimplified(rawCookies)
      };

      // Capture storage data if selected (keeping for compatibility)
      if (captureLocalStorage || captureSessionStorage) {
        const storageData = await getStorageData(currentTab.id, captureLocalStorage, captureSessionStorage);
        sessionData.localStorage = storageData.localStorage || {};
        sessionData.sessionStorage = storageData.sessionStorage || {};
      }
      
      // Store in local storage for "View Last" functionality
      await chrome.storage.local.set({ 
        lastCapture: sessionData,
        lastCaptureTime: Date.now()
      });

      // Download the JSON file
      downloadSessionData(sessionData);

      // Update UI
      showStatus('Session captured successfully! File downloaded.', 'success');
      captureBtnText.textContent = 'Capture Session';
      captureBtn.disabled = false;

    } catch (error) {
      console.error('Capture error:', error);
      showStatus(`Error: ${error.message}`, 'error');
      captureBtnText.textContent = 'Capture Session';
      captureBtn.disabled = false;
    }
  });

  // View last capture button click handler
  viewBtn.addEventListener('click', async () => {
    try {
      const result = await chrome.storage.local.get(['lastCapture', 'lastCaptureTime']);
      
      if (!result.lastCapture) {
        showStatus('No previous capture found', 'error');
        return;
      }

      const timeDiff = Date.now() - result.lastCaptureTime;
      const minutes = Math.floor(timeDiff / 60000);
      const timeAgo = minutes < 1 ? 'just now' : `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      
      downloadSessionData(result.lastCapture, `session_${result.lastCapture.domain}_previous`);
      showStatus(`Downloaded previous capture from ${timeAgo}`, 'success');
      
    } catch (error) {
      console.error('View error:', error);
      showStatus(`Error: ${error.message}`, 'error');
    }
  });

  // Get cookies for the current domain
  async function getCookies(url) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'getCookies', url: url.href },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('Cookie fetch error:', chrome.runtime.lastError);
            resolve([]);
          } else {
            resolve(response.cookies || []);
          }
        }
      );
    });
  }

  // Get storage data from content script
  async function getStorageData(tabId, getLocal, getSession) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(
        tabId,
        { 
          action: 'getStorage',
          getLocalStorage: getLocal,
          getSessionStorage: getSession
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('Storage fetch error:', chrome.runtime.lastError);
            resolve({ localStorage: {}, sessionStorage: {} });
          } else {
            resolve(response || { localStorage: {}, sessionStorage: {} });
          }
        }
      );
    });
  }

  // Get user agent from content script
  async function getUserAgent(tabId) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(
        tabId,
        { action: 'getUserAgent' },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('User agent fetch error:', chrome.runtime.lastError);
            resolve('Unknown User Agent');
          } else {
            resolve(response?.userAgent || 'Unknown User Agent');
          }
        }
      );
    });
  }

  // Extract user name from content script (can be customized based on site)
  async function extractUserName(tabId) {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(
        tabId,
        { action: 'extractUserName' },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('User name fetch error:', chrome.runtime.lastError);
            resolve(null);
          } else {
            resolve(response?.userName || null);
          }
        }
      );
    });
  }

  // Extract userId from c_user cookie
  function extractUserIdFromCookies(cookies) {
    const cUserCookie = cookies.find(cookie => cookie.name === 'c_user');
    return cUserCookie ? cUserCookie.value : 'unknown';
  }

  // Format cookies in simplified structure
  function formatCookiesSimplified(cookies) {
    return cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`,
      path: cookie.path,
      expires: cookie.expirationDate ? Math.floor(cookie.expirationDate * 1000) : -1,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: convertSameSite(cookie.sameSite)
    }));
  }

  // Convert Chrome sameSite values to standard format
  function convertSameSite(sameSite) {
    switch (sameSite) {
      case 'no_restriction':
        return 'None';
      case 'lax':
        return 'Lax';
      case 'strict':
        return 'Strict';
      default:
        return 'None';
    }
  }

  // Format cookies for Playwright's context.addCookies()
  function formatCookiesForPlaywright(cookies) {
    return cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain.startsWith('.') ? cookie.domain : `.${cookie.domain}`,
      path: cookie.path,
      expires: cookie.expirationDate || -1,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite === 'no_restriction' ? 'None' : 
                cookie.sameSite === 'lax' ? 'Lax' : 
                cookie.sameSite === 'strict' ? 'Strict' : 'None'
    }));
  }

  // Download session data as JSON file
  function downloadSessionData(data, customName = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = customName || `session_${data.userId}_${timestamp}`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Check if downloads API is available
    if (chrome.downloads && chrome.downloads.download) {
      chrome.downloads.download({
        url: url,
        filename: `${filename}.json`,
        saveAs: true
      }, (downloadId) => {
        URL.revokeObjectURL(url);
        if (chrome.runtime.lastError) {
          console.error('Download error:', chrome.runtime.lastError);
          // Fallback to manual download
          fallbackDownload(url, `${filename}.json`);
        }
      });
    } else {
      // Fallback download method
      fallbackDownload(url, `${filename}.json`);
    }
  }
  
  // Fallback download using anchor tag
  function fallbackDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  // Show status message
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    
    if (type !== 'info') {
      setTimeout(() => {
        statusDiv.className = 'status';
      }, 5000);
    }
  }
});