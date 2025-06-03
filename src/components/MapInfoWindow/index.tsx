/**
 * MapInfoWindow Component
 * 
 * A reusable info window component for Google Maps that displays place details.
 * 
 * Features:
 * - Displays place details including name, address, photos, and ratings
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

import React, { useState } from 'react';
import { InfoWindow } from '@react-google-maps/api';
import { Place } from '../../types';
import { ImageIcon } from 'lucide-react';
import { Button } from '../Button';
import './index.css';

export interface MapInfoWindowProps {
  place: Place;
  position: google.maps.LatLng | google.maps.LatLngLiteral;
  onClose: () => void;
  onAddToFavorites?: () => void;
  showAddButton?: boolean;
}

const MapInfoWindow: React.FC<MapInfoWindowProps> = ({ 
  place, 
  position, 
  onClose, 
  onAddToFavorites,
  showAddButton = false
}) => {
  const [imageError, setImageError] = useState(false);
  
  return (
    <InfoWindow
      position={position}
      onCloseClick={onClose}
    >
      <div className="map-info-window">
        <h3>{place.name}</h3>
        {place.photos && place.photos.length > 0 && !imageError ? (
          <div className="info-window-image-container">
            <img 
              src={place.photos[0]} 
              alt={place.name} 
              onError={() => setImageError(true)}
            />
          </div>
        ) : (
          <div className="info-window-image-placeholder">
            <ImageIcon size={32} color="#9ca3af" />
            <span>{place.name}</span>
          </div>
        )}
        <p>{place.address}</p>
        {place.rating && (
          <p>Rating: {place.rating} ({place.userRatingCount || 0} reviews)</p>
        )}
        {place.openingHours && (
          <p>Currently: {place.openingHours.open ? 'Open' : 'Closed'}</p>
        )}
        {place.website && (
          <p><a href={place.website} target="_blank" rel="noopener noreferrer">Website</a></p>
        )}
        {place.phoneNumber && (
          <p>Phone: {place.phoneNumber}</p>
        )}
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