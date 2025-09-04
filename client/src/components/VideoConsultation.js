import React, { useState, useEffect, useRef, Component } from 'react';
import logoImage from '../assets/25YearsLogo.png';
import './VideoConsultation.css';
import AppointmentService from '../utils/appointmentService';

// Helper function to get Zego credentials from environment variables
const getZegoCredentials = () => {
  console.log('🔍 Debug: Environment variables check:');
  console.log('🔍 REACT_APP_ZEGO_APP_ID:', process.env.REACT_APP_ZEGO_APP_ID);
  console.log('🔍 REACT_APP_ZEGO_SERVER_SECRET:', process.env.REACT_APP_ZEGO_SERVER_SECRET ? '***exists***' : 'undefined');
  console.log('🔍 All REACT_APP_ variables:', Object.keys(process.env).filter(key => key.startsWith('REACT_APP_')));
  
  return {
    appId: process.env.REACT_APP_ZEGO_APP_ID,
    serverSecret: process.env.REACT_APP_ZEGO_SERVER_SECRET
  };
};
// Error Boundary to catch DOM conflicts
class VideoErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.warn('🛡️ Error Boundary caught error:', error);
    
    // If it's any DOM-related error, prevent it from crashing the app
    if (error.message && (
      error.message.includes('removeChild') ||
      error.message.includes('appendChild') ||
      error.message.includes('insertBefore') ||
      error.message.includes('replaceChild') ||
      error.message.includes('Node') ||
      error.message.includes('DOM') ||
      error.message.includes('NotFoundError')
    )) {
      console.warn('🛡️ Preventing DOM error from crashing the app');
      
      // Try to recover by forcing a re-render
      setTimeout(() => {
        this.setState({ hasError: false });
      }, 500);
      
      return;
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          background: '#f8f9fa',
          borderRadius: '8px',
          margin: '20px'
        }}>
          <h3>Video Interface Error</h3>
          <p>There was an issue with the video interface. Please refresh the page.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              background: '#007bff',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Isolated Zego Component to prevent DOM conflicts
const ZegoVideoInterface = ({ containerRef, isInitialized, initializationError, appointmentData, onRetry, showLeaveRoomPopup, onConfirmLeaveRoom, onCancelLeaveRoom }) => {
  // Use React.useMemo to prevent unnecessary re-renders that might cause DOM conflicts
        const containerStyle = React.useMemo(() => ({
        width: '100vw', // Full viewport width
        height: 'calc(100vh - 70px - 40px)', // Full height minus header/footer
        background: 'white', // White background
        borderRadius: 0, // No border radius
        overflow: 'hidden', // Prevent overflow
        marginTop: '70px', // Top margin for header
        marginLeft: '0', // No left margin
        marginRight: '0', // No right margin
        position: 'relative',
        minHeight: 'calc(100vh - 110px)', // Minimum height
        maxHeight: 'calc(100vh - 110px)', // Maximum height
        isolation: 'isolate',
        display: 'block', // Single column layout
        boxShadow: 'none', // No shadow
        border: 'none', // No border
        padding: '0', // No padding
        // Responsive design for different screen sizes
        '@media (max-width: 768px)': {
          marginTop: '60px',
          height: 'calc(100vh - 60px - 40px)',
          minHeight: 'calc(100vh - 100px)',
          maxHeight: 'calc(100vh - 100px)',
          padding: '0'
        }
      }), []);

  try {
    return (
    <div 
      ref={containerRef}
      style={containerStyle}
    >
      {/* Debug info */}
      {/* <div style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        background: 'rgba(0,0,0,0.8)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '8px',
        fontSize: '12px',
        zIndex: 1000,
        fontFamily: 'monospace'
      }}> */}
        {/* Zego: {isInitialized ? '✅' : '⏳'} | 
        Error: {initializationError ? '❌' : '✅'} | 
        Container: {containerRef.current ? '✅' : '❌'} */}
      {/* </div> */}



      {/* Leave Room Popup - Inside video container */}
      {showLeaveRoomPopup && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            border: '2px solid #EE2D67'
          }}>
            <h2 style={{
              color: '#962067',
              fontSize: '24px',
              fontWeight: 700,
              margin: '0 0 16px 0',
              fontFamily: "'Poppins', sans-serif"
            }}>
              Leave the room
            </h2>
            
            <p style={{
              color: '#58595B',
              fontSize: '16px',
              lineHeight: 1.6,
              margin: '0 0 24px 0'
            }}>
              Are you sure to leave the room?
            </p>
            
            <div style={{
              display: 'flex',
              gap: '16px',
              justifyContent: 'center'
            }}>
              <button 
                onClick={onCancelLeaveRoom}
                style={{
                  background: '#eeeeee',
                  color: '#58595B',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  minWidth: '100px'
                }}
              >
                Cancel
              </button>
              
              <button 
                onClick={() => {
                  console.log('🔴 Confirm button clicked!');
                  alert('Confirm button clicked! Health packages page should appear now.');
                  onConfirmLeaveRoom();
                }}
                style={{
                  background: '#962067',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  minWidth: '100px',
                  boxShadow: '0 4px 12px rgba(150, 32, 103, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#7a1a52';
                  e.target.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#962067';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fallback content while Zego loads or error state */}
      {!isInitialized && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: '#A23293',
          textAlign: 'center',
          zIndex: 1,
          maxWidth: '400px',
          padding: '20px'
        }}>
          <div style={{
            width: '96px',
            height: '48px',
            background: 'transparent',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            overflow: 'hidden'
          }}>
            <img 
              src={logoImage} 
              alt="Kauvery Hospital Logo" 
              style={{
                width: '100%',
                height: '100%',
                // objectFit: 'contain'
              }}
            />
          </div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>Kauvery Hospital</h3>
          {initializationError ? (
            <div>
              <p style={{ margin: '0 0 12px 0', opacity: 0.9, color: '#ffcdd2' }}>
                Connection Error
              </p>
              <p style={{ margin: '0 0 16px 0', fontSize: '14px', opacity: 0.8 }}>
                {initializationError}
              </p>
              <button 
                onClick={onRetry}
                style={{
                  background: 'linear-gradient(135deg, #FDB913, #EE2D67)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                🔄 Retry Connection
              </button>
            </div>
          ) : (
            <p style={{ margin: 0, opacity: 0.8 }}>Loading Video Consultation...</p>
          )}
        </div>
      )}
    </div>
    );
  } catch (error) {
    console.warn('🛡️ ZegoVideoInterface error caught:', error);
    // Return a fallback UI if there's an error
    return (
      <div style={{
        width: '100%',
        height: 'calc(100vh - 80px - 32px)',
        background: 'white',
        borderRadius: 0,
        marginTop: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#A23293',
        textAlign: 'center',
        boxShadow: 'none',
        border: 'none'
      }}>
        <div>
          <h3>Video Interface Error</h3>
          <p>There was an issue loading the video interface.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              background: '#007bff',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }
};

const VideoConsultation = () => {
  const [isInConsultation, setIsInConsultation] = useState(true);
  const [isPrejoinVisible, setIsPrejoinVisible] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState({
    microphone: 'checking',
    camera: 'checking'
  });
  const [joinButtonLoading, setJoinButtonLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'info' });
  const [appointmentData, setAppointmentData] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessDeniedReason, setAccessDeniedReason] = useState('');
  const [zegoInitialized, setZegoInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState(null);
  const [callEnded, setCallEnded] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodingError, setDecodingError] = useState(null);
  const [showLeaveRoomPopup, setShowLeaveRoomPopup] = useState(false);
  const [showHealthPackages, setShowHealthPackages] = useState(false);

  // Monitor health packages state changes
  React.useEffect(() => {
    console.log('🔍 Debug: showHealthPackages state changed to:', showHealthPackages);
    if (showHealthPackages) {
      console.log('🔍 Debug: Health packages should be visible now!');
    }
  }, [showHealthPackages]);

  // Enhanced Zego override with confirm button focus
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Force confirm button color in our popup */
      button[onclick*="onConfirmLeaveRoom"], 
      button[onclick*="handleConfirmLeaveRoom"],
      button:contains("Confirm") {
        background: #962067 !important;
        background-color: #962067 !important;
        color: #ffffff !important;
        border: none !important;
        outline: none !important;
        text-decoration: none !important;
        box-shadow: 0 4px 12px rgba(150, 32, 103, 0.3) !important;
      }
      
      /* Hide Zego's end call popup */
      [class*="popup"], [class*="modal"], [class*="dialog"], [class*="overlay"],
      [class*="Popup"], [class*="Modal"], [class*="Dialog"], [class*="Overlay"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      
      /* Override any blue confirm buttons */
      button[style*="blue"], button[style*="Blue"] {
        background: #962067 !important;
        background-color: #962067 !important;
        color: #ffffff !important;
      }
    `;
    document.head.appendChild(style);

    // Function to intercept Zego end call button and show our popup
    const interceptZegoEndCall = () => {
      // Find any end call buttons
      const endCallButtons = document.querySelectorAll('button, [class*="button"], [class*="btn"]');
      endCallButtons.forEach(button => {
        if (button.textContent && (
          button.textContent.toLowerCase().includes('end call') ||
          button.textContent.toLowerCase().includes('leave') ||
          button.textContent.toLowerCase().includes('quit') ||
          button.textContent.toLowerCase().includes('hang up')
        )) {
          console.log('🔴 Found Zego end call button, intercepting:', button.textContent);
          
          // Remove existing click handlers
          button.replaceWith(button.cloneNode(true));
          const newButton = document.querySelector(`[class*="${button.className}"]`);
          
          if (newButton) {
            newButton.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              console.log('🔴 Zego end call intercepted, showing our popup');
              handleEndCall();
              return false;
            }, true);
          }
        }
      });
    };

    // Function to force confirm button color
    const forceConfirmButtonColor = () => {
      const confirmButtons = document.querySelectorAll('button');
      confirmButtons.forEach(button => {
        if (button.textContent && button.textContent.toLowerCase().includes('confirm')) {
          console.log('🎨 Force setting confirm button color to #962067');
          button.style.background = '#962067';
          button.style.backgroundColor = '#962067';
          button.style.color = '#ffffff';
          button.style.border = 'none';
          button.style.outline = 'none';
        }
      });
    };

    // Run interceptors
    interceptZegoEndCall();
    forceConfirmButtonColor();
    
    // Set up intervals
    const endCallInterval = setInterval(interceptZegoEndCall, 1000);
    const colorInterval = setInterval(forceConfirmButtonColor, 500);
    
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
      clearInterval(endCallInterval);
      clearInterval(colorInterval);
    };
  }, []);

  // Force button color when popup shows
  React.useEffect(() => {
    if (showLeaveRoomPopup) {
      const timer = setTimeout(() => {
        if (confirmButtonRef.current) {
          console.log('🔴 Force setting confirm button color via ref');
          confirmButtonRef.current.style.background = '#962067';
          confirmButtonRef.current.style.backgroundColor = '#962067';
          confirmButtonRef.current.style.color = '#ffffff';
          confirmButtonRef.current.style.border = 'none';
          confirmButtonRef.current.style.outline = 'none';
        }
        
        // Also try via querySelector as backup
        const confirmButton = document.querySelector('.kauvery-confirm-button');
        if (confirmButton) {
          console.log('🔴 Force setting confirm button color via querySelector');
          confirmButton.style.background = '#962067';
          confirmButton.style.backgroundColor = '#962067';
          confirmButton.style.color = '#ffffff';
          confirmButton.style.border = 'none';
          confirmButton.style.outline = 'none';
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [showLeaveRoomPopup]);

  const zegoContainerRef = useRef(null);
  const zegoInstanceRef = useRef(null);
  const confirmButtonRef = useRef(null);

  // Color scheme
  const colors = {
    kauveryPurple: '#962067',
    kauveryViolet: '#A23293',
    kauveryPink: '#EE2D67',
    kauveryYellow: '#FFE73F',
    kauveryDarkGrey: '#58595B',
    kauveryRed: '#EC1D25',
    kauveryOrange: '#F26522',
    kauveryYellowOrange: '#FDB913',
    kauveryPeach: '#FAA85F',
    kauveryLightGrey: '#939598',
    white: '#ffffff',
    black: '#000000',
    grey50: '#fafafa',
    grey100: '#f5f5f5',
    grey200: '#eeeeee',
    grey300: '#e0e0e0'
  };

  const spacing = {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px'
  };

  const radius = {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '24px',
    full: '50%'
  };

  const shadows = {
    sm: '0 1px 2px 0 rgba(88, 89, 91, 0.3), 0 1px 3px 1px rgba(88, 89, 91, 0.15)',
    md: '0 1px 2px 0 rgba(88, 89, 91, 0.3), 0 2px 6px 2px rgba(88, 89, 91, 0.15)',
    lg: '0 2px 4px 0 rgba(88, 89, 91, 0.3), 0 8px 12px 6px rgba(88, 89, 91, 0.15)'
  };

  // Health Package Data
  const healthPackages = [
    {
      id: 1,
      title: "Home Health Check Package Essential",
      icon: "👤",
      expanded: false,
      services: [
        "CBC (Complete Blood Count)",
        "Blood Glucose Random (RBS)",
        "HBA1C",
        "Renal Function Test",
        "Teleconsult with Physician"
      ]
    },
    {
      id: 2,
      title: "Home Health Check Package Standard",
      icon: "💻",
      expanded: false,
      services: [
        "Complete Blood Count",
        "Blood Glucose Fasting & PP",
        "Lipid Profile",
        "Liver Function Test",
        "Kidney Function Test",
        "ECG",
        "Teleconsult with Physician"
      ]
    },
    {
      id: 3,
      title: "Home Health Check Package Comprehensive",
      icon: "💻",
      expanded: false,
      services: [
        "Complete Blood Count",
        "Blood Glucose Fasting & PP",
        "Lipid Profile",
        "Liver Function Test",
        "Kidney Function Test",
        "Thyroid Function Test",
        "ECG",
        "Chest X-Ray",
        "Ultrasound Abdomen",
        "Teleconsult with Physician"
      ]
    },
    {
      id: 4,
      title: "Life style health Check Essential",
      icon: "👤",
      expanded: false,
      services: [
        "BMI Calculation",
        "Blood Pressure Monitoring",
        "Blood Glucose Test",
        "Cholesterol Screening",
        "Lifestyle Counseling"
      ]
    },
    {
      id: 5,
      title: "Life style health Check Standard",
      icon: "👤",
      expanded: false,
      services: [
        "BMI Calculation",
        "Blood Pressure Monitoring",
        "Blood Glucose Test",
        "Cholesterol Screening",
        "ECG",
        "Lifestyle Counseling",
        "Nutrition Consultation"
      ]
    },
    {
      id: 6,
      title: "Life style health Check Comprehensive",
      icon: "👤",
      expanded: false,
      services: [
        "BMI Calculation",
        "Blood Pressure Monitoring",
        "Blood Glucose Test",
        "Cholesterol Screening",
        "ECG",
        "Chest X-Ray",
        "Lifestyle Counseling",
        "Nutrition Consultation",
        "Fitness Assessment"
      ]
    },
    {
      id: 7,
      title: "Executive Health Check - Male",
      icon: "👨‍⚕️",
      expanded: false,
      services: [
        "Complete Blood Count",
        "Blood Glucose Fasting & PP",
        "Lipid Profile",
        "Liver Function Test",
        "Kidney Function Test",
        "Thyroid Function Test",
        "PSA Test",
        "ECG",
        "Chest X-Ray",
        "Ultrasound Abdomen",
        "Stress Test",
        "Consultation with Specialist"
      ]
    },
    {
      id: 8,
      title: "Executive Health Check - Female",
      icon: "👩‍⚕️",
      expanded: false,
      services: [
        "Complete Blood Count",
        "Blood Glucose Fasting & PP",
        "Lipid Profile",
        "Liver Function Test",
        "Kidney Function Test",
        "Thyroid Function Test",
        "Pap Smear",
        "Mammography",
        "ECG",
        "Chest X-Ray",
        "Ultrasound Abdomen",
        "Stress Test",
        "Consultation with Specialist"
      ]
    }
  ];

  // Pure React approach - no DOM manipulation
  useEffect(() => {
    applyKauveryStyles();
    
      // Clean up any existing participant info to prevent duplicates
  const existingParticipantInfo = document.querySelectorAll('.kauvery-participant-info, .kauvery-floating-info');
  existingParticipantInfo.forEach(info => {
    if (info && info.parentNode) {
      try {
        // Use the safe removeChild method we defined
        info.parentNode.removeChild(info);
      } catch (error) {
        console.warn('🛡️ Safe cleanup - could not remove element:', error.message);
        // If all else fails, just hide the element
        info.style.display = 'none';
        info.style.visibility = 'hidden';
        info.style.opacity = '0';
      }
    }
  });
    
    // Add a flag to prevent multiple executions
    if (window.kauveryCustomizationDone) {
      return;
    }
    window.kauveryCustomizationDone = true;
    
    // Override React's DOM manipulation to prevent conflicts
    const originalRemoveChild = Node.prototype.removeChild;
    const originalAppendChild = Node.prototype.appendChild;
    const originalInsertBefore = Node.prototype.insertBefore;
    
    // Safe removeChild that doesn't throw errors
    Node.prototype.removeChild = function(child) {
      try {
        // Always check if child exists and has a parent
        if (!child) {
          console.warn('🛡️ Safe removeChild - child is null/undefined');
          return null;
        }
        
        // Check if child is actually a child of this node
        if (child.parentNode === this) {
          return originalRemoveChild.call(this, child);
        }
        
        // If child is not a direct child, try to remove it from its actual parent
        if (child.parentNode) {
          return child.parentNode.removeChild(child);
        }
        
        // If child has no parent, it's already removed
        console.warn('🛡️ Safe removeChild - child has no parent, already removed');
        return child;
      } catch (error) {
        console.warn('🛡️ Safe removeChild - preventing error:', error.message);
        // Return null to prevent further errors
        return null;
      }
    };
    
    // Safe appendChild that doesn't throw errors
    Node.prototype.appendChild = function(child) {
      try {
        if (!child) {
          console.warn('🛡️ Safe appendChild - child is null/undefined');
          return null;
        }
        
        // Check if child is already a child of this node
        if (child.parentNode === this) {
          console.warn('🛡️ Safe appendChild - child is already a child of this node');
          return child;
        }
        
        return originalAppendChild.call(this, child);
      } catch (error) {
        console.warn('🛡️ Safe appendChild - preventing error:', error.message);
        return null;
      }
    };
    
    // Safe insertBefore that doesn't throw errors
    Node.prototype.insertBefore = function(newNode, referenceNode) {
      try {
        if (!newNode) {
          console.warn('🛡️ Safe insertBefore - newNode is null/undefined');
          return null;
        }
        
        // Check if newNode is already a child of this node
        if (newNode.parentNode === this) {
          console.warn('🛡️ Safe insertBefore - newNode is already a child of this node');
          return newNode;
        }
        
        return originalInsertBefore.call(this, newNode, referenceNode);
      } catch (error) {
        console.warn('🛡️ Safe insertBefore - preventing error:', error.message);
        return null;
      }
    };
    
    // Enhanced global error handler to catch removeChild errors
    const handleGlobalError = (event) => {
      // Catch ALL DOM manipulation errors aggressively
      if (event.error && event.error.message && (
        event.error.message.includes('removeChild') ||
        event.error.message.includes('appendChild') ||
        event.error.message.includes('insertBefore') ||
        event.error.message.includes('replaceChild') ||
        event.error.message.includes('Node') ||
        event.error.message.includes('DOM') ||
        event.error.message.includes('NotFoundError')
      )) {
        console.warn('🛡️ DOM conflict detected - preventing crash:', event.error.message);
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        // Log the current state but don't force initialization
        console.log('🔍 Debug: Current state during DOM conflict:', {
          zegoInitialized,
          hasZegoInstance: !!zegoInstanceRef.current,
          hasAppointmentData: !!appointmentData
        });
        
        return false;
      }
    };
    
    // Enhanced unhandled promise rejections handler
    const handleUnhandledRejection = (event) => {
      if (event.reason && event.reason.message && (
        event.reason.message.includes('removeChild') ||
        event.reason.message.includes('NotFoundError')
      )) {
        console.warn('🛡️ Promise rejection from DOM conflict - preventing crash:', event.reason.message);
        event.preventDefault();
        return false;
      }
      
      // Also catch DOM manipulation promise rejections
      if (event.reason && event.reason.message && (
        event.reason.message.includes('removeChild') ||
        event.reason.message.includes('appendChild') ||
        event.reason.message.includes('insertBefore') ||
        event.reason.message.includes('replaceChild') ||
        event.reason.message.includes('NotFoundError')
      )) {
        console.warn('🛡️ Promise rejection from DOM manipulation - preventing crash:', event.reason.message);
        event.preventDefault();
        return false;
      }
    };
    
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      
      // Disconnect observer
      if (observerRef.current) {
        observerRef.current.disconnect();
        console.log('🔍 MutationObserver disconnected');
      }
      
      // Clean up any remaining consultation details
      const remainingInfo = document.querySelectorAll('.kauvery-participant-info, .kauvery-floating-info');
      remainingInfo.forEach(info => {
        if (info && info.parentNode) {
          try {
            info.parentNode.removeChild(info);
          } catch (error) {
            console.warn('🛡️ Cleanup error:', error.message);
            info.style.display = 'none';
          }
        }
      });
      
      // Restore original DOM methods
      if (originalRemoveChild) {
        Node.prototype.removeChild = originalRemoveChild;
      }
      if (originalAppendChild) {
        Node.prototype.appendChild = originalAppendChild;
      }
      if (originalInsertBefore) {
        Node.prototype.insertBefore = originalInsertBefore;
      }
      
      // Cleanup Zego instance on unmount
      if (zegoInstanceRef.current) {
        try {
          zegoInstanceRef.current.leaveRoom();
          zegoInstanceRef.current = null;
        } catch (error) {
          console.warn('Cleanup error:', error);
        }
      }
      
      // Reset global flag
      window.kauveryCustomizationDone = false;
    };
  }, []);

  useEffect(() => {
    
    const urlParams = new URLSearchParams(window.location.search);
    
    // Get doctor name from URL parameters
    const doctorName = urlParams.get('doctor_name');
    
    // Get decrypted parameters from App.js via session storage
    const decryptedParamsFromStorage = sessionStorage.getItem('decryptedParams');
    if (decryptedParamsFromStorage) {
      try {
        const parsedParams = JSON.parse(decryptedParamsFromStorage);
        console.log('🔍 VideoConsultation: Using decrypted params from App.js storage:', parsedParams);
        
        const department = urlParams.get('department') || 
                         urlParams.get('unit_name') || 
                         'General Medicine';

        // Generate room ID based on decrypted appointment ID
        const roomId = `ROOM_${parsedParams.app_no}`;

        // Set appointment data with decrypted values from App.js
        const appointmentDataToSet = {
          id: parsedParams.app_no,
          department: department,
          username: parsedParams.username,
          userid: parsedParams.userid,
          roomId: roomId,
          doctorName: doctorName,
          status: 'Scheduled'
        };
        
        console.log('✅ VideoConsultation: Setting appointment data from App.js:', appointmentDataToSet);
        setAppointmentData(appointmentDataToSet);
        
      } catch (error) {
        console.error('❌ Error parsing decrypted params from App.js storage:', error);
      setAccessDenied(true);
        setAccessDeniedReason('Failed to get appointment data from App.js. Please refresh the page.');
      }
    } else {
      console.log('❌ No appointment data found in session storage from App.js');
        setAccessDenied(true);
      setAccessDeniedReason('No appointment data available. Please check your consultation link.');
      }

  }, []); // Only run once on mount

  // Separate useEffect to initialize Zego when appointment data is available
  useEffect(() => {
    if (appointmentData && appointmentData.roomId && !zegoInitialized && !zegoInstanceRef.current) {
      console.log('🔄 Starting Zego initialization from appointment data useEffect...');
      
      // Temporarily delay Zego initialization to ensure DOM is stable
      setTimeout(() => {
        initializeZego().catch(console.error);
      }, 1000);
    }
  }, [appointmentData]); // Run when appointment data changes

  // Debug useEffect to track zegoInitialized state changes
  useEffect(() => {
    console.log('🔍 Debug: zegoInitialized state changed to:', zegoInitialized);
    console.log('🔍 Debug: Current state:', {
      zegoInitialized,
      hasZegoInstance: !!zegoInstanceRef.current,
      hasAppointmentData: !!appointmentData,
      appointmentData: appointmentData
    });
  }, [zegoInitialized, appointmentData]);

  const generateAppointmentId = () => {
    const prefix = 'KH';
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 3).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: 'info' });
    }, 4000);
  };

  const handleEndCall = () => {
    console.log('🔴 End call triggered - showing leave room popup');
    
    // Track end call event
    const appointmentId = AppointmentService.getAppointmentId();
    if (appointmentId && appointmentData) {
      // Store video call event
      AppointmentService.storeVideoCallEvent({
        appointment_id: parseInt(appointmentId),
        event_type: 'end_call_requested',
        room_id: appointmentData.roomId,
        user_id: appointmentData.userid,
        username: appointmentData.username,
        event_data: {
          timestamp: new Date().toISOString(),
          room_id: appointmentData.roomId,
          user_id: appointmentData.userid,
          username: appointmentData.username,
          action: 'user_requested_end_call'
        }
      }).catch(err => console.error('Failed to store video call event:', err));
    }
    
    setShowLeaveRoomPopup(true);
  };

  const handleConfirmLeaveRoom = () => {
    console.log('🔴 Confirming leave room');
    console.log('🔴 Setting showLeaveRoomPopup to false');
    setShowLeaveRoomPopup(false);
    
    // Track manual leave room event
    const appointmentId = AppointmentService.getAppointmentId();
    if (appointmentId && appointmentData) {
      // End call session
      AppointmentService.endCallSession({
        appointment_id: parseInt(appointmentId)
      }).catch(err => console.error('Failed to end call session:', err));
      
      // Store video call event
      AppointmentService.storeVideoCallEvent({
        appointment_id: parseInt(appointmentId),
        event_type: 'manual_leave_room',
        room_id: appointmentData.roomId,
        user_id: appointmentData.userid,
        username: appointmentData.username,
        event_data: {
          timestamp: new Date().toISOString(),
          room_id: appointmentData.roomId,
          user_id: appointmentData.userid,
          username: appointmentData.username,
          action: 'user_confirmed_leave'
        }
      }).catch(err => console.error('Failed to store video call event:', err));
    }
    
    // Add a small delay to ensure state updates properly
    setTimeout(() => {
      console.log('🔴 Setting showHealthPackages to true');
      setShowHealthPackages(true);
      console.log('🔴 Health packages should now be visible');
    }, 100);
    
    if (zegoInstanceRef.current) {
      try {
        console.log('🔴 Leaving Zego room');
        zegoInstanceRef.current.leaveRoom();
      } catch (error) {
        console.warn('Error leaving room:', error);
      }
    }
    console.log('🔴 Setting callEnded to true');
    setCallEnded(true);
    console.log('🔴 Setting zegoInitialized to false');
    setZegoInitialized(false);
  };

  const handleCancelLeaveRoom = () => {
    console.log('🔴 Canceling leave room');
    setShowLeaveRoomPopup(false);
  };

  const checkDevices = async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setDeviceStatus({ microphone: 'ready', camera: 'ready' });
      showNotification('All devices are ready for your consultation', 'success');
    } catch (error) {
      showNotification('Please check your camera and microphone permissions', 'error');
    }
  };

  // Store observer reference for cleanup
  const observerRef = React.useRef(null);
  
  // Customize pre-join view with participant info and button text
  const customizePreJoinView = () => {
    try {
      console.log('🎨 Customizing pre-join view...');
      
      // Find and update join button text
      const buttons = document.querySelectorAll('button');
      buttons.forEach(button => {
        if (button.textContent && (
          button.textContent.toLowerCase().includes('join') ||
          button.textContent.toLowerCase().includes('start') ||
          button.textContent.toLowerCase().includes('enter')
        )) {
          console.log('🎯 Found join button, updating text to "Join Teleconsultation"');
          button.textContent = 'Join Teleconsultation';
          button.style.background = 'linear-gradient(135deg, #A23293, #EE2D67)';
          button.style.color = 'white';
          button.style.fontFamily = "'Poppins', sans-serif";
          button.style.fontWeight = '600';
          button.style.borderRadius = '8px';
          button.style.padding = '12px 24px';
          button.style.border = 'none';
          button.style.cursor = 'pointer';
          button.style.transition = 'all 0.3s ease';
          button.style.boxShadow = '0 2px 8px rgba(162, 50, 147, 0.2)';
          button.style.marginLeft = '30px';
        }
      });
      
      // Add participant information section
      // Try multiple selectors to find the pre-join container
      let prejoinContainer = document.querySelector('[class*="prejoin"], [class*="Prejoin"], [class*="zego"], [class*="PreJoin"]');
      
      // If not found, try to find any container with buttons
      if (!prejoinContainer) {
        const buttons = document.querySelectorAll('button');
        buttons.forEach(button => {
          if (button.textContent && button.textContent.toLowerCase().includes('join')) {
            prejoinContainer = button.closest('[class*="container"], [class*="view"], [class*="panel"], [class*="content"]') || button.parentElement;
            console.log('🔍 Found container via button:', prejoinContainer?.className);
          }
        });
      }
      
      // Fallback to body if still not found
      if (!prejoinContainer) {
        prejoinContainer = document.body;
        console.log('⚠️ Using body as fallback container');
      }
      
      console.log('🎯 Using container:', prejoinContainer?.className || 'body');
      
      if (prejoinContainer) {
        // Remove existing participant info if any
        const existingInfo = prejoinContainer.querySelector('.kauvery-participant-info');
        if (existingInfo) {
          existingInfo.remove();
        }
        
        // Also remove any floating participant info
        const existingFloatingInfo = document.querySelector('.kauvery-floating-info');
        if (existingFloatingInfo) {
          existingFloatingInfo.remove();
        }
        
        // Create participant info section
        const participantInfo = document.createElement('div');
        participantInfo.className = 'kauvery-participant-info';
        participantInfo.style.cssText = `
          background: transparent;
          border: none;
          border-radius: 0;
          padding: 0;
          margin: 0;
          text-align: center;
          font-family: 'Poppins', sans-serif;
          box-shadow: none;
          backdrop-filter: none;
          position: relative;
          z-index: 1;
          max-width: 100%;
          width: 100%;
          height: fit-content;
          max-height: 100%;
          transform: scale(1);
          transition: all 0.3s ease;
          align-self: center;
          justify-self: center !important;
        `;
        
        // Get appointment details for display
        const doctorName = appointmentData?.doctorName || '';
        const department = appointmentData?.department || 'General Medicine';
        const patientName = appointmentData?.username || '';
        
                participantInfo.innerHTML = `
          <div style="
            display: flex;
            flex-direction: column;
            gap: 20px;
            text-align: center;
            width: 100%;
            max-width: 400px;
            margin: 0 auto;
          ">
            <!-- Welcome Text -->      
            
            <!-- Patient Details Section -->
            <div style="
              display: flex;
              flex-direction: row;
              gap: 16px;
              margin-left: 20px;
            ">
              <!-- Doctor Info -->
              <div style="
                background: linear-gradient(135deg, rgba(162, 50, 147, 0.08), rgba(238, 45, 103, 0.08));
                border: 1px solid rgba(162, 50, 147, 0.15);
                border-radius: 14px;
                padding: 18px;
                transition: all 0.3s ease;
                box-shadow: 0 3px 10px rgba(162, 50, 147, 0.08);
                display: flex;
                align-items: center;
                gap: 14px;
              ">
                <div style="
                  width: 45px;
                  height: 45px;
                  background: linear-gradient(135deg, #A23293, #EE2D67);
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 3px 8px rgba(162, 50, 147, 0.2);
                  flex-shrink: 0;
                ">
                  <span style="font-size: 20px; color: white;">👨‍⚕️</span>
                </div>
                <div style="flex: 1; text-align: left;">
                  <p style="
                    color: #A23293;
                    font-size: 11px;
                    font-weight: 700;
                    margin: 0 0 5px 0;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                    font-family: 'Poppins', sans-serif;
                  ">Doctor</p>
                  <p style="
                    color: #333;
                    font-size: 15px;
                    font-weight: 600;
                    margin: 0;
                    font-family: 'Poppins', sans-serif;
                  ">${doctorName}</p>
                </div>
              </div>
              
              <!-- Patient Info -->
              <div style="
                background: linear-gradient(135deg, rgba(162, 50, 147, 0.08), rgba(238, 45, 103, 0.08));
                border: 1px solid rgba(162, 50, 147, 0.15);
                border-radius: 14px;
                padding: 18px;
                transition: all 0.3s ease;
                box-shadow: 0 3px 10px rgba(162, 50, 147, 0.08);
                display: flex;
                align-items: center;
                gap: 14px;
              ">
                <div style="
                  width: 45px;
                  height: 45px;
                  background: linear-gradient(135deg, #A23293, #EE2D67);
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 3px 8px rgba(162, 50, 147, 0.2);
                  flex-shrink: 0;
                ">
                  <span style="font-size: 20px; color: white;">👤</span>
                </div>
                <div style="flex: 1; text-align: left;">
                  <p style="
                    color: #A23293;
                    font-size: 11px;
                    font-weight: 700;
                    margin: 0 0 5px 0;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                    font-family: 'Poppins', sans-serif;
                  ">Patient</p>
                  <p style="
                    color: #333;
                    font-size: 15px;
                    font-weight: 600;
                    margin: 0;
                    font-family: 'Poppins', sans-serif;
                  ">${patientName}</p>
                </div>
              </div>
            </div>
            
            <!-- Real-time Room Status -->
            <div id="room-status" style="
              background: linear-gradient(135deg, rgba(40, 167, 69, 0.12), rgba(40, 167, 69, 0.08));
              border: 1px solid rgba(40, 167, 69, 0.25);
              border-radius: 12px;
              padding: 16px;
              position: relative;
              overflow: hidden;
              box-shadow: 0 3px 10px rgba(40, 167, 69, 0.1);
            ">
              <div style="
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(90deg, #28a745, #20c997);
              "></div>
              <div id="status-content" style="
                color: #155724;
                font-size: 12px;
                margin: 0;
                font-family: 'Poppins', sans-serif;
                font-weight: 600;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
              ">
                <span style="
                  width: 8px;
                  height: 8px;
                  background: linear-gradient(135deg, #28a745, #20c997);
                  border-radius: 50%;
                  display: inline-block;
                  animation: pulse 2s infinite;
                  box-shadow: 0 0 6px rgba(40, 167, 69, 0.3);
                "></span>
                <span id="status-text">🟢 Checking room status...</span>
              </div>
              <div id="participants-list" style="
                margin-top: 12px;
                display: none;
                flex-direction: column;
                gap: 8px;
              ">
                <!-- Participants will be dynamically added here -->
              </div>
            </div>
          </div>
        `;
        
        // Add pulse animation
        const style = document.createElement('style');
        style.textContent = `
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
        `;
        document.head.appendChild(style);
        
                // Insert consultation details directly into the Zego pre-join container
        try {
          // Check if consultation details already exist to prevent duplicates
          const existingInfo = document.querySelector('.kauvery-participant-info');
          if (existingInfo) {
            console.log('⚠️ Consultation details already exist, skipping creation');
            return;
          }
          
          // Find the Zego pre-join container
          let prejoinContainer = document.querySelector('[class*="prejoin"], [class*="Prejoin"], [class*="zego"], [class*="PreJoin"]');
          
          if (!prejoinContainer) {
            // If not found, try to find any container with buttons
            const buttons = document.querySelectorAll('button');
            buttons.forEach(button => {
              if (button.textContent && button.textContent.toLowerCase().includes('join')) {
                prejoinContainer = button.closest('[class*="container"], [class*="view"], [class*="panel"], [class*="content"]') || button.parentElement;
                console.log('🔍 Found container via button:', prejoinContainer?.className);
              }
            });
          }
          
          // Fallback to body if still not found
          if (!prejoinContainer) {
            prejoinContainer = document.body;
            console.log('⚠️ Using body as fallback container');
          }
          
          if (prejoinContainer) {
                    // Insert the participant info directly into the pre-join container
        prejoinContainer.appendChild(participantInfo);
        console.log('✅ Consultation details inserted directly into Zego pre-join container');
        
              // Start monitoring room status
      updateRoomStatus();
      
      // Force remove borders immediately
      forceRemoveBorders();
          }
        } catch (error) {
          console.log('⚠️ Error inserting consultation details:', error);
        }
        
        // Hide any existing Zego content that might conflict
        const existingTitles = prejoinContainer.querySelectorAll('h1, h2, h3, [class*="title"], [class*="header"]');
        existingTitles.forEach(title => {
          if (title.textContent && (
            title.textContent.toLowerCase().includes('welcome') ||
            title.textContent.toLowerCase().includes('join') ||
            title.textContent.toLowerCase().includes('meeting')
          )) {
            console.log('🔄 Hiding existing title:', title.textContent);
            title.style.display = 'none';
          }
        });
        
        // Hide any existing text boxes or content areas
        const existingContent = prejoinContainer.querySelectorAll('[class*="content"], [class*="text"], [class*="description"]');
        existingContent.forEach(content => {
          if (content.textContent && content.textContent.length > 50) {
            console.log('🔄 Hiding existing content:', content.textContent.substring(0, 50) + '...');
            content.style.display = 'none';
          }
        });

        // Hide patient name input field and related elements
        const inputFields = prejoinContainer.querySelectorAll('input[type="text"], input[placeholder*="name"], input[placeholder*="Name"], [class*="input"], [class*="textbox"]');
        inputFields.forEach(input => {
          console.log('🔄 Hiding patient name input field:', input.placeholder || input.className);
          input.style.display = 'none';
          
          // Also hide the parent container if it's just for the input
          const parent = input.parentElement;
          if (parent && (parent.className.includes('input') || parent.className.includes('textbox') || parent.className.includes('field'))) {
            parent.style.display = 'none';
          }
        });

        // Hide labels related to patient name input
        const labels = prejoinContainer.querySelectorAll('label, [class*="label"]');
        labels.forEach(label => {
          if (label.textContent && (
            label.textContent.toLowerCase().includes('name') ||
            label.textContent.toLowerCase().includes('username') ||
            label.textContent.toLowerCase().includes('enter')
          )) {
            console.log('🔄 Hiding patient name label:', label.textContent);
            label.style.display = 'none';
          }
        });
      }
      
              console.log('🎨 Pre-join view customization complete');
        
        // Prevent multiple executions by checking if already processed
        if (document.querySelector('.kauvery-participant-info')) {
          console.log('⚠️ Consultation details already exist, skipping duplicate creation');
          return;
        }
        
      } catch (error) {
        console.warn('⚠️ Error customizing pre-join view:', error);
      }
  };
  
  // Force remove all borders from pre-join view
  const forceRemoveBorders = () => {
    // Remove borders from all elements immediately
    const allElements = document.querySelectorAll('*');
    allElements.forEach(element => {
      element.style.border = 'none';
      element.style.borderWidth = '0';
      element.style.borderStyle = 'none';
      element.style.borderColor = 'transparent';
      element.style.borderRadius = '0';
      element.style.outline = 'none';
      element.style.outlineWidth = '0';
      element.style.boxShadow = 'none';
    });
    
    // Continue removing borders every 50ms
    setInterval(() => {
      const allElements = document.querySelectorAll('*');
      allElements.forEach(element => {
        element.style.border = 'none';
        element.style.borderWidth = '0';
        element.style.borderStyle = 'none';
        element.style.borderColor = 'transparent';
        element.style.borderRadius = '0';
        element.style.outline = 'none';
        element.style.outlineWidth = '0';
        element.style.boxShadow = 'none';
      });
    }, 50);
  };

  // Update room status with real-time participant information
  const updateRoomStatus = () => {
    try {
      const statusText = document.getElementById('status-text');
      const participantsList = document.getElementById('participants-list');
      
      if (!statusText || !participantsList) {
        console.log('⚠️ Status elements not found, retrying...');
        setTimeout(updateRoomStatus, 1000);
        return;
      }
      
      // Check for Zego participants in the DOM
      const zegoParticipants = document.querySelectorAll('[class*="participant"], [class*="user"], [class*="member"], [class*="attendee"]');
      const zegoUserNames = document.querySelectorAll('[class*="username"], [class*="name"], [class*="display-name"]');
      
      // Also check for any video elements that might indicate participants
      const videoElements = document.querySelectorAll('video');
      const audioElements = document.querySelectorAll('audio');
      
      // Count active participants
      let participantCount = 0;
      let participantNames = [];
      
      // Check for Zego's internal participant tracking
      if (zegoInstanceRef.current) {
        try {
          // Try to get participants from Zego instance
          const roomInfo = zegoInstanceRef.current.getRoomInfo ? zegoInstanceRef.current.getRoomInfo() : null;
          if (roomInfo && roomInfo.participants) {
            participantCount = roomInfo.participants.length;
            participantNames = roomInfo.participants.map(p => p.userName || p.name || 'Unknown User');
          }
        } catch (error) {
          console.log('⚠️ Could not get room info from Zego instance:', error.message);
        }
      }
      
      // Fallback: Count based on DOM elements
      if (participantCount === 0) {
        // Count unique video/audio elements (excluding our own)
        const mediaElements = [...videoElements, ...audioElements];
        participantCount = mediaElements.length;
        
        // Try to extract names from DOM
        zegoUserNames.forEach(nameElement => {
          const name = nameElement.textContent?.trim();
          if (name && name !== 'You' && name !== 'Me' && !participantNames.includes(name)) {
            participantNames.push(name);
          }
        });
      }
      
      // Update status display
      if (participantCount === 0) {
        statusText.textContent = 'No other participants in room yet';
        participantsList.style.display = 'none';
      } else {
        statusText.textContent = `${participantCount} participant${participantCount > 1 ? 's' : ''} in room`;
        participantsList.style.display = 'flex';
        
        // Clear existing list
        participantsList.innerHTML = '';
        
        // Add participant names
        participantNames.forEach(name => {
          const participantItem = document.createElement('div');
          participantItem.style.cssText = `
            background: rgba(40, 167, 69, 0.1);
            border: 1px solid rgba(40, 167, 69, 0.2);
            border-radius: 8px;
            padding: 8px 12px;
            font-size: 11px;
            color: #155724;
            font-family: 'Poppins', sans-serif;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 8px;
          `;
          participantItem.innerHTML = `
            <span style="
              width: 6px;
              height: 6px;
              background: #28a745;
              border-radius: 50%;
              display: inline-block;
            "></span>
            <span>${name}</span>
          `;
          participantsList.appendChild(participantItem);
        });
      }
      
      // Continue monitoring
      setTimeout(updateRoomStatus, 2000);
      
    } catch (error) {
      console.log('⚠️ Error updating room status:', error.message);
      // Retry after error
      setTimeout(updateRoomStatus, 3000);
    }
  };

  // Create floating participant info panel
  const createFloatingParticipantInfo = () => {
    try {
      // Remove existing floating info
      const existingFloating = document.querySelector('.kauvery-floating-info');
      if (existingFloating) {
        existingFloating.remove();
      }
      
      // Create floating container
      const floatingInfo = document.createElement('div');
      floatingInfo.className = 'kauvery-floating-info';
      floatingInfo.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 249, 250, 0.98));
        border: 1px solid #A23293;
        border-radius: 8px;
        padding: 15px;
        text-align: center;
        font-family: 'Poppins', sans-serif;
        
        backdrop-filter: blur(8px);
        z-index: 9999;
        max-width: 380px;
        width: 80%;
        transform: translateX(-50%) scale(1);
        transition: all 0.3s ease;
      `;
      
      // Get appointment details for display
      const doctorName = appointmentData?.doctorName || '';
      const department = appointmentData?.department || 'General Medicine';
      const patientName = appointmentData?.username || 'Patient';
      
      floatingInfo.innerHTML = `
        <div style="
          margin-bottom: 15px;
          text-align: center;
          position: relative;
        ">
          <div style="
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #A23293, #EE2D67);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 8px;
            box-shadow: 0 1px 4px rgba(162, 50, 147, 0.15);
          ">
            <span style="font-size: 14px; color: white;">📋</span>
          </div>
          <h3 style="
            color: #A23293;
            font-size: 16px;
            font-weight: 700;
            margin: 0 0 4px 0;
            font-family: 'Poppins', sans-serif;
            text-shadow: 0 1px 2px rgba(162, 50, 147, 0.1);
          ">Consultation Details</h3>
          <p style="
            color: #666;
            font-size: 12px;
            margin: 0;
            font-family: 'Poppins', sans-serif;
            font-weight: 500;
                      ">Room: ${appointmentData?.roomId || `ROOM_${appointmentData?.id || 'TEST123'}`}</p>
        </div>
        
        <div style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 15px;
          text-align: left;
        ">
          <div style="
            background: linear-gradient(135deg, rgba(162, 50, 147, 0.05), rgba(238, 45, 103, 0.05));
            border: 1px solid rgba(162, 50, 147, 0.1);
            border-radius: 8px;
            padding: 12px;
            transition: all 0.3s ease;
          ">
            <div style="
              width: 24px;
              height: 24px;
              background: linear-gradient(135deg, #A23293, #EE2D67);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 6px;
            ">
              <span style="font-size: 12px; color: white;">👨‍⚕️</span>
            </div>
            <p style="
              color: #A23293;
              font-size: 9px;
              font-weight: 700;
              margin: 0 0 3px 0;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              font-family: 'Poppins', sans-serif;
            ">Doctor</p>
            <p style="
              color: #333;
              font-size: 12px;
              font-weight: 600;
              margin: 0 0 1px 0;
              font-family: 'Poppins', sans-serif;
            ">${doctorName}</p>
            <p style="
              color: #666;
              font-size: 10px;
              margin: 0;
              font-family: 'Poppins', sans-serif;
              font-weight: 500;
            ">${department}</p>
          </div>
          
          <div style="
            background: linear-gradient(135deg, rgba(162, 50, 147, 0.05), rgba(238, 45, 103, 0.05));
            border: 1px solid rgba(162, 50, 147, 0.1);
            border-radius: 8px;
            padding: 12px;
            transition: all 0.3s ease;
          ">
            <div style="
              width: 24px;
              height: 24px;
              background: linear-gradient(135deg, #A23293, #EE2D67);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 6px;
            ">
              <span style="font-size: 12px; color: white;">👤</span>
            </div>
            <p style="
              color: #A23293;
              font-size: 9px;
              font-weight: 700;
              margin: 0 0 3px 0;
              text-transform: uppercase;
              letter-spacing: 0.3px;
              font-family: 'Poppins', sans-serif;
            ">Patient</p>
            <p style="
              color: #333;
              font-size: 12px;
              font-weight: 600;
              margin: 0 0 1px 0;
              font-family: 'Poppins', sans-serif;
            ">${patientName}</p>
            <p style="
              color: #666;
              font-size: 10px;
              margin: 0;
              font-family: 'Poppins', sans-serif;
              font-weight: 500;
            ">Ready to join</p>
          </div>
        </div>
        
        <div style="
          background: linear-gradient(135deg, rgba(40, 167, 69, 0.1), rgba(40, 167, 69, 0.05));
          border: 1px solid rgba(40, 167, 69, 0.2);
          border-radius: 6px;
          padding: 8px;
          margin-top: 12px;
          position: relative;
          overflow: hidden;
        ">
          <div style="
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, #28a745, #20c997);
          "></div>
          <p style="
            color: #155724;
            font-size: 10px;
            margin: 0;
            font-family: 'Poppins', sans-serif;
            font-weight: 600;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          ">
            <span style="
              width: 6px;
              height: 6px;
              background: linear-gradient(135deg, #28a745, #20c997);
              border-radius: 50%;
              display: inline-block;
              animation: pulse 2s infinite;
              box-shadow: 0 0 4px rgba(40, 167, 69, 0.25);
            "></span>
            <span>No other participants in room yet</span>
          </p>
        </div>
      `;
      
      document.body.appendChild(floatingInfo);
      console.log('✅ Floating participant info created');
      
    } catch (error) {
      console.warn('⚠️ Error creating floating participant info:', error);
    }
  };
  
  // Apply custom styles for join button and fonts
  const applyKauveryStyles = () => {
    try {
      // Add Poppins font
      const fontLink = document.createElement('link');
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap';
      fontLink.rel = 'stylesheet';
      document.head.appendChild(fontLink);

      // Add custom CSS for join button gradient
      const style = document.createElement('style');
      style.textContent = `
        /* Force remove all borders from pre-join view */
        .zego-prejoin-view *,
        .zego-prejoin-container *,
        .zego-prejoin * {
          border: none !important;
          border-width: 0 !important;
          border-style: none !important;
          border-color: transparent !important;
          border-radius: 0 !important;
          outline: none !important;
          outline-width: 0 !important;
          box-shadow: none !important;
        }
        
        /* Target any element with a dark background (video preview) */
        .zego-prejoin-view [style*="background"],
        .zego-prejoin-container [style*="background"],
        .zego-prejoin [style*="background"] {
          border: none !important;
          border-width: 0 !important;
          border-style: none !important;
          border-color: transparent !important;
          border-radius: 0 !important;
          outline: none !important;
          outline-width: 0 !important;
          box-shadow: none !important;
        }
        
        /* Override any existing border styles */
        .zego-prejoin-view *,
        .zego-prejoin-container *,
        .zego-prejoin * {
          border: none !important;
          border-width: 0 !important;
          border-style: none !important;
          border-color: transparent !important;
          border-radius: 0 !important;
          outline: none !important;
          outline-width: 0 !important;
          box-shadow: none !important;
        }
        
        /* Nuclear option - remove borders from everything */
        * {
          border: none !important;
          border-width: 0 !important;
          border-style: none !important;
          border-color: transparent !important;
          border-radius: 0 !important;
          outline: none !important;
          outline-width: 0 !important;
          box-shadow: none !important;
        }
        
        /* Ensure header shadow is preserved */
        header, [data-testid="header"], .header {
          box-shadow: 0 8px 25px rgba(150, 32, 103, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15) !important;
          filter: drop-shadow(0 8px 25px rgba(150, 32, 103, 0.3)) !important;
        }
        
        /* Global fitting styles */
        /* Global fitting styles */
        html, body {
          max-width: 100vw !important;
          max-height: 100vh !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
        }

        * {
          box-sizing: border-box !important;
        }

        /* Target Zego join button with multiple selectors */
        .zego-join-button,
        .zego-prejoin-view button,
        .zego-prejoin-view .zego-button,
        .zego-prejoin-view [class*="button"],
        .zego-prejoin-view [class*="join"],
        .zego-prejoin-view button[type="button"],
        .zego-prejoin-view .zego-ui-button,
        .zego-prejoin-view .zego-btn,
        .zego-prejoin-view .join-btn,
        .zego-prejoin-view .start-btn,
        .zego-prejoin-view .primary-btn {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
        }
        
        .zego-join-button:hover,
        .zego-prejoin-view button:hover,
        .zego-prejoin-view .zego-button:hover,
        .zego-prejoin-view [class*="button"]:hover,
        .zego-prejoin-view [class*="join"]:hover,
        .zego-prejoin-view button[type="button"]:hover,
        .zego-prejoin-view .zego-ui-button:hover,
        .zego-prejoin-view .zego-btn:hover,
        .zego-prejoin-view .join-btn:hover,
        .zego-prejoin-view .start-btn:hover,
        .zego-prejoin-view .primary-btn:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 4px 12px rgba(162, 50, 147, 0.3) !important;
          background: linear-gradient(135deg, #B23DA4, #FF3D78) !important;
        }
        
        /* Target all elements in pre-join view for Poppins font */
        .zego-prejoin-view *,
        .zego-prejoin-container *,
        .zego-prejoin * {
          font-family: 'Poppins', sans-serif !important;
        }
        
        /* Specific targeting for titles and content */
        .zego-prejoin-view h1,
        .zego-prejoin-view h2,
        .zego-prejoin-view h3,
        .zego-prejoin-view .title,
        .zego-prejoin-view .header,
        .zego-prejoin-title {
          font-family: 'Poppins', sans-serif !important;
          font-weight: 600 !important;
        }
        
        .zego-prejoin-view p,
        .zego-prejoin-view span,
        .zego-prejoin-view div,
                  .zego-prejoin-content {
            font-family: 'Poppins', sans-serif !important;
          }
        
        /* Force override for any button-like elements */
        .zego-prejoin-view [class*="btn"],
        .zego-prejoin-view [class*="Button"],
        .zego-prejoin-view [class*="button"] {
          background: linear-gradient(135deg, #A23293, #EE2D67) !important;
          border: none !important;
          color: white !important;
          font-family: 'Poppins', sans-serif !important;
          font-weight: 600 !important;
          border-radius: 8px !important;
          padding: 12px 24px !important;
          cursor: pointer !important;
          transition: all 0.3s ease !important;
        }

        /* Ensure Zego elements fit properly - only for pre-join view */
        .zego-prejoin-view,
        .zego-prejoin-container,
        .zego-prejoin {
          width: 100% !important;
          height: 100% !important;
          max-width: 100% !important;
          max-height: 100% !important;
          overflow: hidden !important;
          box-sizing: border-box !important;
          border-radius: 0 !important;
          border: none !important;
          box-shadow: none !important;
          margin: 0 !important;
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          position: relative !important;
        }

        /* Remove aggressive styling for video view - let Zego handle its own interface */
        .zego-video-view,
        .zego-video-container,
        .zego-ui {
          /* Remove all forced styling to let Zego display normally */
        }
        
        /* Ensure pre-join view has white background and no borders */
        .zego-prejoin-view,
        .zego-prejoin-container,
        .zego-prejoin {
          background: #ffffff !important;
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          outline: none !important;
        }
        
        /* Simple border removal for pre-join view */
        .zego-prejoin-view *,
        .zego-prejoin-container *,
        .zego-prejoin * {
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          outline: none !important;
        }
        
        /* Target the specific video preview container */
        .zego-prejoin-view [style*="background-color"],
        .zego-prejoin-container [style*="background-color"],
        .zego-prejoin [style*="background-color"],
        .zego-prejoin-view [style*="background"],
        .zego-prejoin-container [style*="background"],
        .zego-prejoin [style*="background"] {
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          outline: none !important;
        }
        
        /* Nuclear option - remove borders from everything in pre-join view */
        .zego-prejoin-view,
        .zego-prejoin-container,
        .zego-prejoin,
        .zego-prejoin-view *,
        .zego-prejoin-container *,
        .zego-prejoin * {
          border: none !important;
          border-width: 0 !important;
          border-style: none !important;
          border-color: transparent !important;
          border-radius: 0 !important;
          outline: none !important;
          outline-width: 0 !important;
          box-shadow: none !important;
        }

        /* Responsive design for different screen sizes - only for pre-join view */
        @media (min-width: 1201px) {
          /* Desktop - Single column layout */
          .zego-prejoin-view,
          .zego-prejoin-container,
          .zego-prejoin {
            width: 100% !important;
            height: 100% !important;
            position: relative !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          
          .kauvery-participant-info,
          .kauvery-floating-info {
            position: relative !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            z-index: 1 !important;
            transform: none !important;
            align-self: center !important;
            justify-self: center !important;
          }
        }

        @media (max-width: 1200px) and (min-width: 769px) {
          /* Laptop - Single column layout */
          .zego-prejoin-view,
          .zego-prejoin-container,
          .zego-prejoin {
            width: 100% !important;
            height: 100% !important;
            position: relative !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
          
          .kauvery-participant-info,
          .kauvery-floating-info {
            position: relative !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            z-index: 1 !important;
            align-self: center !important;
            justify-self: center !important;
          }
        }

        @media (max-width: 768px) {
          /* Tablet and Mobile - Stacked layout */
          .zego-prejoin-view,
          .zego-prejoin-container,
          .zego-prejoin {
            width: 100% !important;
            height: 100% !important;
            position: relative !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            grid-column: 1 !important;
            grid-row: 1 !important;
          }
          
          .kauvery-participant-info,
          .kauvery-floating-info {
            position: relative !important;
            margin: 0 !important;
            width: 95% !important;
            max-width: 300px !important;
            z-index: 1 !important;
            font-size: 14px !important;
            align-self: center !important;
            grid-column: 1 !important;
            grid-row: 2 !important;
            justify-self: center !important;
          }
          
          .kauvery-participant-info h3,
          .kauvery-floating-info h3 {
            font-size: 18px !important;
          }
          
          .kauvery-participant-info .appointment-details,
          .kauvery-floating-info .appointment-details {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
        }

        @media (max-width: 480px) {
          /* Small mobile devices */
          .zego-prejoin-view,
          .zego-prejoin-container,
          .zego-prejoin {
            height: 50% !important;
            margin-bottom: 10px !important;
          }
          
          .kauvery-participant-info,
          .kauvery-floating-info {
            width: 98% !important;
            margin: 0 auto 10px auto !important;
            font-size: 12px !important;
            padding: 10px !important;
          }
          
          .kauvery-participant-info h3,
          .kauvery-floating-info h3 {
            font-size: 16px !important;
          }
        }

        /* Hide patient name input fields - only in pre-join view */
        .zego-prejoin-view input[type="text"],
        .zego-prejoin-view input[placeholder*="name"],
        .zego-prejoin-view input[placeholder*="Name"],
        .zego-prejoin-view [class*="input"],
        .zego-prejoin-view [class*="textbox"] {
          display: none !important;
        }

        /* Hide labels for patient name - only in pre-join view */
        .zego-prejoin-view label,
        .zego-prejoin-view [class*="label"] {
          display: none !important;
        }

        /* Hide welcome text inside Zego container - only in pre-join view */
        .zego-prejoin-view h1,
        .zego-prejoin-view h2,
        .zego-prejoin-view h3,
        .zego-prejoin-view .title,
        .zego-prejoin-view [class*="title"],
        .zego-prejoin-view [class*="header"],
        .zego-prejoin-view [class*="welcome"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
        }

        /* More aggressive title color override - only for pre-join view */
        .zego-prejoin-view *,
        .zego-prejoin-container *,
        .zego-prejoin * {
          color: #962067 !important;
        }

        /* Ensure Zego pre-join view has white background and relative positioning */
        .zego-prejoin-view,
        .zego-prejoin-container,
        .zego-prejoin {
          background: #ffffff !important;
          position: relative !important;
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          outline: none !important;
        }

        /* Remove any duplicate participant info */
        .kauvery-floating-info {
          display: none !important;
        }

        /* Ensure consultation details appear inline with content */
        .kauvery-participant-info {
          position: relative !important;
          margin: 20px auto !important;
          width: 100% !important;
          max-width: 400px !important;
          z-index: 1 !important;
          transform: none !important;
          box-shadow: 0 4px 16px rgba(162, 50, 147, 0.15) !important;
          border-radius: 12px !important;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 249, 250, 0.98)) !important;
          backdrop-filter: blur(8px) !important;
        }

        /* Specific targeting for any text containing "Welcome" */
        .zego-prejoin-view *:contains("Welcome"),
        .zego-prejoin-container *:contains("Welcome"),
        .zego-prejoin *:contains("Welcome") {
          color: #962067 !important;
        }

        /* Universal selector for all text in pre-join view */
        .zego-prejoin-view,
        .zego-prejoin-container,
        .zego-prejoin {
          color: #962067 !important;
        }

        /* Target any element with text content */
        .zego-prejoin-view div,
        .zego-prejoin-view span,
        .zego-prejoin-view p {
          color: #962067 !important;
        }

        /* Hide Zego's default quit/end call page - only in pre-join view */
        .zego-quit-view,
        .zego-quit-container,
        .zego-quit,
        [class*="quit"],
        [class*="Quit"],
        [class*="end"],
        [class*="End"],
        [class*="leave"],
        [class*="Leave"] {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
        
        /* Ensure Zego's join button is visible and styled */
        .zego-prejoin-view button,
        .zego-prejoin-view [class*="button"],
        .zego-prejoin-view [class*="join"] {
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
          background: linear-gradient(135deg, #A23293, #EE2D67) !important;
          color: white !important;
          border: none !important;
          border-radius: 14px !important;
          padding: 18px 28px !important;
          font-family: 'Poppins', sans-serif !important;
          font-weight: 600 !important;
          font-size: 15px !important;
          cursor: pointer !important;
          transition: all 0.3s ease !important;
          box-shadow: 0 5px 18px rgba(162, 50, 147, 0.25) !important;
          width: 100% !important;
          max-width: 400px !important;
          margin: 20px auto 0 auto !important;
        }
        
        .zego-prejoin-view button:hover,
        .zego-prejoin-view [class*="button"]:hover,
        .zego-prejoin-view [class*="join"]:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 8px 25px rgba(162, 50, 147, 0.35) !important;
          background: linear-gradient(135deg, #B23DA4, #FF3D78) !important;
        }

        /* Hide any Zego elements that appear after call ends - only in pre-join view */
        .zego-ui[data-ended="true"],
        .zego-ui[data-left="true"],
        .zego-ui[data-quit="true"] {
          display: none !important;
        }

        /* Ensure our custom quit page takes precedence */
        .kauvery-call-ended {
          z-index: 9999 !important;
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          background: #ffffff;
        }
      `;
      document.head.appendChild(style);
      
      // Add MutationObserver to ensure styles are applied to dynamically created elements
      observerRef.current = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // Simple border removal for pre-join view elements
                const newElements = node.querySelectorAll ? node.querySelectorAll('*') : [node];
                newElements.forEach(element => {
                  // Only apply border removal if it's in the pre-join view
                  if (element.closest('.zego-prejoin-view') || element.closest('.zego-prejoin-container') || element.closest('.zego-prejoin')) {
                    element.style.border = 'none';
                    element.style.borderRadius = '0';
                    element.style.boxShadow = 'none';
                    element.style.outline = 'none';
                  }
                });
                
                // Check if any buttons were added
                const buttons = node.querySelectorAll ? node.querySelectorAll('button, [class*="button"], [class*="btn"], [class*="join"]') : [];
                buttons.forEach(button => {
                  if (button.textContent && (button.textContent.toLowerCase().includes('join') || 
                      button.textContent.toLowerCase().includes('start') || 
                      button.textContent.toLowerCase().includes('enter'))) {
                    console.log('🎯 Found join button, applying gradient styles and updating text');
                    
                    // Update button text
                    button.textContent = 'Join Teleconsultation';
                    
                    // Apply gradient styles
                    button.style.background = 'linear-gradient(135deg, #A23293, #EE2D67)';
                    button.style.border = 'none';
                    button.style.color = 'white';
                    button.style.fontFamily = "'Poppins', sans-serif";
                    button.style.fontWeight = '600';
                    button.style.borderRadius = '8px';
                    button.style.padding = '12px 24px';
                    button.style.cursor = 'pointer';
                    button.style.transition = 'all 0.3s ease';
                    button.style.boxShadow = '0 2px 8px rgba(162, 50, 147, 0.2)';
                    
                    // Add hover effect
                    button.addEventListener('mouseenter', () => {
                      button.style.transform = 'translateY(-2px)';
                      button.style.boxShadow = '0 4px 12px rgba(162, 50, 147, 0.3)';
                      button.style.background = 'linear-gradient(135deg, #B23DA4, #FF3D78)';
                    });
                    
                    button.addEventListener('mouseleave', () => {
                      button.style.transform = 'translateY(0)';
                      button.style.boxShadow = '0 2px 8px rgba(162, 50, 147, 0.2)';
                      button.style.background = 'linear-gradient(135deg, #A23293, #EE2D67)';
                    });
                    
                                        // Only trigger participant info customization if not already done
        if (!document.querySelector('.kauvery-participant-info')) {
          setTimeout(() => {
            customizePreJoinView();
          }, 100);
        }
                  }
                });

                // Check if any input fields were added and hide them
                const inputFields = node.querySelectorAll ? node.querySelectorAll('input[type="text"], input[placeholder*="name"], input[placeholder*="Name"], [class*="input"], [class*="textbox"]') : [];
                inputFields.forEach(input => {
                  console.log('🎯 Found input field, hiding it:', input.placeholder || input.className);
                  input.style.display = 'none';
                  
                  // Also hide the parent container if it's just for the input
                  const parent = input.parentElement;
                  if (parent && (parent.className.includes('input') || parent.className.includes('textbox') || parent.className.includes('field'))) {
                    parent.style.display = 'none';
                  }
                });

                // Check if any labels were added and hide them
                const labels = node.querySelectorAll ? node.querySelectorAll('label, [class*="label"]') : [];
                labels.forEach(label => {
                  if (label.textContent && (
                    label.textContent.toLowerCase().includes('name') ||
                    label.textContent.toLowerCase().includes('username') ||
                    label.textContent.toLowerCase().includes('enter')
                  )) {
                    console.log('🎯 Found label, hiding it:', label.textContent);
                    label.style.display = 'none';
                  }
                });

                // Check if any titles were added and change their color
                const titles = node.querySelectorAll ? node.querySelectorAll('h1, h2, h3, [class*="title"], [class*="header"], [class*="welcome"]') : [];
                titles.forEach(title => {
                  if (title.textContent && title.textContent.toLowerCase().includes('welcome')) {
                    console.log('🎯 Found welcome title, changing color:', title.textContent);
                    title.style.color = '#962067';
                    title.style.fontFamily = "'Poppins', sans-serif";
                    title.style.fontWeight = '600';
                    title.style.fontSize = '24px';
                  }
                });

                // More aggressive title color application
                const welcomeElements = node.querySelectorAll ? node.querySelectorAll('*') : [];
                welcomeElements.forEach(element => {
                  if (element.textContent && element.textContent.toLowerCase().includes('welcome')) {
                    console.log('🎯 Found element with welcome text, changing color:', element.textContent);
                    element.style.color = '#962067';
                    element.style.fontFamily = "'Poppins', sans-serif";
                    element.style.fontWeight = '600';
                    element.style.fontSize = '24px';
                  }
                });

                // Also check the entire document for welcome text
                setTimeout(() => {
                  const allWelcomeElements = document.querySelectorAll('*');
                  allWelcomeElements.forEach(element => {
                    if (element.textContent && element.textContent.toLowerCase().includes('welcome') && 
                        element.closest('.zego-prejoin-view')) {
                      console.log('🎯 Found welcome element in document, changing color:', element.textContent);
                      element.style.color = '#962067';
                      element.style.fontFamily = "'Poppins', sans-serif";
                      element.style.fontWeight = '600';
                      element.style.fontSize = '24px';
                    }
                  });
                }, 500);

                // Check for Zego quit/end call elements and hide them
                const quitElements = node.querySelectorAll ? node.querySelectorAll('[class*="quit"], [class*="Quit"], [class*="end"], [class*="End"], [class*="leave"], [class*="Leave"]') : [];
                quitElements.forEach(element => {
                  console.log('🚫 Found Zego quit element, hiding it:', element.className);
                  element.style.display = 'none';
                  element.style.visibility = 'hidden';
                  element.style.opacity = '0';
                  element.style.pointerEvents = 'none';
                });

                // Check for end call buttons and redirect them to our handler
                const endCallButtons = node.querySelectorAll ? node.querySelectorAll('button, [class*="button"], [class*="btn"], [class*="end"], [class*="End"], [class*="leave"], [class*="Leave"], [class*="quit"], [class*="Quit"]') : [];
                endCallButtons.forEach(button => {
                  if (button.textContent && (
                    button.textContent.toLowerCase().includes('end call') ||
                    button.textContent.toLowerCase().includes('leave') ||
                    button.textContent.toLowerCase().includes('quit') ||
                    button.textContent.toLowerCase().includes('hang up') ||
                    button.textContent.toLowerCase().includes('end') ||
                    button.textContent.toLowerCase().includes('exit')
                  )) {
                    console.log('🔴 Found end call button, redirecting to our handler:', button.textContent);
                    button.onclick = (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.stopImmediatePropagation();
                      handleEndCall();
                      return false;
                    };
                    button.addEventListener('click', (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.stopImmediatePropagation();
                      handleEndCall();
                      return false;
                    }, true);
                  }
                });

                // Hide any Zego popups that appear
                if (node.className && (
                  node.className.toLowerCase().includes('popup') ||
                  node.className.toLowerCase().includes('modal') ||
                  node.className.toLowerCase().includes('dialog') ||
                  node.className.toLowerCase().includes('overlay')
                )) {
                  console.log('🚫 Found Zego popup/modal, hiding it:', node.className);
                  node.style.display = 'none';
                  node.style.visibility = 'hidden';
                  node.style.opacity = '0';
                  node.style.pointerEvents = 'none';
                }

                // Check for text that indicates call ended
                if (node.textContent && (
                  node.textContent.toLowerCase().includes('you have left the room') ||
                  node.textContent.toLowerCase().includes('call ended') ||
                  node.textContent.toLowerCase().includes('consultation ended') ||
                  node.textContent.toLowerCase().includes('return to home')
                )) {
                  console.log('🚫 Found call ended text, hiding element:', node.textContent);
                  node.style.display = 'none';
                  node.style.visibility = 'hidden';
                  node.style.opacity = '0';
                  node.style.pointerEvents = 'none';
                  
                  // Trigger our custom call ended page
                  if (!callEnded) {
                    console.log('🔄 Triggering custom call ended page');
                    setCallEnded(true);
                  }
                }
              }
            });
          }
        });
      });
      
      // Start observing the document body for changes
      observerRef.current.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      console.log('✅ Custom styles applied - Poppins font and join button gradient with MutationObserver');
      
      // Function to force update title color
      const forceUpdateTitleColor = () => {
        const titleElements = document.querySelectorAll('*');
        titleElements.forEach(element => {
          if (element.textContent && element.textContent.toLowerCase().includes('welcome') && 
              element.closest('.zego-prejoin-view')) {
            console.log('🎯 Force updating welcome title color:', element.textContent);
            element.style.color = '#962067';
            element.style.fontFamily = "'Poppins', sans-serif";
            element.style.fontWeight = '600';
            element.style.fontSize = '24px';
          }
        });
      };

      // Periodically check and update title color
      setInterval(forceUpdateTitleColor, 1000);
      
      // Periodically check for and hide Zego quit elements and popups
      setInterval(() => {
        // Hide quit elements
        const quitElements = document.querySelectorAll('[class*="quit"], [class*="Quit"], [class*="end"], [class*="End"], [class*="leave"], [class*="Leave"]');
        quitElements.forEach(element => {
          if (element.style.display !== 'none') {
            console.log('🚫 Hiding Zego quit element:', element.className);
            element.style.display = 'none';
            element.style.visibility = 'hidden';
            element.style.opacity = '0';
            element.style.pointerEvents = 'none';
          }
        });

        // Hide any Zego popups or modals
        const popupElements = document.querySelectorAll('[class*="popup"], [class*="modal"], [class*="dialog"], [class*="overlay"], [class*="Popup"], [class*="Modal"], [class*="Dialog"], [class*="Overlay"]');
        popupElements.forEach(element => {
          if (element.style.display !== 'none' && !element.classList.contains('kauvery-confirm-button')) {
            console.log('🚫 Hiding Zego popup/modal:', element.className);
            element.style.display = 'none';
            element.style.visibility = 'hidden';
            element.style.opacity = '0';
            element.style.pointerEvents = 'none';
          }
        });
        
        // Check for call ended text
        const callEndedElements = document.querySelectorAll('*');
        callEndedElements.forEach(element => {
          if (element.textContent && (
            element.textContent.toLowerCase().includes('you have left the room') ||
            element.textContent.toLowerCase().includes('call ended') ||
            element.textContent.toLowerCase().includes('consultation ended') ||
            element.textContent.toLowerCase().includes('return to home')
          )) {
            console.log('🚫 Hiding call ended text:', element.textContent);
            element.style.display = 'none';
            element.style.visibility = 'hidden';
            element.style.opacity = '0';
            element.style.pointerEvents = 'none';
            
            // Trigger our custom call ended page
            if (!callEnded) {
              console.log('🔄 Triggering custom call ended page from periodic check');
              setCallEnded(true);
            }
          }
        });
      }, 500);
      
      // Simple continuous border removal for pre-join view
      setInterval(() => {
        const prejoinElements = document.querySelectorAll('.zego-prejoin-view *, .zego-prejoin-container *, .zego-prejoin *');
        prejoinElements.forEach(element => {
          element.style.border = 'none';
          element.style.borderRadius = '0';
          element.style.boxShadow = 'none';
          element.style.outline = 'none';
        });
      }, 100);
      
              // Make functions globally available for debugging
        window.customizePreJoinView = customizePreJoinView;
        // window.createFloatingParticipantInfo = createFloatingParticipantInfo; // Disabled to prevent duplicates
        window.forceUpdateTitleColor = forceUpdateTitleColor;
        window.handleEndCall = handleEndCall;
        console.log('🔧 Debug functions available: customizePreJoinView(), forceUpdateTitleColor(), handleEndCall()');
      
    } catch (error) {
      console.warn('⚠️ Error applying custom styles:', error);
    }
  };

  // Initialize Zego with Kauvery styling (called directly on page load)
  const initializeZego = async () => {
    try {
      console.log('🔍 Debug: initializeZego called');
      console.log('🔍 Debug: Current state - zegoInitialized:', zegoInitialized);
      console.log('🔍 Debug: Current state - zegoInstanceRef.current:', !!zegoInstanceRef.current);
      console.log('🔍 Debug: Current state - appointmentData:', appointmentData);
      
      // Enhanced prevention of multiple initializations
      if (zegoInitialized || zegoInstanceRef.current || document.querySelector('[class*="zego"]')) {
        console.log('⚠️ Zego already initialized, skipping...');
        return;
      }

      // Safety check for appointment data
      if (!appointmentData || !appointmentData.roomId || !appointmentData.userid || !appointmentData.username) {
        console.log('⏳ Waiting for appointment data...');
        console.log('🔍 Debug: Missing appointment data -', {
          hasAppointmentData: !!appointmentData,
          hasRoomId: !!(appointmentData && appointmentData.roomId),
          hasUserid: !!(appointmentData && appointmentData.userid),
          hasUsername: !!(appointmentData && appointmentData.username)
        });
        setTimeout(initializeZego, 500);
        return;
      }

      // Wait for container to be ready
      if (!zegoContainerRef.current) {
        console.log('⏳ Waiting for container...');
        console.log('🔍 Debug: Container not ready - zegoContainerRef.current:', zegoContainerRef.current);
        setTimeout(initializeZego, 500);
        return;
      }

      console.log('🚀 Starting Zego initialization...');
      setInitializationError(null);

      // Check Zego credentials first
      const { appId: appID, serverSecret } = getZegoCredentials();
      console.log('🔍 Debug: Zego credentials check:', { 
        appID: appID ? 'Set' : 'Missing', 
        serverSecret: serverSecret ? 'Set' : 'Missing' 
      });
      
      if (!appID || !serverSecret) {
        throw new Error('Zego credentials are missing. Please check your environment variables.');
      }

      // Convert appID to number (Zego requires number, not string)
      const numericAppID = parseInt(appID, 10);
      if (isNaN(numericAppID)) {
        throw new Error(`Invalid appID: ${appID}. Must be a valid number.`);
      }
      
      console.log('🔍 Debug: AppID conversion:', { original: appID, numeric: numericAppID });
      
      console.log('🔍 Debug: Importing ZegoUIKitPrebuilt...');
      
      // Try different import approaches
      let ZegoUIKitPrebuilt;
      try {
        const zegoModule = await import('@zegocloud/zego-uikit-prebuilt');
        console.log('🔍 Debug: Full zegoModule:', zegoModule);
        ZegoUIKitPrebuilt = zegoModule.ZegoUIKitPrebuilt || zegoModule.default || zegoModule;
        console.log('🔍 Debug: ZegoUIKitPrebuilt imported successfully');
        console.log('🔍 Debug: ZegoUIKitPrebuilt object:', ZegoUIKitPrebuilt);
        console.log('🔍 Debug: Available methods:', Object.keys(ZegoUIKitPrebuilt || {}));
      } catch (importError) {
        console.error('❌ Error importing ZegoUIKitPrebuilt:', importError);
        throw new Error(`Failed to import ZegoUIKitPrebuilt: ${importError.message}`);
      }
      
      if (!ZegoUIKitPrebuilt) {
        throw new Error('ZegoUIKitPrebuilt is undefined after import');
      }
      
      console.log('🔍 Debug: ZegoUIKitPrebuilt.create method:', typeof ZegoUIKitPrebuilt.create);
      console.log('🔍 Debug: ZegoUIKitPrebuilt.generateKitTokenForTest method:', typeof ZegoUIKitPrebuilt.generateKitTokenForTest);
      
      console.log('🔍 Debug: Using Zego credentials from environment:', { 
        appID: numericAppID, 
        serverSecret: serverSecret.substring(0, 10) + '...' 
      });
      
      console.log('🔍 Debug: Generating kit token...');
      
      // Try different token generation methods
      let kitToken;
      if (ZegoUIKitPrebuilt.generateKitTokenForTest) {
        kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          numericAppID, 
          serverSecret, 
          appointmentData.roomId, 
          appointmentData.userid, 
          appointmentData.username
        );
      } else if (ZegoUIKitPrebuilt.generateKitToken) {
        kitToken = ZegoUIKitPrebuilt.generateKitToken(
          numericAppID, 
          serverSecret, 
          appointmentData.roomId, 
          appointmentData.userid, 
          appointmentData.username
        );
      } else {
        throw new Error('No token generation method found in ZegoUIKitPrebuilt');
      }
      
      console.log('🔍 Debug: Kit token generated:', kitToken.substring(0, 20) + '...');

      console.log('🔍 Debug: Creating Zego instance...');
      console.log('🔍 Debug: Kit token for create:', kitToken);
      
      if (!ZegoUIKitPrebuilt.create) {
        throw new Error('ZegoUIKitPrebuilt.create method is not available');
      }
      
      // Try creating the instance with different approaches
      let zp;
      try {
        zp = ZegoUIKitPrebuilt.create(kitToken);
      } catch (createError) {
        console.error('❌ Error creating Zego instance:', createError);
        throw new Error(`Failed to create Zego instance: ${createError.message}`);
      }
      
      console.log('🔍 Debug: Zego instance created:', zp);
      
      if (!zp) {
        throw new Error('Failed to create Zego instance - zp is undefined');
      }
      
      if (!zp.joinRoom) {
        console.error('❌ Zego instance methods:', Object.keys(zp));
        throw new Error('Zego instance does not have joinRoom method');
      }
      
      zegoInstanceRef.current = zp;
      console.log('🔍 Debug: Zego instance created successfully');

      // Join room with pre-join screen (original Zego interface)
      console.log('🔗 Joining room with ID:', appointmentData.roomId);
      console.log('🔍 Debug: Container element:', zegoContainerRef.current);
      
      try {
        console.log('🔍 Debug: Calling zp.joinRoom...');
        await zp.joinRoom({
          container: zegoContainerRef.current,
          scenario: {
            mode: ZegoUIKitPrebuilt.VideoConference,
          },
          showPreJoinView: true, // Restore pre-join view
          preJoinViewConfig: {
            title: `Welcome to Kauvery Hospital`,
            titleStyle: {
              color: '#962067',
              fontFamily: 'Poppins, sans-serif',
              fontWeight: '600',
              fontSize: '20px'
            }
          },
          onJoinRoom: () => {
            console.log('✅ Successfully joined Kauvery Hospital consultation room');
            
            // Track video call join event
            const appointmentId = AppointmentService.getAppointmentId();
            if (appointmentId && appointmentData) {
              // Start call session
              AppointmentService.startCallSession({
                appointment_id: parseInt(appointmentId),
                room_id: appointmentData.roomId,
                user_id: appointmentData.userid,
                username: appointmentData.username
              }).catch(err => console.error('Failed to start call session:', err));
              
              // Store video call event
              AppointmentService.storeVideoCallEvent({
                appointment_id: parseInt(appointmentId),
                event_type: 'join_room',
                room_id: appointmentData.roomId,
                user_id: appointmentData.userid,
                username: appointmentData.username,
                event_data: {
                  timestamp: new Date().toISOString(),
                  room_id: appointmentData.roomId,
                  user_id: appointmentData.userid,
                  username: appointmentData.username
                }
              }).catch(err => console.error('Failed to store video call event:', err));
            }
            
            // Use longer timeout to ensure pre-join to video transition is complete
            setTimeout(() => {
              setZegoInitialized(true);
              console.log('🔄 Zego initialization state updated - pre-join to video transition complete');
            }, 500);
          },
          onLeaveRoom: () => {
            console.log('👋 Left consultation room');
            
            // Track video call leave event
            const appointmentId = AppointmentService.getAppointmentId();
            if (appointmentId && appointmentData) {
              // End call session
              AppointmentService.endCallSession({
                appointment_id: parseInt(appointmentId)
              }).catch(err => console.error('Failed to end call session:', err));
              
              // Store video call event
              AppointmentService.storeVideoCallEvent({
                appointment_id: parseInt(appointmentId),
                event_type: 'leave_room',
                room_id: appointmentData.roomId,
                user_id: appointmentData.userid,
                username: appointmentData.username,
                event_data: {
                  timestamp: new Date().toISOString(),
                  room_id: appointmentData.roomId,
                  user_id: appointmentData.userid,
                  username: appointmentData.username
                }
              }).catch(err => console.error('Failed to store video call event:', err));
            }
            
            setZegoInitialized(false);
            setCallEnded(true);
            zegoInstanceRef.current = null;
          },
          onError: (error) => {
            console.error('❌ Zego join room error:', error);
            setInitializationError(error);
          },
                  onPreJoinViewReady: () => {
          console.log('🎯 Pre-join view is ready - join page loaded successfully');
          // Customize the join button text and add participant info
          setTimeout(() => {
            customizePreJoinView();
          }, 500);
        },
        onJoinRoomSuccess: () => {
          console.log('🎉 Join room success - transitioning to video interface');
        }
        });
              console.log('🔍 Debug: zp.joinRoom completed successfully');
    } catch (joinError) {
      console.error('❌ Error during room join:', joinError);
      setInitializationError(joinError.message || 'Failed to join room');
      throw joinError;
    }

    console.log('✅ Zego initialization completed successfully');
    
    // Fallback: Set initialized state if onJoinRoom doesn't trigger
    setTimeout(() => {
      if (!zegoInitialized && zegoInstanceRef.current) {
        console.log('🔄 Fallback: Setting Zego initialized state');
        setZegoInitialized(true);
      }
    }, 2000);
    
    return true;
    } catch (error) {
      console.error('❌ Error initializing Zego:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      setInitializationError(error.message || 'Failed to initialize video consultation');
      setZegoInitialized(false);
      
      // Show user-friendly error message
      showNotification('Unable to connect to video consultation. Please refresh the page.', 'error');
      
      // Reset after 5 seconds to allow retry
      setTimeout(() => {
        setInitializationError(null);
        zegoInstanceRef.current = null;
      }, 5000);
      
      throw error;
    }
  };

  // Styles object
  const styles = {
    body: {
      fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: colors.white, // White background
      color: colors.kauveryDarkGrey,
      overflow: 'hidden',
      height: '100vh',
      maxHeight: '100vh',
      margin: 0,
      padding: 0
    },
    header: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '70px', // Increased header height
              background: colors.white, // White header background
        borderBottom: `3px solid ${colors.kauveryPurple}`, // Purple border
        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.15)', // Much more prominent shadow
        filter: 'drop-shadow(0 8px 25px rgba(0, 0, 0, 0.15))', // Additional drop-shadow for better browser support
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: `${spacing.sm} ${spacing.lg}`,
      // Responsive header
      '@media (max-width: 768px)': {
        height: '60px',
        padding: `${spacing.xs} ${spacing.md}`,
        boxShadow: '0 6px 20px rgba(150, 32, 103, 0.25), 0 3px 10px rgba(0, 0, 0, 0.12)'
      },
      '@media (max-width: 480px)': {
        height: '55px',
        padding: `${spacing.xs} ${spacing.sm}`,
        boxShadow: '0 4px 15px rgba(150, 32, 103, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1)'
      }
    },
    brandingSection: {
      display: 'flex',
      alignItems: 'center'
    },
    logoContainer: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing.md
    },
    yearsBadge: {
      width: '100px', // Reduced logo size
      height: '48px', // Reduced logo height
      background: 'transparent',
      borderRadius: radius.md,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      // Responsive logo
      '@media (max-width: 768px)': {
        width: '80px',
        height: '40px'
      },
      '@media (max-width: 480px)': {
        width: '70px',
        height: '35px'
      }
    },
    hospitalInfo: {
      display: 'flex',
      flexDirection: 'column'
    },
    hospitalName: {
      fontFamily: "'Poppins', sans-serif",
      fontSize: '18px', // Reduced font size
      fontWeight: 600,
      color: colors.kauveryPurple, // Keep purple for brand consistency
      margin: 0,
      lineHeight: 1.2,
      // Responsive text
      '@media (max-width: 768px)': {
        fontSize: '16px'
      },
      '@media (max-width: 480px)': {
        fontSize: '14px'
      }
    },
    hospitalSubtitle: {
      fontFamily: "'Poppins', sans-serif",
      fontSize: '11px', // Reduced font size
      color: colors.kauveryDarkGrey,
      margin: 0,
      fontWeight: 500,
      // Responsive text
      '@media (max-width: 768px)': {
        fontSize: '10px'
      },
      '@media (max-width: 480px)': {
        fontSize: '9px'
      }
    },
    appointmentSection: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing.xl
    },
    appointmentDetails: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: `${spacing.xs} ${spacing.md}`,
      padding: spacing.sm,
      background: colors.grey50,
      borderRadius: radius.lg,
      border: `2px solid ${colors.kauveryPink}`,
      minWidth: '350px'
    },
    appointmentItem: {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px'
    },
    appointmentLabel: {
      fontFamily: "'Poppins', sans-serif",
      fontSize: '10px',
      color: colors.kauveryLightGrey,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    },
    appointmentValue: {
      fontFamily: "'Poppins', sans-serif",
      fontSize: '12px',
      color: colors.kauveryDarkGrey,
      fontWeight: 600
    },
    statusBadge: {
      display: 'flex',
      alignItems: 'center',
      gap: spacing.sm,
      background: `linear-gradient(135deg, ${colors.kauveryYellowOrange}, ${colors.kauveryPink})`,
      color: colors.white,
      padding: `${spacing.sm} ${spacing.md}`, // Reduced padding
      borderRadius: radius.xl,
      fontWeight: 600,
      fontSize: '13px', // Reduced font size
      boxShadow: shadows.md,
      // Responsive status badge
      '@media (max-width: 768px)': {
        padding: `${spacing.xs} ${spacing.sm}`,
        fontSize: '11px',
        gap: spacing.xs
      },
      '@media (max-width: 480px)': {
        padding: `${spacing.xs} ${spacing.xs}`,
        fontSize: '10px',
        gap: spacing.xs
      }
    },
    statusIcon: {
      fontSize: '16px'
    },
    statusText: {
      fontWeight: 700
    },
    notification: {
      position: 'fixed',
      top: spacing.lg,
      right: spacing.lg,
      background: colors.white,
      color: colors.kauveryDarkGrey,
      padding: `${spacing.md} ${spacing.lg}`,
      borderRadius: radius.lg,
      boxShadow: shadows.lg,
      zIndex: 100,
      transform: 'translateX(100%)',
      transition: 'transform 0.3s ease'
    }
  };

  // Access Denied Component
  const AccessDeniedPage = () => {
    console.log('🔍 Debug: AccessDeniedPage component rendered');
    console.log('🔍 Debug: AccessDeniedPage - accessDeniedReason:', accessDeniedReason);
    
    return (
      <div style={{
        ...styles.body,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl
      }}>
      <div style={{
        background: colors.white,
        borderRadius: radius.xl,
        padding: spacing['2xl'],
        maxWidth: '500px',
        textAlign: 'center',
        boxShadow: shadows.lg,
        border: `3px solid ${colors.kauveryRed}`
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: `linear-gradient(135deg, ${colors.kauveryRed}, ${colors.kauveryPink})`,
          borderRadius: radius.full,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: '32px'
        }}>
          ⚠️
        </div>
        
        <h1 style={{
          color: colors.kauveryRed,
          fontSize: '28px',
          fontWeight: 700,
          margin: '0 0 16px 0',
          fontFamily: "'Google Sans', sans-serif"
        }}>
          Access Denied
        </h1>
        
        <p style={{
          color: colors.kauveryDarkGrey,
          fontSize: '16px',
          lineHeight: 1.6,
          margin: '0 0 24px 0'
        }}>
          {decodingError || accessDeniedReason}
        </p>
        
        <div style={{
          background: colors.grey50,
          borderRadius: radius.lg,
          padding: spacing.lg,
          margin: '24px 0',
          border: `2px solid ${colors.grey200}`
        }}>
          <h3 style={{
            color: colors.kauveryPurple,
            fontSize: '18px',
            fontWeight: 600,
            margin: '0 0 12px 0'
          }}>
            Required Parameters:
          </h3>
          <ul style={{
            textAlign: 'left',
            color: colors.kauveryDarkGrey,
            fontSize: '14px',
            lineHeight: 1.8,
            margin: 0,
            paddingLeft: '20px'
          }}>
            <li><strong>id</strong> - Encoded Appointment ID containing all parameters</li>
          </ul>
          
          <div style={{
            background: colors.grey100,
            borderRadius: radius.md,
            padding: spacing.md,
            marginTop: spacing.md,
            border: `1px solid ${colors.grey300}`
          }}>
            <h4 style={{
              color: colors.kauveryPurple,
              fontSize: '14px',
              fontWeight: 600,
              margin: '0 0 8px 0'
            }}>
              Example URL:
            </h4>
            <p style={{
              color: colors.kauveryDarkGrey,
              fontSize: '12px',
              margin: 0,
              fontFamily: 'monospace',
              wordBreak: 'break-all'
            }}>
              {/* http://localhost:3000/?id=ODFlvLi0k4Ahvs6YIHnKCbJ//F1frN/vbVq+1c55QOZ1oa3keYEEZjCHHyvID7X5jfNNotg52mwz1TKIzOGJRw== */}
            </p>
          </div>
        </div>
        
        <button 
          onClick={() => window.history.back()}
          style={{
            background: `linear-gradient(135deg, ${colors.kauveryPurple}, ${colors.kauveryViolet})`,
            color: colors.white,
            border: 'none',
            borderRadius: radius.lg,
            padding: `${spacing.md} ${spacing.xl}`,
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: spacing.lg
          }}
        >
          🔙 Go Back
        </button>
      </div>
    </div>
    );
  };

  // Health Packages Page Component
  const HealthPackagesPage = () => {
    const [packages, setPackages] = useState(healthPackages);

    const togglePackage = (packageId) => {
      setPackages(prevPackages => 
        prevPackages.map(pkg => 
          pkg.id === packageId 
            ? { ...pkg, expanded: !pkg.expanded }
            : pkg
        )
      );
    };

    return (
      <div style={{
        ...styles.body,
        padding: spacing.xl,
        background: colors.grey50
      }}>
        {/* Header */}
        <div style={{
          ...styles.header,
          boxShadow: '0 8px 25px rgba(150, 32, 103, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15)',
          filter: 'drop-shadow(0 8px 25px rgba(150, 32, 103, 0.3))'
        }}>
          <div style={styles.brandingSection}>
            <div style={styles.logoContainer}>
              <div style={styles.yearsBadge}>
                <img src={logoImage} alt="Kauvery Hospital Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
              <div style={styles.hospitalInfo}>
                <h1 style={styles.hospitalName}>Kauvery Hospital</h1>
                <p style={styles.hospitalSubtitle}>Health Check Packages</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          paddingTop: spacing.xl
        }}>
          <h1 style={{
            color: colors.kauveryPurple,
            fontSize: '32px',
            fontWeight: 700,
            textAlign: 'center',
            margin: '0 0 40px 0',
            fontFamily: "'Poppins', sans-serif"
          }}>
            Choose Your Health Check Package
          </h1>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
            gap: spacing.lg,
            marginBottom: spacing.xl
          }}>
            {packages.map((pkg) => (
              <div key={pkg.id} style={{
                background: colors.white,
                borderRadius: radius.lg,
                border: `2px solid ${pkg.expanded ? colors.kauveryPink : colors.grey200}`,
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                boxShadow: pkg.expanded ? shadows.md : shadows.sm
              }}>
                {/* Package Header */}
                <div 
                  onClick={() => togglePackage(pkg.id)}
                  style={{
                    padding: spacing.lg,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: pkg.expanded ? colors.grey50 : colors.white,
                    transition: 'all 0.3s ease'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.md
                  }}>
                    <span style={{
                      fontSize: '24px',
                      width: '40px',
                      textAlign: 'center'
                    }}>
                      {pkg.icon}
                    </span>
                    <h3 style={{
                      color: colors.kauveryPurple,
                      fontSize: '18px',
                      fontWeight: 600,
                      margin: 0,
                      fontFamily: "'Poppins', sans-serif"
                    }}>
                      {pkg.title}
                    </h3>
                  </div>
                  <span style={{
                    fontSize: '20px',
                    color: colors.kauveryPurple,
                    transition: 'transform 0.3s ease',
                    transform: pkg.expanded ? 'rotate(180deg)' : 'rotate(0deg)'
                  }}>
                    ▼
                  </span>
                </div>

                {/* Package Details */}
                {pkg.expanded && (
                  <div style={{
                    padding: `0 ${spacing.lg} ${spacing.lg} ${spacing.lg}`,
                    borderTop: `1px solid ${colors.grey200}`,
                    background: colors.grey50
                  }}>
                    <h4 style={{
                      color: colors.kauveryPurple,
                      fontSize: '16px',
                      fontWeight: 600,
                      margin: '0 0 12px 0'
                    }}>
                      Included Services:
                    </h4>
                    <ul style={{
                      margin: 0,
                      paddingLeft: spacing.lg,
                      color: colors.kauveryDarkGrey,
                      fontSize: '14px',
                      lineHeight: 1.8
                    }}>
                      {pkg.services.map((service, index) => (
                        <li key={index} style={{
                          marginBottom: spacing.xs,
                          position: 'relative'
                        }}>
                          <span style={{
                            color: colors.kauveryPink,
                            marginRight: spacing.sm,
                            fontWeight: 'bold'
                          }}>
                            •
                          </span>
                          {service}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(135deg, #962067, #A23293)',
          color: colors.white,
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
          <span>© 2025 Kauvery Hospital. All Rights Reserved.</span>
          <span>|</span>
          <a 
            href="https://www.kauveryhospital.com/disclaimer/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              color: colors.white,
              textDecoration: 'none',
              transition: 'color 0.3s ease',
              fontSize: '13px',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => e.target.style.color = '#f0f0f0'}
            onMouseLeave={(e) => e.target.style.color = colors.white}
          >
            Disclaimer
          </a>
          <span>|</span>
          <a 
            href="https://www.kauveryhospital.com/privacy/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              color: colors.white,
              textDecoration: 'none',
              transition: 'color 0.3s ease',
              fontSize: '13px',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => e.target.style.color = '#f0f0f0'}
            onMouseLeave={(e) => e.target.style.color = colors.white}
          >
            Privacy Policy
          </a>
          <span>|</span>
          <a 
            href="https://www.kauveryhospital.com/terms-conditions/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{
              color: colors.white,
              textDecoration: 'none',
              transition: 'color 0.3s ease',
              fontSize: '13px',
              fontWeight: '500'
            }}
            onMouseEnter={(e) => e.target.style.color = '#f0f0f0'}
            onMouseLeave={(e) => e.target.style.color = colors.white}
          >
            T&C
          </a>
        </div>
      </div>
    );
  };

  // Call Ended Page Component
  const CallEndedPage = () => {
    console.log('🔍 Debug: CallEndedPage component rendered');
    
    return (
      <div 
        className="kauvery-call-ended"
        style={{
          ...styles.body,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl
        }}
      >
        <div style={{
          background: colors.white,
          borderRadius: radius.xl,
          padding: spacing['2xl'],
          maxWidth: '500px',
          textAlign: 'center',
          boxShadow: shadows.lg,
          border: `3px solid ${colors.kauveryPink}`
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: `linear-gradient(135deg, ${colors.kauveryPink}, ${colors.kauveryViolet})`,
            borderRadius: radius.full,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            fontSize: '32px'
          }}>
            ✅
          </div>
          
          <h1 style={{
            color: colors.kauveryPurple,
            fontSize: '28px',
            fontWeight: 700,
            margin: '0 0 16px 0',
            fontFamily: "'Poppins', sans-serif"
          }}>
            Consultation Completed
          </h1>
          
          <p style={{
            color: colors.kauveryDarkGrey,
            fontSize: '16px',
            lineHeight: 1.6,
            margin: '0 0 24px 0'
          }}>
            Your video consultation has been successfully completed. Thank you for choosing Kauvery Hospital.
          </p>
          
          <div style={{
            background: colors.grey50,
            borderRadius: radius.lg,
            padding: spacing.lg,
            margin: '24px 0',
            border: `2px solid ${colors.grey200}`
          }}>
            <h3 style={{
              color: colors.kauveryPurple,
              fontSize: '18px',
              fontWeight: 600,
              margin: '0 0 12px 0'
            }}>
              Consultation Summary:
            </h3>
            <ul style={{
              textAlign: 'left',
              color: colors.kauveryDarkGrey,
              fontSize: '14px',
              lineHeight: 1.8,
              margin: 0,
              paddingLeft: '20px'
            }}>
              <li><strong>Doctor:</strong> {appointmentData?.doctorName || ''}</li>
              <li><strong>Department:</strong> {appointmentData?.department || 'General Medicine'}</li>
              <li><strong>Patient:</strong> {appointmentData?.username || 'Patient'}</li>
              <li><strong>Room:</strong> {appointmentData?.roomId || `ROOM_${appointmentData?.id || 'TEST123'}`}</li>
            </ul>
          </div>
          
          <div style={{
            display: 'flex',
            gap: spacing.md,
            justifyContent: 'center',
            flexWrap: 'wrap'
          }}>
            <button 
              onClick={() => window.location.reload()}
              style={{
                background: `linear-gradient(135deg, ${colors.kauveryPurple}, ${colors.kauveryViolet})`,
                color: colors.white,
                border: 'none',
                borderRadius: radius.lg,
                padding: `${spacing.md} ${spacing.xl}`,
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              🔄 Start New Consultation
            </button>
            
            <button 
              onClick={() => window.history.back()}
              style={{
                background: colors.grey200,
                color: colors.kauveryDarkGrey,
                border: 'none',
                borderRadius: radius.lg,
                padding: `${spacing.md} ${spacing.xl}`,
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
            >
              🔙 Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Show access denied page if validation failed or decryption error
  console.log('🔍 Debug: Render check - accessDenied:', accessDenied);
  console.log('🔍 Debug: Render check - appointmentData:', appointmentData);
  console.log('🔍 Debug: Render check - callEnded:', callEnded);
  console.log('🔍 Debug: Render check - decodingError:', decodingError);
  
  if (accessDenied || decodingError) {
    console.log('🔍 Debug: Rendering AccessDeniedPage');
    return <AccessDeniedPage />;
  }

  // Show health packages page if call ended and health packages should be shown
  if (showHealthPackages) {
    console.log('🔍 Debug: Rendering HealthPackagesPage');
    console.log('🔍 Debug: showHealthPackages state:', showHealthPackages);
    console.log('🔍 Debug: callEnded state:', callEnded);
    console.log('🔍 Debug: Health packages page should be visible now!');
    return <HealthPackagesPage />;
  }
  
  // Show call ended page if call has been completed
  if (callEnded) {
    console.log('🔍 Debug: Rendering CallEndedPage');
    return <CallEndedPage />;
  }

  // Show loading if appointment data is not yet loaded or if decryption is in progress
  if (!appointmentData || isDecoding) {
    return (
      <div style={{
        ...styles.body,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          textAlign: 'center',
          color: colors.kauveryPurple
        }}>
          <div style={{
            width: '120px',
            height: '60px',
            background: 'transparent',
            borderRadius: radius.md,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            overflow: 'hidden'
          }}>
            <img 
              src={logoImage} 
              alt="Kauvery Hospital Logo" 
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
            />
          </div>
          <h2 style={{ margin: '0 0 12px 0', fontSize: '24px' }}>Kauvery Hospital</h2>
          <p style={{ margin: 0, opacity: 0.8 }}>
            {isDecoding ? 'Decrypting appointment details...' : 'Validating appointment details...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.body}>
      {/* Compact Header */}
      <div style={{
        ...styles.header,
        boxShadow: '0 8px 25px rgba(150, 32, 103, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15)',
        filter: 'drop-shadow(0 8px 25px rgba(150, 32, 103, 0.3))'
      }}>
        {/* Hospital Branding */}
        <div style={styles.brandingSection}>
          <div style={styles.logoContainer}>
            <div style={styles.yearsBadge}>
              <img src={logoImage} alt="Kauvery Hospital Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div style={styles.hospitalInfo}>
              <h1 style={styles.hospitalName}>Kauvery Hospital</h1>
              <p style={styles.hospitalSubtitle}>Video Consultation Platform</p>
            </div>
          </div>
        </div>

        {/* Status Badge Only */}
        <div style={styles.statusBadge}>
          <span style={styles.statusIcon}>🔒</span>
          <span style={styles.statusText}>Secure Session</span>
        </div>
      </div>



            {/* Zego Video Container with Error Boundary */}
      <VideoErrorBoundary>
        <ZegoVideoInterface 
          containerRef={zegoContainerRef}
          isInitialized={zegoInitialized}
          initializationError={initializationError}
          appointmentData={appointmentData}
          onRetry={() => {
            setInitializationError(null);
            setZegoInitialized(false);
            zegoInstanceRef.current = null;
            initializeZego().catch(console.error);
          }}
          showLeaveRoomPopup={showLeaveRoomPopup}
          onConfirmLeaveRoom={handleConfirmLeaveRoom}
          onCancelLeaveRoom={handleCancelLeaveRoom}
        />
      </VideoErrorBoundary>

      {/* Notification */}
      <div style={styles.notification}>
        <span>{notification.message}</span>
      </div>



      {/* Footer */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(135deg, #962067, #A23293)', // Updated gradient as requested
        color: colors.white,
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
        gap: '10px',
        // Responsive footer
        '@media (max-width: 768px)': {
          padding: '10px 16px',
          fontSize: '12px',
          height: '35px',
          gap: '8px'
        },
        '@media (max-width: 480px)': {
          padding: '8px 12px',
          fontSize: '11px',
          height: '30px',
          gap: '6px',
          flexWrap: 'wrap'
        }
      }}>
        <span style={{ 
          fontSize: '13px', 
          color: colors.white,
          '@media (max-width: 768px)': { fontSize: '12px' },
          '@media (max-width: 480px)': { fontSize: '11px' }
        }}>© 2025 Kauvery Hospital. All Rights Reserved.</span>
        <span style={{ 
          color: colors.white, 
          fontSize: '12px',
          '@media (max-width: 768px)': { fontSize: '11px' },
          '@media (max-width: 480px)': { fontSize: '10px' }
        }}>|</span>
        <a 
          href="https://www.kauveryhospital.com/disclaimer/" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            color: colors.white,
            textDecoration: 'none',
            transition: 'color 0.3s ease',
            fontSize: '13px',
            fontWeight: '500',
            '@media (max-width: 768px)': { fontSize: '12px' },
            '@media (max-width: 480px)': { fontSize: '11px' }
          }}
          onMouseEnter={(e) => e.target.style.color = '#f0f0f0'}
          onMouseLeave={(e) => e.target.style.color = colors.white}
        >
          Disclaimer
        </a>
        <span style={{ 
          color: colors.white, 
          fontSize: '12px',
          '@media (max-width: 768px)': { fontSize: '11px' },
          '@media (max-width: 480px)': { fontSize: '10px' }
        }}>|</span>
        <a 
          href="https://www.kauveryhospital.com/privacy/" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            color: colors.white,
            textDecoration: 'none',
            transition: 'color 0.3s ease',
            fontSize: '13px',
            fontWeight: '500',
            '@media (max-width: 768px)': { fontSize: '12px' },
            '@media (max-width: 480px)': { fontSize: '11px' }
          }}
          onMouseEnter={(e) => e.target.style.color = '#f0f0f0'}
          onMouseLeave={(e) => e.target.style.color = colors.white}
        >
          Privacy Policy
        </a>
        <span style={{ 
          color: colors.white, 
          fontSize: '12px',
          '@media (max-width: 768px)': { fontSize: '11px' },
          '@media (max-width: 480px)': { fontSize: '10px' }
        }}>|</span>
        <a 
          href="https://www.kauveryhospital.com/terms-conditions/" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            color: colors.white,
            textDecoration: 'none',
            transition: 'color 0.3s ease',
            fontSize: '13px',
            fontWeight: '500',
            '@media (max-width: 768px)': { fontSize: '12px' },
            '@media (max-width: 480px)': { fontSize: '11px' }
          }}
          onMouseEnter={(e) => e.target.style.color = '#f0f0f0'}
          onMouseLeave={(e) => e.target.style.color = colors.white}
        >
          T&C
        </a>
      </div>
      

    </div>
  );
};

export default VideoConsultation; 