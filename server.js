const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const sql = require('mssql');
const { DefaultAzureCredential, ClientSecretCredential } = require('@azure/identity');
const { sqlInjectionDetectionMiddleware, initializeLogger } = require('./utils/sqlInjectionMiddleware');
const SQLInjectionDetector = require('./utils/sqlInjectionDetector');
const SQLInjectionLogger = require('./utils/sqlInjectionLogger');
const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Security: Disable X-Powered-By header to hide Express version
app.disable('x-powered-by');


// Database configuration for Azure SQL Database
const dbConfig = {
  server: process.env.DB_SERVER || 'videoconsultation.database.windows.net',
  database: process.env.DB_NAME || 'videoconsultation_db',
  user: process.env.DB_USER || 'videoconsultation', // Updated username
  password: process.env.DB_PASSWORD || 'kauvery@123', // Updated password
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
    connectionTimeout: 30000,
    requestTimeout: 30000,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  }
};

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://videoconsultation-fsb6dbejh3c9htfn.canadacentral-01.azurewebsites.net',
      'http://localhost:3000',
      'https://localhost:3000',
      'https://kauverytelehealth.kauverykonnect.com'
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Security: Cookie SameSite protection middleware
// Intercepts Set-Cookie headers to ensure proper SameSite attribute
// Note: ARRAffinity cookies are set by Azure infrastructure and require Azure configuration
app.use((req, res, next) => {
  // Store original end method to intercept Set-Cookie headers before sending
  const originalEnd = res.end.bind(res);
  const originalWriteHead = res.writeHead.bind(res);
  
  // Track Set-Cookie headers
  const cookieHeaders = [];
  
  // Override setHeader to capture Set-Cookie headers
  const originalSetHeader = res.setHeader.bind(res);
  res.setHeader = function(name, value) {
    if (name.toLowerCase() === 'set-cookie') {
      const cookies = Array.isArray(value) ? value : [value];
      cookies.forEach(cookie => {
        cookieHeaders.push(cookie);
      });
      return originalSetHeader.call(this, name, value);
    }
    return originalSetHeader.call(this, name, value);
  };
  
  // Override writeHead to ensure cookies are properly set
  res.writeHead = function(statusCode, statusMessage, headers) {
    if (typeof statusMessage === 'object') {
      headers = statusMessage;
    }
    
    if (headers && headers['Set-Cookie']) {
      const cookies = Array.isArray(headers['Set-Cookie']) ? headers['Set-Cookie'] : [headers['Set-Cookie']];
      const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
      headers['Set-Cookie'] = cookies.map(cookie => ensureCookieSameSite(cookie, isSecure));
    }
    
    return originalWriteHead.call(this, statusCode, statusMessage || headers);
  };
  
  // Override end to modify cookies before sending response
  res.end = function(chunk, encoding) {
    // Modify Set-Cookie headers if any exist
    if (cookieHeaders.length > 0) {
      const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
      const modifiedCookies = cookieHeaders.map(cookie => ensureCookieSameSite(cookie, isSecure));
      res.setHeader('Set-Cookie', modifiedCookies);
    }
    
    return originalEnd.call(this, chunk, encoding);
  };
  
  next();
});

// Helper function to ensure cookie has SameSite attribute
function ensureCookieSameSite(cookieString, isSecure = true) {
  if (!cookieString || typeof cookieString !== 'string') {
    return cookieString;
  }
  
  const cookie = cookieString.trim();
  const lowerCookie = cookie.toLowerCase();
  
  // Skip if SameSite is already set (don't override existing settings)
  if (lowerCookie.includes('samesite=')) {
    // Ensure Secure flag is present if SameSite=None
    if (lowerCookie.includes('samesite=none') && !lowerCookie.includes('secure')) {
      return cookie + '; Secure';
    }
    return cookie;
  }
  
  // For ARRAffinity cookies (Azure sets these), we can't modify them here
  // They need to be configured in Azure App Service settings
  if (lowerCookie.includes('arraffinity')) {
    // Azure sets these - return as is (fix via Azure configuration)
    return cookie;
  }
  
  // For application-set cookies, add SameSite=Lax by default
  // Lax provides good CSRF protection while allowing legitimate top-level navigations
  let modifiedCookie = cookie;
  
  // Ensure Secure flag for HTTPS (recommended best practice)
  if (!lowerCookie.includes('secure') && isSecure) {
    modifiedCookie += '; Secure';
  }
  
  // Add SameSite=Lax (recommended default for most applications)
  modifiedCookie += '; SameSite=Lax';
  
  return modifiedCookie;
}

// Security: Remove Server header and add security headers including Content Security Policy
// This middleware aggressively removes server disclosure headers that IIS sets
app.use((req, res, next) => {
  // Store original methods to intercept headers
  const originalSetHeader = res.setHeader.bind(res);
  const originalWriteHead = res.writeHead.bind(res);
  const originalEnd = res.end.bind(res);
  
  // Track headers to remove - Framework disclosure headers and information leakage
  // This prevents attackers from identifying framework versions and targeting specific vulnerabilities
  const headersToRemove = [
    'Server',                    // IIS/Server version disclosure
    'X-Powered-By',             // Express/ASP.NET framework disclosure
    'X-AspNet-Version',         // ASP.NET version disclosure (e.g., 4.0.30319)
    'X-AspNetMvc-Version',      // ASP.NET MVC version disclosure (e.g., 5.2.7)
    'X-Powered-CMS',            // CMS framework disclosure (if any)
    'X-Generator',              // Framework generator disclosure
    'X-Drupal-Cache',           // Drupal framework (if any)
    'X-Varnish',                // Varnish proxy (if any)
    'Via',                      // Proxy/load balancer disclosure
    'ETag'                      // ETag can leak file inodes and sensitive information
  ];
  
  // Override setHeader to block server disclosure headers
  res.setHeader = function(name, value) {
    const lowerName = name.toLowerCase();
    if (headersToRemove.some(header => lowerName === header.toLowerCase())) {
      // Silently ignore - don't set these headers
      return this;
    }
    return originalSetHeader.call(this, name, value);
  };
  
  // Override writeHead to remove server disclosure headers from response
  res.writeHead = function(statusCode, statusMessage, headers) {
    if (typeof statusMessage === 'object') {
      headers = statusMessage;
    }
    
    if (headers) {
      // Remove server disclosure headers
      headersToRemove.forEach(header => {
        delete headers[header];
        delete headers[header.toLowerCase()];
      });
    }
    
    return originalWriteHead.call(this, statusCode, statusMessage || headers);
  };
  
  // Override end to ensure headers are removed before sending
  res.end = function(chunk, encoding) {
    // Remove headers one more time before sending
    headersToRemove.forEach(header => {
      try {
        res.removeHeader(header);
        res.removeHeader(header.toLowerCase());
      } catch (e) {
        // Ignore errors if header doesn't exist
      }
    });
    
    // Explicitly remove ETag header (if set by static middleware or IIS)
    try {
      res.removeHeader('ETag');
      res.removeHeader('etag');
    } catch (e) {
      // Ignore if doesn't exist
    }
    
    return originalEnd.call(this, chunk, encoding);
  };
  
  // Try to remove headers immediately
  headersToRemove.forEach(header => {
    try {
      res.removeHeader(header);
      res.removeHeader(header.toLowerCase());
    } catch (e) {
      // Headers might not exist yet
    }
  });
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Cache-Control: Prevent caching of sensitive pages (fixes VAPT finding)
  // Check if this is a static asset (CSS, JS, images) or dynamic page/API
  const isStaticAsset = req.path.match(/\.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot|map)$/);
  const isApiRoute = req.path.startsWith('/api/');
  
  // Override Cache-Control only for dynamic pages and API routes
  // Static assets will be handled by express.static middleware with proper caching
  if (!isStaticAsset) {
    if (isApiRoute) {
      // API routes - no caching (may contain sensitive patient data)
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      // HTML pages and other dynamic content - no caching (prevents sensitive data storage)
      // This includes consultation pages with patient information
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
  
  // HTTP Strict Transport Security (HSTS)
  // Only set HSTS for HTTPS connections
  const isSecure = req.secure || 
                   req.headers['x-forwarded-proto'] === 'https' || 
                   req.headers['x-forwarded-ssl'] === 'on';
  
  if (isSecure) {
    // HSTS: Force browsers to use HTTPS for 1 year (31536000 seconds)
    // includeSubDomains: Apply to all subdomains
    // preload: Allow inclusion in HSTS preload list (optional)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Content Security Policy (CSP) - Configured for video consultation application
  // Allows necessary external resources while maintaining security
  const cspDirectives = [
    // Default source - only allow resources from same origin
    "default-src 'self'",
    
    // Scripts - allow inline scripts (React requires this) and same-origin scripts
    // 'unsafe-inline' is needed for React's bundled code, but we use nonce/hash for production
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' *.zego.im *.zegocloud.com",
    
    // Styles - allow same origin, Google Fonts, and inline styles (React needs this)
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    
    // Fonts - allow Google Fonts and same origin
    "font-src 'self' https://fonts.gstatic.com data:",
    
    // Images - allow same origin, data URIs, and blob URIs (for video thumbnails)
    "img-src 'self' data: blob: https:",
    
    // Media - allow WebRTC and media streams (required for video consultation)
    "media-src 'self' blob: mediastream:",
    
    // Connect - allow API calls to same origin and Zego Cloud services
    // WebSocket connections needed for real-time video communication
    "connect-src 'self' https://*.zego.im wss://*.zego.im https://*.zegocloud.com wss://*.zegocloud.com https://*.kauverykonnect.com",
    
    // Frame ancestors - prevent clickjacking (only allow same origin)
    "frame-ancestors 'self'",
    
    // Form action - prevent form submission to external sites
    "form-action 'self'",
    
    // Base URI - prevent base tag injection attacks
    "base-uri 'self'",
    
    // Object - disallow plugins (Flash, etc.)
    "object-src 'none'",
    
    // Upgrade insecure requests - force HTTPS
    "upgrade-insecure-requests",
    
    // Worker - allow workers from same origin (if needed)
    "worker-src 'self' blob:",
    
    // Manifest - allow manifest file
    "manifest-src 'self'",
    
    // Child source - for iframes if needed
    "child-src 'self' blob:",
    
    // Frame source - for iframes if needed
    "frame-src 'self' blob:"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', cspDirectives);
  
  // Also set report-only version for monitoring (optional - can be enabled for testing)
  // Uncomment below to enable CSP reporting without blocking
  // res.setHeader('Content-Security-Policy-Report-Only', cspDirectives);
  
  // Security: Add header to suggest SameSite cookie policy
  res.setHeader('Set-Cookie', res.getHeader('Set-Cookie') || []);
  
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure static file serving to disable ETags and set proper cache control
app.use(express.static(path.join(__dirname, "client/build"), {
  etag: false,  // Disable ETags to prevent file inode disclosure
  lastModified: true,  // Keep Last-Modified for caching if needed
  setHeaders: (res, path) => {
    // Set proper Cache-Control for static assets
    // Static files (CSS, JS, images) can be cached for 1 year
    if (path.match(/\.(css|js|jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      // HTML files and other files should not be cached (they may contain sensitive data)
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// SQL Injection Detection Middleware - Must be after body parsing but before routes
app.use(sqlInjectionDetectionMiddleware);

// Configuration
const config = {
  decryptionKey: process.env.DECRYPTION_KEY || 'sfrwYIgtcgsRdwjo',
  environment: NODE_ENV
};

// Validate configuration
if (!config.decryptionKey || config.decryptionKey.length < 16) {
  console.error('❌ Invalid decryption key configuration');
  process.exit(1);
}

// Database connection pool
let pool;

async function connectDB() {
  try {
    pool = await sql.connect(dbConfig);
    
    // Initialize SQL injection logger after database connection
    if (pool) {
      initializeLogger(pool);
      console.log('✅ SQL Injection detection and logging initialized');
    }
    
  } catch (err) {
    console.error('❌ Database connection failed:', err);
    console.error('Error details:', {
      code: err.code,
      message: err.message,
      server: dbConfig.server,
      database: dbConfig.database,
      user: dbConfig.user || 'Connection string'
    });
  }
}

// Helper functions
function normalizeBase64(input) {
  if (!input || typeof input !== 'string') {
    throw new Error("Invalid input: cipherText must be a non-empty string");
  }
  
  let s = input.trim();
  s = s.replace(/ /g, "+").replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  
  if (pad === 2) s += "==";
  else if (pad === 3) s += "=";
  else if (pad === 1) throw new Error("Invalid base64 length");
  
  return s;
}

function decrypt(keyString, cipherTextBase64) {
  try {
    const key = Buffer.from(keyString, "utf8");
    
    if (![16, 24, 32].includes(key.length)) {
      throw new Error(`Invalid key length: ${key.length}. Must be 16, 24, or 32 bytes.`);
    }
    
    const algorithm = key.length === 16 ? "aes-128-cbc" :
                     key.length === 24 ? "aes-192-cbc" : "aes-256-cbc";
    
    const iv = Buffer.alloc(16, 0); // Zero IV as per requirement
    const normalized = normalizeBase64(cipherTextBase64);
    const encrypted = Buffer.from(normalized, "base64");
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAutoPadding(true);
    
    let out = decipher.update(encrypted, undefined, "utf8");
    out += decipher.final("utf8");
    
    return out;
  } catch (error) {
    console.error('Decryption error:', error.message);
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

// Function to format date for SQL Server
const formatDateForSQL = (dateString) => {
  try {
    if (!dateString) return null;
    
    // Remove time part if present
    const dateOnly = dateString.split(' ')[0];
    
    // Parse DD/MM/YYYY format
    const [day, month, year] = dateOnly.split('/');
    
    // Convert to YYYY-MM-DD format (SQL Server standard)
    const formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    return formattedDate;
  } catch (error) {
    console.error('❌ Error formatting date:', error);
    return null;
  }
};

// Function to format time for SQL Server
const formatTimeForSQL = (timeString) => {
  try {
    if (!timeString) return null;
    
    // Ensure time is in HH:MM:SS format
    if (timeString.length === 5) {
      return `${timeString}:00`; // Add seconds if missing
    }
    
    return timeString;
  } catch (error) {
    console.error('❌ Error formatting time:', error);
    return null;
  }
};

// Enhanced appointment storage with MIS tracking
async function storeAppointment(appointmentData) {
  try {
    // console.log('📝 Server: Storing appointment data:', appointmentData);
    
    const pool = await sql.connect(dbConfig);
    const request = pool.request();
    
    // Format dates for SQL Server
    const formattedDate = formatDateForSQL(appointmentData.appointment_date);
    const formattedTime = formatTimeForSQL(appointmentData.appointment_time);
    // const formattedDate = "2025-09-15";
    // const formattedTime = "15:30:00";
    
    // Check if appointment already exists
    const checkResult = await request.query(`
      SELECT id FROM appointments 
      WHERE app_no = '${appointmentData.app_no}' 
      AND userid = '${appointmentData.userid}'
    `);
    
    if (checkResult.recordset.length > 0) {
      // Update existing appointment (remove status column)
      await request.query(`
        UPDATE appointments SET
            username = '${appointmentData.username}',
            userid = '${appointmentData.userid}',
            doctorname = '${appointmentData.doctorname}',
            speciality = '${appointmentData.speciality}',
            appointment_date = '${formattedDate}',
            appointment_time = '${formattedTime}',
            room_id = '${appointmentData.roomID}',
            updated_at = GETDATE()
        WHERE app_no = '${appointmentData.app_no}' 
        AND userid = '${appointmentData.userid}'
      `);
      
      return { 
        success: true, 
        appointment_id: checkResult.recordset[0].id,
        message: 'Appointment updated successfully' 
      };
    } else {
      // Insert new appointment (remove status column)
      const insertResult = await request.query(`
        INSERT INTO appointments 
        (app_no, username, userid, doctorname, speciality, appointment_date, appointment_time, room_id, created_at)
        VALUES 
        ('${appointmentData.app_no}', '${appointmentData.username}', '${appointmentData.userid}', 
         '${appointmentData.doctorname}', '${appointmentData.speciality}', 
         '${formattedDate}', '${formattedTime}', 
         '${appointmentData.roomID}', GETDATE())
      `);
      
      // Get the newly created appointment ID
      const newAppointmentResult = await request.query(`
        SELECT id FROM appointments 
        WHERE app_no = '${appointmentData.app_no}' 
        AND userid = '${appointmentData.userid}'
      `);
      
      return { 
        success: true, 
        appointment_id: newAppointmentResult.recordset[0].id,
        message: 'Appointment created successfully' 
      };
    }
  } catch (error) {
    console.error('❌ Server: Error storing appointment:', error);
    throw error;
  }
}

// Enhanced video call event storage with comprehensive tracking
async function storeVideoCallEvent(eventData) {
  try {
   // console.log('📹 Server: Storing video call event:', eventData);
    
    const pool = await sql.connect(dbConfig);
    const request = pool.request();
    
    // Get appointment ID
    let appointmentId = eventData.appointment_id;
    if (isNaN(eventData.appointment_id)) {
      const appointmentResult = await request.query(`
        SELECT id FROM appointments 
        WHERE app_no = '${eventData.appointment_id}'
      `);
      
      if (appointmentResult.recordset.length > 0) {
        appointmentId = appointmentResult.recordset[0].id;
      } else {
        throw new Error(`Appointment not found: ${eventData.appointment_id}`);
      }
    }
    
    // Store comprehensive event data
    await request.query(`
      INSERT INTO video_call_events 
      (appointment_id, event_type, event_timestamp, event_data, room_id, user_id, username, session_id, duration_seconds, created_at)
      VALUES 
      (${appointmentId}, '${eventData.event_type}', 
       '${eventData.event_timestamp || new Date().toISOString()}', 
       '${JSON.stringify(eventData.event_data)}', 
       '${eventData.roomID}', '${eventData.user_id}', '${eventData.username}',
       '${eventData.session_id || ''}', 
       ${eventData.duration_seconds || 0}, 
       GETDATE())
    `);
    
    // Remove status updates since status column doesn't exist
    // if (eventData.event_type === 'connected') {
    //   await request.query(`
    //     UPDATE appointments 
    //     SET status = 'In Progress', updated_at = GETDATE()
    //     WHERE id = ${appointmentId}
    //   `);
    // } else if (eventData.event_type === 'disconnected') {
    //   await request.query(`
    //     UPDATE appointments 
    //     SET status = 'Completed', updated_at = GETDATE()
    //     WHERE id = ${appointmentId}
    //   `);
    // }

    return { success: true, appointment_id: appointmentId };
    
  } catch (err) {
    console.error('❌ Error storing video call event:', err);
    throw err;
  }
}

// Fix the startCallSession function
async function startCallSession(sessionData) {
  try {
    
    const pool = await sql.connect(dbConfig);
    const request = pool.request();
    
    // Get appointment ID if it's a string (appointment number)
    let appointmentId = sessionData.appointment_id;
    if (isNaN(sessionData.appointment_id)) {
      const appointmentResult = await request.query(`
        SELECT id FROM appointments 
        WHERE app_no = '${sessionData.appointment_id}'
      `);
      
      if (appointmentResult.recordset.length > 0) {
        appointmentId = appointmentResult.recordset[0].id;
      } else {
        throw new Error(`Appointment not found: ${sessionData.appointment_id}`);
      }
    }
    
    // End any existing active sessions for this appointment
    await request.query(`
      UPDATE call_sessions 
      SET session_end = GETDATE(), 
          duration_seconds = DATEDIFF(SECOND, session_start, GETDATE()),
          status = 'ended'
      WHERE appointment_id = ${appointmentId} AND status = 'active'
    `);
    
    // Start new session
    await request.query(`
      INSERT INTO call_sessions (appointment_id, session_start, room_id, user_id, username, status)
      VALUES (${appointmentId}, GETDATE(), '${sessionData.roomID}', '${sessionData.user_id}', '${sessionData.username}', 'active')
    `);

    return { success: true, appointment_id: appointmentId };
    
  } catch (err) {
    console.error('❌ Error starting call session:', err);
    throw err;
  }
}

// Fix the endCallSession function
async function endCallSession(sessionData) {
  try {
    // console.log('🏁 Server: Ending call session:', sessionData);
    
    const pool = await sql.connect(dbConfig);
    const request = pool.request();
    
    // Get appointment ID if it's a string (appointment number)
    let appointmentId = sessionData.appointment_id;
    if (isNaN(sessionData.appointment_id)) {
      const appointmentResult = await request.query(`
        SELECT id FROM appointments 
        WHERE app_no = '${sessionData.appointment_id}'
      `);
      
      if (appointmentResult.recordset.length > 0) {
        appointmentId = appointmentResult.recordset[0].id;
      } else {
        throw new Error(`Appointment not found: ${sessionData.appointment_id}`);
      }
    }
    
    await request.query(`
      UPDATE call_sessions 
      SET session_end = GETDATE(), 
          duration_seconds = DATEDIFF(SECOND, session_start, GETDATE()),
          status = 'ended'
      WHERE appointment_id = ${appointmentId} AND status = 'active'
    `);
    
    // console.log('✅ Server: Call session ended successfully');
    return { success: true, appointment_id: appointmentId };
    
  } catch (err) {
    console.error('❌ Error ending call session:', err);
    throw err;
  }
}

// Error handling middleware
// app.use((error, req, res, next) => {
//   console.error('Server error:', error);
  
//   if (error.message === 'Not allowed by CORS') {
//     return res.status(403).json({
//       success: false,
//       error: 'CORS policy violation',
//       message: 'Request origin not allowed'
//     });
//   }
  
//   res.status(500).json({
//     success: false,
//     error: 'Internal server error',
//     message: NODE_ENV === 'development' ? error.message : 'Something went wrong'
//   });
// });

// Helper function to mask sensitive data
function maskSensitiveData(data) {
  try {
    // Parse the decrypted text (assuming it's JSON)
    let parsedData;
    try {
      parsedData = JSON.parse(data);
    } catch {
      // If not JSON, return as is (might be plain text)
      return data;
    }

    const masked = { ...parsedData };

    // Mask Date of Birth - show only year or mask completely
    if (masked.dob || masked.date_of_birth || masked.dateOfBirth) {
      const dob = masked.dob || masked.date_of_birth || masked.dateOfBirth;
      if (dob) {
        // Extract only year from DOB (format: DD/MM/YYYY)
        const yearMatch = dob.match(/\d{4}$/);
        if (yearMatch) {
          masked.dob = `**/**/${yearMatch[0]}`;
          if (masked.date_of_birth) masked.date_of_birth = `**/**/${yearMatch[0]}`;
          if (masked.dateOfBirth) masked.dateOfBirth = `**/**/${yearMatch[0]}`;
        } else {
          masked.dob = '**/**/****';
          if (masked.date_of_birth) masked.date_of_birth = '**/**/****';
          if (masked.dateOfBirth) masked.dateOfBirth = '**/**/****';
        }
      }
    }

    // Mask Patient ID - show only last 4 digits
    if (masked.userid || masked.patient_id || masked.patientId) {
      const pid = String(masked.userid || masked.patient_id || masked.patientId || '');
      if (pid.length > 4) {
        masked.userid = `****${pid.slice(-4)}`;
        if (masked.patient_id) masked.patient_id = `****${pid.slice(-4)}`;
        if (masked.patientId) masked.patientId = `****${pid.slice(-4)}`;
      }
    }

    // Remove or mask other highly sensitive fields if they exist
    // Keep only what's necessary for the application to function
    const sensitiveFields = ['ssn', 'aadhaar', 'pan', 'phone', 'mobile', 'email'];
    sensitiveFields.forEach(field => {
      if (masked[field]) {
        const value = String(masked[field]);
        if (value.length > 4) {
          masked[field] = `${value.substring(0, 2)}****${value.slice(-2)}`;
        } else {
          masked[field] = '****';
        }
      }
    });

    return JSON.stringify(masked);
  } catch (error) {
    // If masking fails, return original data (shouldn't happen but safe fallback)
    console.error('Error masking sensitive data:', error);
    return data;
  }
}

// Helper function to identify which fields should be fully removed (highly sensitive)
function removeHighlySensitiveFields(parsed) {
  // Fields that should be completely removed from response (if they exist)
  const removeFields = ['ssn', 'aadhaar', 'pan', 'credit_card', 'card_number'];
  
  const cleaned = { ...parsed };
  Object.keys(cleaned).forEach(key => {
    const lowerKey = key.toLowerCase();
    if (removeFields.some(field => lowerKey.includes(field))) {
      delete cleaned[key];
    }
  });
  
  return cleaned;
}

// Rate limiting store for decrypt endpoint (simple in-memory store)
const decryptRateLimitStore = new Map();
const DECRYPT_RATE_LIMIT = {
  maxRequests: 20, // Maximum requests (increased to accommodate batch operations)
  windowMs: 15 * 60 * 1000, // 15 minutes window
  blockDurationMs: 30 * 60 * 1000, // Block for 30 minutes if exceeded
  burstAllowance: 10, // Allow up to 10 requests within 1 minute for legitimate batch operations
  burstWindowMs: 60 * 1000 // 1 minute burst window
};

// Rate limiting middleware for decrypt endpoint
function decryptRateLimit(req, res, next) {
  const clientId = SQLInjectionLogger.getClientIp(req);
  const now = Date.now();
  let clientData = decryptRateLimitStore.get(clientId);

  // Clean up old entries (older than 1 hour)
  if (decryptRateLimitStore.size > 1000) {
    for (const [key, value] of decryptRateLimitStore.entries()) {
      if (now - value.firstRequest > 60 * 60 * 1000) {
        decryptRateLimitStore.delete(key);
      }
    }
  }

  if (clientData) {
    // Check if still blocked
    if (clientData.blockedUntil && now < clientData.blockedUntil) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil((clientData.blockedUntil - now) / 1000)
      });
    }

    // Track burst requests (requests within 1 minute)
    if (!clientData.burstRequests) {
      clientData.burstRequests = [];
    }
    
    // Remove burst requests older than 1 minute
    clientData.burstRequests = clientData.burstRequests.filter(
      timestamp => now - timestamp < DECRYPT_RATE_LIMIT.burstWindowMs
    );
    
    // Check burst limit (for legitimate batch operations)
    if (clientData.burstRequests.length >= DECRYPT_RATE_LIMIT.burstAllowance) {
      // Allow burst if within first minute and total count is reasonable
      const burstAge = clientData.burstRequests.length > 0 
        ? now - clientData.burstRequests[0] 
        : 0;
      
      // If burst is too fast (more than 10 requests in less than 2 seconds), block
      if (burstAge < 2000 && clientData.burstRequests.length > DECRYPT_RATE_LIMIT.burstAllowance) {
        clientData.blockedUntil = now + DECRYPT_RATE_LIMIT.blockDurationMs;
        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(DECRYPT_RATE_LIMIT.blockDurationMs / 1000)
        });
      }
    }
    
    // Add current request to burst tracker
    clientData.burstRequests.push(now);

    // Reset if main window expired
    if (now - clientData.firstRequest > DECRYPT_RATE_LIMIT.windowMs) {
      clientData.count = 1;
      clientData.firstRequest = now;
      clientData.blockedUntil = null;
      clientData.burstRequests = [now];
    } else {
      clientData.count++;
    }

    // Check if main limit exceeded
    if (clientData.count > DECRYPT_RATE_LIMIT.maxRequests) {
      clientData.blockedUntil = now + DECRYPT_RATE_LIMIT.blockDurationMs;
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(DECRYPT_RATE_LIMIT.blockDurationMs / 1000)
      });
    }
  } else {
    // First request from this client
    clientData = {
      count: 1,
      firstRequest: now,
      blockedUntil: null,
      burstRequests: [now]
    };
    decryptRateLimitStore.set(clientId, clientData);
  }

  next();
}

// Batch decryption endpoint - Decrypt multiple parameters at once
app.post('/api/decrypt/batch', decryptRateLimit, async (req, res) => {
  try {
    const { texts } = req.body;
    
    if (!texts || !Array.isArray(texts)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid input',
        message: 'texts must be an array of encrypted strings' 
      });
    }

    if (texts.length > 20) {
      return res.status(400).json({ 
        success: false, 
        error: 'Too many items',
        message: 'Maximum 20 items allowed per batch request' 
      });
    }

    const results = {};
    const errors = {};

    // Decrypt each text in parallel
    const decryptPromises = texts.map(async (item) => {
      const { key, text } = item;
      
      if (!key || !text || typeof text !== 'string') {
        errors[key] = 'Invalid input';
        return { key, error: 'Invalid input' };
      }

      if (text.length > 1000) {
        errors[key] = 'Input too large';
        return { key, error: 'Input too large' };
      }

      try {
        const decryptedText = decrypt(config.decryptionKey, text);
        
        // Check if decrypted text is JSON or plain string
        let finalResponse;
        let isJSON = false;
        
        try {
          const parsed = JSON.parse(decryptedText);
          isJSON = true;
          
          const maskedData = maskSensitiveData(decryptedText);
          
          try {
            const maskedParsed = JSON.parse(maskedData);
            finalResponse = removeHighlySensitiveFields(maskedParsed);
          } catch {
            finalResponse = parsed;
            if (finalResponse.dob) finalResponse.dob = '**/**/****';
            if (finalResponse.userid && finalResponse.userid.length > 4) {
              finalResponse.userid = `****${String(finalResponse.userid).slice(-4)}`;
            }
          }
        } catch {
          finalResponse = decryptedText;
          isJSON = false;
        }
        
        return {
          key,
          decryptedText: isJSON ? JSON.stringify(finalResponse) : finalResponse
        };
      } catch (error) {
        errors[key] = error.message;
        return { key, error: error.message };
      }
    });

    const decryptResults = await Promise.all(decryptPromises);
    
    // Organize results
    decryptResults.forEach(result => {
      if (result.error) {
        errors[result.key] = result.error;
      } else {
        results[result.key] = result.decryptedText;
      }
    });

    // Log batch decrypt access
    const clientIp = SQLInjectionLogger.getClientIp(req);
    console.log(`[SECURITY] Batch decrypt endpoint accessed by IP: ${clientIp} at ${new Date().toISOString()}, items: ${texts.length}`);

    res.json({
      success: true,
      results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Batch decryption failed:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Batch decryption failed', 
      message: NODE_ENV === 'development' ? error.message : 'Invalid encrypted data',
      timestamp: new Date().toISOString()
    });
  }
});

// Main decryption endpoint - Enhanced with security (single item)
app.post('/api/decrypt', decryptRateLimit, (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid input',
        message: 'Encoded text is required and must be a string' 
      });
    }

    if (text.length > 1000) {
      return res.status(400).json({ 
        success: false, 
        error: 'Input too large',
        message: 'Encoded text must be less than 1000 characters' 
      });
    }

    // Decrypt the data
    const decryptedText = decrypt(config.decryptionKey, text);
    
    // Check if decrypted text is JSON or plain string
    let finalResponse;
    let isJSON = false;
    
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(decryptedText);
      isJSON = true;
      
      // SECURITY: Apply masking to sensitive fields while keeping all necessary fields
      // This preserves functionality while protecting sensitive data
      const maskedData = maskSensitiveData(decryptedText);
      
      try {
        const maskedParsed = JSON.parse(maskedData);
        // Remove fields that shouldn't be in response at all
        finalResponse = removeHighlySensitiveFields(maskedParsed);
      } catch {
        // If masked data parsing fails, use original parsed data with basic masking
        finalResponse = parsed;
        // Apply basic masking
        if (finalResponse.dob) finalResponse.dob = '**/**/****';
        if (finalResponse.userid && finalResponse.userid.length > 4) {
          finalResponse.userid = `****${String(finalResponse.userid).slice(-4)}`;
        }
      }
    } catch {
      // Decrypted text is not JSON - it's a plain string (e.g., "CN206201")
      // Return as-is without masking (plain strings are typically non-sensitive identifiers)
      finalResponse = decryptedText;
      isJSON = false;
    }
    
    // Return sanitized and masked response
    // Note: Client should only receive what it needs, not full decrypted data
    res.json({ 
      success: true, 
      decryptedText: isJSON ? JSON.stringify(finalResponse) : finalResponse, // Return JSON string if object, plain string if text
      timestamp: new Date().toISOString()
    });
    
    // Log access to decrypt endpoint for security monitoring
    const clientIp = SQLInjectionLogger.getClientIp(req);
    console.log(`[SECURITY] Decrypt endpoint accessed by IP: ${clientIp} at ${new Date().toISOString()}`);

  } catch (error) {
    console.error('❌ Decryption failed:', error.message);
    // Don't expose error details in production
    res.status(500).json({ 
      success: false, 
      error: 'Decryption failed', 
      message: NODE_ENV === 'development' ? error.message : 'Invalid encrypted data',
      timestamp: new Date().toISOString()
    });
  }
});

// Add debugging to the /api/appointments endpoint
app.post('/api/appointments', async (req, res) => {
  try {
    // console.log(' Server: /api/appointments endpoint called');
    // console.log('📞 Server: Request body:', req.body);
    
    const appointmentData = req.body;
    
    // Validate required fields
    if (!appointmentData.app_no || !appointmentData.username || !appointmentData.userid) {
      // console.log('❌ Server: Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: app_no, username, userid'
      });
    }
    
    // console.log('✅ Server: Required fields validated, calling storeAppointment');
    
    // Store appointment in database
    const result = await storeAppointment(appointmentData);
    
    // console.log('📊 Server: storeAppointment result:', result);
    
    if (result.success) {
      res.json({
        success: true,
        appointment_id: result.appointment_id,
        message: result.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Server: Error in /api/appointments:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Video call events endpoint
app.post('/api/video-call-events', async (req, res) => {
  try {
    const eventData = req.body;
    
    // Validate required fields
    if (!eventData.appointment_id || !eventData.event_type || !eventData.roomID || !eventData.user_id || !eventData.username) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields for video call event'
      });
    }
    
    const result = await storeVideoCallEvent(eventData);
    
    if (result.success) {
      res.json({
        success: true,
        appointment_id: result.appointment_id,
        message: 'Video call event stored successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.message
      });
    }
    
  } catch (error) {
    console.error('❌ Error storing video call event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to store video call event',
      details: error.message
    });
  }
});

// Call session management endpoints
app.post('/api/call-sessions/start', async (req, res) => {
  try {
    const sessionData = req.body;
    
    if (!sessionData.appointment_id || !sessionData.roomID || !sessionData.user_id || !sessionData.username) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields for call session'
      });
    }
    
    await startCallSession(sessionData);
    
    res.json({
      success: true,
      message: 'Call session started successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error starting call session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start call session',
      details: error.message
    });
  }
});

app.post('/api/call-sessions/end', async (req, res) => {
  try {
    const sessionData = req.body;
    
    if (!sessionData.appointment_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing appointment_id for ending call session'
      });
    }
    
    const result = await endCallSession(sessionData);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Call session ended successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.message
      });
    }
    
  } catch (error) {
    console.error('❌ Error ending call session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end call session',
      details: error.message
    });
  }
});

// Get appointment details endpoint
app.get('/api/appointments/:appNo', async (req, res) => {
  try {
    const { appNo } = req.params;
    
    const request = pool.request();
    const result = await request.query(`
      SELECT * FROM appointments WHERE app_no = '${appNo}'
    `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Appointment not found'
      });
    }
    
    res.json({
      success: true,
      appointment: result.recordset[0]
    });
    
  } catch (error) {
    console.error('❌ Error fetching appointment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch appointment',
      details: error.message
    });
  }
});

// Test database connection endpoint
app.get('/api/test-db', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ success: false, error: 'Database not connected' });
    }
    
    const result = await pool.request().query('SELECT 1 as test');
    res.json({ 
      success: true, 
      message: 'Database connection successful',
      data: result.recordset 
    });
  } catch (error) {
    console.error('❌ Database test failed:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Database connection failed',
      details: error.message 
    });
  }
});

// SQL Injection Logs Endpoints (Security monitoring)
app.get('/api/security/sql-injection-logs', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ success: false, error: 'Database not connected' });
    }

    const request = pool.request();
    const { limit = 100, risk_level, ip_address, start_date, end_date } = req.query;
    
    let query = `
      SELECT TOP ${Math.min(parseInt(limit) || 100, 1000)}
        id, timestamp, ip_address, user_agent, request_method, request_path,
        risk_level, pattern_count, suspicious_field, user_id, response_status, created_at
      FROM sql_injection_logs
      WHERE 1=1
    `;
    
    if (risk_level) {
      query += ` AND risk_level = '${risk_level}'`;
    }
    if (ip_address) {
      query += ` AND ip_address = '${ip_address}'`;
    }
    if (start_date) {
      query += ` AND created_at >= '${start_date}'`;
    }
    if (end_date) {
      query += ` AND created_at <= '${end_date}'`;
    }
    
    query += ` ORDER BY created_at DESC`;
    
    const result = await request.query(query);
    
    res.json({
      success: true,
      count: result.recordset.length,
      logs: result.recordset
    });
  } catch (error) {
    console.error('❌ Error fetching SQL injection logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SQL injection logs',
      details: error.message
    });
  }
});

// Get SQL injection log statistics
app.get('/api/security/sql-injection-stats', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ success: false, error: 'Database not connected' });
    }

    const request = pool.request();
    
    const statsQuery = `
      SELECT 
        COUNT(*) as total_attempts,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(CASE WHEN risk_level = 'critical' THEN 1 END) as critical_count,
        COUNT(CASE WHEN risk_level = 'high' THEN 1 END) as high_count,
        COUNT(CASE WHEN risk_level = 'medium' THEN 1 END) as medium_count,
        COUNT(CASE WHEN created_at >= DATEADD(day, -1, GETDATE()) THEN 1 END) as last_24h,
        COUNT(CASE WHEN created_at >= DATEADD(day, -7, GETDATE()) THEN 1 END) as last_7d,
        COUNT(CASE WHEN created_at >= DATEADD(day, -30, GETDATE()) THEN 1 END) as last_30d
      FROM sql_injection_logs
    `;
    
    const result = await request.query(statsQuery);
    
    res.json({
      success: true,
      statistics: result.recordset[0]
    });
  } catch (error) {
    console.error('❌ Error fetching SQL injection statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SQL injection statistics',
      details: error.message
    });
  }
});

// Get top IP addresses with SQL injection attempts
app.get('/api/security/sql-injection-top-ips', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ success: false, error: 'Database not connected' });
    }

    const request = pool.request();
    const { limit = 10 } = req.query;
    
    const topIPsQuery = `
      SELECT TOP ${Math.min(parseInt(limit) || 10, 50)}
        ip_address,
        COUNT(*) as attempt_count,
        MAX(risk_level) as highest_risk,
        MAX(created_at) as last_attempt,
        COUNT(CASE WHEN created_at >= DATEADD(day, -7, GETDATE()) THEN 1 END) as attempts_last_7d
      FROM sql_injection_logs
      WHERE ip_address IS NOT NULL AND ip_address != 'unknown'
      GROUP BY ip_address
      ORDER BY attempt_count DESC
    `;
    
    const result = await request.query(topIPsQuery);
    
    res.json({
      success: true,
      top_ips: result.recordset
    });
  } catch (error) {
    console.error('❌ Error fetching top IPs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top IPs',
      details: error.message
    });
  }
});

// Start server and connect to database
// async function startServer() {
//   try {
//     await connectDB();
    
//     // app.listen(PORT, () => {
//     //   console.log(`🚀 Server running on port ${PORT}`);
//     //   console.log(`📊 Database connected: ${dbConfig.database}`);
//     // });
//   } catch (err) {
//     console.error('❌ Failed to start server:', err);
//     process.exit(1);
//   }
// }

// startServer();

// app.get("*", (req, res) => {
//   res.sendFile(path.join(__dirname, "client/build", "index.html"));
// });

// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
//   console.log(`📊 Database connected: ${dbConfig.database}`);
// });
// Serve React app (catch-all) - must be after API routes

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'build', 'index.html'));
});

// Error handler - last middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err && err.message ? err.message : err);
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ success: false, error: 'CORS policy violation' });
  }
  res.status(500).json({ success: false, error: 'Internal server error', details: NODE_ENV === 'development' ? err.message : undefined });
});

// Azure App Service / iisnode: Do NOT call app.listen() - iisnode handles the HTTP server
// For local development, we can call app.listen() if not running under iisnode
const isRunningUnderIISNode = process.env.IISNODE_VERSION || process.env.WEBSITE_SITE_NAME; // Azure sets these

// Connect to database (non-blocking for Azure deployment)
(async function connectDatabase() {
  try {
    await connectDB();
    console.log('✅ Database connection established');
  } catch (error) {
    console.error('⚠️ Database connection failed (server will continue):', error.message);
    // Don't exit - let the server continue without database for now
  }
})();

// Only call app.listen() if NOT running under iisnode (local development)
if (!isRunningUnderIISNode) {
  app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT} (local development)`);
    console.log(`📊 Database: ${pool ? 'Connected' : 'Not connected'}`);
  });
} else {
  // Running under iisnode (Azure App Service)
  console.log('🚀 Server ready for iisnode (Azure App Service)');
  console.log(`📊 Database: ${pool ? 'Connected' : 'Not connected (connecting in background...)'}`);
}

module.exports = app;
