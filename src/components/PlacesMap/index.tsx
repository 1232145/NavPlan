/**
 * PlacesMap Component
 * 
 * A specialized map component for searching and managing favorite places.
 * 
 * Features:
 * - Displays search results and favorite places
 * - Handles tab switching between saved and search views
 * - Manages marker hover interactions and info windows (like Google Maps)
 * - Smooth hover behavior with delay to allow mouse movement between marker and InfoWindow
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
  const { favoritePlaces, addFavoritePlace, searchResults } = useAppContext();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [hoveredPlace, setHoveredPlace] = useState<Place | null>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  const markerClickedRef = useRef(false);
  const hideTimeoutRef = useRef<number | null>(null);

  // Helper to fit map to all result markers
  const fitMapToPlaces = (places: Place[]) => {
    if (!map || !places.length) return;
    const bounds = new window.google.maps.LatLngBounds();
    places.forEach(place => {
      bounds.extend(place.location);
    });
    map.fitBounds(bounds);
  };

  // Listen for search results from SearchBar to fit map bounds
  useEffect(() => {
    const handleSearchResults = (e: Event) => {
      const customEvent = e as CustomEvent;
      const places = Array.isArray(customEvent.detail) ? customEvent.detail : [];
      if (map && places.length > 0) {
        fitMapToPlaces(places);
      }
    };
    window.addEventListener('search-places', handleSearchResults);
    return () => {
      window.removeEventListener('search-places', handleSearchResults);
    };
  }, [map]);

  // Listen for place hover events
  useEffect(() => {
    const handlePlaceHover = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { placeId, hovering } = customEvent.detail || {};
      console.log('Hover event received:', placeId, hovering);
      setHoveredPlaceId(hovering ? placeId : null);
    };
    
    window.addEventListener('place-hover', handlePlaceHover);
    return () => {
      window.removeEventListener('place-hover', handlePlaceHover);
    };
  }, []);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const handleAddToFavorites = () => {
    if (hoveredPlace) {
      addFavoritePlace(hoveredPlace);
      setHoveredPlace(null);
    }
  };

  const handleTabChange = (e: Event) => {
    const customEvent = e as CustomEvent;
    setActiveTab(customEvent.detail);
    if (customEvent.detail === 'saved') {
      if (favoritePlaces.length > 0 && map) {
        fitMapToPlaces(favoritePlaces);
      }
    } else if (customEvent.detail === 'search') {
      if (searchResults.length > 0 && map) {
        fitMapToPlaces(searchResults);
      }
    }
  };

  // Listen for tab changes from ItineraryPanel
  useEffect(() => {
    window.addEventListener('itinerary-tab-changed', handleTabChange);
    return () => {
      window.removeEventListener('itinerary-tab-changed', handleTabChange);
    };
  }, [favoritePlaces, map, setActiveTab, searchResults]);

  // Map click handler
  const handleMapClick = useCallback(() => {
    if (markerClickedRef.current) {
      markerClickedRef.current = false;
      return;
    }
    // Clear any pending hide timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setHoveredPlace(null);
    window.dispatchEvent(new CustomEvent('clear-selected-place'));
  }, []);

  // Map load handler
  const handleMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  // Handle marker hover with improved UX
  const handleMarkerHover = (place: Place | null) => {
    // Clear any existing timeout
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    if (place) {
      // Show InfoWindow immediately on hover
      setHoveredPlace(place);
    } else {
      // Delay hiding InfoWindow to allow mouse movement to InfoWindow
      hideTimeoutRef.current = setTimeout(() => {
        setHoveredPlace(null);
        hideTimeoutRef.current = null;
      }, 100); // 100ms delay - adjust as needed
    }
  };

  // Handle InfoWindow hover to keep it visible
  const handleInfoWindowMouseEnter = () => {
    // Clear hide timeout when mouse enters InfoWindow
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const handleInfoWindowMouseLeave = () => {
    // Hide InfoWindow when mouse leaves InfoWindow
    hideTimeoutRef.current = setTimeout(() => {
      setHoveredPlace(null);
      hideTimeoutRef.current = null;
    }, 100);
  };

  // Handle marker click (optional additional functionality)
  const handleMarkerClick = (place: Place, tab: 'saved' | 'search') => {
    markerClickedRef.current = true;
    // On click, we can pan and zoom to the place for better focus
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
      {activeTab === 'saved' && favoritePlaces.map(place => (
        <MapMarker
          key={`fav-${place.id}`}
          place={place}
          markerType="favorite"
          onHover={handleMarkerHover}
          onClick={(p) => handleMarkerClick(p, 'saved')}
          isHighlighted={hoveredPlaceId === place.id}
        />
      ))}

      {activeTab === 'search' && searchResults.map(place => (
        <MapMarker
          key={`search-${place.id}`}
          place={place}
          onHover={handleMarkerHover}
          onClick={(p) => handleMarkerClick(p, 'search')}
          isHighlighted={hoveredPlaceId === place.id}
        />
      ))}

      {/* Render info window for hovered place */}
      {hoveredPlace && (
        <div
          onMouseEnter={handleInfoWindowMouseEnter}
          onMouseLeave={handleInfoWindowMouseLeave}
        >
          <MapInfoWindow
            place={hoveredPlace}
            position={hoveredPlace.location}
            onAddToFavorites={handleAddToFavorites}
            showAddButton={activeTab === 'search'}
          />
        </div>
      )}
    </Map>
  );
};

export default PlacesMap; 