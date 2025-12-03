// Build-time script to check for internal IP addresses in environment variables
// This script runs before the build to prevent internal IP disclosure
// Add to package.json: "prebuild": "node build-time-ip-check.js"

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Private IP ranges to detect
const privateIPPatterns = [
  /^10\./,                              // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,    // 172.16.0.0/12
  /^192\.168\./,                        // 192.168.0.0/16
  /^127\./,                             // 127.0.0.0/8
  /localhost/i,
  /^0\.0\.0\.0$/,
];

function isPrivateIP(value) {
  if (!value || typeof value !== 'string') return false;
  
  // Extract IP from URL
  const urlMatch = value.match(/(?:https?:\/\/)?(\d+\.\d+\.\d+\.\d+)/);
  if (urlMatch) {
    const ip = urlMatch[1];
    return privateIPPatterns.some(pattern => pattern.test(ip));
  }
  
  // Check if it's localhost
  if (value.includes('localhost') || value.includes('127.0.0.1') || value.includes('0.0.0.0')) {
    return true;
  }
  
  return false;
}

function checkEnvironmentVariables() {
  console.log('🔍 Checking environment variables for internal IP addresses...\n');
  
  const errors = [];
  const warnings = [];
  
  // Check all REACT_APP_ environment variables
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('REACT_APP_')) {
      const value = process.env[key];
      
      if (isPrivateIP(value)) {
        errors.push({
          variable: key,
          value: value.replace(/\d+\.\d+\.\d+\.\d+/, '[INTERNAL_IP]'), // Mask IP for display
          issue: 'Contains private/internal IP address'
        });
      }
      
      // Warn about localhost in production
      if (process.env.NODE_ENV === 'production' && 
          (value.includes('localhost') || value.includes('127.0.0.1'))) {
        warnings.push({
          variable: key,
          value: value,
          issue: 'Contains localhost - not suitable for production'
        });
      }
    }
  });
  
  if (errors.length > 0) {
    console.error('❌ SECURITY ERROR: Internal IP addresses detected in environment variables!\n');
    errors.forEach(({ variable, value, issue }) => {
      console.error(`  Variable: ${variable}`);
      console.error(`  Issue: ${issue}`);
      console.error(`  Value: ${value}`);
      console.error('');
    });
    console.error('⚠️  Internal IP addresses will be bundled into client-side JavaScript!');
    console.error('⚠️  This exposes your infrastructure to attackers.');
    console.error('\n💡 Solution:');
    console.error('   1. Use public URLs (e.g., Azure App Service URL)');
    console.error('   2. Never use internal IP addresses (172.x, 192.168.x, 10.x)');
    console.error('   3. Use relative URLs or public domain names');
    console.error('\n❌ Build aborted for security reasons.\n');
    process.exit(1);
  }
  
  if (warnings.length > 0) {
    console.warn('⚠️  WARNING: Potential issues found:\n');
    warnings.forEach(({ variable, value, issue }) => {
      console.warn(`  Variable: ${variable}`);
      console.warn(`  Issue: ${issue}`);
      console.warn(`  Value: ${value}`);
      console.warn('');
    });
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ No internal IP addresses detected in environment variables.\n');
  }
}

// Run the check
checkEnvironmentVariables();

