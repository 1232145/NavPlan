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

import React, { useState, useEffect } from 'react';
import PlacesMap from '../../components/PlacesMap';
import ItineraryPanel from '../../components/ItineraryPanel';
import NavbarColumn from '../../components/NavbarColumn';
import { SearchBar } from '../../components/SearchBar';
import { Place, Coordinates } from '../../types';
import { useAppContext } from '../../context/AppContext';
import './index.css';

// Utility for dispatching search results event
function dispatchSearchResults(places: Place[]) {
  window.dispatchEvent(new CustomEvent('search-places', { detail: places }));
}

const MapPage: React.FC = () => {
  const { setSearchResults } = useAppContext();
  const [mapCenter, setMapCenter] = useState<Coordinates>({ lat: 40.7128, lng: -74.0060 });
  const [activeTab, setActiveTab] = useState<'saved' | 'search'>('search');

  useEffect(() => {
    return () => {
      setSearchResults([]);
    };
  }, [setSearchResults]);

  return (
    <div className="map-page-content">
      <NavbarColumn />
      <div className="map-container-wrapper">
        <div className="search-bar-container">
          <SearchBar 
            onSearchResults={dispatchSearchResults} 
            mapCenter={mapCenter} 
          />
        </div>
        <PlacesMap mapCenter={mapCenter} setMapCenter={setMapCenter} activeTab={activeTab} setActiveTab={setActiveTab} />
        <ItineraryPanel activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
};

export default MapPage; 