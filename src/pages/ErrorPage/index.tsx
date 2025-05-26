import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ErrorPageProps {
  message?: string;
}

const ErrorPage: React.FC<ErrorPageProps> = ({ message }) => {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ background: 'white', padding: 40, borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.07)', textAlign: 'center' }}>
        <h1 style={{ color: '#d32f2f', marginBottom: 16 }}>Error</h1>
        <p style={{ marginBottom: 32 }}>
          {message || 'Your session has expired or you are not authenticated.\nPlease log in again.'}
        </p>
        <button
          style={{
            background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, padding: '12px 32px', fontSize: '1.1rem', fontWeight: 500, cursor: 'pointer',
          }}
          onClick={() => { navigate('/'); }}
        >
          Go to Login
        </button>
      </div>
    </div>
  );
};

export default ErrorPage; 