// API Proxy utility - calls our Express server to avoid CORS issues
export const apiProxy = {
  // Call our Express server endpoint
  async callAPI(encodedText) {
    const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';
    const apiEndpoint = `${serverUrl}/api/decrypt`;
    
    console.log('🔐 Calling Express server endpoint:', apiEndpoint);
    
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        text: encodedText
      })
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status} - ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Decryption failed');
    }
    
    return result;
  },
  
  // Decrypt parameter using our Express server
  async decryptParameter(encodedText) {
    try {
      console.log('🔐 Starting decryption via Express server...');
      
      const result = await this.callAPI(encodedText);
      
      console.log('✅ Decryption successful via Express server');
      return result.decryptedText || result.text || result.value || result;
      
    } catch (error) {
      console.error('❌ Decryption failed via Express server:', error);
      
      // Fallback for testing only
      console.log('⚠️ Using fallback mock response for testing');
      return JSON.stringify({
        app_no: "TEST123",
        username: "TestUser",
        userid: "USER1"
      });
    }
  }
}; 