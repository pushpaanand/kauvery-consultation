import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import VideoConsultation from "./components/VideoConsultation";
import AppointmentService from "./utils/appointmentService";

function App() {
  const [token, setToken] = useState("");
  const [appointment, setAppointment] = useState({});
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [appointmentStored, setAppointmentStored] = useState(false);

  // Environment validation function
  const validateEnvironment = () => {
    const required = [
      'REACT_APP_ZEGO_APP_ID',
      'REACT_APP_ZEGO_SERVER_SECRET',
      'REACT_APP_DECRYPTION_API_URL',
      'REACT_APP_DECRYPTION_KEY',
      'REACT_APP_SERVER_URL'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing);
      console.error('Please check your .env file');
      return false;
    }
    
    console.log('✅ All required environment variables are set');
    return true;
  };

  // Validate environment variables on startup
  useEffect(() => {
    const isValid = validateEnvironment();
    
    if (!isValid) {
      console.error('❌ App.js: Environment validation failed. Please check your .env file.');
    } else {
      console.log('✅ App.js: Environment validation passed.');
    }
  }, []);

  // Function to decrypt encoded ID parameter by calling Express server
  const decryptParameter = async (encodedText) => {
    try {
      // const serverUrl = 'http://localhost:3001';
      const serverUrl='https://videoconsultation-fsb6dbejh3c9htfn.canadacentral-01.azurewebsites.net';
      const apiEndpoint = `${serverUrl}/api/decrypt`;
      
      console.log('🔐 App.js: Calling /api/decrypt with params.id:', encodedText);
      console.log('🔐 App.js: API endpoint:', apiEndpoint);
      
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
      console.log('✅ App.js: Received response from /api/decrypt:', result);
      
      if (result.success && result.decryptedText) {
        return result.decryptedText;
      } else {
        return result;
      }
      
    } catch (error) {
      throw error;
    }
  };

  // Function to store appointment data in database
  const storeAppointmentData = async (appointmentData) => {
    try {
      console.log('📝 App.js: Storing appointment data:', appointmentData);
      
      // Prepare appointment data for storage
      const appointmentToStore = {
        app_no: appointmentData.app_no || appointmentData.appointment_id || appointmentData.id,
        username: appointmentData.username || appointmentData.name,
        userid: appointmentData.userid || appointmentData.user_id,
        doctorname: appointmentData.doctorname || appointmentData.doctor_name || 'Dr. General',
        speciality: appointmentData.speciality || appointmentData.department || 'General Medicine',
        appointment_date: appointmentData.appointment_date || appointmentData.date || new Date().toISOString().split('T')[0],
        appointment_time: appointmentData.appointment_time || appointmentData.time || new Date().toTimeString().split(' ')[0],
        room_id: appointmentData.room_id || appointmentData.roomId || appointmentData.meeting_id || `ROOM_${appointmentData.app_no || appointmentData.userid}`
      };

      // Store appointment in database
      const result = await AppointmentService.storeAppointment(appointmentToStore);
      
      if (result.success) {
        setAppointmentStored(true);
        console.log('✅ App.js: Appointment stored successfully in database');
        
        // Store appointment ID in session storage
        AppointmentService.setAppointmentId(result.appointment_id);
        
        // Update appointment state with stored data
        setAppointment({
          ...appointmentToStore,
          id: result.appointment_id
        });
      }
      
      return result;
    } catch (error) {
      console.error('❌ App.js: Failed to store appointment data:', error);
      // Don't throw error, continue with the flow
      return { success: false, error: error.message };
    }
  };

  // Function to get query parameters
  const getQueryParams = () => {
    const params = new URLSearchParams(window.location.search);
    console.log('🔍 App.js: Query params:', params);
    return {
      token: params.get("token"),
      name: params.get("name"),
      date: params.get("date"),
      time: params.get("time"),
      // Add support for video consultation parameters
      app_no: params.get("app_no"),
      appointment_id: params.get("appointment_id"),
      meeting_id: params.get("meeting_id"),
      room_id: params.get("room_id"),
      username: params.get("username"),
      userid: params.get("userid"),
      department: params.get("department"),
      doctor_name: params.get("doctor_name"),
      speciality: params.get("speciality"),
      appointment_date: params.get("appointment_date"),
      appointment_time: params.get("appointment_time"),
      // Add support for single encoded ID parameter
      id: params.get("id"),
    };
  };

  useEffect(() => {
    const params = getQueryParams();

    // Function to process encoded ID parameter
    const processEncodedId = async () => {
      try {
        console.log('🔐 App.js: Processing encoded ID parameter...', params.id);
        
        // Decrypt the single encoded ID
        const decryptedId = await decryptParameter(params.id);
        let appointmentId, username, userid;
        
        console.log('🔍 App.js: Decrypted data:', decryptedId);
        
        // Parse URL query string format: "app_no=TEST123&room_id=ROOM1&username=TestUser&userid=USER1"
        const urlParams = new URLSearchParams(decryptedId);
        appointmentId = urlParams.get('app_no') || urlParams.get('appointmentId') || urlParams.get('id');
        username = urlParams.get('username') || urlParams.get('name');
        userid = urlParams.get('userid') || urlParams.get('user_id');

        // Create appointment data object
        const appointmentData = {
          app_no: appointmentId,
          username: username,
          userid: userid,
          room_id: urlParams.get('room_id') || urlParams.get('roomId') || `ROOM_${appointmentId}`,
          doctorname: urlParams.get('doctorname') || urlParams.get('doctor_name') || 'Dr. General',
          speciality: urlParams.get('speciality') || urlParams.get('department') || 'General Medicine',
          appointment_date: urlParams.get('appointment_date') || urlParams.get('date') || new Date().toISOString().split('T')[0],
          appointment_time: urlParams.get('appointment_time') || urlParams.get('time') || new Date().toTimeString().split(' ')[0]
        };

        // Store appointment data in database
        await storeAppointmentData(appointmentData);

        // Create a token from the decrypted parameters
        const videoToken = `video_${appointmentId || userid}`;
        sessionStorage.setItem("authToken", videoToken);
        sessionStorage.setItem("decryptedParams", JSON.stringify(appointmentData));
        setToken(videoToken);
        setIsTokenValid(true); // Set token as valid immediately after successful decryption
        console.log('🔍 App.js: Encoded ID processed successfully, setting token:', videoToken);
        
      } catch (error) {
        console.error('❌ App.js: Failed to process encoded ID:', error);
        setIsTokenValid(false);
      }
    };

    // Function to process direct URL parameters
    const processDirectParams = async (params) => {
      try {
        console.log('🔍 App.js: Processing direct URL parameters...', params);
        
        // Create appointment data object from direct parameters
        const appointmentData = {
          app_no: params.app_no || params.appointment_id,
          username: params.username || params.name,
          userid: params.userid,
          room_id: params.room_id || params.roomId || params.meeting_id || `ROOM_${params.app_no || params.userid}`,
          doctorname: params.doctor_name || params.doctorname || 'Dr. General',
          speciality: params.speciality || params.department || 'General Medicine',
          appointment_date: params.appointment_date || params.date || new Date().toISOString().split('T')[0],
          appointment_time: params.appointment_time || params.time || new Date().toTimeString().split(' ')[0]
        };

        // Store appointment data in database
        await storeAppointmentData(appointmentData);

        // Create token and set as valid
        const videoToken = `video_${params.app_no || params.userid}`;
        sessionStorage.setItem("authToken", videoToken);
        setToken(videoToken);
        setIsTokenValid(true);
        console.log('🔍 App.js: Direct parameters processed successfully, setting token:', videoToken);
        
      } catch (error) {
        console.error('❌ App.js: Failed to process direct parameters:', error);
        setIsTokenValid(false);
      }
    };

    // Check for encoded ID parameter first (highest priority)
    if (params.id) {
      console.log('🔍 App.js: Encoded ID parameter detected');
      processEncodedId();
    }
    // Check for video consultation parameters
    else if (params.app_no && params.username && params.userid) {
      console.log('🔍 App.js: Video consultation parameters detected');
      processDirectParams(params);
    } 
    // Check for original token
    else if (params.token) {
      console.log('🔍 App.js: Token parameter detected');
      sessionStorage.setItem("authToken", params.token);
      setToken(params.token);
      setIsTokenValid(true);
    } 
    // Check for saved token
    else {
      const savedToken = sessionStorage.getItem("authToken");
      if (savedToken) {
        setToken(savedToken);
        setIsTokenValid(true);
        console.log('🔍 App.js: Using saved token');
      } else {
        console.log('🔍 App.js: No valid parameters found');
        setIsTokenValid(false);
      }
    }

    if (params.name && params.date && params.time) {
      setAppointment({
        name: params.name,
        date: params.date,
        time: params.time,
      });
    }
  }, []);

  // Validate URL parameters and token - Simplified validation
  useEffect(() => {
    const params = getQueryParams();
    
    // Check if ANY URL parameters exist
    const hasUrlParams = Object.values(params).some(param => param !== null && param !== '');
    
    if (!hasUrlParams) {
      // No URL parameters at all - show Access Denied
      console.log('🔍 App.js: No URL parameters found - showing Access Denied');
      setIsTokenValid(false);
    }
    // Token validity is now set directly in the parameter processing functions
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* All routes check token validation and show VideoConsultation if valid */}
        <Route 
          path="/" 
          element={
            isTokenValid ? (
              <VideoConsultation />
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                background: 'white',
                color: '#962067',
                fontFamily: "'Poppins', sans-serif",
                textAlign: 'center',
                padding: '20px'
              }}>
                <div style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '40px',
                  maxWidth: '500px',
                  textAlign: 'center',
                  boxShadow: '0 8px 25px rgba(150, 32, 103, 0.15)',
                  border: '3px solid #962067'
                }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    background: 'linear-gradient(135deg, #962067, #A23293)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                    fontSize: '32px',
                    color: 'white'
                  }}>
                    ⚠️
                  </div>
                  
                  <h1 style={{
                    color: '#962067',
                    fontSize: '28px',
                    fontWeight: '700',
                    margin: '0 0 16px 0',
                    fontFamily: "'Poppins', sans-serif"
                  }}>
                    Access Denied
                  </h1>
                  
                  <p style={{
                    color: '#58595B',
                    fontSize: '16px',
                    lineHeight: '1.6',
                    margin: '0 0 24px 0'
                  }}>
                    No consultation parameters found in the URL. Please use a valid consultation link provided by Kauvery Hospital.
                  </p>
                  
                  <div style={{
                    background: '#f8f9fa',
                    borderRadius: '12px',
                    padding: '20px',
                    margin: '24px 0',
                    border: '2px solid #e9ecef'
                  }}>
                    <h3 style={{
                      color: '#962067',
                      fontSize: '18px',
                      fontWeight: '600',
                      margin: '0 0 12px 0'
                    }}>
                      Required Parameters:
                    </h3>
                    <ul style={{
                      textAlign: 'left',
                      color: '#58595B',
                      fontSize: '14px',
                      lineHeight: '1.8',
                      margin: '0',
                      paddingLeft: '20px'
                    }}>
                      <li><strong>app_no</strong> - Appointment number</li>
                      <li><strong>username</strong> - Patient name</li>
                      <li><strong>userid</strong> - User ID</li>
                    </ul>
                  </div>
                  

                </div>
                
                {/* Footer */}
                <div style={{
                  position: 'fixed',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'linear-gradient(135deg, #962067, #A23293)',
                  color: 'white',
                  padding: '12px 20px',
                  textAlign: 'center',
                  fontSize: '13px',
                  fontFamily: "'Poppins', sans-serif",
                  fontWeight: '500',
                  zIndex: 1000,
                  boxShadow: '0 -2px 8px rgba(150, 32, 103, 0.3)',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px'
                }}>
                  <span style={{ fontSize: '13px', color: 'white' }}>© 2025 Kauvery Hospital. All Rights Reserved.</span>
                  <span style={{ color: 'white', fontSize: '12px' }}>|</span>
                  <a 
                    href="https://www.kauveryhospital.com/disclaimer/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      color: 'white',
                      textDecoration: 'none',
                      transition: 'color 0.3s ease',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}
                    onMouseEnter={(e) => e.target.style.color = '#f0f0f0'}
                    onMouseLeave={(e) => e.target.style.color = 'white'}
                  >
                    Disclaimer
                  </a>
                  <span style={{ color: 'white', fontSize: '12px' }}>|</span>
                  <a 
                    href="https://www.kauveryhospital.com/privacy/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      color: 'white',
                      textDecoration: 'none',
                      transition: 'color 0.3s ease',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}
                    onMouseEnter={(e) => e.target.style.color = '#f0f0f0'}
                    onMouseLeave={(e) => e.target.style.color = 'white'}
                  >
                    Privacy Policy
                  </a>
                  <span style={{ color: 'white', fontSize: '12px' }}>|</span>
                  <a 
                    href="https://www.kauveryhospital.com/terms-conditions/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      color: 'white',
                      textDecoration: 'none',
                      transition: 'color 0.3s ease',
                      fontSize: '13px',
                      fontWeight: '500'
                    }}
                    onMouseEnter={(e) => e.target.style.color = '#f0f0f0'}
                    onMouseLeave={(e) => e.target.style.color = 'white'}
                  >
                    T&C
                  </a>
                </div>
              </div>
            )
          } 
        />
        
        {/* Patient route */}
        <Route 
          path="/patient" 
          element={
            isTokenValid ? (
              <VideoConsultation />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        
        {/* Video consultation route */}
        <Route 
          path="/consultation" 
          element={
            isTokenValid ? (
              <VideoConsultation />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        
        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;