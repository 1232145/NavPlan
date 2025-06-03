/**
 * MapPage Component
 * 
 * The main page for exploring and saving places on a map.
 * 
 * Features:
 * - Interactive map for searching and viewing places
 * - Side panel for managing saved places and search results
 * - Navigation controls for accessing lists and signing out
 * - Integrated search functionality
 * 
 * This page combines the PlacesMap and ItineraryPanel components to provide
 * a complete interface for place discovery and itinerary building.
 */

import React, { useState } from 'react';
import PlacesMap from '../../components/PlacesMap';
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
      <PlacesMap mapCenter={mapCenter} setMapCenter={setMapCenter} activeTab={activeTab} setActiveTab={setActiveTab} />
      <ItineraryPanel activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

export default MapPage; 