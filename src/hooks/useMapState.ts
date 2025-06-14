import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Coordinates, Place } from '../types';

interface UseMapStateReturn {
  // Map instance
  map: google.maps.Map | null;
  setMap: (map: google.maps.Map | null) => void;
  
  // Map center
  mapCenter: Coordinates;
  setMapCenter: (center: Coordinates) => void;
  
  // Hover state
  hoveredPlace: Place | null;
  setHoveredPlace: (place: Place | null) => void;
  hoveredPlaceId: string | null;
  setHoveredPlaceId: (id: string | null) => void;
  
  // Map operations
  fitMapToPlaces: (places: Place[]) => void;
  handleMapLoad: (mapInstance: google.maps.Map) => void;
  handleMapUnmount: () => void;
  handleMapIdle: () => void;
  
  // Event handlers
  setupPlaceHoverListener: () => () => void;
  setupSearchResultsListener: () => () => void;
  
  // Performance helpers
  isMapReady: boolean;
  centerChanged: boolean;
  resetCenterChanged: () => void;
}

// Debounce utility for map center updates
const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export const useMapState = (
  initialCenter: Coordinates = { lat: 40.7128, lng: -74.0060 },
  onMapCenterChange?: (center: Coordinates) => void
): UseMapStateReturn => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinates>(initialCenter);
  const [hoveredPlace, setHoveredPlace] = useState<Place | null>(null);
  const [hoveredPlaceId, setHoveredPlaceId] = useState<string | null>(null);
  const [centerChanged, setCenterChanged] = useState(false);
  
  const hideTimeoutRef = useRef<number | null>(null);
  const lastCenterRef = useRef<Coordinates>(initialCenter);
  const resizeTimeoutRef = useRef<number | null>(null);

  // Debounced center for performance
  const debouncedCenter = useDebounce(mapCenter, 300);

  // Memoized map ready state
  const isMapReady = useMemo(() => !!map, [map]);

  // Optimized center change detection
  const isCenterSignificantlyDifferent = useCallback((newCenter: Coordinates, oldCenter: Coordinates): boolean => {
    const threshold = 1e-6;
    return Math.abs(newCenter.lat - oldCenter.lat) > threshold || 
           Math.abs(newCenter.lng - oldCenter.lng) > threshold;
  }, []);

  // Reset center changed flag
  const resetCenterChanged = useCallback(() => {
    setCenterChanged(false);
  }, []);

  // Optimized fit map to places with bounds caching
  const fitMapToPlaces = useCallback((places: Place[]) => {
    if (!map || !places.length) return;
    
    try {
      const bounds = new window.google.maps.LatLngBounds();
      places.forEach(place => {
        if (place.location && place.location.lat && place.location.lng) {
          bounds.extend(place.location);
        }
      });
      
      // Only fit bounds if we have valid bounds
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds);
      }
    } catch (error) {
      console.warn('Error fitting map to places:', error);
    }
  }, [map]);

  // Optimized map load handler with error handling
  const handleMapLoad = useCallback((mapInstance: google.maps.Map) => {
    try {
      setMap(mapInstance);
      lastCenterRef.current = initialCenter;
    } catch (error) {
      console.error('Error loading map:', error);
    }
  }, [initialCenter]);

  // Optimized map unmount handler with cleanup
  const handleMapUnmount = useCallback(() => {
    // Clear all timeouts
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = null;
    }
    
    setMap(null);
    setCenterChanged(false);
  }, []);

  // Optimized map idle handler with debouncing
  const handleMapIdle = useCallback(() => {
    if (!map || !onMapCenterChange) return;
    
    try {
      const center = map.getCenter();
      if (center) {
        const newCenter = { lat: center.lat(), lng: center.lng() };
        
        if (isCenterSignificantlyDifferent(newCenter, lastCenterRef.current)) {
          lastCenterRef.current = newCenter;
          setMapCenter(newCenter);
          setCenterChanged(true);
        }
      }
    } catch (error) {
      console.warn('Error handling map idle:', error);
    }
  }, [map, onMapCenterChange, isCenterSignificantlyDifferent]);

  // Effect for debounced center change notifications
  useEffect(() => {
    if (onMapCenterChange && centerChanged) {
      onMapCenterChange(debouncedCenter);
      setCenterChanged(false);
    }
  }, [debouncedCenter, onMapCenterChange, centerChanged]);

  // Memoized place hover event listener
  const setupPlaceHoverListener = useCallback(() => {
    const handlePlaceHover = (e: Event) => {
      try {
        const customEvent = e as CustomEvent;
        const { placeId, hovering } = customEvent.detail || {};
        
        // Clear existing timeout
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = null;
        }
        
        if (hovering) {
          setHoveredPlaceId(placeId);
        } else {
          // Debounce hiding to prevent flicker
          hideTimeoutRef.current = window.setTimeout(() => {
            setHoveredPlaceId(null);
          }, 100);
        }
      } catch (error) {
        console.warn('Error handling place hover:', error);
      }
    };
    
    window.addEventListener('place-hover', handlePlaceHover);
    return () => {
      window.removeEventListener('place-hover', handlePlaceHover);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Memoized search results event listener
  const setupSearchResultsListener = useCallback(() => {
    const handleSearchResults = (e: Event) => {
      try {
        const customEvent = e as CustomEvent;
        const places = Array.isArray(customEvent.detail) ? customEvent.detail : [];
        
        if (map && places.length > 0) {
          // Debounce map fitting for better performance
          if (resizeTimeoutRef.current) {
            clearTimeout(resizeTimeoutRef.current);
          }
          
          resizeTimeoutRef.current = window.setTimeout(() => {
            fitMapToPlaces(places);
          }, 150);
        }
      } catch (error) {
        console.warn('Error handling search results:', error);
      }
    };
    
    window.addEventListener('search-places', handleSearchResults);
    return () => {
      window.removeEventListener('search-places', handleSearchResults);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [map, fitMapToPlaces]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  // Optimized resize handler with debouncing
  useEffect(() => {
    if (!map) return;

    const handleResize = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      
      resizeTimeoutRef.current = window.setTimeout(() => {
        try {
          if (map) {
            window.google.maps.event.trigger(map, 'resize');
            if (mapCenter) {
              map.setCenter(mapCenter);
            }
          }
        } catch (error) {
          console.warn('Error handling map resize:', error);
        }
      }, 250);
    };

    window.addEventListener('resize', handleResize);
    
    // Initial trigger with delay
    const initialTimeout = setTimeout(handleResize, 100);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(initialTimeout);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [map, mapCenter]);

  // Memoized return object for performance
  return useMemo(() => ({
    map,
    setMap,
    mapCenter,
    setMapCenter,
    hoveredPlace,
    setHoveredPlace,
    hoveredPlaceId,
    setHoveredPlaceId,
    fitMapToPlaces,
    handleMapLoad,
    handleMapUnmount,
    handleMapIdle,
    setupPlaceHoverListener,
    setupSearchResultsListener,
    isMapReady,
    centerChanged,
    resetCenterChanged,
  }), [
    map,
    mapCenter,
    hoveredPlace,
    hoveredPlaceId,
    fitMapToPlaces,
    handleMapLoad,
    handleMapUnmount,
    handleMapIdle,
    setupPlaceHoverListener,
    setupSearchResultsListener,
    isMapReady,
    centerChanged,
    resetCenterChanged,
  ]);
}; 