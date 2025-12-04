# URGENT FIX - 500.1000 Error

## The Problem
The server is crashing during module initialization, before it can even handle requests.

## Immediate Solution

### Step 1: Create Minimal Server (works immediately)

Create a new file `server-minimal.js` with this content:

```javascript
const express = require('express');
const path = require('path');
const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS - allow all for now
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Minimal server is running'
  });
});

// Serve static files if they exist
try {
  app.use(express.static(path.join(__dirname, 'client/build')));
} catch (err) {
  console.warn('Static files not available:', err.message);
}

// Simple decrypt endpoint
app.post('/api/decrypt', (req, res) => {
  res.json({ 
    success: false, 
    error: 'Full server not loaded - check logs',
    message: 'Minimal server is running but full features not available'
  });
});

// Catch all - serve React app if exists
app.get('*', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'client/build/index.html'));
  } catch (err) {
    res.json({ 
      error: 'Application not fully loaded',
      path: req.path,
      message: 'Check server logs for full initialization'
    });
  }
});

console.log('✅ Minimal server loaded successfully');
module.exports = app;
```

### Step 2: Update web.config

Change line 20 in `web.config`:

```xml
<add name="iisnode" path="server-minimal.js" verb="*" modules="iisnode" />
```

### Step 3: Update URL Rewrite

Change line 35 in `web.config`:

```xml
<action type="Rewrite" url="server-minimal.js" />
```

### Step 4: Deploy and Test

1. Deploy both files: `server-minimal.js` and updated `web.config`
2. Test: `https://your-app-url/health`
3. Should work immediately!

### Step 5: Once Minimal Server Works

Then gradually add features back to the main `server.js`:
1. Test minimal server works
2. Switch back to `server.js` 
3. Check logs to see what's failing
4. Fix one issue at a time

## Why This Will Work

The minimal server:
- ✅ Only uses core dependencies
- ✅ No optional modules
- ✅ No database connection
- ✅ No complex initialization
- ✅ Always exports the app
- ✅ Can't crash during startup

## Quick Deploy Checklist

- [ ] Create `server-minimal.js` with code above
- [ ] Update `web.config` handler to `server-minimal.js`
- [ ] Update `web.config` rewrite rule to `server-minimal.js`
- [ ] Deploy to Azure
- [ ] Test `/health` endpoint
- [ ] Once working, debug main `server.js` issues

## After Minimal Server Works

Then we can:
1. Check what's failing in main server.js
2. Add features back one by one
3. Fix the actual root cause

---

**This minimal server will get your site responsive immediately!**

