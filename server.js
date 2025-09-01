const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

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

app.use(express.static(path.join(__dirname, "./client/build")));
// Configuration
const config = {
  // decryptionApiUrl: process.env.DECRYPTION_API_URL || 'https://hmsapiktv.kauverykonnect.com/Encryfile/api/values/decrypt',
  decryptionKey: process.env.DECRYPTION_KEY || 'sfrwYIgtcgsRdwjo',
  environment: NODE_ENV
};

// Validate configuration
if (!config.decryptionKey || config.decryptionKey.length < 16) {
  console.error('❌ Invalid decryption key configuration');
  process.exit(1);
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

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  
  if (error.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 'CORS policy violation',
      message: 'Request origin not allowed'
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Health check endpoint
// app.get('/api/health', (req, res) => {
//   res.json({
//     status: 'OK',
//     timestamp: new Date().toISOString(),
//     environment: config.environment,
//     version: '1.0.0',
//     uptime: process.uptime(),
//     decryptionApiUrl: config.decryptionApiUrl,
//     decryptionKey: config.decryptionKey ? '***' + config.decryptionKey.slice(-4) : 'Not set'
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



app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client","build", "index.html"));
});
// // Request logging middleware
// app.use((req, res, next) => {
//   const timestamp = new Date().toISOString();
//   console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
//   next();
// });
// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
