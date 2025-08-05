// Load environment variables
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors({
  origin: ['chrome-extension://*', 'moz-extension://*', 'http://localhost:*'],
  credentials: true
}));
app.use(session({
  secret: process.env.SESSION_SECRET || '181c6b8a73ce337a2af1cc03a3ff76ff',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Database connection with initialization
const db = new sqlite3.Database('./users.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    // Initialize database tables if they don't exist
    initializeDatabaseTables();
  }
});

// Function to initialize database tables
function initializeDatabaseTables() {
  // Create users table
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT 1,
      last_login DATETIME,
      login_attempts INTEGER DEFAULT 0,
      locked_until DATETIME
    )
  `;

  // Create sessions table
  const createSessionsTable = `
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT,
      user_agent TEXT,
      is_active BOOLEAN DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `;

  // Create logs table
  const createLogsTable = `
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    )
  `;

  // Execute table creation
  db.run(createUsersTable, (err) => {
    if (err) {
      console.error('Error creating users table:', err.message);
    } else {
      console.log('✅ Users table initialized');
    }
  });

  db.run(createSessionsTable, (err) => {
    if (err) {
      console.error('Error creating sessions table:', err.message);
    } else {
      console.log('✅ Sessions table initialized');
    }
  });

  db.run(createLogsTable, (err) => {
    if (err) {
      console.error('Error creating logs table:', err.message);
    } else {
      console.log('✅ Logs table initialized');
    }
  });

  // Create default admin user if no users exist
  createDefaultAdminIfNeeded();
}

// Create default admin user if database is empty
function createDefaultAdminIfNeeded() {
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err) {
      console.error('Error checking user count:', err.message);
      return;
    }
    
    console.log(`📊 Current user count: ${row.count}`);
    
    if (row.count === 0) {
      console.log('👤 Creating default admin user...');
      const defaultPassword = 'admin123';
      
      bcrypt.hash(defaultPassword, 10, (err, hashedPassword) => {
        if (err) {
          console.error('❌ Error hashing password:', err.message);
          return;
        }
        
        console.log('🔐 Password hashed successfully, inserting user...');
        
        db.run(
          'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
          ['admin', hashedPassword, 'admin@vendaboost.com'],
          function(err) {
            if (err) {
              console.error('❌ Error creating admin user:', err.message);
            } else {
              console.log('✅ Default admin user created successfully!');
              console.log('   🔑 Username: admin');
              console.log('   🔑 Password: admin123');
              console.log('   📧 Email: admin@vendaboost.com');
              console.log('   🆔 User ID:', this.lastID);
            }
          }
        );
      });
    } else {
      console.log(`👥 Database already has ${row.count} user(s)`);
      
      // List existing users for debug
      db.all('SELECT id, username, email, created_at FROM users', (err, users) => {
        if (!err && users) {
          console.log('📋 Existing users:');
          users.forEach(user => {
            console.log(`   - ID: ${user.id}, Username: ${user.username}, Email: ${user.email}`);
          });
        }
      });
    }
  });
}

// Serve login page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(`🔐 Login attempt for username: ${username}`);

    if (!username || !password) {
      console.log('❌ Missing username or password');
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password are required' 
      });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
      if (err) {
        console.error('❌ Database error:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Internal server error' 
        });
      }

      if (!user) {
        console.log(`❌ User not found: ${username}`);
        
        // Debug: List all users in database
        db.all('SELECT username, email FROM users', (err, users) => {
          if (!err && users) {
            console.log('📊 Available users in database:');
            users.forEach(u => console.log(`   - ${u.username} (${u.email})`));
          }
        });
        
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid credentials' 
        });
      }

      console.log(`✅ User found: ${user.username}`);
      const isValidPassword = await bcrypt.compare(password, user.password);
      console.log(`🔑 Password validation: ${isValidPassword ? 'SUCCESS' : 'FAILED'}`);
      
      if (!isValidPassword) {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid credentials' 
        });
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      console.log(`🎉 Login successful for: ${user.username}`);
      res.json({
        success: true,
        message: 'Login successful',
        token: token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Validate token endpoint
app.post('/api/validate', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ 
      success: false, 
      message: 'Token is required' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({
      success: true,
      user: {
        userId: decoded.userId,
        username: decoded.username
      }
    });
  } catch (error) {
    res.status(401).json({ 
      success: false, 
      message: 'Invalid token' 
    });
  }
});

// Register endpoint (optional)
app.post('/api/register', async (req, res) => {
  try {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username, password, and email are required' 
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
      [username, hashedPassword, email],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ 
              success: false, 
              message: 'Username or email already exists' 
            });
          }
          console.error('Database error:', err);
          return res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
          });
        }

        res.status(201).json({
          success: true,
          message: 'User registered successfully',
          userId: this.lastID
        });
      }
    );
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Login server running on port ${PORT}`);
  console.log(`Access the login page at: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});
