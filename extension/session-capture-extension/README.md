# Session Capture Extension for Playwright

A secure Chrome extension for capturing browser session data (cookies, localStorage, sessionStorage) to use with Playwright automation scripts. Perfect for bypassing repeated 2FA prompts during testing and automation of your own accounts.

## Features

- 🔐 **Secure**: All data is handled locally, no external servers
- 🍪 **Complete Session Capture**: Cookies, localStorage, and sessionStorage
- 📦 **Playwright Ready**: Exports data in a format optimized for Playwright
- 💾 **Export/Import**: Download session data as JSON files
- 🎯 **Selective Capture**: Choose which data types to capture
- 🔄 **Session History**: View and re-download previous captures

## Installation

1. **Clone or download this extension folder**

2. **Load the extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `session-capture-extension` folder

3. **The extension icon will appear in your toolbar**

## Usage

### Capturing Session Data

1. **Log into your website normally** (including any 2FA)
2. **Click the extension icon** in the toolbar
3. **Select data to capture:**
   - ✅ Cookies
   - ✅ Local Storage
   - ✅ Session Storage
4. **Click "Capture Session"**
5. **Save the JSON file** when prompted

### Using with Playwright

1. **Install Playwright:**
```bash
npm install playwright
```

2. **Use the provided integration script:**
```javascript
const { chromium } = require('playwright');
const sessionData = require('./your-session-file.json');

// See playwright-integration.js for complete example
```

3. **Run your automation:**
```bash
node your-script.js
```

## File Structure

```
session-capture-extension/
├── manifest.json           # Extension configuration
├── popup.html             # Extension UI
├── popup.js               # UI logic and coordination
├── background.js          # Service worker for cookies
├── content.js             # Page context script
├── playwright-integration.js  # Example Playwright usage
└── README.md              # This file
```

## Security Considerations

⚠️ **Important Security Notes:**

- **Only use on your own accounts** - This tool is for personal productivity only
- **Store session files securely** - Captured data includes authentication tokens
- **Don't share session files** - They contain sensitive authentication data
- **Sessions expire** - Captured sessions will eventually expire based on the website's policy
- **Use HTTPS only** - Only capture sessions from secure websites

## Example Playwright Script

```javascript
const { chromium } = require('playwright');
const fs = require('fs').promises;

async function runWithSession() {
  // Load captured session
  const sessionData = JSON.parse(
    await fs.readFile('./session_example.com.json', 'utf-8')
  );
  
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  
  // Apply cookies
  await context.addCookies(sessionData.playwrightCookies);
  
  // Apply storage data
  await context.addInitScript(() => {
    // localStorage and sessionStorage are restored here
  });
  
  // Navigate and automate
  const page = await context.newPage();
  await page.goto(sessionData.url);
  
  // You're now logged in!
  // Continue with your automation...
}

runWithSession();
```

## Data Format

The extension exports JSON with the following structure:

```json
{
  "url": "https://example.com",
  "domain": "example.com",
  "capturedAt": "2024-01-01T12:00:00.000Z",
  "cookies": [...],
  "localStorage": {
    "key": {
      "type": "string|json",
      "value": "..."
    }
  },
  "sessionStorage": {...},
  "playwrightCookies": [...]  // Pre-formatted for Playwright
}
```

## Troubleshooting

### Session not working in Playwright?
- Check if cookies have expired
- Ensure you're navigating to the same domain
- Some sites require specific headers or user agents

### Extension not capturing data?
- Refresh the page after installing the extension
- Check that the site uses standard storage APIs
- Some sites may use additional security measures

### Can't see localStorage/sessionStorage?
- Some sites store data in iframes
- Data might be cleared on navigation
- Check the browser console for errors

## Development

To modify the extension:

1. Edit the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

## License

This tool is for personal use only. Use responsibly and only on your own accounts.

## Support

For issues or questions, please review the security considerations and ensure you're using the tool appropriately for personal automation only.