// SQL Injection Detection Utility
// This module detects potential SQL injection attempts in user input

class SQLInjectionDetector {
  // Common SQL injection patterns to detect
  static sqlInjectionPatterns = [
    // Basic SQL injection patterns
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/i,
    /(--|#|\/\*|\*\/)/, // SQL comments
    /(\bOR\b.*=.*|=.*\bOR\b)/i, // OR-based injection (e.g., ' OR '1'='1)
    /(\bAND\b.*=.*|=.*\bAND\b)/i, // AND-based injection
    /(;|\||&)/, // Command separators
    /(\bUNION\b.*\bSELECT\b)/i, // UNION-based injection
    /(CHAR|CHR|ASCII|CAST|CONVERT)/i, // Character encoding functions
    /(\bXP_\w+|sp_\w+|xp_cmdshell)/i, // Stored procedure exploits
    /(\bINTO\b.*\bOUTFILE\b|\bINTO\b.*\bDUMPFILE\b)/i, // File operations
    /(LOAD_FILE|BULK_INSERT|OPENROWSET)/i, // File/remote access
    /(CONCAT|CONCAT_WS|GROUP_CONCAT)/i, // String concatenation
    /(\d+\s*=\s*\d+)/, // Number-based injection (e.g., 1=1)
    /('[^']*'\s*=\s*'[^']*')/, // String-based injection (e.g., '1'='1')
    /(CHAR\s*\(|ASCII\s*\(|SUBSTRING\s*\()/i, // Character functions
    /(BENCHMARK|SLEEP|WAITFOR|DELAY)/i, // Time-based attacks
    /(\bIF\b.*\bTHEN\b|\bCASE\b.*\bWHEN\b)/i, // Conditional logic
    /(HAVING|GROUP BY|ORDER BY)/i, // SQL clauses
    /(VERSION|@@VERSION|@@DATABASE|@@USER|@@HOSTNAME)/i, // System variables
    /(\bSHOW\b|\bDESCRIBE\b|\bEXPLAIN\b)/i, // Information disclosure
    /(INFORMATION_SCHEMA|sys\.[a-z_]+)/i, // System tables
    /(\bLIMIT\b|\bOFFSET\b)/i, // Pagination attempts
    /(NULL|ISNULL|IFNULL|COALESCE)/i, // NULL manipulation
    /(\bTRUNCATE\b|\bDELETE\b.*\bFROM\b|\bDROP\b.*\bTABLE\b)/i, // Destructive operations
    /(\bRAND\b|\bNOW\b|\bCURDATE\b|\bCURTIME\b)/i, // Function calls
    /(SCRIPT|JAVASCRIPT|VBSCRIPT|ONERROR|ONLOAD)/i, // Script injection
    /(%27|%22|%3D|%2F|%5C|%7C|%26)/i, // URL-encoded SQL characters
  ];

  // Detect SQL injection in a value
  static detect(value) {
    if (!value || typeof value !== 'string') {
      return { isInjection: false, patterns: [], risk: 'none' };
    }

    const detectedPatterns = [];
    const input = String(value);

    // Check against all patterns
    for (const pattern of this.sqlInjectionPatterns) {
      if (pattern.test(input)) {
        detectedPatterns.push(pattern.toString());
      }
    }

    // Determine risk level
    let risk = 'none';
    if (detectedPatterns.length > 0) {
      if (detectedPatterns.length >= 3) {
        risk = 'critical';
      } else if (detectedPatterns.length === 2) {
        risk = 'high';
      } else {
        risk = 'medium';
      }
    }

    return {
      isInjection: detectedPatterns.length > 0,
      patterns: detectedPatterns,
      risk: risk,
      input: input.substring(0, 500), // Store first 500 chars for logging
      patternCount: detectedPatterns.length
    };
  }

  // Detect SQL injection in an object (request body, query params, etc.)
  static detectInObject(obj, maxDepth = 5, currentDepth = 0) {
    if (currentDepth > maxDepth) {
      return { isInjection: false, findings: [] };
    }

    const findings = [];

    if (obj === null || obj === undefined) {
      return { isInjection: false, findings: [] };
    }

    if (typeof obj === 'string') {
      const detection = this.detect(obj);
      if (detection.isInjection) {
        findings.push({
          field: 'string_value',
          ...detection
        });
      }
      return {
        isInjection: findings.length > 0,
        findings: findings
      };
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const result = this.detectInObject(obj[i], maxDepth, currentDepth + 1);
        if (result.isInjection) {
          findings.push(...result.findings.map(f => ({
            ...f,
            field: `[${i}]${f.field ? '.' + f.field : ''}`
          })));
        }
      }
    } else if (typeof obj === 'object') {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          if (typeof value === 'string') {
            const detection = this.detect(value);
            if (detection.isInjection) {
              findings.push({
                field: key,
                ...detection
              });
            }
          } else {
            const result = this.detectInObject(value, maxDepth, currentDepth + 1);
            if (result.isInjection) {
              findings.push(...result.findings.map(f => ({
                ...f,
                field: `${key}.${f.field}`
              })));
            }
          }
        }
      }
    }

    return {
      isInjection: findings.length > 0,
      findings: findings
    };
  }

  // Extract SQL query for analysis
  static analyzeQuery(query) {
    if (!query || typeof query !== 'string') {
      return { isSuspicious: false, reasons: [] };
    }

    const reasons = [];
    const normalizedQuery = query.toUpperCase();

    // Check for string concatenation in queries (bad practice)
    if (/\$\{|\+.*\+|\|.*\|/.test(query)) {
      reasons.push('String concatenation in SQL query detected');
    }

    // Check for user input directly in query
    if (/'[^']*'/.test(query) && query.split("'").length > 3) {
      reasons.push('Multiple string literals detected (possible injection point)');
    }

    // Check for suspicious SQL keywords
    const suspiciousKeywords = ['DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'EXEC', 'EXECUTE'];
    for (const keyword of suspiciousKeywords) {
      if (normalizedQuery.includes(keyword)) {
        reasons.push(`Suspicious keyword detected: ${keyword}`);
      }
    }

    return {
      isSuspicious: reasons.length > 0,
      reasons: reasons,
      query: query.substring(0, 1000) // Store first 1000 chars
    };
  }
}

module.exports = SQLInjectionDetector;

