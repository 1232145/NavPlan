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
        // Show visual difference when highlighted
        const favoriteColor = isHighlighted ? '#FF6B35' : '#4285F4'; // Orange when highlighted, blue normally
        const favoriteSize = isHighlighted ? 32 : 27; // Larger when highlighted
        const favoriteHeight = isHighlighted ? 48 : 41; // Proportionally taller
        
        return {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
            <svg width="${favoriteSize}" height="${favoriteHeight}" viewBox="0 0 ${favoriteSize} ${favoriteHeight}" xmlns="http://www.w3.org/2000/svg">
              <path d="M${favoriteSize/2} 0C${favoriteSize * 6.04/27} 0 0 ${favoriteSize * 6.04/27} 0 ${favoriteSize * 13.5/27}C0 ${favoriteSize * 21.05/27} ${favoriteSize * 6.04/27} ${favoriteSize * 27/27} ${favoriteSize * 9/27} ${favoriteSize * 30/27}L${favoriteSize * 11/27} ${favoriteSize * 33/27}L${favoriteSize * 12/27} ${favoriteSize * 36/27}L${favoriteSize/2} ${favoriteHeight - 2}L${favoriteSize * 15/27} ${favoriteSize * 36/27}L${favoriteSize * 16/27} ${favoriteSize * 33/27}L${favoriteSize * 18/27} ${favoriteSize * 30/27}C${favoriteSize * 20.96/27} ${favoriteSize * 27/27} ${favoriteSize} ${favoriteSize * 21.05/27} ${favoriteSize} ${favoriteSize * 13.5/27}C${favoriteSize} ${favoriteSize * 6.04/27} ${favoriteSize * 20.96/27} 0 ${favoriteSize/2} 0Z" fill="${favoriteColor}"/>
              <circle cx="${favoriteSize/2}" cy="${favoriteSize * 13.5/27}" r="${favoriteSize * 5/27}" fill="white"/>
              ${isHighlighted ? `<circle cx="${favoriteSize/2}" cy="${favoriteSize * 13.5/27}" r="${favoriteSize * 8/27}" fill="none" stroke="${favoriteColor}" stroke-width="2" opacity="0.5"/>` : ''}
            </svg>
          `),
          scaledSize: new window.google.maps.Size(favoriteSize, favoriteHeight),
          anchor: new window.google.maps.Point(favoriteSize/2, favoriteHeight - 2),
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
            scale: isHighlighted ? 18 : 15, // Larger when highlighted
            labelOrigin: new window.google.maps.Point(0, 0),
          };
        } else {
          // Fallback to SVG marker if Google Maps API not ready
          const scheduleSize = isHighlighted ? 36 : 30;
          return {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="${scheduleSize}" height="${scheduleSize}" viewBox="0 0 ${scheduleSize} ${scheduleSize}" xmlns="http://www.w3.org/2000/svg">
                <circle cx="${scheduleSize/2}" cy="${scheduleSize/2}" r="${scheduleSize/2}" fill="${markerColors[colorIndex]}" stroke="#FFFFFF" stroke-width="2"/>
                <text x="${scheduleSize/2}" y="${scheduleSize/2 + 4}" text-anchor="middle" fill="#FFFFFF" font-family="Arial, sans-serif" font-size="${scheduleSize/2.5}" font-weight="bold">${index !== undefined ? index + 1 : ''}</text>
                ${isHighlighted ? `<circle cx="${scheduleSize/2}" cy="${scheduleSize/2}" r="${scheduleSize/2 + 3}" fill="none" stroke="${markerColors[colorIndex]}" stroke-width="2" opacity="0.5"/>` : ''}
              </svg>
            `),
            scaledSize: new window.google.maps.Size(scheduleSize, scheduleSize),
            anchor: new window.google.maps.Point(scheduleSize/2, scheduleSize/2),
          };
        }
      }
      default:
        // For default markers, only customize when highlighted
        if (isHighlighted) {
          return {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="32" height="48" viewBox="0 0 32 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M16 0C7.16 0 0 7.16 0 16C0 24.84 7.16 32 10.67 35.56L13.04 39.11L14.22 42.67L16 46L17.78 42.67L18.96 39.11L21.33 35.56C24.84 32 32 24.84 32 16C32 7.16 24.84 0 16 0Z" fill="#4285F4"/>
                <circle cx="16" cy="16" r="6" fill="white"/>
                <circle cx="16" cy="16" r="10" fill="none" stroke="#4285F4" stroke-width="2" opacity="0.5"/>
              </svg>
            `),
            scaledSize: new window.google.maps.Size(32, 48),
            anchor: new window.google.maps.Point(16, 46),
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