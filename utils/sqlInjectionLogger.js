// SQL Injection Logging Service
// This module handles logging of SQL injection attempts to files and database

const fs = require('fs');
const path = require('path');
const sql = require('mssql');

class SQLInjectionLogger {
  constructor(options = {}) {
    this.logDirectory = options.logDirectory || path.join(__dirname, '..', 'logs', 'security');
    this.enableFileLogging = options.enableFileLogging !== false;
    this.enableDatabaseLogging = options.enableDatabaseLogging !== false;
    this.dbPool = options.dbPool || null;
    
    // Ensure log directory exists
    if (this.enableFileLogging) {
      this.ensureLogDirectory();
    }
  }

  // Ensure log directory exists
  ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      }
    } catch (error) {
      console.error('❌ Error creating log directory:', error);
    }
  }

  // Get log file path for today
  getLogFilePath() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logDirectory, `sql-injection-${today}.log`);
  }

  // Format log entry
  formatLogEntry(logData) {
    const timestamp = new Date().toISOString();
    return {
      timestamp: timestamp,
      ...logData
    };
  }

  // Write to file log
  async writeToFile(logData) {
    if (!this.enableFileLogging) return;

    try {
      const logEntry = this.formatLogEntry(logData);
      const logLine = JSON.stringify(logEntry) + '\n';
      const logFilePath = this.getLogFilePath();
      
      fs.appendFileSync(logFilePath, logLine, 'utf8');
    } catch (error) {
      console.error('❌ Error writing to log file:', error);
    }
  }

  // Write to database log
  async writeToDatabase(logData) {
    if (!this.enableDatabaseLogging || !this.dbPool) {
      return;
    }

    try {
      const logEntry = this.formatLogEntry(logData);
      const request = this.dbPool.request();

      // Insert into SQL injection logs table
      await request.query(`
        INSERT INTO sql_injection_logs 
        (timestamp, ip_address, user_agent, request_method, request_path, 
         risk_level, pattern_count, detected_patterns, suspicious_field, 
         suspicious_input, query_text, user_id, session_id, response_status, 
         created_at)
        VALUES 
        ('${logEntry.timestamp}', 
         '${this.escapeString(logEntry.ipAddress || 'unknown')}', 
         '${this.escapeString(logEntry.userAgent || 'unknown')}', 
         '${this.escapeString(logEntry.method || 'unknown')}', 
         '${this.escapeString(logEntry.path || 'unknown')}', 
         '${this.escapeString(logEntry.risk || 'unknown')}', 
         ${logEntry.patternCount || 0}, 
         '${this.escapeString(JSON.stringify(logEntry.patterns || []))}', 
         '${this.escapeString(logEntry.field || 'unknown')}', 
         '${this.escapeString(logEntry.input || '')}', 
         '${this.escapeString(logEntry.query || '')}', 
         '${this.escapeString(logEntry.userId || '')}', 
         '${this.escapeString(logEntry.sessionId || '')}', 
         ${logEntry.responseStatus || 403}, 
         GETDATE())
      `);
    } catch (error) {
      console.error('❌ Error writing to database log:', error);
      // Fallback to file logging if database fails
      await this.writeToFile({
        ...logData,
        dbError: error.message
      });
    }
  }

  // Escape string for SQL (basic escaping)
  escapeString(str) {
    if (!str) return '';
    return String(str)
      .replace(/'/g, "''")
      .replace(/\\/g, '\\\\')
      .substring(0, 4000); // Limit length
  }

  // Log SQL injection attempt
  async logAttempt(detectionResult, requestInfo = {}) {
    const logData = {
      type: 'sql_injection_attempt',
      ipAddress: requestInfo.ip || requestInfo.ipAddress || 'unknown',
      userAgent: requestInfo.userAgent || 'unknown',
      method: requestInfo.method || 'unknown',
      path: requestInfo.path || requestInfo.url || 'unknown',
      risk: detectionResult.risk || 'unknown',
      patternCount: detectionResult.patternCount || 0,
      patterns: detectionResult.patterns || [],
      field: detectionResult.field || 'unknown',
      input: detectionResult.input || detectionResult.suspiciousInput || '',
      query: requestInfo.query || '',
      userId: requestInfo.userId || '',
      sessionId: requestInfo.sessionId || '',
      requestBody: requestInfo.body ? JSON.stringify(requestInfo.body).substring(0, 1000) : '',
      responseStatus: detectionResult.risk === 'critical' ? 403 : 400
    };

    // Log to both file and database
    await Promise.all([
      this.writeToFile(logData),
      this.writeToDatabase(logData)
    ]);

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ SQL Injection Attempt Detected:', {
        risk: logData.risk,
        path: logData.path,
        field: logData.field,
        ip: logData.ipAddress
      });
    }

    return logData;
  }

  // Get client IP from request
  static getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
           'unknown';
  }

  // Extract request info for logging
  static extractRequestInfo(req) {
    return {
      ip: this.getClientIp(req),
      ipAddress: this.getClientIp(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      method: req.method || 'unknown',
      path: req.path || req.url || 'unknown',
      url: req.url || 'unknown',
      query: req.query ? JSON.stringify(req.query) : '',
      body: req.body || {},
      userId: req.user?.id || req.body?.userid || '',
      sessionId: req.sessionID || ''
    };
  }
}

module.exports = SQLInjectionLogger;

