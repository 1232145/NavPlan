import React from 'react';
import { Map } from 'lucide-react';
import './index.css';
import { Button } from '../../components/Button';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import api from '../../services/api/axios';

export interface HeaderProps {
  onMyListsClick: () => void;
  onLogoClick: () => void;
}

// --- Main Component ---
const Header: React.FC<HeaderProps> = ({ onMyListsClick, onLogoClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAppContext();
  const isMapPage = location.pathname === '/map';

  const handleGoToMap = () => {
    navigate('/map');
  };

  const handleSignOut = async () => {
    try {
      await api.post('/logout');
      setUser(null);
      navigate('/');
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  return (
    <header className={`header ${isMapPage ? 'map-page' : ''}`}>
      <div className="header-content">
        <div className="logo" style={{ cursor: 'pointer' }} onClick={onLogoClick}>
          <Map size={28} />
          <h1>NavPlan</h1>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
          <Button variant="primary" size="md" onClick={handleGoToMap}>
            Go to Map
          </Button>
          <Button variant="primary" size="md" onClick={onMyListsClick}>
            Generate Schedule
          </Button>
          <Button variant="primary" size="md" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;