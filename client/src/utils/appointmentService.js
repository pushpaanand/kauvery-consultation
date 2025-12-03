// Appointment Service for handling appointment storage and video call events
// SECURITY: Use relative URLs or validated public URLs only
// Never use internal IPs (172.x, 192.168.x, 10.x) - they get bundled into client code

// Helper function to validate and sanitize server URL
function getServerUrl() {
  const envUrl = process.env.REACT_APP_SERVER_URL || '';
  
  // Check for internal IP addresses
  const privateIPPatterns = [
    /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16.0.0/12
    /^https?:\/\/192\.168\./,                      // 192.168.0.0/16
    /^https?:\/\/10\./,                            // 10.0.0.0/8
    /^https?:\/\/127\./,                           // 127.0.0.0/8
    /localhost/i,
  ];
  
  // If environment URL contains private IP, use relative URL instead
  if (envUrl && privateIPPatterns.some(pattern => pattern.test(envUrl))) {
    console.warn('⚠️ SECURITY: Internal IP detected in REACT_APP_SERVER_URL. Using relative URL instead.');
    return ''; // Empty string = relative URL
  }
  
  // Use environment URL if valid, otherwise use relative URL
  return envUrl || '';
}

const SERVER_URL = getServerUrl();

class AppointmentService {
  // Store appointment data when user enters the website
  static async storeAppointment(appointmentData) {
    try {      
      // Use relative URL if SERVER_URL is empty (prevents internal IP exposure)
      const apiUrl = SERVER_URL ? `${SERVER_URL}/api/appointments` : '/api/appointments';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(appointmentData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Store appointment ID in session storage for future use
      if (result.appointment_id) {
        sessionStorage.setItem('appointment_id', result.appointment_id);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error storing appointment:', error);
      throw error;
    }
  }

  // Store video call event
  static async storeVideoCallEvent(eventData) {
    try {
      
      // Use relative URL if SERVER_URL is empty (prevents internal IP exposure)
      const apiUrl = SERVER_URL ? `${SERVER_URL}/api/video-call-events` : '/api/video-call-events';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      return result;
    } catch (error) {
      console.error('❌ Error storing video call event:', error);
      throw error;
    }
  }

  // Start call session
  static async startCallSession(sessionData) {
    try {      
      // Use relative URL if SERVER_URL is empty (prevents internal IP exposure)
      const apiUrl = SERVER_URL ? `${SERVER_URL}/api/call-sessions/start` : '/api/call-sessions/start';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      return result;
    } catch (error) {
      console.error('❌ Error starting call session:', error);
      throw error;
    }
  }

  // End call session
  static async endCallSession(sessionData) {
    try {      
      // Use relative URL if SERVER_URL is empty (prevents internal IP exposure)
      const apiUrl = SERVER_URL ? `${SERVER_URL}/api/call-sessions/end` : '/api/call-sessions/end';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      return result;
    } catch (error) {
      console.error('❌ Error ending call session:', error);
      throw error;
    }
  }

  // Get appointment details
  static async getAppointment(appNo) {
    try {
      
      // Use relative URL if SERVER_URL is empty (prevents internal IP exposure)
      const apiUrl = SERVER_URL ? `${SERVER_URL}/api/appointments/${appNo}` : `/api/appointments/${appNo}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      return result;
    } catch (error) {
      console.error('❌ Error fetching appointment:', error);
      throw error;
    }
  }

  // Helper method to get appointment ID from session storage
  static getAppointmentId() {
    return sessionStorage.getItem('appointment_id');
  }

  // Helper method to set appointment ID in session storage
  static setAppointmentId(appointmentId) {
    sessionStorage.setItem('appointment_id', appointmentId);
  }

  // Helper method to clear appointment data from session storage
  static clearAppointmentData() {
    sessionStorage.removeItem('appointment_id');
  }
}

export default AppointmentService; 