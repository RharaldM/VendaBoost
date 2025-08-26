# Session Format Update v2.0.0

## New Session JSON Format

The extension now generates session files in the exact format required by your dashboard:

```json
{
  "userId": "extracted_from_c_user_cookie",
  "timestamp": "2025-08-23T20:59:39.718Z",
  "userInfo": {
    "id": "same_as_userId",
    "name": "extracted_user_name_or_default"
  },
  "userAgent": "navigator.userAgent",
  "url": "current_page_url",
  "source": "extension",
  "cookies": [
    {
      "name": "cookie_name",
      "value": "cookie_value", 
      "domain": ".facebook.com",
      "path": "/",
      "expires": 1234567890000,
      "httpOnly": true,
      "secure": true,
      "sameSite": "None"
    }
  ]
}
```

## Key Changes Made:

### ✅ Session Structure
- **userId**: Extracted from `c_user` cookie value
- **timestamp**: ISO timestamp format (`new Date().toISOString()`)
- **userInfo**: Object with id and name
- **userAgent**: From `navigator.userAgent`
- **source**: Always set to "extension"

### ✅ Cookie Format Simplified
- Removed Chrome-specific fields: `hostOnly`, `session`, `storeId`, `expirationDate`
- **expires**: Converted to milliseconds (from `expirationDate * 1000`)
- **sameSite**: Mapped `"no_restriction"` → `"None"`, `"lax"` → `"Lax"`
- **domain**: Ensures leading dot format

### ✅ User Name Extraction
- Attempts to extract user name from DOM using common selectors
- Supports Facebook and generic website patterns
- Falls back to "Unknown User" if not found

### ✅ File Naming
- Files now named: `session_{userId}_{timestamp}.json`
- Consistent with dashboard expectations

## Testing:

1. **Refresh extension** in `chrome://extensions/`
2. **Go to Facebook** or any authenticated site
3. **Capture session** - should generate new format
4. **Check JSON structure** matches above format exactly

## Backward Compatibility:

- localStorage/sessionStorage fields still captured (if enabled)
- Old Playwright format removed (use new simplified cookies)
- Extension UI unchanged - same capture options

The session files should now work directly with your dashboard without requiring any conversion.