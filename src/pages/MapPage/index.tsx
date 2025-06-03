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
import NavbarColumn from '../../components/NavbarColumn';
import './index.css';

const MapPage: React.FC = () => {
  const [mapCenter, setMapCenter] = useState({ lat: 40.7128, lng: -74.0060 });
  const [activeTab, setActiveTab] = useState<'saved' | 'search'>('search');

  return (
    <div className="map-page-content">
      <NavbarColumn />
      <div className="map-container-wrapper">
        <PlacesMap mapCenter={mapCenter} setMapCenter={setMapCenter} activeTab={activeTab} setActiveTab={setActiveTab} />
        <ItineraryPanel activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
};

export default MapPage; 