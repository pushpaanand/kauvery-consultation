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
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [otpStep, setOtpStep] = useState('idle'); // idle | mobile | otp | verified
  const [mobileInput, setMobileInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [precheckId, setPrecheckId] = useState(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [maskedMobile, setMaskedMobile] = useState('');
  const [appointmentHint, setAppointmentHint] = useState('');
  const [encryptedParams, setEncryptedParams] = useState(null);
  const [linkHash, setLinkHash] = useState('');

  // Environment validation function
  const validateEnvironment = () => {
    const required = [
      'REACT_APP_ZEGO_APP_ID',
      'REACT_APP_ZEGO_SERVER_SECRET',
      'REACT_APP_DECRYPTION_KEY',
      'REACT_APP_SERVER_URL'
    ];

    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      console.error('❌ Missing required environment variables:', missing);
      console.error('Please check your .env file');
      return false;
    }
    
    return true;
  };

  const renderOtpMobileScreen = () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'white',
      color: '#962067',
      fontFamily: "'Poppins', sans-serif",
      textAlign: 'center',
      padding: '20px 20px 60px 20px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '520px',
        width: '100%',
        boxShadow: '0 8px 25px rgba(150, 32, 103, 0.15)',
        border: '3px solid #962067',
        textAlign: 'left'
      }}>
        <h1 style={{
          color: '#962067',
          fontSize: '26px',
          fontWeight: '700',
          margin: '0 0 16px 0'
        }}>
          Verify your mobile number
        </h1>
        <p style={{
          color: '#58595B',
          fontSize: '16px',
          lineHeight: '1.6',
          margin: '0 0 24px 0'
        }}>
          Enter the mobile number registered with Kauvery Hospital
          {appointmentHint ? ` (appointment ending with ${appointmentHint})` : ''} to receive an OTP.
        </p>
        <form onSubmit={handleSendOtp}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
            Mobile Number
          </label>
          <input
            type="tel"
            value={mobileInput}
            onChange={(e) => setMobileInput(sanitizeMobileInput(e.target.value))}
            placeholder="Enter registered mobile number"
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '2px solid #E5E5EA',
              fontSize: '16px',
              marginBottom: '16px',
              fontFamily: "'Poppins', sans-serif"
            }}
          />
          {otpError && (
            <div style={{ color: '#cc0000', marginBottom: '16px', fontWeight: 600 }}>
              {otpError}
            </div>
          )}
          <button
            type="submit"
            disabled={otpLoading}
            style={{
              width: '100%',
              background: otpLoading ? '#C3C3C3' : 'linear-gradient(135deg, #962067, #A23293)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '20px',
              cursor: otpLoading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              fontFamily: "'Poppins', sans-serif",
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 15px rgba(150, 32, 103, 0.2)'
            }}
          >
            {otpLoading ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </form>
      </div>
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
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        © 2025 Kauvery Hospital. All rights reserved.
      </div>
    </div>
  );

  const renderOtpVerificationScreen = () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'white',
      color: '#962067',
      fontFamily: "'Poppins', sans-serif",
      textAlign: 'center',
      padding: '20px 20px 60px 20px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '520px',
        width: '100%',
        boxShadow: '0 8px 25px rgba(150, 32, 103, 0.15)',
        border: '3px solid #962067',
        textAlign: 'left'
      }}>
        <h1 style={{
          color: '#962067',
          fontSize: '26px',
          fontWeight: '700',
          margin: '0 0 16px 0'
        }}>
          Enter OTP
        </h1>
        <p style={{
          color: '#58595B',
          fontSize: '16px',
          lineHeight: '1.6',
          margin: '0 0 24px 0'
        }}>
          We sent a verification code to <strong>{maskedMobile || 'your mobile number'}</strong>.
          Please enter the OTP below to continue.
        </p>
        <form onSubmit={handleVerifyOtp}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
            One-Time Password (OTP)
          </label>
          <input
            type="tel"
            value={otpInput}
            onChange={(e) => setOtpInput(sanitizeMobileInput(e.target.value).slice(0, 6))}
            placeholder="Enter OTP"
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '12px',
              border: '2px solid #E5E5EA',
              fontSize: '16px',
              marginBottom: '16px',
              fontFamily: "'Poppins', sans-serif",
              letterSpacing: '4px',
              textAlign: 'center'
            }}
          />
          {otpError && (
            <div style={{ color: '#cc0000', marginBottom: '16px', fontWeight: 600 }}>
              {otpError}
            </div>
          )}
          <button
            type="submit"
            disabled={otpLoading}
            style={{
              width: '100%',
              background: otpLoading ? '#C3C3C3' : 'linear-gradient(135deg, #962067, #A23293)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '20px',
              cursor: otpLoading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              fontFamily: "'Poppins', sans-serif",
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 15px rgba(150, 32, 103, 0.2)',
              marginBottom: '12px'
            }}
          >
            {otpLoading ? 'Verifying...' : 'Verify & Continue'}
          </button>
        </form>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={otpLoading}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#962067',
              fontWeight: 600,
              cursor: otpLoading ? 'not-allowed' : 'pointer'
            }}
          >
            Resend OTP
          </button>
          <button
            type="button"
            onClick={handleChangeMobile}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#58595B',
              cursor: 'pointer'
            }}
          >
            Change mobile number
          </button>
        </div>
      </div>
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
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        © 2025 Kauvery Hospital. All rights reserved.
      </div>
    </div>
  );

  // Validate environment variables on startup
  useEffect(() => {
    const isValid = validateEnvironment();
    
    if (!isValid) {
      console.error('❌ App.js: Environment validation failed. Please check your .env file.');
    } else {
     
    }
  }, []);

  const getServerUrl = () => {
    return process.env.REACT_APP_SERVER_URL || 
           window.location.origin || 
           'https://kauverytelehealth.kauverykonnect.com';
  };

  const sanitizeMobileInput = (value = '') => value.replace(/\D/g, '').slice(0, 15);

  const clearConsultationSession = () => {
    sessionStorage.removeItem('consultationAccessToken');
    sessionStorage.removeItem('consultationLinkHash');
    setLinkHash('');
    setPrecheckId(null);
    setOtpInput('');
  };

  // Function to decrypt encoded ID parameter by calling Express server
  const decryptParameter = async (encodedText) => {
    try {
      const serverUrl = getServerUrl();
      const apiEndpoint = `${serverUrl}/api/decrypt`;
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: encodedText  // Make sure it's 'text', not 'encryptedText'
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ App.js: Server error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      return data.decryptedText;
    } catch (error) {
      console.error('❌ App.js: Decryption failed:', error);
      throw error;
    }
  };

  // Function to store appointment data in database
  const storeAppointmentData = async (appointmentData) => {
    try {
      // Prepare appointment data for storage
      const appointmentToStore = {
        app_no: appointmentData.app_no,
        username: appointmentData.username,
        userid: appointmentData.userid,
        roomID: appointmentData.app_no, // Temporary room ID (appointment number)
        doctorname: appointmentData.doctorname,
        speciality: appointmentData.speciality,
        appointment_date: appointmentData.appointment_date,
        appointment_time: appointmentData.appointment_time
        // appointment_date: "15/09/2025 00:00:00",
        // appointment_time: "15:30"
      };

      // Store appointment in database
      const result = await AppointmentService.storeAppointment(appointmentToStore);
      
      if (result.success) {
        setAppointmentStored(true);
        // Store appointment ID in session storage
        AppointmentService.setAppointmentId(result.appointment_id);
        
        // Update appointment state with stored data and correct room ID
        setAppointment({
          ...appointmentToStore,
          id: result.appointment_id,
          // roomId: result.appointment_id.toString() // Use just appointment ID as room ID
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

  // Update the getQueryParams function (around line 130)
  // Function to get query parameters
  const getQueryParams = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      // New encrypted parameters
      a: params.get("a"),        // app_no (Appointment number)
      un: params.get("un"),      // username (Patient Name)
      ui: params.get("ui"),      // userid (Patient id)
      d: params.get("d"),        // doctorname (Doctor Name)
      s: params.get("s"),        // speciality (Speciality)
      ad: params.get("ad"),      // appointment_date (Appointment Date)
      at: params.get("at"),      // appointment_time (Appointment Time)
      
      // Keep legacy parameters for backward compatibility
      app_no: params.get("app_no"),
      username: params.get("username"),
      userid: params.get("userid"),
      id: params.get("id"),
      token: params.get("token"),
      name: params.get("name"),
      date: params.get("date"),
      time: params.get("time"),
    };
  };

  // Batch decrypt function - Decrypt multiple parameters in a single request
  const batchDecryptParameters = async (paramMap) => {
    try {
      const serverUrl = getServerUrl();
      const consultationToken = sessionStorage.getItem('consultationAccessToken');
      const consultationLinkHash = sessionStorage.getItem('consultationLinkHash');
      const secureEndpointEnabled = Boolean(consultationToken && consultationLinkHash);
      const apiEndpoint = secureEndpointEnabled 
        ? `${serverUrl}/api/consultation/decrypt/batch`
        : `${serverUrl}/api/decrypt/batch`;
      
      // Prepare batch request - map parameter keys to encrypted texts
      const texts = Object.entries(paramMap)
        .filter(([key, value]) => value) // Only include non-empty values
        .map(([key, value]) => ({ key, text: value }));
      
      if (texts.length === 0) {
        return {};
      }
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(consultationToken ? { 'X-Consultation-Token': consultationToken } : {}),
          ...(consultationLinkHash ? { 'X-Consultation-Link': consultationLinkHash } : {})
        },
        body: JSON.stringify({ texts }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ App.js: Batch decrypt server error response:', errorText);
        if (response.status === 401 || response.status === 403) {
          const authError = new Error('Verification expired. Please request a new OTP.');
          authError.code = 'CONSULTATION_ACCESS_DENIED';
          throw authError;
        }
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Batch decryption failed');
      }
      
      // Map results back to parameter names
      const decryptedData = {};
      const paramMapping = {
        'a': 'app_no',
        'un': 'username',
        'ui': 'userid',
        'd': 'doctorname',
        's': 'speciality',
        'ad': 'appointment_date',
        'at': 'appointment_time'
      };
      
      Object.entries(data.results || {}).forEach(([key, value]) => {
        const mappedKey = paramMapping[key] || key;
        decryptedData[mappedKey] = value;
      });
      
      return decryptedData;
    } catch (error) {
      console.error('❌ App.js: Batch decryption failed:', error);
      throw error;
    }
  };

  // Add new function to decrypt multiple parameters using batch endpoint
  const processMultipleEncryptedParams = async (params) => {
    try {
      setIsDecrypting(true);
      setDecryptionError(null);
      
      // Prepare parameters map for batch decryption
      const paramMap = {};
      if (params.a) paramMap.a = params.a;
      if (params.un) paramMap.un = params.un;
      if (params.ui) paramMap.ui = params.ui;
      if (params.d) paramMap.d = params.d;
      if (params.s) paramMap.s = params.s;
      if (params.ad) paramMap.ad = params.ad;
      if (params.at) paramMap.at = params.at;
      
      // Decrypt all parameters in a single batch request
      const decryptedData = await batchDecryptParameters(paramMap);
      
      // Create appointment data object with all decrypted parameters
      const appointmentData = {
        app_no: decryptedData.app_no,
        username: decryptedData.username,
        userid: decryptedData.userid,
        doctorname: decryptedData.doctorname,
        speciality: decryptedData.speciality,
        appointment_date: decryptedData.appointment_date,
        appointment_time: decryptedData.appointment_time,
        // appointment_date: "15/09/2025 00:00:00",
        // appointment_time: "15:30",
        roomID: decryptedData.app_no
      };

      // Validate appointment date (24 hours window)
      // const dateValidation = validateAppointmentDate(appointmentData.appointment_date, appointmentData.appointment_time);
      
      // // Fix only the date formatting in the error message
      // if (!dateValidation.isValid) {
      //   // Format date properly for display - handle DD/MM/YYYY format
      //   let formattedDate;
      //   try {
      //     const dateOnly = appointmentData.appointment_date.split(' ')[0]; // Remove time
      //     const [day, month, year] = dateOnly.split('/');
      //     const dateObj = new Date(year, month - 1, day); // month is 0-indexed
      //     formattedDate = dateObj.toLocaleDateString();
      //   } catch (error) {
      //     // Fallback to original date string if parsing fails
      //     formattedDate = appointmentData.appointment_date.split(' ')[0];
      //   }
        
      //   setDecryptionError(`Access denied. Video consultation is only available on your appointment date. Your appointment is scheduled for ${formattedDate}.`);
      //   setIsDecrypting(false);
      //   setIsTokenValid(false);
      //   setDecryptionComplete(true);
      //   return;
      // }

      // Store appointment data in database
      await storeAppointmentData(appointmentData);

      // Create token and set as valid
      const videoToken = `video_${appointmentData.app_no || appointmentData.userid}`;
      sessionStorage.setItem("authToken", videoToken);
      sessionStorage.setItem("decryptedParams", JSON.stringify(appointmentData));
      setToken(videoToken);
      setIsTokenValid(true);
      setDecryptionComplete(true);
      setIsDecrypting(false);
      
    } catch (error) {
      console.error('❌ App.js: Failed to process multiple encrypted parameters:', error);
      if (error.code === 'CONSULTATION_ACCESS_DENIED') {
        clearConsultationSession();
        setOtpError('Your verification expired. Please request a new OTP.');
        setOtpStep('mobile');
        setIsDecrypting(false);
        setDecryptionComplete(false);
        setIsTokenValid(false);
        setDecryptionError(null);
        return;
      }
      setDecryptionError(error.message);
      setIsDecrypting(false);
      setIsTokenValid(false);
    }
  };

  const requestOtpForMobile = async () => {
    if (!encryptedParams) {
      setOtpError('Invalid consultation link. Please use the link shared via SMS/Email.');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    try {
      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/consultation/precheck`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: mobileInput,
          params: encryptedParams
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to send OTP. Please try again.');
      }

      setPrecheckId(data.precheckId);
      setMaskedMobile(data.maskedMobile || '');
      setAppointmentHint(data.appointmentHint || '');
      setOtpStep('otp');
      setOtpInput('');
      if (data.linkHash) {
        sessionStorage.setItem('consultationLinkHash', data.linkHash);
        setLinkHash(data.linkHash);
      }
      setOtpError('');
    } catch (error) {
      console.error('❌ OTP request failed:', error);
      setOtpError(error.message || 'Unable to send OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleSendOtp = async (event) => {
    event?.preventDefault();
    if (!mobileInput || mobileInput.length < 8) {
      setOtpError('Please enter the mobile number registered with Kauvery Hospital.');
      return;
    }
    await requestOtpForMobile();
  };

  const handleVerifyOtp = async (event) => {
    event?.preventDefault();
    if (!precheckId) {
      setOtpError('OTP session expired. Please request a new OTP.');
      return;
    }
    if (!otpInput || otpInput.length < 4) {
      setOtpError('Please enter the OTP sent to your mobile.');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    try {
      const serverUrl = getServerUrl();
      const response = await fetch(`${serverUrl}/api/consultation/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          precheckId,
          otp: otpInput
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Invalid OTP. Please try again.');
      }

      if (data.token) {
        sessionStorage.setItem('consultationAccessToken', data.token);
      }
      setOtpStep('verified');
      setOtpError('');
      setOtpInput('');
    } catch (error) {
      console.error('❌ OTP verification failed:', error);
      setOtpError(error.message || 'OTP verification failed. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    await requestOtpForMobile();
  };

  const handleChangeMobile = () => {
    clearConsultationSession();
    setMaskedMobile('');
    setMobileInput('');
    setOtpStep('mobile');
    setOtpError('');
  };

  // Simple and correct validateAppointmentDate function
  const validateAppointmentDate = (appointmentDate, appointmentTime) => {
    try {
      
      // Get current date in DD/MM/YYYY format (same as appointment date format)
      const today = new Date();
      const currentDay = today.getDate().toString().padStart(2, '0');
      const currentMonth = (today.getMonth() + 1).toString().padStart(2, '0');
      const currentYear = today.getFullYear();
      const currentDateString = `${currentDay}/${currentMonth}/${currentYear}`;
      
      // Get appointment date without time
      const appointmentDateString = appointmentDate.split(' ')[0]; // Remove " 00:00:00"
      
      // Simple string comparison
      const isOnAppointmentDate = currentDateString === appointmentDateString;
      
      return {
        isValid: isOnAppointmentDate,
        currentDate: currentDateString,
        appointmentDate: appointmentDateString
      };
    } catch (error) {
      console.error('❌ Error validating appointment date:', error);
      return {
        isValid: false,
        error: error.message
      };
    }
  };

  useEffect(() => {
    const params = getQueryParams();
    const hasNewEncryptedParams = params.a || params.un || params.ui || params.d || params.s || params.ad || params.at;

    if (hasNewEncryptedParams) {
      setEncryptedParams(params);
      setRequiresOtp(true);
      const storedToken = sessionStorage.getItem('consultationAccessToken');
      const storedLinkHash = sessionStorage.getItem('consultationLinkHash');
      if (storedLinkHash) {
        setLinkHash(storedLinkHash);
      }
      if (storedToken && storedLinkHash) {
        setOtpStep('verified');
      } else {
        clearConsultationSession();
        setOtpStep('mobile');
      }
      return;
    }

    setRequiresOtp(false);

    // Function to process encoded ID parameter (legacy)
    const processEncodedId = async (encryptedId) => {
      try {
        setIsDecrypting(true);
        setDecryptionError(null);
        
        // Decrypt the single encoded ID
        const decryptedId = await decryptParameter(encryptedId);
        
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
          roomID: appointmentId,
          doctorname: decryptedId.doctorname,
          speciality: decryptedId.speciality,
          appointment_date: decryptedId.appointment_date,
          appointment_time: decryptedId.appointment_time,
          // appointment_date: "15/09/2025 00:00:00",
          // appointment_time: "15:30",
        };

        // Validate appointment date (24 hours window)
        const dateValidation = validateAppointmentDate(appointmentData.appointment_date, appointmentData.appointment_time);
        
        if (!dateValidation.isValid) {
          const formattedDate = new Date(appointmentData.appointment_date).toLocaleDateString();
          setDecryptionError(`Access denied. Video consultation is only available within 24 hours of your appointment date. Your appointment is scheduled for ${formattedDate}.`);
          setIsDecrypting(false);
          setIsTokenValid(false);
          setDecryptionComplete(true);
          return;
        }

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
        
      } catch (error) {
        console.error('❌ App.js: Failed to process encoded ID:', error);
        setDecryptionError(error.message);
        setIsDecrypting(false);
        setIsTokenValid(false);
      }
    };

    // Function to process direct URL parameters (legacy)
    const processDirectParams = async (directParams) => {
      try {
        setIsDecrypting(true);
        setDecryptionError(null);
        
        // Create appointment data object with only the 3 required parameters + defaults
        const appointmentData = {
          app_no: directParams.app_no || directParams.appointment_id,
          username: directParams.username || directParams.name,
          userid: directParams.userid,
          // Set default values for other fields (hidden for now)
          roomID: directParams.app_no,
          doctorname: directParams.doctorname,
          speciality: directParams.speciality,
          appointment_date: directParams.date,
          appointment_time: directParams.time
          // appointment_date: "15/09/2025 00:00:00",
          // appointment_time: "15:30"
        };

        // Validate appointment date (24 hours window)
        const dateValidation = validateAppointmentDate(appointmentData.appointment_date, appointmentData.appointment_time);
        
        if (!dateValidation.isValid) {
          const formattedDate = new Date(appointmentData.appointment_date).toLocaleDateString();
          setDecryptionError(`Access denied. Video consultation is only available within 24 hours of your appointment date. Your appointment is scheduled for ${formattedDate}.`);
          setIsDecrypting(false);
          setIsTokenValid(false);
          setDecryptionComplete(true);
          return;
        }

        // Store appointment data in database
        await storeAppointmentData(appointmentData);

        // Create token and set as valid
        const videoToken = `video_${directParams.app_no || directParams.userid}`;
      sessionStorage.setItem("authToken", videoToken);
      setToken(videoToken);
      setIsTokenValid(true);
        setDecryptionComplete(true);
        setIsDecrypting(false);
        
      } catch (error) {
        console.error('❌ App.js: Failed to process direct parameters:', error);
        setDecryptionError(error.message);
        setIsDecrypting(false);
        setIsTokenValid(false);
      }
    };

    // Main processing logic - Check for encrypted parameter first (highest priority)
    if (params.id) {
      processEncodedId(params.id); // Pass the encrypted ID directly
    }
    // Check for video consultation parameters (direct parameters)
    else if (params.app_no || params.username || params.userid) {
      processDirectParams(params);
    } 
    // Check for original token
    else if (params.token) {
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
      } else {
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

  useEffect(() => {
    if (!requiresOtp) return;
    if (otpStep !== 'verified') return;
    if (!encryptedParams) return;
    processMultipleEncryptedParams(encryptedParams);
  }, [requiresOtp, otpStep, encryptedParams]);

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

  // Update the ErrorScreen component error detection logic
  const ErrorScreen = () => {
    // Determine the error type and message
    const isDateError = decryptionError && (
      decryptionError.includes('appointment date') || 
      decryptionError.includes('24 hours') ||
      decryptionError.includes('scheduled for')
    );
    const isParameterError = decryptionError && decryptionError.includes('Invalid appointment parameters');
    
    let errorMessage = '';
    let errorTitle = 'Access Denied';
    
    if (isDateError) {
      errorTitle = 'Access Denied';
      errorMessage = decryptionError; // Use the full date error message with formatted date
    } else if (isParameterError) {
      errorTitle = 'Access Denied';
      errorMessage = decryptionError;
    } else {
      errorTitle = 'Access Denied';
      errorMessage = 'We couldn\'t verify your consultation request.\nPlease ensure you are using the correct link provided by Kauvery Hospital.';
    }

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'white',
        color: '#962067',
        fontFamily: "'Poppins', sans-serif",
        textAlign: 'center',
        padding: '20px 20px 60px 20px', // Add bottom padding for footer
        boxSizing: 'border-box',
        overflow: 'hidden' // Prevent scroll bar
      }}>
        <div style={{
          background: 'white',
          borderRadius: '20px',
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
            {errorTitle}
          </h1>
          
          <p style={{
            color: '#58595B',
            fontSize: '16px',
            lineHeight: '1.6',
            margin: '0 0 24px 0',
            fontFamily: "'Poppins', sans-serif",
            whiteSpace: 'pre-line'
          }}>
            {errorMessage}
          </p>
          
          <button 
            onClick={() => window.location.reload()} 
            style={{
              background: 'linear-gradient(135deg, #962067, #A23293)',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              fontFamily: "'Poppins', sans-serif",
              transition: 'all 0.3s ease',
              boxShadow: '0 4px 15px rgba(150, 32, 103, 0.2)'
            }}
            onMouseOver={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 20px rgba(150, 32, 103, 0.3)';
            }}
            onMouseOut={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 15px rgba(150, 32, 103, 0.2)';
            }}
          >
            Try Again
          </button>
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
          height: '48px', // Fixed height
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          © 2025 Kauvery Hospital. All rights reserved.
        </div>
      </div>
    );
  };

  // Update the main Access Denied page (around line 600)
  // Show original Access Denied page if no valid parameters
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
            ) : requiresOtp && otpStep !== 'verified' ? (
              otpStep === 'otp' ? renderOtpVerificationScreen() : renderOtpMobileScreen()
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
                padding: '20px 20px 60px 20px', // Add bottom padding for footer
                boxSizing: 'border-box',
                overflow: 'hidden' // Prevent scroll bar
              }}>
                <div style={{
                  background: 'white',
                  borderRadius: '20px',
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
                    margin: '0 0 24px 0',
                    fontFamily: "'Poppins', sans-serif"
                  }}>
                    We couldn't verify your consultation request.<br/>
                    Please ensure you are using the correct link provided by Kauvery Hospital.
                  </p>
                  
                  <button 
                    onClick={() => window.location.reload()} 
                    style={{
                      background: 'linear-gradient(135deg, #962067, #A23293)',
                      color: 'white',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: '600',
                      fontFamily: "'Poppins', sans-serif",
                      transition: 'all 0.3s ease',
                      boxShadow: '0 4px 15px rgba(150, 32, 103, 0.2)'
                    }}
                    onMouseOver={(e) => {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 6px 20px rgba(150, 32, 103, 0.3)';
                    }}
                    onMouseOut={(e) => {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 4px 15px rgba(150, 32, 103, 0.2)';
                    }}
                  >
                    Try Again
                  </button>
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
                  height: '48px', // Fixed height
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  © 2025 Kauvery Hospital. All rights reserved.
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