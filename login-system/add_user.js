const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Database connection
const db = new sqlite3.Database('./users.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Function to add a user
async function addUser(username, email, password) {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
        [username, hashedPassword, email],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              reject(new Error('Username or email already exists'));
            } else {
              reject(err);
            }
          } else {
            resolve({
              id: this.lastID,
              username: username,
              email: email
            });
          }
        }
      );
    });
  } catch (error) {
    throw error;
  }
}

// Function to prompt for user input
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Function to prompt for password (hidden input)
function promptPassword(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    let password = '';
    
    process.stdin.on('data', function(char) {
      char = char + "";
      
      switch(char) {
        case "\n":
        case "\r":
        case "\u0004":
          process.stdin.setRawMode(false);
          process.stdin.pause();
          console.log('');
          resolve(password);
          break;
        case "\u0003":
          process.exit();
          break;
        case "\u007f": // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    });
  });
}

// Main function to add user interactively
async function main() {
  try {
    console.log('=== Add New User ===\n');
    
    // Get user input
    const username = await prompt('Username: ');
    const email = await prompt('Email: ');
    const password = await promptPassword('Password: ');
    const confirmPassword = await promptPassword('Confirm Password: ');
    
    // Validate input
    if (!username || !email || !password) {
      console.log('\nError: All fields are required');
      process.exit(1);
    }
    
    if (password !== confirmPassword) {
      console.log('\nError: Passwords do not match');
      process.exit(1);
    }
    
    if (password.length < 6) {
      console.log('\nError: Password must be at least 6 characters long');
      process.exit(1);
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('\nError: Invalid email format');
      process.exit(1);
    }
    
    // Add user to database
    console.log('\nAdding user...');
    const newUser = await addUser(username, email, password);
    
    console.log('\n✅ User added successfully!');
    console.log(`ID: ${newUser.id}`);
    console.log(`Username: ${newUser.username}`);
    console.log(`Email: ${newUser.email}`);
    
  } catch (error) {
    console.error('\n❌ Error adding user:', error.message);
  } finally {
    rl.close();
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      }
      process.exit(0);
    });
  }
}

// Command line arguments support
if (process.argv.length === 5) {
  // Non-interactive mode: node add_user.js username email password
  const [,, username, email, password] = process.argv;
  
  addUser(username, email, password)
    .then((newUser) => {
      console.log('✅ User added successfully!');
      console.log(`ID: ${newUser.id}`);
      console.log(`Username: ${newUser.username}`);
      console.log(`Email: ${newUser.email}`);
    })
    .catch((error) => {
      console.error('❌ Error adding user:', error.message);
    })
    .finally(() => {
      db.close();
      process.exit(0);
    });
} else if (process.argv.length === 2) {
  // Interactive mode
  main();
} else {
  console.log('Usage:');
  console.log('  Interactive mode: node add_user.js');
  console.log('  Command line mode: node add_user.js <username> <email> <password>');
  process.exit(1);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nOperation cancelled by user');
  rl.close();
  db.close();
  process.exit(0);
});
