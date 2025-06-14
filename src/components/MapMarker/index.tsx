/**
 * MapMarker Component
 * 
 * A reusable marker component for Google Maps that supports different visual styles.
 * 
 * Features:
 * - Supports different marker types (default, favorite, schedule)
 * - Custom styling for each marker type
 * - Numbered markers for schedule view
 * - Hover handling to show place info popup (like Google Maps)
 * - Click handling with place data
 * 
 * Usage:
 * <MapMarker 
 *   place={place}
 *   markerType="favorite"
 *   onHover={handleMarkerHover}
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
  onHover?: (place: Place | null) => void;
  isHighlighted?: boolean;
}

const MapMarker: React.FC<MapMarkerProps> = ({ 
  place, 
  markerType = 'default', 
  index,
  onClick,
  onHover,
  isHighlighted = false
}) => {
  const handleClick = () => {
    if (onClick) onClick(place);
  };

  const handleMouseOver = () => {
    if (onHover) onHover(place);
  };

  const handleMouseOut = () => {
    if (onHover) onHover(null);
  };

  // Get marker icon based on type
  const getMarkerIcon = () => {
    switch (markerType) {
      case 'favorite':
        return {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="27" height="41" viewBox="0 0 27 41" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.5 0C6.04 0 0 6.04 0 13.5C0 21.05 6.04 27 9 30L11 33L12 36L13.5 39L15 36L16 33L18 30C20.96 27 27 21.05 27 13.5C27 6.04 20.96 0 13.5 0Z" fill="#4285F4"/>
              <circle cx="13.5" cy="13.5" r="5" fill="white"/>
            </svg>
          `),
          scaledSize: new window.google.maps.Size(27, 41),
          anchor: new window.google.maps.Point(13.5, 39),
        };
      case 'schedule': {
        // For scheduled places, we can have different colors or use labels
        const markerColors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#FF9800', '#9C27B0', '#795548'];
        const colorIndex = index !== undefined ? index % markerColors.length : 0;
        
        // Check if Google Maps API is available
        if (typeof window !== 'undefined' && window.google && window.google.maps) {
          return {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: markerColors[colorIndex],
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#FFFFFF',
            scale: 15,
            labelOrigin: new window.google.maps.Point(0, 0),
          };
        } else {
          // Fallback to SVG marker if Google Maps API not ready
          return {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
                <circle cx="15" cy="15" r="15" fill="${markerColors[colorIndex]}" stroke="#FFFFFF" stroke-width="2"/>
                <text x="15" y="20" text-anchor="middle" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="12" font-weight="bold">${index !== undefined ? index + 1 : ''}</text>
              </svg>
            `),
            scaledSize: new window.google.maps.Size(30, 30),
            anchor: new window.google.maps.Point(15, 15),
          };
        }
      }
      default:
        // For default markers, only customize when highlighted
        if (isHighlighted) {
          return {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="27" height="41" viewBox="0 0 27 41" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.5 0C6.04 0 0 6.04 0 13.5C0 21.05 6.04 27 9 30L11 33L12 36L13.5 39L15 36L16 33L18 30C20.96 27 27 21.05 27 13.5C27 6.04 20.96 0 13.5 0Z" fill="#4285F4"/>
                <circle cx="13.5" cy="13.5" r="5" fill="white"/>
              </svg>
            `),
            scaledSize: new window.google.maps.Size(27, 41),
            anchor: new window.google.maps.Point(13.5, 39),
          };
        }
        return undefined; // Default Google marker when not highlighted
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
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      icon={getMarkerIcon()}
      label={getLabel()}
      zIndex={isHighlighted ? 2 : 1}
    />
  );
};

export default MapMarker; 