import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useJsApiLoader, GoogleMap, Marker } from '@react-google-maps/api';
import { useAppContext } from '../../context/AppContext';
import { Place, MapContainerProps } from '../../types';
import './index.css';

const containerStyle = {
  width: '100%',
  height: '100%',
};

const GOOGLE_MAP_LIBRARIES: any[] = ['places'];

// --- Custom Hook for Logic ---
function useMapContainerLogic({ mapCenter, setMapCenter, activeTab, setActiveTab }: MapContainerProps) {
  const { favoritePlaces, addFavoritePlace, selectedPlace, setSelectedPlace } = useAppContext();
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAP_LIBRARIES,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]);
  const markerClickedRef = useRef(false);

  // Map load/unmount handlers
  const onLoad = useCallback((mapInstance: google.maps.Map) => setMap(mapInstance), []);
  const onUnmount = useCallback(() => setMap(null), []);

  // Only update mapCenter if it actually changes
  const handleIdle = useCallback(() => {
    if (map) {
      const center = map.getCenter();
      if (center) {
        const newCenter = { lat: center.lat(), lng: center.lng() };
        if (Math.abs(newCenter.lat - mapCenter.lat) > 1e-6 || Math.abs(newCenter.lng - mapCenter.lng) > 1e-6) {
          setMapCenter(newCenter);
        }
      }
    }
  }, [map, mapCenter.lat, mapCenter.lng, setMapCenter]);

  // Map click: close info card unless marker was just clicked
  const handleMapClick = useCallback(() => {
    if (markerClickedRef.current) {
      markerClickedRef.current = false;
      return;
    }
    setSelectedPlace(null);
    window.dispatchEvent(new CustomEvent('clear-selected-place'));
  }, [setSelectedPlace]);

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

  return {
    isLoaded,
    map,
    onLoad,
    onUnmount,
    handleIdle,
    handleMapClick,
    favoritePlaces,
    selectedPlace,
    setSelectedPlace,
    handleAddToFavorites,
    activeTab,
    nearbyPlaces,
  };
}

// --- Subcomponents ---
const FavoriteMarkers: React.FC<{ favoritePlaces: Place[]; setSelectedPlace: (p: Place) => void; markerClickedRef: React.MutableRefObject<boolean>; map?: google.maps.Map | null; }> = ({ favoritePlaces, setSelectedPlace, markerClickedRef, map }) => (
  <>
    {favoritePlaces.map(place => (
      <Marker
        key={`fav-${place.id}`}
        position={place.location}
        title={place.name}
        onClick={() => {
          markerClickedRef.current = true;
          setSelectedPlace(place);
          if (map) {
            map.panTo(place.location);
            map.setZoom(16);
          }
          window.dispatchEvent(new CustomEvent('select-place', { detail: { place, tab: 'saved' } }));
        }}
        icon={{
          url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
          scaledSize: new window.google.maps.Size(40, 40),
        }}
      />
    ))}
  </>
);

const NearbyMarkers: React.FC<{ nearbyPlaces: Place[]; setSelectedPlace: (p: Place) => void; markerClickedRef: React.MutableRefObject<boolean>; map?: google.maps.Map | null; favoritePlaces?: Place[] }> = ({ nearbyPlaces, setSelectedPlace, markerClickedRef, map, favoritePlaces }) => (
  <>
    {nearbyPlaces.map(place => (
      <Marker
        key={`nearby-${place.id}`}
        position={place.location}
        title={place.name}
        onClick={() => {
          markerClickedRef.current = true;
          setSelectedPlace(place);
          if (map) {
            map.panTo(place.location);
            map.setZoom(16);
          }
          // If the place is a favorite, highlight in saved tab, else in search tab
          const isFavorite = favoritePlaces?.some(fav => fav.id === place.id);
          window.dispatchEvent(new CustomEvent('select-place', { detail: { place, tab: isFavorite ? 'saved' : 'search' } }));
        }}
      />
    ))}
  </>
);

const MapLoading: React.FC = () => (
  <div className="map-loading">
    <div className="loading-spinner"></div>
    <p>Loading map...</p>
  </div>
);

// --- Main Component ---
export const MapContainer: React.FC<MapContainerProps> = (props) => {
  const logic = useMapContainerLogic(props);
  const markerClickedRef = useRef(false);

  if (!logic.isLoaded) {
    return <MapLoading />;
  }

  return (
    <div className="map-container">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={props.mapCenter}
        zoom={13}
        onLoad={logic.onLoad}
        onUnmount={logic.onUnmount}
        onIdle={logic.handleIdle}
        onClick={logic.handleMapClick}
        options={{
          disableDefaultUI: true,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "on" }]
            }
          ],
        }}
      >
        {logic.activeTab === 'saved' && logic.favoritePlaces.length > 0 && (
          <FavoriteMarkers favoritePlaces={logic.favoritePlaces} setSelectedPlace={logic.setSelectedPlace} markerClickedRef={markerClickedRef} map={logic.map} />
        )}
        {logic.activeTab === 'search' && logic.nearbyPlaces.length > 0 && (
          <NearbyMarkers nearbyPlaces={logic.nearbyPlaces} setSelectedPlace={logic.setSelectedPlace} markerClickedRef={markerClickedRef} map={logic.map} favoritePlaces={logic.favoritePlaces} />
        )}
      </GoogleMap>
    </div>
  );
};