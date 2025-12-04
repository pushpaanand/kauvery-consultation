// Minimal server that will definitely work
// Use this to get the site responsive immediately

const express = require('express');
const path = require('path');
const app = express();

console.log('🔄 Loading minimal server...');

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS - allow all origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Health check - MUST work
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    server: 'minimal',
    message: 'Minimal server is running'
  });
});

// Serve static files if they exist
try {
  app.use(express.static(path.join(__dirname, 'client/build'), {
    etag: false
  }));
  console.log('✅ Static files middleware loaded');
} catch (err) {
  console.warn('⚠️ Static files not available:', err.message);
}

// Simple API endpoints
app.post('/api/decrypt', (req, res) => {
  res.json({ 
    success: false, 
    error: 'Minimal server mode',
    message: 'Full server features not available. Check logs for initialization issues.'
  });
});

app.post('/api/decrypt/batch', (req, res) => {
  res.json({ 
    success: false, 
    error: 'Minimal server mode',
    message: 'Full server features not available. Check logs for initialization issues.'
  });
});

// Catch all - serve React app if exists
app.get('*', (req, res) => {
  try {
    const indexPath = path.join(__dirname, 'client/build/index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error serving index.html:', err.message);
        res.json({ 
          error: 'Application files not found',
          path: req.path,
          message: 'React build files may be missing. Check deployment.'
        });
      }
    });
  } catch (err) {
    res.json({ 
      error: 'Error serving application',
      path: req.path,
      message: err.message
    });
  }
});

console.log('✅ Minimal server loaded successfully');
console.log('🚀 Ready to handle requests');

module.exports = app;

