import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { initErrorLog } from './core/platform/errorLog';
import './ui/styles/tokens.css';
import './ui/styles/safe-area.css';
import './ui/styles/base.css';
import './ui/styles/components.css';

// Set before first paint: the stylesheet needs to know whether there is a
// native video layer behind this web view. See the comment in base.css.
document.documentElement.dataset.native = String(Capacitor.isNativePlatform());

initErrorLog();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
