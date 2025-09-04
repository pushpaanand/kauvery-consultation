// Appointment Service for handling appointment storage and video call events
const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:3001';

class AppointmentService {
  // Store appointment data when user enters the website
  static async storeAppointment(appointmentData) {
    try {
      console.log('📝 Storing appointment data:', appointmentData);
      
      const response = await fetch(`${SERVER_URL}/api/appointments`, {
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
      console.log('✅ Appointment stored successfully:', result);
      
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
      console.log('📹 Storing video call event:', eventData);
      
      const response = await fetch(`${SERVER_URL}/api/video-call-events`, {
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
      console.log('✅ Video call event stored successfully:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Error storing video call event:', error);
      throw error;
    }
  }

  // Start call session
  static async startCallSession(sessionData) {
    try {
      console.log('🚀 Starting call session:', sessionData);
      
      const response = await fetch(`${SERVER_URL}/api/call-sessions/start`, {
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
      console.log('✅ Call session started successfully:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Error starting call session:', error);
      throw error;
    }
  }

  // End call session
  static async endCallSession(sessionData) {
    try {
      console.log('⏹️ Ending call session:', sessionData);
      
      const response = await fetch(`${SERVER_URL}/api/call-sessions/end`, {
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
      console.log('✅ Call session ended successfully:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Error ending call session:', error);
      throw error;
    }
  }

  // Get appointment details
  static async getAppointment(appNo) {
    try {
      console.log('🔍 Fetching appointment details for:', appNo);
      
      const response = await fetch(`${SERVER_URL}/api/appointments/${appNo}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Appointment details fetched successfully:', result);
      
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