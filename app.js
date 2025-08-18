// Redirect to the actual login system app
// This file exists because Render defaults to running 'node app.js' from root
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

console.log('Starting VendaBoost Login System...');

// Get current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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