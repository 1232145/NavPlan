import React from 'react';
import { Map } from 'lucide-react';
import './index.css';
import { SearchBar } from '../../components/SearchBar';
import { Coordinates, Place } from '../../types';
import { Button } from '../../components/Button';
import { useLocation } from 'react-router-dom';

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
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo" style={{ cursor: 'pointer' }} onClick={onLogoClick}>
          <Map size={28} />
          <h1>Build Me a Day</h1>
        </div>
        {location.pathname === '/map' && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: 24, marginRight: 24 }}>
            <SearchBar onSearchResults={dispatchSearchResults} mapCenter={mapCenter} />
          </div>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <Button variant="primary" size="md" onClick={onMyListsClick} style={{ color: 'white', background: '#2563eb', fontWeight: 500 }}>
            My Lists
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;