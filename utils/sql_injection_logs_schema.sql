-- SQL Injection Logs Table Schema
-- This table stores all detected SQL injection attempts for security monitoring

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sql_injection_logs]') AND type in (N'U'))
BEGIN
    CREATE TABLE sql_injection_logs (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        timestamp DATETIME2 NOT NULL DEFAULT GETDATE(),
        ip_address NVARCHAR(45) NULL,
        user_agent NVARCHAR(500) NULL,
        request_method NVARCHAR(10) NULL,
        request_path NVARCHAR(500) NULL,
        risk_level NVARCHAR(20) NULL, -- 'none', 'medium', 'high', 'critical'
        pattern_count INT NULL,
        detected_patterns NVARCHAR(MAX) NULL, -- JSON array of detected patterns
        suspicious_field NVARCHAR(200) NULL,
        suspicious_input NVARCHAR(MAX) NULL,
        query_text NVARCHAR(MAX) NULL,
        user_id NVARCHAR(100) NULL,
        session_id NVARCHAR(200) NULL,
        request_body NVARCHAR(MAX) NULL,
        response_status INT NULL,
        created_at DATETIME2 NOT NULL DEFAULT GETDATE()
    );

    PRINT 'Table sql_injection_logs created successfully';
END
ELSE
BEGIN
    PRINT 'Table sql_injection_logs already exists';
END;

-- Create indexes for better query performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_sql_injection_logs_timestamp' AND object_id = OBJECT_ID(N'[dbo].[sql_injection_logs]'))
BEGIN
    CREATE INDEX IX_sql_injection_logs_timestamp ON sql_injection_logs (timestamp);
    PRINT 'Index IX_sql_injection_logs_timestamp created';
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_sql_injection_logs_ip_address' AND object_id = OBJECT_ID(N'[dbo].[sql_injection_logs]'))
BEGIN
    CREATE INDEX IX_sql_injection_logs_ip_address ON sql_injection_logs (ip_address);
    PRINT 'Index IX_sql_injection_logs_ip_address created';
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_sql_injection_logs_risk_level' AND object_id = OBJECT_ID(N'[dbo].[sql_injection_logs]'))
BEGIN
    CREATE INDEX IX_sql_injection_logs_risk_level ON sql_injection_logs (risk_level);
    PRINT 'Index IX_sql_injection_logs_risk_level created';
END;

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_sql_injection_logs_created_at' AND object_id = OBJECT_ID(N'[dbo].[sql_injection_logs]'))
BEGIN
    CREATE INDEX IX_sql_injection_logs_created_at ON sql_injection_logs (created_at);
    PRINT 'Index IX_sql_injection_logs_created_at created';
END;

-- Create additional indexes if they don't exist
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_sql_injection_logs_risk_ip' AND object_id = OBJECT_ID(N'[dbo].[sql_injection_logs]'))
BEGIN
    CREATE INDEX IX_sql_injection_logs_risk_ip ON sql_injection_logs (risk_level, ip_address, created_at);
    PRINT 'Index IX_sql_injection_logs_risk_ip created';
END;

-- Optional: Create a view for recent critical attempts
IF NOT EXISTS (SELECT * FROM sys.views WHERE name = 'vw_recent_critical_sql_injections')
BEGIN
    EXEC('
    CREATE VIEW vw_recent_critical_sql_injections AS
    SELECT TOP 100
        id,
        timestamp,
        ip_address,
        request_method,
        request_path,
        risk_level,
        pattern_count,
        suspicious_field,
        user_id,
        response_status,
        created_at
    FROM sql_injection_logs
    WHERE risk_level IN (''high'', ''critical'')
    ORDER BY created_at DESC
    ');
    PRINT 'View vw_recent_critical_sql_injections created';
END;

