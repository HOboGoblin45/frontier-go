import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App.jsx';
import { initErrorLog } from './lib/errorLog.js';
import './styles/safe-area.css';
import './styles/index.css';

// Mark the native shell before first paint so CSS can keep browser-only
// affordances out of the shipped app. Exactly one rule needs it today — the
// desktop dev view in styles/index.css, which a width-only media query was
// handing to every iPad — and the comment there explains why a media query
// alone was not trusted to hold.
if (Capacitor.isNativePlatform()) {
  document.documentElement.dataset.native = '';
}

initErrorLog();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
