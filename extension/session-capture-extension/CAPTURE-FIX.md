# Fixed: Capture Error - Tab Variable Scope Issue

## Problem Fixed in v1.0.3:
```
Capture error: ReferenceError: tab is not defined
```

## Root Cause:
The `tab` and `url` variables were declared inside a try-catch block, making them inaccessible to the capture button click handler.

## Solution:
- Moved `tab` and `url` to global scope as `currentTab` and `currentUrl`
- Added validation in capture handler to ensure valid tab data exists
- Improved error messaging for debugging

## Code Changes:
```javascript
// Before (broken):
try {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // tab only accessible within this try block
}

captureBtn.addEventListener('click', async () => {
  // ERROR: tab is not defined here!
  const sessionData = {
    url: tab.url, // ReferenceError
    domain: url.hostname, // ReferenceError
  };
});

// After (fixed):
let currentTab = null;
let currentUrl = null;

try {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;
  currentUrl = new URL(tab.url);
}

captureBtn.addEventListener('click', async () => {
  if (!currentTab || !currentUrl) {
    throw new Error('No valid tab information available');
  }
  
  const sessionData = {
    url: currentTab.url, // ✅ Works!
    domain: currentUrl.hostname, // ✅ Works!
  };
});
```

## To Apply Fix:
1. Refresh the extension in `chrome://extensions/`
2. Test capture functionality on any HTTPS website
3. Should now work without variable scope errors

## Testing:
1. Go to any website (e.g., https://github.com)
2. Click extension icon
3. Click "Capture Session"
4. Should show "Capturing session data..." and download JSON file