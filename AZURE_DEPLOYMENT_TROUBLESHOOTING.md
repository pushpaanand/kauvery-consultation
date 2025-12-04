# Azure App Service Deployment Troubleshooting Guide

## Current Issue: HTTP Error 500.1000 (iisnode)

### Error Details
- **Module**: iisnode
- **Handler**: iisnode  
- **Error Code**: 0x00000407
- **Meaning**: Node.js application failed to start or crashed during initialization

## Fixes Applied

### 1. Server Startup Fixes
✅ Removed `process.exit(1)` on decryption key validation  
✅ Added error handling for startup code  
✅ Added graceful error handling for missing static files  
✅ Fixed iisnode detection logic  
✅ Added health check endpoint at `/health`

### 2. Configuration Fixes
✅ Enhanced logging in `web.config`  
✅ Enabled detailed error messages  
✅ Increased log file sizes

## Debugging Steps

### Step 1: Check Azure Logs

1. **Application Logs**:
   - Go to Azure Portal → Your App Service
   - Navigate to **Log stream** or **Logs**
   - Look for Node.js error messages

2. **iisnode Logs**:
   - Path: `C:\home\LogFiles\iisnode\`
   - Access via Azure Portal → Advanced Tools (Kudu) → Debug console
   - Navigate to `LogFiles\iisnode\`
   - Check the latest log file for errors

3. **Kudu Console**:
   - Go to: `https://your-app-name.scm.azurewebsites.net`
   - Navigate to **Debug console** → **CMD**
   - Check if `server.js` exists in `site\wwwroot\`

### Step 2: Verify Deployment Structure

Ensure your deployment has:
```
wwwroot/
├── server.js          ✅ Required
├── package.json       ✅ Required
├── web.config         ✅ Required
├── node_modules/      ✅ Required (or ensure npm install runs)
├── client/
│   └── build/         ✅ Required (React build output)
│       └── index.html
└── utils/             ✅ Required (if using)
```

### Step 3: Test Health Endpoint

Try accessing: `https://your-app-url/health`

Expected response:
```json
{
  "status": "ok",
  "timestamp": "...",
  "environment": "production",
  "isIISNode": true,
  "database": "connected" or "not connected"
}
```

If this doesn't work, the server is crashing before it can respond.

### Step 4: Common Issues & Solutions

#### Issue 1: Missing Dependencies
**Solution**: Ensure `node_modules` is deployed or `npm install` runs during deployment

#### Issue 2: Missing Environment Variables
**Required variables in Azure App Service → Configuration → Application settings**:
- `DECRYPTION_KEY`
- `DB_SERVER`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `PORT` (automatically set by Azure)

#### Issue 3: Client Build Missing
**Solution**: 
- Ensure React app is built: `cd client && npm run build`
- Deploy the `client/build` folder to Azure

#### Issue 4: Database Connection Blocking
**Solution**: Database connection is now non-blocking, but check:
- Database firewall allows Azure services
- Connection string is correct
- Database server is accessible

#### Issue 5: Path Issues
**Solution**: Verify all file paths are correct:
- `client/build` exists
- `utils/` folder exists
- All required files are in the deployment

### Step 5: Enable Detailed Logging

The `web.config` has been updated with:
- `debuggingEnabled="true"`
- `debugHeaderEnabled="true"`
- Increased log file sizes
- `devErrorsEnabled="true"`

### Step 6: Minimal Test

Create a minimal `server.js` test to verify iisnode works:

```javascript
const express = require('express');
const app = express();

app.get('*', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

module.exports = app;
```

If this works, the issue is in your full `server.js` code.

## Quick Verification Checklist

- [ ] `server.js` exists in `wwwroot`
- [ ] `package.json` exists in `wwwroot`
- [ ] `web.config` exists in `wwwroot`
- [ ] `node_modules` folder exists (or npm install completes)
- [ ] `client/build` folder exists with `index.html`
- [ ] Environment variables are set in Azure
- [ ] App Service runtime stack is set to Node.js
- [ ] Startup command is correct (or default)
- [ ] Health endpoint `/health` is accessible
- [ ] No syntax errors in `server.js`
- [ ] All required dependencies are installed

## Next Steps

1. **Check iisnode logs** - This will show the exact error
2. **Test health endpoint** - Verify server can start
3. **Check deployment structure** - Ensure all files are present
4. **Verify environment variables** - All required vars are set
5. **Test with minimal server.js** - Isolate the issue

## Contact Points

If the issue persists after checking all above:
- Check Azure App Service → Diagnose and solve problems
- Review Application Insights logs (if enabled)
- Check Azure Service Health for known issues

## Files Modified

1. `server.js` - Fixed startup logic, error handling
2. `web.config` - Enhanced logging, iisnode configuration
3. Added health check endpoint
4. Added graceful error handling

---

**Last Updated**: 2025-12-04  
**Status**: Waiting for iisnode logs to identify root cause

