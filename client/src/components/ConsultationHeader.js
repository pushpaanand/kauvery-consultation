import React from 'react';
import { theme } from '../theme/colors';

/**
 * Shared header for OTP page and Video Consultation page.
 * Slightly dark pink background (#fce4ec).
 */
const ConsultationHeader = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 24px',
    background: theme.headerFooterBg,
    borderBottom: `1px solid ${theme.border}`,
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <img
        src={`${process.env.PUBLIC_URL || ''}/KauveryLogo.png`}
        alt="Kauvery Hospital"
        style={{ width: '40px', height: '40px', objectFit: 'contain' }}
      />
      <div>
        <div style={{ color: theme.primary, fontWeight: 'bold', fontSize: '16px', lineHeight: '1' }}>Kauvery Teleconnect</div>
        <div style={{ color: theme.textSecondary, fontSize: '9px', letterSpacing: '0.5px', marginTop: '1px' }}>VIDEO CONSULTATION SERVICE</div>
      </div>
    </div>
    <div style={{ textAlign: 'right' }}>
      <div style={{ color: theme.textSecondary, fontSize: '9px', fontWeight: '600' }}>SUPPORT LINE</div>
      <div style={{ color: theme.primary, fontSize: '13px', fontWeight: '700' }}>+91 44 4000 6000</div>
    </div>
  </div>
);

export default ConsultationHeader;
