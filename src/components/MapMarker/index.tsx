/**
 * MapMarker Component
 * 
 * A reusable marker component for Google Maps that supports different visual styles.
 * 
 * Features:
 * - Supports different marker types (default, favorite, schedule)
 * - Custom styling for each marker type
 * - Numbered markers for schedule view
 * - Click handling with place data
 * 
 * Usage:
 * <MapMarker 
 *   place={place}
 *   markerType="favorite"
 *   onClick={handleMarkerClick}
 * />
 */

import React from 'react';
import { Marker } from '@react-google-maps/api';
import { Place } from '../../types';
import './index.css';

export interface MapMarkerProps {
  place: Place;
  markerType?: 'default' | 'favorite' | 'schedule';
  index?: number;
  onClick?: (place: Place) => void;
}

const MapMarker: React.FC<MapMarkerProps> = ({ 
  place, 
  markerType = 'default', 
  index,
  onClick 
}) => {
  const handleClick = () => {
    if (onClick) onClick(place);
  };

  // Get marker icon based on type
  const getMarkerIcon = () => {
    switch (markerType) {
      case 'favorite':
        return {
          url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
          scaledSize: new window.google.maps.Size(40, 40),
        };
      case 'schedule':
        // For scheduled places, we can have different colors or use labels
        const markerColors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#FF9800', '#9C27B0', '#795548'];
        const colorIndex = index !== undefined ? index % markerColors.length : 0;
        
        return {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: markerColors[colorIndex],
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#FFFFFF',
          scale: 15,
          labelOrigin: new google.maps.Point(0, 0),
        };
      default:
        return undefined; // Default Google marker
    }
  };

  // Get label for schedule markers
  const getLabel = () => {
    if (markerType === 'schedule' && index !== undefined) {
      return {
        text: (index + 1).toString(),
        color: '#FFFFFF',
        fontWeight: 'bold'
      };
    }
    return undefined;
  };

  return (
    <Marker
      position={place.location}
      title={place.name}
      onClick={handleClick}
      icon={getMarkerIcon()}
      label={getLabel()}
    />
  );
};

export default MapMarker; 