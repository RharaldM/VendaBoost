// Redirect to the actual login system app
// This file exists because Render defaults to running 'node app.js' from root
console.log('Starting VendaBoost Login System...');

// Import and run the actual app from login-system directory
const path = require('path');
const { spawn } = require('child_process');

// Change to login-system directory and run the app
process.chdir(path.join(__dirname, 'login-system'));

// Start the login system app
const child = spawn('node', ['app.js'], {
  stdio: 'inherit',
  env: { ...process.env }
});

child.on('error', (error) => {
  console.error('Failed to start login system:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  console.log(`Login system exited with code ${code}`);
  process.exit(code);
});