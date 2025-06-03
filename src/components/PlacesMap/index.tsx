/**
 * PlacesMap Component
 * 
 * A specialized map component for searching and managing favorite places.
 * 
 * Features:
 * - Displays search results and favorite places
 * - Handles tab switching between saved and search views
 * - Manages marker interactions and info windows
 * - Fits map bounds to visible markers
 * - Communicates with other components via custom events
 * 
 * Usage:
 * <PlacesMap 
 *   mapCenter={mapCenter}
 *   setMapCenter={setMapCenter}
 *   activeTab={activeTab}
 *   setActiveTab={setActiveTab}
 * />
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import Map from '../Map';
import MapMarker from '../MapMarker';
import MapInfoWindow from '../MapInfoWindow';
import { Place, Coordinates } from '../../types';
import './index.css';

export interface PlacesMapProps {
  mapCenter: Coordinates;
  setMapCenter: (center: Coordinates) => void;
  activeTab: 'saved' | 'search';
  setActiveTab: (tab: 'saved' | 'search') => void;
}

const PlacesMap: React.FC<PlacesMapProps> = ({ 
  mapCenter, 
  setMapCenter, 
  activeTab, 
  setActiveTab 
}) => {
  const { favoritePlaces, addFavoritePlace, selectedPlace, setSelectedPlace } = useAppContext();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]);
  const markerClickedRef = useRef(false);

  // Helper to fit map to all result markers
  const fitMapToPlaces = (places: Place[]) => {
    if (!map || !places.length) return;
    const bounds = new window.google.maps.LatLngBounds();
    places.forEach(place => {
      bounds.extend(place.location);
    });
    map.fitBounds(bounds);
  };

  // Listen for search results from SearchBar
  useEffect(() => {
    const handleSearchResults = (e: Event) => {
      const customEvent = e as CustomEvent;
      const places = Array.isArray(customEvent.detail) ? customEvent.detail : [];
      setNearbyPlaces(places);
      if (map) {
        if (places.length > 0) {
          fitMapToPlaces(places);
        }
      }
    };
    window.addEventListener('search-places', handleSearchResults);
    return () => {
      window.removeEventListener('search-places', handleSearchResults);
    };
  }, [map]);

  const handleAddToFavorites = () => {
    if (selectedPlace) {
      addFavoritePlace(selectedPlace);
      setSelectedPlace(null);
    }
  };

  // Listen for tab changes from ItineraryPanel
  useEffect(() => {
    const handleTabChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      setActiveTab(customEvent.detail);
      if (customEvent.detail === 'saved') {
        setNearbyPlaces([]);
        if (favoritePlaces.length > 0 && map) {
          fitMapToPlaces(favoritePlaces);
        }
      }
    };
    window.addEventListener('itinerary-tab-changed', handleTabChange);
    return () => {
      window.removeEventListener('itinerary-tab-changed', handleTabChange);
    };
  }, [favoritePlaces, map, setActiveTab]);

  // Map click handler
  const handleMapClick = useCallback(() => {
    if (markerClickedRef.current) {
      markerClickedRef.current = false;
      return;
    }
    setSelectedPlace(null);
    window.dispatchEvent(new CustomEvent('clear-selected-place'));
  }, [setSelectedPlace]);

  // Map load handler
  const handleMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  // Handle marker click
  const handleMarkerClick = (place: Place, tab: 'saved' | 'search') => {
    markerClickedRef.current = true;
    setSelectedPlace(place);
    if (map) {
      map.panTo(place.location);
      map.setZoom(16);
    }
    window.dispatchEvent(new CustomEvent('select-place', { detail: { place, tab } }));
  };

  return (
    <Map 
      mapCenter={mapCenter} 
      setMapCenter={setMapCenter}
      onMapLoad={handleMapLoad}
      onClick={handleMapClick}
      className="places-map"
    >
      {/* Render favorite place markers */}
      {activeTab === 'saved' && favoritePlaces.map(place => (
        <MapMarker
          key={`fav-${place.id}`}
          place={place}
          markerType="favorite"
          onClick={(p) => handleMarkerClick(p, 'saved')}
        />
      ))}

      {/* Render search result markers */}
      {activeTab === 'search' && nearbyPlaces.map(place => (
        <MapMarker
          key={`search-${place.id}`}
          place={place}
          onClick={(p) => handleMarkerClick(p, 'search')}
        />
      ))}

      {/* Render info window for selected place */}
      {selectedPlace && (
        <MapInfoWindow
          place={selectedPlace}
          position={selectedPlace.location}
          onClose={() => setSelectedPlace(null)}
          onAddToFavorites={handleAddToFavorites}
          showAddButton={activeTab === 'search'}
        />
      )}
    </Map>
  );
};

export default PlacesMap; 