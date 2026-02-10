/* eslint-disable no-unused-vars, react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import VideoConsultation from "./components/VideoConsultation";
import ConsultationHeader from "./components/ConsultationHeader";
import ConsultationFooter from "./components/ConsultationFooter";
import AppointmentService from "./utils/appointmentService";
import { theme } from "./theme/colors";

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
  const [doctorInfo, setDoctorInfo] = useState({ name: '', speciality: '', appointment_date: '', appointment_time: '' });
  const [encryptedParams, setEncryptedParams] = useState(null);
  const [linkHash, setLinkHash] = useState('');
  const [resendCooldownRemaining, setResendCooldownRemaining] = useState(0);
  const [isOtpInputFocused, setIsOtpInputFocused] = useState(false);
  const otpInputRef = useRef(null);
  const postOtpDecryptStartedRef = useRef(false);

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
      return false;
    }
    
    return true;
  };

  const renderOtpMobileScreen = () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100vh',
      background: theme.pageBg,
      fontFamily: "'Poppins', sans-serif",
      padding: '70px 20px 90px 20px',
      boxSizing: 'border-box',
      overflowY: 'auto'
    }}>
      <ConsultationHeader />
      
      {renderDoctorCard()}

      <div style={{
        background: theme.cardBg,
        borderRadius: '30px',
        padding: '40px',
        width: '100%',
        maxWidth: '450px',
        boxShadow: '0 10px 40px rgba(150, 32, 103, 0.08)',
        textAlign: 'center'
      }}>
        <h2 style={{ color: '#962067', fontSize: '28px', fontWeight: '800', margin: '0 0 15px 0' }}>Identity Verification</h2>
        <p style={{ color: '#777', fontSize: '14px', lineHeight: '1.5', margin: '0 auto 30px', maxWidth: '320px' }}>
          To ensure your privacy and security during this consultation, please verify your registered mobile number.
        </p>

        <form onSubmit={handleSendOtp} style={{ textAlign: 'left' }}>
          <label style={{ display: 'block', color: '#aaa', fontSize: '11px', fontWeight: '700', marginBottom: '10px', letterSpacing: '0.5px' }}>
            REGISTERED MOBILE NUMBER
          </label>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            border: '1px solid #eee', 
            borderRadius: '12px',
            padding: '5px 15px',
            marginBottom: '25px',
            background: 'white'
          }}>
            <span style={{ color: '#962067', fontWeight: '700', fontSize: '16px', marginRight: '10px', borderRight: '1px solid #eee', paddingRight: '10px' }}>+91</span>
            <input
              type="tel"
              value={mobileInput}
              onChange={(e) => setMobileInput(sanitizeMobileInput(e.target.value))}
              placeholder="Enter 10-digit number"
              style={{
                flex: 1,
                border: 'none',
                padding: '12px 0',
                fontSize: '16px',
                outline: 'none',
                color: '#444',
                fontWeight: '600'
              }}
            />
          </div>

          {otpError && (
            <div style={{ color: '#e91e63', fontSize: '13px', marginBottom: '15px', textAlign: 'center', fontWeight: '600' }}>
              {otpError}
            </div>
          )}

          <button
            type="submit"
            disabled={otpLoading || mobileInput.length < 10}
            style={{
              width: '100%',
              background: (otpLoading || mobileInput.length < 10) ? '#b0b0b0' : '#962067',
              color: 'white',
              border: 'none',
              padding: '16px',
              borderRadius: '12px',
              cursor: (otpLoading || mobileInput.length < 10) ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'all 0.3s ease'
            }}
          >
            {otpLoading ? 'Processing...' : 'Get Access Code'}
            {!otpLoading && <span style={{ fontSize: '20px' }}>→</span>}
          </button>
        </form>

        <div style={{ marginTop: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={{ width: '40px', height: '1px', background: '#eee' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#bbb', fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            HIPAA COMPLIANT PROTOCOL
          </div>
          <div style={{ width: '40px', height: '1px', background: '#eee' }}></div>
        </div>
      </div>

      <ConsultationFooter />
    </div>
  );

  const renderOtpVerificationScreen = () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100vh',
      background: theme.pageBg,
      fontFamily: "'Poppins', sans-serif",
      padding: '70px 20px 90px 20px',
      boxSizing: 'border-box',
      overflowY: 'auto'
    }}>
      <ConsultationHeader />
      
      {renderDoctorCard()}

      <div style={{
        background: theme.cardBg,
        borderRadius: '30px',
        padding: '40px',
        width: '100%',
        maxWidth: '450px',
        boxShadow: '0 10px 40px rgba(150, 32, 103, 0.08)',
        textAlign: 'center'
      }}>
        <h2 style={{ color: '#962067', fontSize: '28px', fontWeight: '800', margin: '0 0 15px 0' }}>Enter Access Code</h2>
        <p style={{ color: '#777', fontSize: '14px', lineHeight: '1.5', margin: '0 auto 30px', maxWidth: '350px' }}>
          Please enter the secure code sent to <strong style={{ color: '#444' }}>+91 {mobileInput}</strong> to join your call. 
          <span onClick={handleChangeMobile} style={{ color: '#e91e63', fontWeight: '800', fontSize: '11px', marginLeft: '8px', cursor: 'pointer', textDecoration: 'underline' }}>CHANGE NUMBER</span>
        </p>

        <form onSubmit={handleVerifyOtp} style={{ textAlign: 'left' }}>
          <label style={{ display: 'block', color: '#aaa', fontSize: '11px', fontWeight: '700', marginBottom: '15px', letterSpacing: '0.5px', textAlign: 'center' }}>
            ONE-TIME PASSWORD
          </label>
          
          <div
            role="button"
            tabIndex={0}
            onClick={() => otpInputRef.current?.focus()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); otpInputRef.current?.focus(); } }}
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '10px',
              marginBottom: '30px',
              cursor: 'text',
              position: 'relative',
              outline: 'none'
            }}
            aria-label="Enter OTP - click to focus input"
          >
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{
                width: '45px',
                height: '55px',
                border: '2px solid ' + (isOtpInputFocused ? '#962067' : '#f0f0f0'),
                borderRadius: '12px',
                background: '#fafafa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: '700',
                color: '#962067',
                transition: 'border-color 0.2s'
              }}>
                {otpInput[i] ? otpInput[i] : <div style={{ width: '6px', height: '6px', background: '#ddd', borderRadius: '50%' }} />}
                {otpInput.length === i && <div style={{ width: '2px', height: '24px', background: '#962067', animation: 'blink 1s infinite' }} />}
              </div>
            ))}
            <input
              ref={otpInputRef}
              type="tel"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={otpInput}
              onChange={(e) => setOtpInput(sanitizeOtpInput(e.target.value))}
              onFocus={() => setIsOtpInputFocused(true)}
              onBlur={() => setIsOtpInputFocused(false)}
              onPaste={(e) => {
                e.preventDefault();
                const pasted = sanitizeOtpInput((e.clipboardData?.getData('text') || '').slice(0, 6));
                setOtpInput(pasted);
              }}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                opacity: 0,
                width: '100%',
                height: '100%',
                margin: 0,
                padding: 0,
                border: 'none',
                outline: 'none'
              }}
              aria-label="OTP input"
              maxLength={6}
            />
          </div>

          {otpError && (
            <div style={{ color: '#e91e63', fontSize: '13px', marginBottom: '15px', textAlign: 'center', fontWeight: '600' }}>
              {otpError}
            </div>
          )}

          <button
            type="submit"
            disabled={otpLoading || otpInput.length < 6}
            onClick={() => console.log('[Consultation] Join button clicked (submit will follow)')}
            style={{
              width: '100%',
              background: (otpLoading || otpInput.length < 6) ? '#b0b0b0' : '#962067',
              color: 'white',
              border: 'none',
              padding: '16px',
              borderRadius: '12px',
              cursor: (otpLoading || otpInput.length < 6) ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '700',
              transition: 'all 0.3s ease',
              marginBottom: '20px'
            }}
          >
            {otpLoading ? 'Verifying...' : 'Join Consultation Room'}
          </button>
        </form>

        <div style={{ color: '#bbb', fontSize: '11px', fontWeight: '700' }}>
          {resendCooldownRemaining > 0 ? (
            <>RESEND CODE IN <span style={{ color: '#962067' }}>{resendCooldownRemaining}S</span></>
          ) : (
            <span
              onClick={() => !otpLoading && resendCooldownRemaining === 0 && handleResendOtp()}
              style={{
                color: '#962067',
                cursor: otpLoading ? 'not-allowed' : 'pointer',
                textDecoration: 'underline'
              }}
            >
              RESEND CODE
            </span>
          )}
        </div>

        <div style={{ marginTop: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={{ width: '40px', height: '1px', background: '#eee' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#bbb', fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            HIPAA COMPLIANT PROTOCOL
          </div>
          <div style={{ width: '40px', height: '1px', background: '#eee' }}></div>
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
      
      <ConsultationFooter />
    </div>
  );

  const renderVerifiedScreen = () => (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100vh',
      background: theme.pageBg,
      fontFamily: "'Poppins', sans-serif",
      padding: '70px 20px 90px 20px',
      boxSizing: 'border-box',
      overflowY: 'auto'
    }}>
      <ConsultationHeader />
      
      {renderDoctorCard()}

      <div style={{
        background: theme.cardBg,
        borderRadius: '30px',
        padding: '50px 40px',
        width: '100%',
        maxWidth: '450px',
        boxShadow: '0 10px 40px rgba(150, 32, 103, 0.08)',
        textAlign: 'center'
      }}>
        <div style={{
          width: '100px',
          height: '100px',
          background: 'linear-gradient(135deg, #ff9800, #f44336)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 30px',
          boxShadow: '0 10px 20px rgba(255, 152, 0, 0.3)'
        }}>
          <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>

        <h2 style={{ color: '#962067', fontSize: '32px', fontWeight: '800', margin: '0 0 15px 0' }}>Verified!</h2>
        <p style={{ color: '#777', fontSize: '15px', lineHeight: '1.5', margin: '0 auto 40px', maxWidth: '300px' }}>
          Thank you for verifying. Your <span style={{ color: '#e91e63', fontWeight: '700' }}>Secure Consultation</span> is starting now.
        </p>

        <div style={{
          background: '#fcf8fa',
          borderRadius: '15px',
          padding: '20px',
          width: '100%',
          boxSizing: 'border-box',
          marginBottom: '30px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '15px' }}>
            <div style={{ width: '8px', height: '8px', background: '#e91e63', borderRadius: '50%', animation: 'pulse 1.5s infinite' }}></div>
            <div style={{ color: '#962067', fontSize: '11px', fontWeight: '800', letterSpacing: '1px' }}>CONNECTING TO VIDEO SERVER...</div>
          </div>
          <div style={{
            height: '6px',
            background: '#eee',
            borderRadius: '3px',
            overflow: 'hidden',
            width: '100%'
          }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, #962067, #e91e63)',
              width: '60%',
              borderRadius: '3px',
              animation: 'progress 2s ease-in-out infinite'
            }}></div>
          </div>
        </div>

        <p style={{ color: '#aaa', fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px', margin: 0 }}>
          PLEASE ALLOW CAMERA AND MICROPHONE ACCESS WHEN PROMPTED.
        </p>

        {encryptedParams && (
          <button
            type="button"
            onClick={() => processMultipleEncryptedParams(encryptedParams)}
            style={{
              width: '100%',
              marginTop: '24px',
              background: 'linear-gradient(135deg, #962067, #e91e63)',
              color: 'white',
              border: 'none',
              padding: '14px 24px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '700',
              transition: 'all 0.3s ease',
              boxShadow: '0 2px 8px rgba(150, 32, 103, 0.25)'
            }}
          >
            Enter video room
          </button>
        )}

        <div style={{ marginTop: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={{ width: '40px', height: '1px', background: '#eee' }}></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#bbb', fontSize: '10px', fontWeight: '700', letterSpacing: '0.5px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            HIPAA COMPLIANT PROTOCOL
          </div>
          <div style={{ width: '40px', height: '1px', background: '#eee' }}></div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.8); opacity: 0.5; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0.8); opacity: 0.5; }
        }
        @keyframes progress {
          0% { width: 10%; }
          50% { width: 80%; }
          100% { width: 100%; }
        }
      `}</style>
      
      <ConsultationFooter />
    </div>
  );

  // Validate environment variables on startup
  useEffect(() => {
    const isValid = validateEnvironment();
    
    if (!isValid) {
      // Environment validation failed
    } else {
     
    }
  }, []);

  // Use relative path when no explicit server URL (production build) so API always hits same origin
  const getServerUrl = () => {
    const env = process.env.REACT_APP_SERVER_URL || '';
    if (env && typeof env === 'string' && env.startsWith('http')) return env.replace(/\/$/, '');
    return '';
  };

  const apiUrl = (path) => {
    const base = getServerUrl();
    return base ? `${base}${path.startsWith('/') ? path : '/' + path}` : path;
  };

  const sanitizeMobileInput = (value = '') => value.replace(/\D/g, '').slice(0, 10);
  // VAPT: OTP input - digits only, max 6 chars, prevent injection
  const sanitizeOtpInput = (value = '') => String(value).replace(/\D/g, '').slice(0, 6);

  // Format appointment date and time for display (from API)
  const formatAppointmentDateTime = (dateStr, timeStr) => {
    if (!dateStr && !timeStr) return '';
    const datePart = dateStr ? String(dateStr).split(' ')[0] : ''; // DD/MM/YYYY
    const timePart = timeStr ? String(timeStr).trim() : '';
    if (!datePart && !timePart) return '';
    if (datePart && timePart) return `${datePart}, ${timePart}`;
    return datePart || timePart;
  };


  const renderDoctorCard = () => (
    <div style={{
      background: theme.cardBg,
      borderRadius: '15px',
      padding: '15px 25px',
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
      boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
      marginBottom: '20px',
      width: '100%',
      maxWidth: '450px',
      border: '1px solid #f0f0f0'
    }}>
      <div style={{
        width: '45px',
        height: '45px',
        background: '#f8f0f5',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#962067'
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 7l-7 5 7 5V7z"></path><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: '700', color: '#444', fontSize: '15px' }}>{doctorInfo.name || '—'}</div>
        <div style={{ color: '#888', fontSize: '12px' }}>{doctorInfo.speciality || '—'}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ color: '#e91e63', fontSize: '10px', fontWeight: '800', letterSpacing: '0.5px' }}>LIVE NOW</div>
        <div style={{ color: '#444', fontSize: '11px', fontWeight: '600' }}>{formatAppointmentDateTime(doctorInfo.appointment_date, doctorInfo.appointment_time) || '—'}</div>
      </div>
    </div>
  );

  const clearConsultationSession = () => {
    sessionStorage.removeItem('consultationAccessToken');
    sessionStorage.removeItem('consultationLinkHash');
    setLinkHash('');
    setPrecheckId(null);
    setOtpInput('');
    postOtpDecryptStartedRef.current = false;
  };

  // Function to decrypt encoded ID parameter by calling Express server
  const decryptParameter = async (encodedText) => {
    try {
      const response = await fetch(apiUrl('/api/decrypt'), {
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
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      return data.decryptedText;
    } catch (error) {
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
      }
      
      return result;
    } catch (error) {
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
      const consultationToken = sessionStorage.getItem('consultationAccessToken');
      const consultationLinkHash = sessionStorage.getItem('consultationLinkHash');
      const secureEndpointEnabled = Boolean(consultationToken && consultationLinkHash);
      const apiEndpoint = apiUrl(secureEndpointEnabled ? '/api/consultation/decrypt/batch' : '/api/decrypt/batch');

      const texts = Object.entries(paramMap)
        .filter(([key, value]) => value)
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
        console.error('[Consultation] Batch decrypt failed:', response.status, errorText);
        if (response.status === 401 || response.status === 403) {
          const authError = new Error('Verification expired. Please request a new OTP.');
          authError.code = 'CONSULTATION_ACCESS_DENIED';
          throw authError;
        }
        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
      }

      let data;
      try {
        data = await response.json();
      } catch (parseErr) {
        console.error('[Consultation] Batch decrypt: invalid JSON response');
        throw new Error('Invalid server response. Please try again.');
      }

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
      console.error('[Consultation] batchDecryptParameters error:', error.message, error);
      throw error;
    }
  };

  // Add new function to decrypt multiple parameters using batch endpoint
  const processMultipleEncryptedParams = async (params) => {
    if (postOtpDecryptStartedRef.current) return;
    postOtpDecryptStartedRef.current = true;
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
      if (error.code === 'CONSULTATION_ACCESS_DENIED') {
        clearConsultationSession();
        setOtpError('Your verification expired. Please request a new OTP.');
        setOtpStep('mobile');
        setIsDecrypting(false);
        setDecryptionComplete(false);
        setIsTokenValid(false);
        setDecryptionError(null);
        postOtpDecryptStartedRef.current = false;
        return;
      }
      console.error('[Consultation] processMultipleEncryptedParams error:', error.message, error);
      setDecryptionError(error.message);
      setIsDecrypting(false);
      setIsTokenValid(false);
      postOtpDecryptStartedRef.current = false;
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
      const response = await fetch(apiUrl('/api/consultation/precheck'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: mobileInput,
          params: encryptedParams
        })
      });
      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (_) {
        throw new Error('Server error. Please try again.');
      }
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to send OTP. Please try again.');
      }

      setPrecheckId(data.precheckId);
      setMaskedMobile(data.maskedMobile || '');
      setAppointmentHint(data.appointmentHint || '');
      setOtpStep('otp');
      setOtpInput('');
      setResendCooldownRemaining(data.resendCooldownSeconds ?? 30);
      if (data.linkHash) {
        sessionStorage.setItem('consultationLinkHash', data.linkHash);
        setLinkHash(data.linkHash);
      }
      setOtpError('');
      otpInputRef.current?.focus();
    } catch (error) {
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
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    console.log('[Consultation] Join Consultation Room clicked');
    if (!precheckId) {
      setOtpError('OTP session expired. Please request a new OTP.');
      console.warn('[Consultation] No precheckId');
      return;
    }
    if (!otpInput || otpInput.length < 6) {
      setOtpError('Please enter the complete 6-digit OTP sent to your mobile.');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    const verifyUrl = apiUrl('/api/consultation/verify-otp');
    try {
      console.log('[Consultation] Verifying OTP at', verifyUrl);
      const response = await fetch(verifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          precheckId,
          otp: otpInput
        })
      });
      let data;
      try {
        data = await response.json();
      } catch (parseErr) {
        console.error('[Consultation] verify-otp: response not JSON. Status:', response.status, parseErr?.message);
        throw new Error('Server returned an invalid response. Please try again.');
      }
      if (!response.ok || !data.success) {
        console.error('[Consultation] verify-otp failed:', response.status, data);
        throw new Error(data.message || 'Invalid OTP. Please try again.');
      }

      if (data.token) {
        sessionStorage.setItem('consultationAccessToken', data.token);
      }
      setOtpStep('verified');
      setOtpError('');
      setOtpInput('');
      console.log('[Consultation] OTP verified, starting post-OTP flow');
      if (encryptedParams) {
        processMultipleEncryptedParams(encryptedParams);
      }
    } catch (error) {
      console.error('[Consultation] handleVerifyOtp error:', error.message, error);
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

  // Resend OTP countdown timer (seconds from backend precheck response)
  useEffect(() => {
    if (otpStep !== 'otp' || resendCooldownRemaining <= 0) return;
    const t = setInterval(() => {
      setResendCooldownRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [otpStep, resendCooldownRemaining]);

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
      
      // Try to decrypt doctor and appointment info early for the UI
      if (params.d || params.s || params.ad || params.at) {
        const decryptDoctorInfo = async () => {
          try {
            const info = {};
            if (params.d) info.name = await decryptParameter(params.d);
            if (params.s) info.speciality = await decryptParameter(params.s);
            if (params.ad) info.appointment_date = await decryptParameter(params.ad);
            if (params.at) info.appointment_time = await decryptParameter(params.at);
            setDoctorInfo(prev => ({ ...prev, ...info }));
          } catch (e) {
          }
        };
        decryptDoctorInfo();
      }

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
      backgroundColor: theme.pageBg,
      fontFamily: "'Poppins', sans-serif"
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
        backgroundColor: theme.cardBg,
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
        background: theme.pageBg,
        color: theme.primary,
        fontFamily: "'Poppins', sans-serif",
        textAlign: 'center',
        padding: '20px 20px 90px 20px',
        boxSizing: 'border-box',
        overflowY: 'auto'
      }}>
        <div style={{
          background: theme.cardBg,
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
            ) : requiresOtp && otpStep === 'verified' && !decryptionComplete ? (
              renderVerifiedScreen()
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
                background: theme.cardBg,
                color: '#962067',
                fontFamily: "'Poppins', sans-serif",
                textAlign: 'center',
                padding: '20px 20px 90px 20px',
                boxSizing: 'border-box',
                overflowY: 'auto'
              }}>
                <div style={{
                  background: theme.cardBg,
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