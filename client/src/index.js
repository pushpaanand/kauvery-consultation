import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { validateEnvironmentVariables } from './utils/validateEnvironment';

// Validate environment variables to prevent internal IP disclosure
try {
  validateEnvironmentVariables();
} catch (error) {
  console.error('❌ Environment validation failed:', error.message);
  // In production, fail the build
  if (process.env.NODE_ENV === 'production') {
    throw error;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
