import React from 'react';
import { Map } from 'lucide-react';
import './index.css';
import { SearchBar } from '../../components/SearchBar';
import { Coordinates, Place } from '../../types';
import { Button } from '../../components/Button';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import api from '../../services/api/axios';

export interface HeaderProps {
  mapCenter?: Coordinates;
  onMyListsClick: () => void;
  onLogoClick: () => void;
}

// --- Utility for dispatching search results event ---
function dispatchSearchResults(places: Place[]) {
  window.dispatchEvent(new CustomEvent('search-places', { detail: places }));
}

// --- Main Component ---
const Header: React.FC<HeaderProps> = ({ mapCenter, onMyListsClick, onLogoClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, setUser } = useAppContext();
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
        {location.pathname === '/map' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 24, marginRight: 24 }}>
            <SearchBar onSearchResults={dispatchSearchResults} mapCenter={mapCenter} />
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
          {location.pathname !== '/map' && (
            <>
              <Button variant="primary" size="md" onClick={handleGoToMap}>
                Go to Map
              </Button>
              <Button variant="primary" size="md" onClick={onMyListsClick}>
                My Lists
              </Button>
              <Button variant="primary" size="md" onClick={handleSignOut}>
                Sign Out
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;