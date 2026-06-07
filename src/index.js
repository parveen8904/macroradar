import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import MacroDashboard from './App';
import { AuthProvider } from './AuthContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <MacroDashboard />
    </AuthProvider>
  </React.StrictMode>
);
