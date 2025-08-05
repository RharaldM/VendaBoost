# Extension Login System

A secure login system for browser extensions using Node.js, Express, SQLite, and JWT authentication.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd login-system
npm install
```

### 2. Initialize Database
```bash
npm run init-db
```
This will create the SQLite database and a default admin user:
- **Username:** admin
- **Password:** admin123
- **Email:** admin@example.com

⚠️ **Important:** Change the default admin password immediately!

### 3. Start the Server
```bash
npm start
```
The server will run on `http://localhost:3000`

## 📁 Project Structure

```
login-system/
├── app.js           # Main Express server
├── package.json     # Dependencies and scripts
├── login.html       # Login/Register web interface
├── add_user.js      # User management utility
├── init_db.js       # Database initialization
└── users.db         # SQLite database (created after init)
```

## 🔧 Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start with nodemon for development
- `npm run init-db` - Initialize the database
- `npm run add-user` - Add a new user interactively

## 👥 User Management

### Add User Interactively
```bash
node add_user.js
```

### Add User via Command Line
```bash
node add_user.js username email@example.com password123
```

## 🔐 API Endpoints

### POST /api/login
Login with username and password
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "jwt-token-here",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com"
  }
}
```

### POST /api/register
Register a new user
```json
{
  "username": "newuser",
  "email": "user@example.com",
  "password": "password123"
}
```

### POST /api/validate
Validate an authentication token
```json
{
  "token": "jwt-token-here"
}
```

### GET /api/health
Health check endpoint

## 🌐 Extension Integration

### 1. Background Script Integration
```javascript
// In your extension's background.js
function authenticateUser() {
  chrome.tabs.create({
    url: 'http://localhost:3000',
    active: true
  }, (tab) => {
    // Listen for authentication success
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        // Check for authentication token
        chrome.tabs.executeScript(tab.id, {
          code: 'localStorage.getItem("authToken")'
        }, (result) => {
          if (result && result[0]) {
            // Store token in extension storage
            chrome.storage.local.set({
              authToken: result[0]
            });
            chrome.tabs.remove(tab.id);
          }
        });
      }
    });
  });
}
```

### 2. Popup Integration
```javascript
// In your extension's popup.js
chrome.storage.local.get(['authToken'], (result) => {
  if (result.authToken) {
    // User is authenticated
    validateToken(result.authToken);
  } else {
    // Redirect to login
    showLoginButton();
  }
});

function validateToken(token) {
  fetch('http://localhost:3000/api/validate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Token is valid
      showAuthenticatedUI(data.user);
    } else {
      // Token is invalid, clear storage
      chrome.storage.local.remove(['authToken']);
      showLoginButton();
    }
  });
}
```

### 3. Manifest Permissions
Add these permissions to your `manifest.json`:
```json
{
  "permissions": [
    "storage",
    "tabs",
    "http://localhost:3000/*"
  ],
  "host_permissions": [
    "http://localhost:3000/*"
  ]
}
```

## 🔒 Security Features

- **Password Hashing:** Uses bcryptjs for secure password storage
- **JWT Tokens:** Stateless authentication with expiration
- **CORS Protection:** Configured for extension origins
- **Input Validation:** Server-side validation for all inputs
- **SQL Injection Protection:** Parameterized queries
- **Rate Limiting Ready:** Structure supports rate limiting implementation

## 🗃️ Database Schema

### Users Table
- `id` - Primary key
- `username` - Unique username
- `password` - Hashed password
- `email` - Unique email
- `created_at` - Account creation timestamp
- `updated_at` - Last update timestamp
- `is_active` - Account status
- `last_login` - Last login timestamp
- `login_attempts` - Failed login counter
- `locked_until` - Account lock expiration

### Sessions Table
- `id` - Primary key
- `user_id` - Foreign key to users
- `token` - JWT token
- `expires_at` - Token expiration
- `created_at` - Session creation
- `ip_address` - Client IP
- `user_agent` - Client user agent
- `is_active` - Session status

### Logs Table
- `id` - Primary key
- `user_id` - Foreign key to users
- `action` - Action performed
- `details` - Action details
- `ip_address` - Client IP
- `user_agent` - Client user agent
- `timestamp` - Action timestamp

## 🚀 Deployment

### Using Render.com
1. Push your code to GitHub
2. Connect your GitHub repo to Render
3. Set environment variables:
   - `JWT_SECRET` - Your JWT secret key
   - `NODE_ENV` - production
4. Deploy!

### Environment Variables
```bash
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=production
PORT=3000
```

## 🔧 Development

### Development Mode
```bash
npm run dev
```
This uses nodemon for auto-restart on file changes.

### Adding Features
The system is designed to be extensible:
- Add new API endpoints in `app.js`
- Modify the database schema in `init_db.js`
- Customize the UI in `login.html`
- Add user management features in `add_user.js`

## 🤝 Support

For issues or questions:
1. Check the logs in the terminal
2. Verify database connections
3. Ensure all dependencies are installed
4. Check CORS settings for your extension

## 📝 License

MIT License - feel free to use in your projects!
