import React, { useState } from 'react';
import videoCallService from '../services/videoCallService';

const VideoCallManager = () => {
  const [appointmentData, setAppointmentData] = useState({
    appointment_id: '',
    appointment_number: '',
    patient_name: '',
    doctor_name: '',
    user_id: '',
    appointment_time: new Date().toISOString()
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setAppointmentData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Create video call session
  const handleCreateVideoCall = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Generate user ID if not provided
      const dataToSend = {
        ...appointmentData,
        user_id: appointmentData.user_id || `user_${Date.now()}`
      };

      const result = await videoCallService.initiateVideoCall(dataToSend);
      setResult(result);
      
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Copy video call URL to clipboard
  const copyToClipboard = (url) => {
    navigator.clipboard.writeText(url).then(() => {
      alert('Video call URL copied to clipboard!');
    });
  };

  return (
    <div style={{
      maxWidth: '800px',
      margin: '50px auto',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ color: '#8B5CF6', textAlign: 'center', marginBottom: '30px' }}>
        Video Call Manager
      </h1>

      {/* Appointment Data Form */}
      <div style={{
        background: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3 style={{ marginBottom: '15px', color: '#333' }}>Appointment Information</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Appointment ID:
            </label>
            <input
              type="text"
              name="appointment_id"
              value={appointmentData.appointment_id}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
              placeholder="Enter appointment ID"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Appointment Number:
            </label>
            <input
              type="text"
              name="appointment_number"
              value={appointmentData.appointment_number}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
              placeholder="Enter appointment number"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Patient Name:
            </label>
            <input
              type="text"
              name="patient_name"
              value={appointmentData.patient_name}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
              placeholder="Enter patient name"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Doctor Name:
            </label>
            <input
              type="text"
              name="doctor_name"
              value={appointmentData.doctor_name}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
              placeholder="Enter doctor name"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              User ID (optional):
            </label>
            <input
              type="text"
              name="user_id"
              value={appointmentData.user_id}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
              placeholder="Auto-generated if empty"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Appointment Time:
            </label>
            <input
              type="datetime-local"
              name="appointment_time"
              value={appointmentData.appointment_time.slice(0, 16)}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>
        </div>

        <button
          onClick={handleCreateVideoCall}
          disabled={loading || !appointmentData.appointment_number || !appointmentData.patient_name}
          style={{
            marginTop: '15px',
            padding: '12px 24px',
            background: loading ? '#ccc' : '#8B5CF6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {loading ? 'Creating Video Call...' : 'Create Video Call'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          background: '#fee',
          color: '#c33',
          padding: '15px',
          borderRadius: '6px',
          marginBottom: '20px',
          border: '1px solid #fcc'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Result Display */}
      {result && (
        <div style={{
          background: '#e8f5e8',
          padding: '20px',
          borderRadius: '8px',
          border: '1px solid #4caf50'
        }}>
          <h3 style={{ color: '#2e7d32', marginBottom: '15px' }}>
            ✅ Video Call Created Successfully!
          </h3>
          
          <div style={{ marginBottom: '15px' }}>
            <strong>Session ID:</strong> {result.sessionId}
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <strong>Video Call URL:</strong>
            <div style={{
              background: 'white',
              padding: '10px',
              borderRadius: '4px',
              border: '1px solid #ddd',
              marginTop: '5px',
              wordBreak: 'break-all'
            }}>
              {result.videoCallURL}
            </div>
            <button
              onClick={() => copyToClipboard(result.videoCallURL)}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              📋 Copy URL
            </button>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <strong>Appointment Details:</strong>
            <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
              <li>Appointment Number: {result.appointmentData.appointment_number}</li>
              <li>Patient: {result.appointmentData.patient_name}</li>
              <li>Doctor: {result.appointmentData.doctor_name}</li>
              <li>User ID: {result.appointmentData.user_id}</li>
            </ul>
          </div>

          <div style={{
            background: '#fff3cd',
            padding: '10px',
            borderRadius: '4px',
            border: '1px solid #ffeaa7'
          }}>
            <strong>Next Steps:</strong>
            <ol style={{ marginTop: '5px', paddingLeft: '20px' }}>
              <li>Copy the video call URL</li>
              <li>Send it to the patient via SMS/Email</li>
              <li>Patient clicks the link to join the video call</li>
              <li>Video call opens with Zego integration</li>
            </ol>
          </div>
        </div>
      )}

      {/* API Endpoints Info */}
      <div style={{
        background: '#f0f8ff',
        padding: '20px',
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <h3 style={{ color: '#0066cc', marginBottom: '15px' }}>API Endpoints Used:</h3>
        <ul style={{ paddingLeft: '20px' }}>
          <li><strong>POST /video-call/create</strong> - Creates video call session</li>
          <li><strong>PUT /video-call/{'{sessionId}'}/status</strong> - Updates call status</li>
          <li><strong>GET /video-call/{'{sessionId}'}</strong> - Gets session details</li>
        </ul>
      </div>
    </div>
  );
};

export default VideoCallManager; 