import React, { useState } from 'react';
import MapContainer from '../../components/MapContainer';
import ItineraryPanel from '../../components/ItineraryPanel';
import './index.css';

const MapPage: React.FC = () => {
  const [mapCenter, setMapCenter] = useState({ lat: 40.7128, lng: -74.0060 });
  const [activeTab, setActiveTab] = useState<'saved' | 'search'>('search');

  return (
    <div className="map-page-content">
      <MapContainer mapCenter={mapCenter} setMapCenter={setMapCenter} activeTab={activeTab} setActiveTab={setActiveTab} />
      <ItineraryPanel activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

export default MapPage; 