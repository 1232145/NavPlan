/**
 * MapInfoWindow Component
 * 
 * A reusable info window component for Google Maps that displays place details.
 * 
 * Features:
 * - Displays place details including name, photos, and ratings
 * - Handles image loading errors gracefully
 * - Optional "Add to Favorites" button
 * - Consistent styling with the application
 * 
 * Usage:
 * <MapInfoWindow
 *   place={selectedPlace}
 *   position={selectedPlace.location}
 *   onClose={handleClose}
 *   onAddToFavorites={handleAddToFavorites}
 *   showAddButton={true}
 * />
 */

import React from 'react';
import { InfoWindow } from '@react-google-maps/api';
import { Place } from '../../types';
import { useImageError } from '../../hooks/useImageError';
import { ImageIcon } from 'lucide-react';
import { Button } from '../Button';
import './index.css';

export interface MapInfoWindowProps {
  place: Place;
  position: google.maps.LatLng | google.maps.LatLngLiteral;
  onAddToFavorites?: () => void;
  showAddButton?: boolean;
}

const MapInfoWindow: React.FC<MapInfoWindowProps> = ({ 
  place, 
  position, 
  onAddToFavorites,
  showAddButton = false
}) => {
  const { imageError, handleImageError } = useImageError();
  
  // Helper function to get opening hours display text
  const getOpeningHoursDisplay = () => {
    if (!place.openingHours) return null;
    
    const isOpen = place.openingHours.open;
    const baseStyle = { fontSize: 13, fontWeight: 500 };
    
    if (isOpen) {
      return (
        <p style={{ ...baseStyle, color: '#2ecc40', margin: '5px 0' }}>
          ● Open now
        </p>
      );
    } else {
      return (
        <p style={{ ...baseStyle, color: '#ff4136', margin: '5px 0' }}>
          ● Closed now
        </p>
      );
    }
  };
  
  return (
    <InfoWindow
      position={position}
      options={{
        pixelOffset: new window.google.maps.Size(0, -20),
        disableAutoPan: true
      }}
    >
      <div className="map-info-window">
        {place.photos && place.photos.length > 0 && !imageError ? (
          <div className="info-window-image-container">
            <img 
              src={place.photos[0]} 
              alt={place.name} 
              onError={handleImageError}
            />
          </div>
        ) : (
          <div className="image-placeholder">
            <ImageIcon size={32} color="#9ca3af" />
            <span>{place.name}</span>
          </div>
        )}
        <h3>{place.name}</h3>
        {place.rating && (
          <p style={{ margin: '5px 0', fontSize: 14, color: '#f7b500', fontWeight: 600 }}>
            ★ {place.rating} ({place.userRatingCount || 0})
          </p>
        )}
        {getOpeningHoursDisplay()}
        {place.note && (
          <p>Note: {place.note}</p>
        )}
        {showAddButton && onAddToFavorites && (
          <Button 
            variant="primary"
            size="sm"
            onClick={onAddToFavorites}
            style={{ marginTop: '10px', width: '100%' }}
          >
            Add to Favorites
          </Button>
        )}
      </div>
    </InfoWindow>
  );
};

export default MapInfoWindow; 