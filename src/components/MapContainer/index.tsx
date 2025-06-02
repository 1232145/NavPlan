import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useJsApiLoader, GoogleMap, Marker, InfoWindow, Libraries } from '@react-google-maps/api';
import { useAppContext } from '../../context/AppContext';
import { Place, Coordinates } from '../../types';
import { TabControlProps } from '../ItineraryPanel';
import './index.css';
import { Image as ImageIcon } from 'lucide-react';

// Define libraries array outside component to prevent reloading
const GOOGLE_MAP_LIBRARIES: Libraries = ['places'];

export interface MapContainerProps extends TabControlProps {
  mapCenter: Coordinates;
  setMapCenter: (center: Coordinates) => void;
}

const containerStyle = {
  width: '100%',
  height: '100%',
};

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
          // Highlight the place in the current tab without switching tabs
          window.dispatchEvent(new CustomEvent('select-place', { detail: { place, tab: 'search' } }));
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

const PlaceInfoWindow: React.FC<{ place: Place; onClose: () => void; onAddToFavorites: () => void; activeTab: 'saved' | 'search'; }> = ({ place, onClose, onAddToFavorites, activeTab }) => {
  const [imageError, setImageError] = useState(false);
  
  return (
    <div style={{ maxWidth: '300px', padding: '10px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}>
      <h3 style={{ marginTop: '0', marginBottom: '10px' }}>{place.name}</h3>
      {place.photos && place.photos.length > 0 && !imageError ? (
        <div style={{ marginBottom: '10px' }}>
          <img 
            src={place.photos[0]} 
            alt={place.name} 
            style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '4px' }} 
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        <div style={{ width: '100%', height: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', borderRadius: '4px', marginBottom: '10px' }}>
          <ImageIcon size={32} color="#9ca3af" />
          <span style={{ marginTop: '8px', color: '#9ca3af', fontSize: '14px' }}>{place.name}</span>
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
      {activeTab === 'search' && (
        <button 
          onClick={onAddToFavorites}
          style={{ marginTop: '10px', padding: '5px 10px', backgroundColor: '#007BFF', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', width: '100%' }}
        >
          Add to Favorites
        </button>
      )}
    </div>
  );
};

// --- Main Component ---
const MapContainer: React.FC<MapContainerProps> = (props) => {
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
        {logic.selectedPlace && (
          <InfoWindow
            position={logic.selectedPlace.location}
            onCloseClick={() => {
              logic.setSelectedPlace(null);
              window.dispatchEvent(new CustomEvent('clear-selected-place'));
            }}
            options={{ pixelOffset: new window.google.maps.Size(0, -40), disableAutoPan: false }}
          >
            <PlaceInfoWindow 
              place={logic.selectedPlace} 
              onClose={() => {
                logic.setSelectedPlace(null);
                window.dispatchEvent(new CustomEvent('clear-selected-place'));
              }} 
              onAddToFavorites={logic.handleAddToFavorites} 
              activeTab={logic.activeTab} 
            />
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

export default MapContainer;