import React from 'react';
import './index.css';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import axios from 'axios';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { setUser } = useAppContext();

  const handleSignOut = async () => {
    await axios.post('http://localhost:8000/api/logout', {}, { withCredentials: true });
    setUser(null);
    navigate('/login');
  };

  return (
    <div className="landing-page-root">
      <div className="landing-page-content">
        <h1 className="landing-page-logo">Nav Plan</h1>
        <button className="landing-login-btn" onClick={() => navigate('/map')}>
          Go to Map
        </button>
        <button className="landing-login-btn" onClick={handleSignOut} style={{ background: '#d32f2f' }}>
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default LandingPage; 