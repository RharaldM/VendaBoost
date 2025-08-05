# Project Structure

This document explains the VendaBoost project structure and organization.

## Overview

VendaBoost follows a **monorepo architecture** with clear separation between frontend (browser extension) and backend (authentication server) components.

## Directory Structure

```
VendaBoost/
├── 📁 Root Level                  # Extension files
│   ├── src/                      # Extension source code
│   │   ├── background.js         # Service worker
│   │   ├── content.js           # Content scripts
│   │   ├── popup.html/js        # Extension popup
│   │   ├── database.js          # IndexedDB management
│   │   └── openai-integration.js # AI features
│   │
│   ├── public/                   # Static assets
│   │   ├── manifest.json        # Extension manifest
│   │   └── icons/               # Extension icons
│   │
│   ├── scripts/                  # Build utilities
│   │   └── copy-static.js       # Asset copying script
│   │
│   ├── dist/                     # Built extension (ignored)
│   └── package.json             # Extension dependencies
│
├── 📁 login-system/              # Authentication server
│   ├── app.js                   # Express server
│   ├── login.html              # Login interface
│   ├── init_db.js              # Database initialization
│   ├── add_user.js             # User management
│   ├── package.json            # Server dependencies
│   └── users.db                # SQLite database (ignored)
│
├── 📁 docs/                     # Documentation
│   ├── LOGIN_SYSTEM.md         # Auth system documentation
│   └── STRUCTURE.md            # This file
│
├── 📁 fotos/                    # Project screenshots
├── 📁 versao_antiga/            # Legacy code (ignored)
│
├── README.md                    # Main project documentation
├── .gitignore                   # Git ignore rules
├── vite.config.js              # Vite configuration
└── Various PowerShell scripts   # Build and utility scripts
```

## Component Separation

### Extension (Frontend)
- **Purpose**: Browser extension functionality
- **Dependencies**: Vite, Dexie.js, Chrome APIs
- **Build Output**: `dist/` folder for browser loading
- **Entry Points**: `popup.html`, `background.js`, `content.js`

### Authentication Server (Backend)
- **Purpose**: User authentication and management
- **Dependencies**: Express.js, SQLite3, JWT, Bcrypt
- **Runtime**: Node.js server (localhost:3000)
- **Database**: SQLite with users, sessions, and logs tables

## Development Workflow

### 1. Initial Setup
```bash
npm run setup        # Install all dependencies
npm run setup:auth   # Initialize authentication database
```

### 2. Development
```bash
# Terminal 1: Extension development
npm run dev

# Terminal 2: Authentication server
npm run start:auth
```

### 3. Production Build
```bash
npm run build:all    # Build both extension and prepare server
```

## File Organization Principles

### Root Level
- Contains extension-specific files
- Main package.json for extension dependencies
- Primary documentation (README.md)

### Subdirectories
- `login-system/`: Self-contained authentication server
- `docs/`: All documentation files
- `fotos/`: Project screenshots and images
- `versao_antiga/`: Legacy code (not tracked in git)

### Build Artifacts
- `dist/`: Extension build output (ignored)
- `*.zip`: Distribution packages (ignored)
- `login-system/users.db`: Database file (ignored)
- `login-system/node_modules/`: Server dependencies (ignored)

## Best Practices

### 1. Dependency Management
- Keep extension and server dependencies separate
- Use workspace commands for unified management
- Update dependencies regularly for security

### 2. Documentation
- Main README.md for project overview
- Specific documentation in docs/ folder
- Inline code comments for complex logic

### 3. Git Management
- Comprehensive .gitignore for all environments
- Meaningful commit messages
- Regular pushes to backup work

### 4. Security
- Never commit database files
- Keep environment variables in .env files
- Regular security audits of dependencies

## Deployment Structure

### Extension Deployment
```
dist/
├── manifest.json
├── popup.html
├── background.js
├── content.js
└── icons/
```

### Server Deployment
```
login-system/
├── app.js
├── login.html
├── init_db.js
├── add_user.js
├── package.json
└── .env (environment variables)
```

This structure ensures:
- ✅ Clean separation of concerns
- ✅ Independent development and deployment
- ✅ Easy maintenance and updates
- ✅ Professional project organization
