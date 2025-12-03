// Setup script for SQL Injection Logging
// This script creates the database table for SQL injection logs

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

// Database configuration (same as server.js)
const dbConfig = {
  server: process.env.DB_SERVER || 'videoconsultation.database.windows.net',
  database: process.env.DB_NAME || 'videoconsultation_db',
  user: process.env.DB_USER || 'videoconsultation',
  password: process.env.DB_PASSWORD || 'kauvery@123',
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
    connectionTimeout: 30000,
    requestTimeout: 30000
  }
};

async function setupSQLInjectionLogging() {
  let pool;
  
  try {
    console.log('📋 Starting SQL Injection Logging Setup...');
    
    // Connect to database
    console.log('🔌 Connecting to database...');
    pool = await sql.connect(dbConfig);
    console.log('✅ Database connected successfully');
    
    // Read SQL schema file
    const schemaPath = path.join(__dirname, 'sql_injection_logs_schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }
    
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split by GO statements (SQL Server batch separator)
    const batches = schema
      .split(/\bGO\b/i)
      .map(batch => batch.trim())
      .filter(batch => batch.length > 0);
    
    console.log(`📝 Executing ${batches.length} SQL batch(es)...`);
    
    // Execute each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      if (batch.trim()) {
        try {
          await pool.request().query(batch);
          console.log(`✅ Batch ${i + 1} executed successfully`);
        } catch (error) {
          // Some errors are expected (like table already exists)
          if (error.message.includes('already exists') || 
              error.message.includes('already exist')) {
            console.log(`ℹ️  Batch ${i + 1}: ${error.message}`);
          } else {
            throw error;
          }
        }
      }
    }
    
    // Verify table exists
    console.log('🔍 Verifying table creation...');
    const verifyResult = await pool.request().query(`
      SELECT COUNT(*) as table_count
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'sql_injection_logs'
    `);
    
    if (verifyResult.recordset[0].table_count > 0) {
      console.log('✅ Table sql_injection_logs verified');
    } else {
      throw new Error('Table verification failed');
    }
    
    // Check column count
    const columnResult = await pool.request().query(`
      SELECT COUNT(*) as column_count
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'sql_injection_logs'
    `);
    
    console.log(`✅ Table has ${columnResult.recordset[0].column_count} columns`);
    
    // Create logs directory
    const logsDir = path.join(__dirname, '..', 'logs', 'security');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      console.log(`✅ Created logs directory: ${logsDir}`);
    } else {
      console.log(`ℹ️  Logs directory already exists: ${logsDir}`);
    }
    
    console.log('\n✨ SQL Injection Logging Setup Completed Successfully!');
    console.log('\n📊 Next Steps:');
    console.log('   1. The middleware is already integrated in server.js');
    console.log('   2. Restart your server to activate SQL injection detection');
    console.log('   3. Monitor logs at: /api/security/sql-injection-logs');
    console.log('   4. View statistics at: /api/security/sql-injection-stats');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message
    });
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run setup
if (require.main === module) {
  setupSQLInjectionLogging()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = setupSQLInjectionLogging;

