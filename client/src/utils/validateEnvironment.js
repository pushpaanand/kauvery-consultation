// Environment Variable Validation Utility
// Prevents internal IP addresses and sensitive information from being bundled into client code

/**
 * Checks if an IP address is a private/internal IP
 */
function isPrivateIP(ip) {
  if (!ip || typeof ip !== 'string') return false;
  
  // Remove protocol and path
  const cleanIP = ip.replace(/^https?:\/\//, '').replace(/\/.*$/, '').split(':')[0];
  
  // Private IP ranges
  const privateIPRanges = [
    /^10\./,                              // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,    // 172.16.0.0/12
    /^192\.168\./,                        // 192.168.0.0/16
    /^127\./,                             // 127.0.0.0/8 (localhost)
    /^localhost$/i,                       // localhost
    /^0\.0\.0\.0$/,                       // 0.0.0.0
  ];
  
  return privateIPRanges.some(range => range.test(cleanIP));
}

/**
 * Validates environment variables and prevents internal IP disclosure
 */
function validateEnvironmentVariables() {
  const errors = [];
  const warnings = [];
  
  // Check all REACT_APP environment variables
  const envVars = Object.keys(process.env).filter(key => key.startsWith('REACT_APP_'));
  
  envVars.forEach(key => {
    const value = process.env[key];
    
    // Check for internal IP addresses in URLs
    if (typeof value === 'string' && (value.includes('://') || value.includes('://'))) {
      if (isPrivateIP(value)) {
        errors.push(`Environment variable ${key} contains private IP address: ${value}`);
      }
    }
    
    // Check for localhost in production builds
    if (process.env.NODE_ENV === 'production') {
      if (typeof value === 'string' && (
        value.includes('localhost') ||
        value.includes('127.0.0.1') ||
        value.includes('0.0.0.0')
      )) {
        warnings.push(`Environment variable ${key} contains localhost in production: ${value}`);
      }
    }
  });
  
  // Throw errors in development to prevent issues
  if (errors.length > 0) {
    console.error('❌ SECURITY ERROR: Internal IP addresses found in environment variables:');
    errors.forEach(error => console.error(`  - ${error}`));
    console.error('Please use public URLs instead of internal IP addresses.');
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Build failed: Internal IP addresses detected in environment variables');
    }
  }
  
  // Warn in development
  if (warnings.length > 0) {
    console.warn('⚠️ WARNING: Localhost URLs found in environment variables:');
    warnings.forEach(warning => console.warn(`  - ${warning}`));
  }
  
  return { errors, warnings };
}

/**
 * Sanitize URL to remove/replace internal IPs
 */
function sanitizeURL(url) {
  if (!url || typeof url !== 'string') return url;
  
  // If it contains a private IP, return a masked version for logging
  if (isPrivateIP(url)) {
    return url.replace(/\d+\.\d+\.\d+\.\d+/, '[INTERNAL_IP]');
  }
  
  return url;
}

module.exports = {
  isPrivateIP,
  validateEnvironmentVariables,
  sanitizeURL
};

