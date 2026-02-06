import React from 'react';
import { theme } from '../theme/colors';

/**
 * Shared footer for OTP page and Video Consultation page.
 * Slightly dark pink background (#fce4ec), fixed at bottom.
 */
const ConsultationFooter = () => (
  <div style={{
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '12px 20px',
    textAlign: 'center',
    fontSize: '11px',
    color: theme.textSecondary,
    background: theme.headerFooterBg,
    borderTop: `1px solid ${theme.border}`,
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px'
  }}>
    <div>© 2026 Kauvery Hospital. All rights reserved.</div>
    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontWeight: '600', fontSize: '10px' }}>
      <span style={{ cursor: 'pointer', color: theme.primary }}>PRIVACY POLICY</span>
      <span style={{ cursor: 'pointer', color: theme.primary }}>TERMS OF USE</span>
      <span style={{ cursor: 'pointer', color: theme.primary }}>HELP CENTER</span>
    </div>
  </div>
);

export default ConsultationFooter;
