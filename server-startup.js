// Minimal startup wrapper to catch all errors
// This file loads server.js and ensures it doesn't crash

console.log('🔄 Starting server wrapper...');
console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  IISNODE_VERSION: process.env.IISNODE_VERSION,
  WEBSITE_SITE_NAME: process.env.WEBSITE_SITE_NAME
});

try {
  // Load the main server file
  console.log('📦 Loading server.js...');
  const app = require('./server.js');
  console.log('✅ server.js loaded successfully');
  
  // Verify app is exported
  if (!app) {
    console.error('❌ server.js did not export an app');
    process.exit(1);
  }
  
  console.log('✅ Server module exported successfully');
  module.exports = app;
  
} catch (error) {
  console.error('❌ FATAL ERROR loading server.js:');
  console.error('Error message:', error.message);
  console.error('Error stack:', error.stack);
  
  // Create a minimal fallback Express app
  console.log('⚠️ Creating minimal fallback server...');
  const express = require('express');
  const fallbackApp = express();
  
  fallbackApp.get('*', (req, res) => {
    res.status(500).json({
      error: 'Server initialization failed',
      message: error.message,
      path: req.path,
      timestamp: new Date().toISOString()
    });
  });
  
  module.exports = fallbackApp;
}

