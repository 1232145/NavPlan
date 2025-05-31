import React, { useState } from 'react';
import MapContainer from '../../components/MapContainer';
import ItineraryPanel from '../../components/ItineraryPanel';
import { Button } from '../../components/Button';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import api from '../../services/api/axios';
import './index.css';

const MapPage: React.FC = () => {
  const [mapCenter, setMapCenter] = useState({ lat: 40.7128, lng: -74.0060 });
  const [activeTab, setActiveTab] = useState<'saved' | 'search'>('search');
  const navigate = useNavigate();
  const { setUser } = useAppContext();

  const handleMyListsClick = () => {
    navigate('/lists');
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
    <div className="map-page-content">
      <div className="navbar-column">
        <Button size="md" onClick={handleMyListsClick}>
          My Lists
        </Button>
        <Button size="md" onClick={handleSignOut}>
          Sign Out
        </Button>
      </div>
      <MapContainer mapCenter={mapCenter} setMapCenter={setMapCenter} activeTab={activeTab} setActiveTab={setActiveTab} />
      <ItineraryPanel activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

export default MapPage; 