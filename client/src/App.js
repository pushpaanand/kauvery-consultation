import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import VideoConsultation from "./components/VideoConsultation";
import AppointmentService from "./utils/appointmentService";

function App() {
  const [token, setToken] = useState("");
  const [appointment, setAppointment] = useState({});
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [appointmentStored, setAppointmentStored] = useState(false);
  
  // New states for real-time decryption flow
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptionComplete, setDecryptionComplete] = useState(false);
  const [decryptionError, setDecryptionError] = useState(null);

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
      const serverUrl = 'https://videoconsultation-fsb6dbejh3c9htfn.canadacentral-01.azurewebsites.net';
      const apiEndpoint = `${serverUrl}/api/decrypt`;
      
      console.log('🔐 App.js: Calling decrypt API with:', encodedText);
      console.log('🔐 App.js: API endpoint:', apiEndpoint);
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: encodedText  // Make sure it's 'text', not 'encryptedText'
        }),
      });
  
      console.log('🔐 App.js: Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ App.js: Server error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('✅ App.js: Decryption successful:', data);
      return data.decryptedText;
    } catch (error) {
      console.error('❌ App.js: Decryption failed:', error);
      throw error;
    }
  };

  // Function to store appointment data in database
  const storeAppointmentData = async (appointmentData) => {
    try {
      console.log('💾 App.js: Storing appointment data:', appointmentData);
      
      // Prepare appointment data for storage - only the 3 required parameters + defaults
      const appointmentToStore = {
        app_no: appointmentData.app_no,
        username: appointmentData.username,
        userid: appointmentData.userid,
        // Set default values for other fields (hidden for now)
        room_id: `ROOM_${appointmentData.app_no}`,
        doctorname: 'Dr. General',
        speciality: 'General Medicine',
        appointment_date: new Date().toISOString().split('T')[0],
        appointment_time: new Date().toTimeString().split(' ')[0]
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
      } else {
        console.error('❌ App.js: Failed to store appointment:', result.error);
      }
      
      return result;
    } catch (error) {
      console.error('❌ App.js: Failed to store appointment data:', error);
      return { success: false, error: error.message };
    }
  };

  // Function to get query parameters
  const getQueryParams = () => {
    const params = new URLSearchParams(window.location.search);
    console.log('🔍 App.js: Query params:', params);
    return {
      // Only the 3 required parameters
      app_no: params.get("app_no"),
      username: params.get("username"),
      userid: params.get("userid"),
      // Keep encrypted ID parameter for decryption
      id: params.get("id"),
      // Keep token for backward compatibility
      token: params.get("token"),
      // Keep legacy parameters for backward compatibility
      name: params.get("name"),
      date: params.get("date"),
      time: params.get("time"),
    };
  };

  useEffect(() => {
    const params = getQueryParams();

    // Function to process encoded ID parameter
    const processEncodedId = async (encryptedId) => {
      try {
        setIsDecrypting(true);
        setDecryptionError(null);
        console.log(' App.js: Processing encoded ID parameter...', encryptedId);
        
        // Decrypt the single encoded ID
        const decryptedId = await decryptParameter(encryptedId);
        console.log('🔍 App.js: Decrypted data:', decryptedId);
        
        // Parse the decrypted string to get actual appointment data
        const urlParams = new URLSearchParams(decryptedId);
        const appointmentId = urlParams.get('app_no') || urlParams.get('appointmentId') || urlParams.get('id');
        const username = urlParams.get('username') || urlParams.get('name');
        const userid = urlParams.get('userid') || urlParams.get('user_id');

        // Create appointment data object with only the 3 required parameters + defaults
        const appointmentData = {
          app_no: appointmentId,
          username: username,
          userid: userid,
          // Set default values for other fields (hidden for now)
          room_id: `ROOM_${appointmentId}`,
          doctorname: 'Dr. General',
          speciality: 'General Medicine',
          appointment_date: new Date().toISOString().split('T')[0],
          appointment_time: new Date().toTimeString().split(' ')[0]
        };

        // Store appointment data in database
        await storeAppointmentData(appointmentData);

        // Create token and set as valid
        const videoToken = `video_${appointmentId || userid}`;
        sessionStorage.setItem("authToken", videoToken);
        sessionStorage.setItem("decryptedParams", JSON.stringify(appointmentData));
        setToken(videoToken);
        setIsTokenValid(true);
        setDecryptionComplete(true);
        setIsDecrypting(false);
        console.log('✅ App.js: Encoded ID processed successfully, setting token:', videoToken);
        
      } catch (error) {
        console.error('❌ App.js: Failed to process encoded ID:', error);
        setDecryptionError(error.message);
        setIsDecrypting(false);
        setIsTokenValid(false);
      }
    };

    // Function to process direct URL parameters
    const processDirectParams = async (directParams) => {
      try {
        setIsDecrypting(true);
        setDecryptionError(null);
        console.log(' App.js: Processing direct URL parameters...', directParams);
        
        // Create appointment data object with only the 3 required parameters + defaults
        const appointmentData = {
          app_no: directParams.app_no || directParams.appointment_id,
          username: directParams.username || directParams.name,
          userid: directParams.userid,
          // Set default values for other fields (hidden for now)
          room_id: `ROOM_${directParams.app_no || directParams.userid}`,
          doctorname: 'Dr. General',
          speciality: 'General Medicine',
          appointment_date: new Date().toISOString().split('T')[0],
          appointment_time: new Date().toTimeString().split(' ')[0]
        };

        // Store appointment data in database
        await storeAppointmentData(appointmentData);

        // Create token and set as valid
        const videoToken = `video_${directParams.app_no || directParams.userid}`;
        sessionStorage.setItem("authToken", videoToken);
        setToken(videoToken);
        setIsTokenValid(true);
        setDecryptionComplete(true);
        setIsDecrypting(false);
        console.log('✅ App.js: Direct parameters processed successfully, setting token:', videoToken);
        
      } catch (error) {
        console.error('❌ App.js: Failed to process direct parameters:', error);
        setDecryptionError(error.message);
        setIsDecrypting(false);
        setIsTokenValid(false);
      }
    };

    // Main processing logic - Check for encrypted parameter first (highest priority)
    if (params.id) {
      console.log(' App.js: Encoded ID parameter detected, decrypting...');
      processEncodedId(params.id); // Pass the encrypted ID directly
    }
    // Check for video consultation parameters (direct parameters)
    else if (params.app_no && params.username && params.userid) {
      console.log('🔍 App.js: Direct video consultation parameters detected');
      processDirectParams(params);
    } 
    // Check for original token
    else if (params.token) {
      console.log('🔍 App.js: Token parameter detected');
      sessionStorage.setItem("authToken", params.token);
      setToken(params.token);
      setIsTokenValid(true);
      setDecryptionComplete(true);
    } 
    // Check for saved token
    else {
      const savedToken = sessionStorage.getItem("authToken");
      if (savedToken) {
        setToken(savedToken);
        setIsTokenValid(true);
        setDecryptionComplete(true);
        console.log('🔍 App.js: Using saved token');
      } else {
        console.log('🔍 App.js: No valid parameters found');
        setIsTokenValid(false);
        setDecryptionComplete(true);
      }
    }

    // Handle legacy appointment data
    if (params.name && params.date && params.time) {
      setAppointment({
        name: params.name,
        date: params.date,
        time: params.time,
      });
    }
  }, []);

  // Loading component for decryption process
  const LoadingScreen = () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#f0f2f5',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
        backgroundColor: 'white',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        maxWidth: '400px',
        width: '90%'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #3498db',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 20px'
        }}></div>
        <h2 style={{ color: '#333', marginBottom: '10px' }}>Processing Your Appointment</h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          {isDecrypting ? 'Decrypting appointment details...' : 'Preparing video consultation...'}
        </p>
        <div style={{ fontSize: '14px', color: '#999' }}>
          Please wait while we set up your consultation room
        </div>
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  // Error component for decryption failures
  const ErrorScreen = () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#f0f2f5',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
        backgroundColor: 'white',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        maxWidth: '400px',
        width: '90%'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          backgroundColor: '#e74c3c',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          fontSize: '24px',
          color: 'white'
        }}>⚠️</div>
        <h2 style={{ color: '#e74c3c', marginBottom: '10px' }}>Access Denied</h2>
        <p style={{ color: '#666', marginBottom: '20px' }}>
          {decryptionError || 'Invalid appointment parameters. Please check your link and try again.'}
        </p>
        <button 
          onClick={() => window.location.reload()} 
          style={{
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  );

  return (
    <BrowserRouter>
      <Routes>
        {/* Home route */}
        <Route 
          path="/" 
          element={
            // Show loading screen while decrypting
            isDecrypting ? (
              <LoadingScreen />
            ) : decryptionError ? (
              <ErrorScreen />
            ) : decryptionComplete && isTokenValid ? (
              // Redirect to video consultation after successful decryption
              <Navigate to="/consultation" replace />
            ) : (
              // Show original Access Denied page if no valid parameters
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
            isDecrypting ? (
              <LoadingScreen />
            ) : decryptionError ? (
              <ErrorScreen />
            ) : decryptionComplete && isTokenValid ? (
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
            isDecrypting ? (
              <LoadingScreen />
            ) : decryptionError ? (
              <ErrorScreen />
            ) : decryptionComplete && isTokenValid ? (
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