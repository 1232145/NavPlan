/**
 * Map Component
 * 
 * A reusable base map component that provides core Google Maps functionality.
 * This component handles map initialization, loading states, and basic interaction.
 * 
 * Features:
 * - Loads Google Maps with proper API key
 * - Manages loading state with spinner
 * - Handles map center updates
 * - Provides customization through props
 * - Supports child components for markers, info windows, etc.
 * 
 * Usage:
 * <Map 
 *   mapCenter={center}
 *   setMapCenter={setCenter}
 *   zoom={14}
 *   onClick={handleMapClick}
 * >
 *   {children}
 * </Map>
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useJsApiLoader, GoogleMap, Libraries } from '@react-google-maps/api';
import { Coordinates } from '../../types';
import './index.css';

// Define libraries array outside component to prevent reloading
const GOOGLE_MAP_LIBRARIES: Libraries = ['places'];

export interface MapProps {
  mapCenter: Coordinates;
  setMapCenter?: (center: Coordinates) => void;
  onMapLoad?: (map: google.maps.Map) => void;
  onMapUnmount?: () => void;
  options?: google.maps.MapOptions;
  zoom?: number;
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const containerStyle = {
  width: '100%',
  height: '100%',
};

const MapLoading: React.FC = () => (
  <div className="map-loading">
    <div className="loading-spinner"></div>
    <p>Loading map...</p>
  </div>
);

const Map: React.FC<MapProps> = ({ 
  mapCenter, 
  setMapCenter,
  onMapLoad,
  onMapUnmount,
  options,
  zoom = 13,
  children,
  className = "",
  onClick
}) => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAP_LIBRARIES,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  
  // Add a resize handler for when the component mounts or window resizes
  useEffect(() => {
    const handleResize = () => {
      if (map) {
        window.google.maps.event.trigger(map, 'resize');
        if (mapCenter) {
          map.setCenter(mapCenter);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Initial trigger after a small delay
    if (map) {
      setTimeout(handleResize, 100);
    }
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [map, mapCenter]);
  
  // Map load/unmount handlers
  const handleLoad = useCallback((mapInstance: google.maps.Map) => {
    console.log("Base map loaded");
    setMap(mapInstance);
    if (onMapLoad) onMapLoad(mapInstance);
  }, [onMapLoad]);
  
  const handleUnmount = useCallback(() => {
    console.log("Base map unmounted");
    setMap(null);
    if (onMapUnmount) onMapUnmount();
  }, [onMapUnmount]);

  // Only update mapCenter if it actually changes
  const handleIdle = useCallback(() => {
    if (map && setMapCenter) {
      const center = map.getCenter();
      if (center) {
        const newCenter = { lat: center.lat(), lng: center.lng() };
        if (Math.abs(newCenter.lat - mapCenter.lat) > 1e-6 || Math.abs(newCenter.lng - mapCenter.lng) > 1e-6) {
          setMapCenter(newCenter);
        }
      }
    }
  }, [map, mapCenter.lat, mapCenter.lng, setMapCenter]);

  if (loadError) {
    return <div className="map-error">Error loading Google Maps: {loadError.message}</div>;
  }

  if (!isLoaded) {
    return <MapLoading />;
  }

  return (
    <div className={`map-container ${className}`}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={zoom}
        onLoad={handleLoad}
        onUnmount={handleUnmount}
        onIdle={handleIdle}
        onClick={onClick}
        options={{
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          zoomControl: true,
          ...options
        }}
      >
        {children}
      </GoogleMap>
    </div>
  );
};

export default Map; 