import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { initializeDB } from './db/database';
import './index.css';
import App from './App.jsx';

initializeDB().then(() => {
  console.log('School Portal DB initialized');
}).catch(err => {
  console.error('DB init error:', err);
});

// Electron loads via file://, which requires hash-based routing.
// In the browser dev server we keep BrowserRouter for cleaner URLs.
const isElectron = window.navigator.userAgent.toLowerCase().includes('electron');
const Router = isElectron ? HashRouter : BrowserRouter;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  </StrictMode>,
);
