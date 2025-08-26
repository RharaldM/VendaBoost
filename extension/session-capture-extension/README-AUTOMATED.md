# Facebook Session Auto-Capture Extension

## Overview
This Chrome extension automatically captures Facebook session data (cookies, localStorage, sessionStorage) when you're logged in, and sends it to a local bridge server. This allows you to use the session data with Playwright for automation, bypassing repeated 2FA requirements.

**IMPORTANT**: This is for personal use only on your own accounts. Never use this on accounts you don't own.

## What Changed from Manual Version

### ✅ Removed
- Popup UI completely removed
- Manual "Extract" button removed
- All user interaction requirements removed

### ✅ Added
- Automatic session detection on Facebook
- Auto-capture when logged in
- Direct sending to localhost bridge (port 3000)
- Smart deduplication (avoids capturing same session repeatedly)
- Background monitoring every 30 seconds

### ✅ Modified
- `manifest.json`: Removed popup, added webNavigation permission
- `background.js`: Complete rewrite for automatic operation
- `content.js`: Kept as-is (already suitable for automation)

## Installation

### 1. Start the Bridge Server
First, make sure the bridge server is running:

```bash
cd C:\Users\Hardd\Documents\AUTOMACAO
node start-file-bridge.js
```

The server should start on port 3000 and show:
```
🚀 VendaBoost File System Bridge started
📡 Server running on http://localhost:3000
```

### 2. Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the folder: `C:\Users\Hardd\Documents\AUTOMACAO\extension\session-capture-extension`
5. The extension "Facebook Session Auto-Capture" should appear

### 3. Files to Remove (Optional)
Since we no longer need the popup, you can delete these files:
- `popup.html`
- `popup.js`
- `popup.css` (if exists)

Keep these files as they're still used:
- `manifest.json`
- `background.js`
- `content.js`
- `icon*.png` files

## How It Works

### Automatic Capture Flow

1. **Detection**: Extension monitors all Facebook tabs
2. **Trigger**: When a Facebook page loads completely, it checks for login
3. **Validation**: Looks for `c_user` cookie (Facebook's user ID cookie)
4. **Deduplication**: Checks if this user was captured in last 5 minutes
5. **Capture**: Extracts cookies, localStorage, sessionStorage
6. **Send**: POSTs data to `http://localhost:3000/api/facebook-session`
7. **Storage**: Bridge saves to `data/sessions/` folder

### Data Format

The extension sends data in this format:
```json
{
  "userId": "123456789",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "userInfo": {
    "id": "123456789",
    "name": "User Name"
  },
  "userAgent": "Mozilla/5.0...",
  "url": "https://www.facebook.com/...",
  "source": "auto-extension",
  "cookies": [...],
  "localStorage": {...},
  "sessionStorage": {...},
  "metadata": {
    "captureMethod": "automatic",
    "tabId": 123,
    "extensionVersion": "3.0.0"
  }
}
```

## Using with Playwright

### Basic Usage

```javascript
const { loadCurrentSession, createAuthenticatedContext } = require('./playwright-integration-updated.js');

async function runAutomation() {
  // Load the most recent session
  const sessionData = await loadCurrentSession();
  
  // Create browser with session
  const { browser, context } = await createAuthenticatedContext(sessionData);
  const page = await context.newPage();
  
  // Navigate to Facebook - already logged in!
  await page.goto('https://www.facebook.com');
  
  // Your automation code here...
  
  await browser.close();
}

runAutomation();
```

### Wait for New Session

```javascript
const { waitForNewSession } = require('./playwright-integration-updated.js');

// Wait for user to log in with extension installed
const session = await waitForNewSession(null, 120000); // 2 minute timeout
console.log('New session captured for user:', session.userId);
```

### Load Specific User Session

```javascript
const { loadSessionByUserId } = require('./playwright-integration-updated.js');

const session = await loadSessionByUserId('123456789');
```

## Configuration

Edit `background.js` to adjust settings:

```javascript
const CONFIG = {
  BRIDGE_URL: 'http://localhost:3000/api/facebook-session',
  CHECK_INTERVAL: 30000, // Check every 30 seconds
  MIN_CAPTURE_INTERVAL: 300000, // Min 5 minutes between captures
  FACEBOOK_DOMAINS: ['facebook.com', 'www.facebook.com'],
  DEBUG: true // Set to false to reduce console logs
};
```

## Debugging

### Check Extension Console
1. Go to `chrome://extensions/`
2. Find "Facebook Session Auto-Capture"
3. Click "background page" or "service worker"
4. Check console for logs prefixed with `[FB-AutoCapture]`

### Common Issues

**Session not capturing:**
- Make sure you're logged into Facebook
- Check if bridge server is running
- Look for errors in extension console
- Wait 3-5 seconds after page loads

**Bridge connection failed:**
- Verify server is running on port 3000
- Check Windows firewall settings
- Try accessing `http://localhost:3000/api/test-simple` in browser

**Session expired in Playwright:**
- Facebook sessions can expire after inactivity
- Capture a fresh session by logging in again
- The extension will auto-capture the new session

## Security Notes

⚠️ **IMPORTANT SECURITY CONSIDERATIONS:**

1. **Local Only**: Extension only sends to localhost:3000
2. **No External Communication**: Never sends data to external servers
3. **Personal Use**: Only use on accounts you own
4. **Secure Storage**: Session files contain sensitive data - protect them
5. **Don't Share**: Never share session files or commit to git

## Testing the Setup

1. **Test Extension Loading:**
   - Open Facebook in Chrome
   - Open extension console (chrome://extensions -> service worker)
   - Should see: "Facebook Session Auto-Capture Extension - Background script loaded"

2. **Test Auto-Capture:**
   - Log into Facebook
   - Wait 5 seconds
   - Check bridge server console for "📡 Facebook session data received"
   - Check `data/sessions/` folder for new JSON file

3. **Test with Playwright:**
   ```bash
   node playwright-integration-updated.js
   ```
   Should open browser already logged into Facebook

## Comparison with Manual Version

| Feature | Manual Version | Auto Version |
|---------|---------------|--------------|
| User Interaction | Click button | None |
| Capture Trigger | Manual | Automatic on page load |
| Data Destination | Download file | Localhost bridge |
| Session Storage | Chrome downloads | File system via bridge |
| Deduplication | None | 5-minute cooldown |
| Facebook Detection | Check current tab | Monitor all FB tabs |

## Uninstalling

1. Remove extension from Chrome (chrome://extensions/)
2. Stop bridge server (Ctrl+C in terminal)
3. Delete extension folder (optional)
4. Delete captured sessions in `data/sessions/` (optional)

## License & Disclaimer

This tool is for personal use only. Users are responsible for complying with Facebook's Terms of Service and applicable laws. The authors are not responsible for any misuse of this tool.