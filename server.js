const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const sql = require('mssql');
const { DefaultAzureCredential, ClientSecretCredential } = require('@azure/identity');
const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Load environment variables
require('dotenv').config();

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
      'https://localhost:3000'
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

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(express.static(path.join(__dirname, "client/build")));

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
    console.log('🔌 Attempting to connect to database...');
    console.log('Server:', dbConfig.server);
    console.log('Database:', dbConfig.database);
    console.log('User:', dbConfig.user || 'Using connection string');
    
    pool = await sql.connect(dbConfig);
    console.log('✅ Connected to MSSQL database');
    
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

// Helper function to store appointment data
async function storeAppointment(appointmentData) {
  try {
    console.log('💾 Server: Storing appointment data:', appointmentData);
    
    const request = pool.request();
    
    // Check if appointment already exists
    const checkResult = await request.query(`
      SELECT id FROM appointments 
      WHERE app_no = '${appointmentData.app_no}' 
      AND userid = '${appointmentData.userid}'
    `);
    
    if (checkResult.recordset.length > 0) {
      // Update existing appointment
      const updateResult = await request.query(`
        UPDATE appointments 
        SET username = '${appointmentData.username}',
            doctorname = '${appointmentData.doctorname}',
            speciality = '${appointmentData.speciality}',
            appointment_date = '${appointmentData.appointment_date}',
            appointment_time = '${appointmentData.appointment_time}',
            room_id = '${appointmentData.room_id}',
            updated_at = GETDATE()
        WHERE app_no = '${appointmentData.app_no}' 
        AND userid = '${appointmentData.userid}'
      `);
      
      console.log('✅ Server: Appointment updated successfully');
      return { 
        success: true, 
        appointment_id: checkResult.recordset[0].id,
        message: 'Appointment updated successfully' 
      };
    } else {
      // Insert new appointment
      const insertResult = await request.query(`
        INSERT INTO appointments 
        (app_no, username, userid, doctorname, speciality, appointment_date, appointment_time, room_id)
        VALUES 
        ('${appointmentData.app_no}', '${appointmentData.username}', '${appointmentData.userid}', 
         '${appointmentData.doctorname}', '${appointmentData.speciality}', 
         '${appointmentData.appointment_date}', '${appointmentData.appointment_time}', 
         '${appointmentData.room_id}')
      `);
      
      // Get the newly created appointment ID
      const newAppointmentResult = await request.query(`
        SELECT id FROM appointments 
        WHERE app_no = '${appointmentData.app_no}' 
        AND userid = '${appointmentData.userid}'
      `);
      
      console.log('✅ Server: Appointment created successfully');
      return { 
        success: true, 
        appointment_id: newAppointmentResult.recordset[0].id,
        message: 'Appointment created successfully' 
      };
    }
  } catch (error) {
    console.error('❌ Server: Error storing appointment:', error);
    return { success: false, error: error.message };
  }
}

// Store video call event
async function storeVideoCallEvent(eventData) {
  try {
    const request = pool.request();
    
    await request.query(`
      INSERT INTO video_call_events (appointment_id, event_type, event_data, room_id, user_id, username)
      VALUES (${eventData.appointment_id}, '${eventData.event_type}', '${JSON.stringify(eventData.event_data)}', 
              '${eventData.room_id}', '${eventData.user_id}', '${eventData.username}')
    `);
    
    console.log('✅ Video call event stored:', eventData.event_type);
  } catch (err) {
    console.error('❌ Error storing video call event:', err);
    throw err;
  }
}

// Start call session
async function startCallSession(sessionData) {
  try {
    const request = pool.request();
    
    // End any existing active sessions for this appointment
    await request.query(`
      UPDATE call_sessions 
      SET session_end = GETDATE(), 
          duration_seconds = DATEDIFF(SECOND, session_start, GETDATE()),
          status = 'ended'
      WHERE appointment_id = ${sessionData.appointment_id} AND status = 'active'
    `);
    
    // Start new session
    await request.query(`
      INSERT INTO call_sessions (appointment_id, session_start, room_id, user_id, username)
      VALUES (${sessionData.appointment_id}, GETDATE(), '${sessionData.room_id}', '${sessionData.user_id}', '${sessionData.username}')
    `);
    
    console.log('✅ Call session started for appointment:', sessionData.appointment_id);
  } catch (err) {
    console.error('❌ Error starting call session:', err);
    throw err;
  }
}

// End call session
async function endCallSession(sessionData) {
  try {
    const request = pool.request();
    
    await request.query(`
      UPDATE call_sessions 
      SET session_end = GETDATE(), 
          duration_seconds = DATEDIFF(SECOND, session_start, GETDATE()),
          status = 'ended'
      WHERE appointment_id = ${sessionData.appointment_id} AND status = 'active'
    `);
    
    console.log('✅ Call session ended for appointment:', sessionData.appointment_id);
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

// Main decryption endpoint
app.post('/api/decrypt', (req, res) => {
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

    const decryptedText = decrypt(config.decryptionKey, text);
    
    console.log(`✅ Decryption successful for input length: ${text.length}`);
    
    res.json({ 
      success: true, 
      decryptedText, 
      originalResponse: decryptedText,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Decryption failed:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Decryption failed', 
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API endpoint to store appointment data
app.post('/api/appointments', async (req, res) => {
  try {
    console.log('📝 Server: Received appointment data:', req.body);
    
    const appointmentData = req.body;
    
    // Validate required fields
    if (!appointmentData.app_no || !appointmentData.username || !appointmentData.userid) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: app_no, username, userid'
      });
    }
    
    // Store appointment in database
    const result = await storeAppointment(appointmentData);
    
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
    if (!eventData.appointment_id || !eventData.event_type || !eventData.room_id || !eventData.user_id || !eventData.username) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields for video call event'
      });
    }
    
    await storeVideoCallEvent(eventData);
    
    res.json({
      success: true,
      message: 'Video call event stored successfully',
      timestamp: new Date().toISOString()
    });
    
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
    
    if (!sessionData.appointment_id || !sessionData.room_id || !sessionData.user_id || !sessionData.username) {
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
    
    await endCallSession(sessionData);
    
    res.json({
      success: true,
      message: 'Call session ended successfully',
      timestamp: new Date().toISOString()
    });
    
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

// Start: connect DB then start server
(async function main() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Server listening on port ${PORT}. DB connected: ${!!pool}`);
  });
})();

module.exports = app;
