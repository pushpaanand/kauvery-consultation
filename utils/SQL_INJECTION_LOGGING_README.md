# SQL Injection Detection and Logging System

This security module provides comprehensive SQL injection detection and logging for your application.

## Features

- **Real-time Detection**: Automatically detects SQL injection attempts in all incoming requests
- **Pattern Matching**: Uses advanced pattern matching to identify common SQL injection techniques
- **Risk Assessment**: Categorizes threats as 'medium', 'high', or 'critical'
- **Dual Logging**: Logs to both database and file system for redundancy
- **Request Blocking**: Automatically blocks critical SQL injection attempts
- **Security Endpoints**: Provides API endpoints to view and analyze logged attempts

## Components

### 1. SQL Injection Detector (`sqlInjectionDetector.js`)
- Detects SQL injection patterns in user input
- Analyzes request bodies, query parameters, and URL parameters
- Identifies 30+ common SQL injection patterns
- Provides risk assessment (none, medium, high, critical)

### 2. SQL Injection Logger (`sqlInjectionLogger.js`)
- Logs all detected attempts to database table `sql_injection_logs`
- Also logs to daily log files in `logs/security/`
- Captures request details: IP address, user agent, method, path, etc.
- Handles errors gracefully with fallback logging

### 3. SQL Injection Middleware (`sqlInjectionMiddleware.js`)
- Express middleware that intercepts all requests
- Automatically checks request body, query params, and URL params
- Blocks critical attempts (403 Forbidden)
- Allows high-risk attempts but logs them
- Initializes logger with database connection

### 4. Database Schema (`sql_injection_logs_schema.sql`)
- Creates `sql_injection_logs` table with comprehensive fields
- Includes indexes for efficient querying
- Creates view for recent critical attempts

## Setup

### 1. Create Database Table

Run the SQL schema file to create the logs table:

```sql
-- Execute utils/sql_injection_logs_schema.sql
```

Or manually execute the SQL statements in your database.

### 2. The middleware is already integrated in `server.js`

The SQL injection detection middleware is automatically initialized when the database connects.

## Usage

The system works automatically - no additional code needed! It will:

1. ✅ Detect SQL injection attempts in all API requests
2. ✅ Log all attempts to database and files
3. ✅ Block critical attempts (return 403)
4. ✅ Warn on high-risk attempts but allow them through

## API Endpoints

### View SQL Injection Logs
```
GET /api/security/sql-injection-logs
```

Query Parameters:
- `limit` (default: 100, max: 1000) - Number of logs to return
- `risk_level` - Filter by risk level (medium, high, critical)
- `ip_address` - Filter by IP address
- `start_date` - Filter from date (YYYY-MM-DD)
- `end_date` - Filter to date (YYYY-MM-DD)

Example:
```
GET /api/security/sql-injection-logs?limit=50&risk_level=critical
```

### Get Statistics
```
GET /api/security/sql-injection-stats
```

Returns:
- Total attempts
- Unique IPs
- Counts by risk level
- Attempts in last 24h, 7d, 30d

### Top IP Addresses
```
GET /api/security/sql-injection-top-ips?limit=10
```

Returns IP addresses with most SQL injection attempts.

## Log Files

Log files are stored in: `logs/security/sql-injection-YYYY-MM-DD.log`

Format: JSON lines (one JSON object per line)

## Detected Patterns

The system detects common SQL injection patterns including:
- SQL keywords (SELECT, INSERT, UPDATE, DELETE, DROP, etc.)
- SQL comments (--, #, /* */)
- OR/AND-based injections (' OR '1'='1)
- UNION-based injections
- Command separators (;, |, &)
- Character encoding functions
- Stored procedure exploits
- File operations
- Time-based attacks
- And many more...

## Risk Levels

- **None**: No SQL injection detected
- **Medium**: 1 pattern detected
- **High**: 2 patterns detected
- **Critical**: 3+ patterns detected (automatically blocked)

## Security Best Practices

⚠️ **Important**: This system detects and logs SQL injection attempts, but you should also:

1. **Use Parameterized Queries**: Always use parameterized queries instead of string concatenation
2. **Input Validation**: Validate and sanitize all user input
3. **Least Privilege**: Use database accounts with minimum required privileges
4. **Regular Monitoring**: Review logs regularly for patterns and attack sources
5. **Rate Limiting**: Consider implementing rate limiting for suspicious IPs

## Example Log Entry

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "type": "sql_injection_attempt",
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "method": "POST",
  "path": "/api/appointments",
  "risk": "critical",
  "patternCount": 3,
  "patterns": ["/(\\b(SELECT|INSERT|...)\\b)/i", "/(''|#|\\/\\*|\\*\\/)/"],
  "field": "app_no",
  "input": "123' OR '1'='1",
  "userId": "",
  "sessionId": ""
}
```

## Monitoring Recommendations

1. Set up alerts for critical attempts
2. Review logs daily for patterns
3. Monitor top IPs and consider blocking repeat offenders
4. Track trends over time (use statistics endpoint)
5. Integrate with security information and event management (SIEM) systems

## Troubleshooting

### Logs not being created
- Check database connection
- Verify `sql_injection_logs` table exists
- Check file system permissions for `logs/security/` directory

### Too many false positives
- Review and adjust pattern detection rules in `sqlInjectionDetector.js`
- Add legitimate patterns to whitelist if needed

### Performance concerns
- The detection is lightweight and runs before database queries
- Database logging is asynchronous
- Consider archiving old logs periodically

## Support

For issues or questions, review the code in:
- `utils/sqlInjectionDetector.js`
- `utils/sqlInjectionLogger.js`
- `utils/sqlInjectionMiddleware.js`
- `server.js` (integration)

