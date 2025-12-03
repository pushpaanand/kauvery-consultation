// SQL Injection Detection Middleware
// This middleware intercepts requests and detects potential SQL injection attempts

const SQLInjectionDetector = require('./sqlInjectionDetector');
const SQLInjectionLogger = require('./sqlInjectionLogger');

// Create logger instance (will be initialized with db pool)
let logger = null;

// Initialize logger with database pool
function initializeLogger(dbPool) {
  logger = new SQLInjectionLogger({
    enableFileLogging: true,
    enableDatabaseLogging: true,
    dbPool: dbPool
  });
}

// Middleware to detect SQL injection in request
function sqlInjectionDetectionMiddleware(req, res, next) {
  if (!logger) {
    // If logger not initialized, skip detection but warn
    console.warn('⚠️ SQL Injection Logger not initialized. Skipping detection.');
    return next();
  }

  try {
    // Extract request info
    const requestInfo = SQLInjectionLogger.extractRequestInfo(req);

    // Check request body
    if (req.body && typeof req.body === 'object') {
      const bodyDetection = SQLInjectionDetector.detectInObject(req.body);
      
      if (bodyDetection.isInjection) {
        // Log each finding
        for (const finding of bodyDetection.findings) {
          logger.logAttempt(finding, requestInfo);
        }

        // Block critical attempts
        const criticalFindings = bodyDetection.findings.filter(f => f.risk === 'critical');
        if (criticalFindings.length > 0) {
          return res.status(403).json({
            success: false,
            error: 'Security violation detected',
            message: 'Request blocked due to potential SQL injection attempt',
            timestamp: new Date().toISOString()
          });
        }

        // Warn on high-risk attempts but allow
        const highRiskFindings = bodyDetection.findings.filter(f => f.risk === 'high');
        if (highRiskFindings.length > 0) {
          // Log but continue
          console.warn('⚠️ High-risk SQL injection pattern detected:', {
            path: requestInfo.path,
            field: highRiskFindings[0].field
          });
        }
      }
    }

    // Check query parameters
    if (req.query && typeof req.query === 'object') {
      const queryDetection = SQLInjectionDetector.detectInObject(req.query);
      
      if (queryDetection.isInjection) {
        for (const finding of queryDetection.findings) {
          logger.logAttempt(finding, requestInfo);
        }

        // Block critical attempts
        const criticalFindings = queryDetection.findings.filter(f => f.risk === 'critical');
        if (criticalFindings.length > 0) {
          return res.status(403).json({
            success: false,
            error: 'Security violation detected',
            message: 'Request blocked due to potential SQL injection attempt',
            timestamp: new Date().toISOString()
          });
        }
      }
    }

    // Check URL parameters (for routes like /api/appointments/:appNo)
    if (req.params) {
      for (const key in req.params) {
        if (req.params.hasOwnProperty(key)) {
          const paramDetection = SQLInjectionDetector.detect(req.params[key]);
          if (paramDetection.isInjection) {
            logger.logAttempt({
              ...paramDetection,
              field: `params.${key}`
            }, requestInfo);

            // Block critical attempts in URL params
            if (paramDetection.risk === 'critical') {
              return res.status(403).json({
                success: false,
                error: 'Security violation detected',
                message: 'Request blocked due to potential SQL injection attempt',
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      }
    }

    // Continue to next middleware
    next();
  } catch (error) {
    console.error('❌ Error in SQL injection detection middleware:', error);
    // On error, continue (don't block legitimate requests)
    next();
  }
}

// Wrapper for database query functions to detect SQL injection in queries
function wrapQueryFunction(originalFunction, functionName) {
  return async function(...args) {
    try {
      // Check if query string contains potential injection patterns
      // This is a secondary check - primary prevention should be using parameterized queries
      if (args.length > 0 && typeof args[0] === 'string') {
        const queryAnalysis = SQLInjectionDetector.analyzeQuery(args[0]);
        
        if (queryAnalysis.isSuspicious) {
          // Log suspicious query pattern
          if (logger) {
            logger.writeToFile({
              type: 'suspicious_sql_query',
              function: functionName,
              reasons: queryAnalysis.reasons,
              query: queryAnalysis.query,
              timestamp: new Date().toISOString()
            });
          }
          
          console.warn(`⚠️ Suspicious SQL query detected in ${functionName}:`, {
            reasons: queryAnalysis.reasons
          });
        }
      }

      // Execute original function
      return await originalFunction.apply(this, args);
    } catch (error) {
      // Log query errors that might indicate injection attempts
      if (error.message && (
        error.message.includes('Invalid column') ||
        error.message.includes('Syntax error') ||
        error.message.includes('Unclosed quotation')
      )) {
        if (logger) {
          logger.writeToFile({
            type: 'sql_query_error',
            function: functionName,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }
      throw error;
    }
  };
}

module.exports = {
  sqlInjectionDetectionMiddleware,
  initializeLogger,
  wrapQueryFunction
};

