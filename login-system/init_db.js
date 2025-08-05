const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const dbPath = './users.db';

console.log('Initializing database...');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error creating database:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

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

// Create sessions table (for token management)
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

// Create logs table (for audit trail)
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

// Function to run table creation
function createTable(query, tableName) {
  return new Promise((resolve, reject) => {
    db.run(query, (err) => {
      if (err) {
        console.error(`❌ Error creating ${tableName} table:`, err.message);
        reject(err);
      } else {
        console.log(`✅ ${tableName} table created/verified successfully`);
        resolve();
      }
    });
  });
}

// Initialize database
async function initializeDatabase() {
  try {
    console.log('\n🔧 Creating tables...\n');
    
    // Create all tables
    await createTable(createUsersTable, 'users');
    await createTable(createSessionsTable, 'sessions');
    await createTable(createLogsTable, 'logs');
    
    // Create indexes for better performance
    const indexes = [
      { name: 'idx_users_username', query: 'CREATE INDEX IF NOT EXISTS idx_users_username ON users (username)' },
      { name: 'idx_users_email', query: 'CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)' },
      { name: 'idx_sessions_token', query: 'CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token)' },
      { name: 'idx_sessions_user_id', query: 'CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)' },
      { name: 'idx_logs_user_id', query: 'CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs (user_id)' },
      { name: 'idx_logs_timestamp', query: 'CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs (timestamp)' }
    ];
    
    console.log('📊 Creating indexes...\n');
    
    for (const index of indexes) {
      await new Promise((resolve, reject) => {
        db.run(index.query, (err) => {
          if (err) {
            console.error(`❌ Error creating index ${index.name}:`, err.message);
            reject(err);
          } else {
            console.log(`✅ Index ${index.name} created successfully`);
            resolve();
          }
        });
      });
    }
    
    // Insert default admin user if no users exist
    await createDefaultAdmin();
    
    console.log('\n🎉 Database initialization completed successfully!');
    console.log('\n📝 Database schema:');
    console.log('   - users: Store user accounts');
    console.log('   - sessions: Store authentication tokens');
    console.log('   - logs: Store audit trail');
    console.log('\n💡 Next steps:');
    console.log('   1. Run "npm install" to install dependencies');
    console.log('   2. Run "npm start" to start the login server');
    console.log('   3. Use "node add_user.js" to add new users');
    
  } catch (error) {
    console.error('\n❌ Database initialization failed:', error.message);
    process.exit(1);
  }
}

// Create default admin user
function createDefaultAdmin() {
  return new Promise((resolve, reject) => {
    // Check if any users exist
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (row.count === 0) {
        console.log('\n👤 Creating default admin user...');
        
        const bcrypt = require('bcryptjs');
        const defaultPassword = 'admin123';
        
        bcrypt.hash(defaultPassword, 10, (err, hashedPassword) => {
          if (err) {
            reject(err);
            return;
          }
          
          db.run(
            'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
            ['admin', hashedPassword, 'admin@example.com'],
            function(err) {
              if (err) {
                reject(err);
              } else {
                console.log('✅ Default admin user created:');
                console.log('   Username: admin');
                console.log('   Password: admin123');
                console.log('   Email: admin@example.com');
                console.log('   ⚠️  Please change the default password!');
                resolve();
              }
            }
          );
        });
      } else {
        console.log(`\n👥 Found ${row.count} existing user(s) in database`);
        resolve();
      }
    });
  });
}

// Run initialization
initializeDatabase()
  .finally(() => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('\n🔒 Database connection closed');
      }
      process.exit(0);
    });
  });

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nOperation cancelled by user');
  db.close();
  process.exit(0);
});
