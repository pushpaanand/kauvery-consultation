#!/usr/bin/env node
/**
 * Post-build check: ensures built JS does NOT contain server-only secrets (VAPT).
 * Run after build: node check-bundle-no-secrets.js
 * Or: npm run check-bundle
 */

const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, 'build', 'static', 'js');

// Strings that must NOT appear in client bundle (sensitive / server-only)
const FORBIDDEN = [
  'REACT_APP_ZEGO_SERVER_SECRET',
  'REACT_APP_ZEGO_APP_ID',
  'REACT_APP_DECRYPTION_KEY',
];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const found = [];
  for (const str of FORBIDDEN) {
    if (content.includes(str)) found.push(str);
  }
  return found;
}

function main() {
  if (!fs.existsSync(BUILD_DIR)) {
    console.log('⚠️  No build folder found. Run "npm run build" first.');
    process.exit(0);
  }

  const files = fs.readdirSync(BUILD_DIR).filter(f => f.endsWith('.js'));
  let failed = false;

  for (const file of files) {
    const fullPath = path.join(BUILD_DIR, file);
    const found = checkFile(fullPath);
    if (found.length > 0) {
      console.error(`❌ ${file} contains forbidden env/secret references: ${found.join(', ')}`);
      failed = true;
    }
  }

  if (failed) {
    console.error('\n❌ Bundle check FAILED. Do not deploy. Fix build env (remove Zego/decryption from client .env and CI).\n');
    process.exit(1);
  }

  console.log('✅ Bundle check passed: no server-only secrets in built JS.\n');
  process.exit(0);
}

main();
