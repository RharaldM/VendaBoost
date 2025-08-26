# Installation Instructions

## Quick Start

### 1. Load Extension in Chrome

1. **Open Chrome** and navigate to `chrome://extensions/`
2. **Enable Developer Mode** (toggle switch in top right corner)
3. **Click "Load unpacked"**
4. **Select the `session-capture-extension` folder**
5. **Pin the extension** (optional) - click the puzzle piece icon and pin "Session Capture"

### 2. Test the Extension

1. **Navigate to any website** (e.g., `https://github.com`)
2. **Click the extension icon** in the toolbar
3. **Verify the popup opens** and shows the current domain
4. **Try capturing session data** (should work even without login)

## Troubleshooting

### ❌ Service Worker Registration Failed (Status Code: 15)
**Fixed in v1.0.1** - Updated manifest.json with proper service worker configuration

### ❌ Cannot read properties of undefined (reading 'create')
**Fixed in v1.0.1** - Added fallback download method when chrome.downloads is unavailable

### ❌ Extension doesn't appear
- Refresh the extensions page (`chrome://extensions/`)
- Check that all files are in the folder (especially icons)
- Look for error messages in the extension details

### ❌ Popup shows "Cannot access current tab"
- Make sure you're on an HTTP/HTTPS website (not chrome:// pages)
- Refresh the page and try again
- Check that the extension has "tabs" permission

### ❌ Session capture fails
- Content script may not be injected yet - refresh the page
- Some sites block content scripts - check the console for errors
- Ensure you're on a supported website type

## Supported Browsers
- ✅ Chrome (Recommended)
- ✅ Chromium-based browsers (Edge, Brave, Opera)
- ❌ Firefox (uses different extension API)

## Next Steps

Once the extension is working:

1. **Log into a website** that requires authentication
2. **Use the extension** to capture your session data
3. **Download the JSON file** 
4. **Use with Playwright** following the examples in `playwright-integration.js`

## Security Reminders

- Only use on your own accounts
- Keep session files secure
- Session data contains authentication tokens
- Files are stored locally only - no cloud sync