/**
 * DirectionsMap Component
 * 
 * A specialized map component for displaying routes and directions between places.
 * 
 * Features:
 * - Displays a Google Maps route between multiple locations
 * - Shows numbered markers for each stop in the route
 * - Automatically fits the map to show the entire route
 * - Handles directions requests with error fallbacks
 * - Compatible with the Schedule interface
 * 
 * Usage:
 * <DirectionsMap
 *   schedule={currentSchedule}
 *   places={favoritePlaces}
 *   initialCenter={mapCenter}
 * />
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import Map from '../Map';
import MapMarker from '../MapMarker';
import { Schedule, Place, Coordinates } from '../../types';
import './index.css';

export interface DirectionsMapProps {
  schedule: Schedule;
  places: Place[];
  initialCenter?: Coordinates;
  travelMode?: string;
}

const DEFAULT_CENTER = { lat: 40.7128, lng: -74.0060 }; // New York as default

// Custom marker colors for better visibility - must match the colors in ScheduleTimelinePanel
const markerColors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#FF9800', '#9C27B0', '#795548'];

const mapOptions = {
  styles: [
    {
      featureType: 'road',
      elementType: 'geometry.stroke',
      stylers: [
        { color: 'transparent' },
        { visibility: 'on' }
      ]
    },
    {
      featureType: 'road',
      elementType: 'geometry.fill',
      stylers: [
        { color: '#ffffff' }
      ]
    },
    {
      featureType: 'road.local',
      stylers: [{ visibility: 'simplified' }]
    },
    {
      featureType: 'transit',
      stylers: [{ visibility: 'off' }]
    }
  ]
};

const DirectionsMap: React.FC<DirectionsMapProps> = ({
  schedule,
  places,
  initialCenter = DEFAULT_CENTER,
  travelMode = "walking"
}) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinates>(initialCenter);
  const [mapError, setMapError] = useState<string | null>(null);
  const directionsAttempted = useRef(false);
  const directionsRenderers = useRef<google.maps.DirectionsRenderer[]>([]);

  // Reset directions when travel mode changes or component mounts
  useEffect(() => {
    // Clear existing directions renderers
    directionsRenderers.current.forEach(renderer => {
      if (renderer) {
        renderer.setMap(null);
      }
    });
    directionsRenderers.current = [];
    directionsAttempted.current = false;
  }, [travelMode]);

  // Create bounds for all locations to fit the map
  const fitBounds = useCallback(() => {
    if (!map || !schedule || schedule.items.length === 0) {
      return;
    }

    try {
      const bounds = new window.google.maps.LatLngBounds();
      let addedPoints = 0;

      schedule.items.forEach(item => {
        if (item.travel_to_next &&
          item.travel_to_next.start_location &&
          item.travel_to_next.start_location.lat &&
          item.travel_to_next.start_location.lng) {

          // Skip (0,0) coordinates
          if (item.travel_to_next.start_location.lat === 0 &&
            item.travel_to_next.start_location.lng === 0) {
            return;
          }

          bounds.extend({
            lat: item.travel_to_next.start_location.lat,
            lng: item.travel_to_next.start_location.lng
          });
          addedPoints++;

          // Also include the end location of the last item
          if (item === schedule.items[schedule.items.length - 1]) {
            if (item.travel_to_next.end_location &&
              item.travel_to_next.end_location.lat !== 0 &&
              item.travel_to_next.end_location.lng !== 0) {
              bounds.extend({
                lat: item.travel_to_next.end_location.lat,
                lng: item.travel_to_next.end_location.lng
              });
              addedPoints++;
            }
          }
        }
      });

      if (addedPoints > 0) {
        map.fitBounds(bounds);

        // Slightly zoom out to give some padding
        setTimeout(() => {
          if (map) {
            const zoom = map.getZoom();
            if (zoom && zoom > 15) map.setZoom(zoom - 1);
          }
        }, 300);
      } else {
        map.setCenter(mapCenter);
        map.setZoom(12);
      }
    } catch (error) {
      console.error("Error in fitBounds:", error);
      setMapError("Error fitting map to bounds");
    }
  }, [map, schedule, mapCenter]);

  // Handle map load
  const handleMapLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);

    // Ensure the map is visible by triggering a resize event
    window.google.maps.event.trigger(mapInstance, 'resize');

    // Reset directionsAttempted to ensure initial route is generated
    directionsAttempted.current = false;

    setTimeout(() => {
      fitBounds();
    }, 500);
  }, [fitBounds]);

  // Function to fetch directions for each route segment
  useEffect(() => {
    if (!map || !schedule || schedule.items.length < 2 || directionsAttempted.current) {
      return;
    }

    try {
      directionsAttempted.current = true;

      // Clear any existing directions renderers
      directionsRenderers.current.forEach(renderer => {
        if (renderer) {
          renderer.setMap(null);
        }
      });
      directionsRenderers.current = [];

      // Create separate route for each segment
      const directionsService = new window.google.maps.DirectionsService();
      const requestPromises = [];

      // Process each route segment between consecutive locations
      for (let i = 0; i < schedule.items.length - 1; i++) {
        const currentItem = schedule.items[i];
        const nextItem = schedule.items[i + 1];

        // Skip invalid segments - do thorough checks to satisfy TypeScript
        if (!currentItem.travel_to_next || 
            !nextItem.travel_to_next || 
            !currentItem.travel_to_next.start_location || 
            !nextItem.travel_to_next.start_location ||
            typeof currentItem.travel_to_next.start_location.lat !== 'number' || 
            typeof currentItem.travel_to_next.start_location.lng !== 'number' ||
            typeof nextItem.travel_to_next.start_location.lat !== 'number' || 
            typeof nextItem.travel_to_next.start_location.lng !== 'number') {
          continue;
        }

        // At this point TypeScript knows all the properties exist and are valid
        const currentStartLocation = currentItem.travel_to_next.start_location;
        const nextStartLocation = nextItem.travel_to_next.start_location;

        // Get the color for this segment (matching the starting point marker)
        const routeColor = markerColors[i % markerColors.length];
        
        // Create a dynamic offset for this route to prevent route overlap
        // Use different patterns based on segment index
        // This creates a curved offset pattern that increases with each segment
        const offsetPattern = i % 4;
        let latOffset = 0;
        let lngOffset = 0;

        // Apply different offset patterns based on segment number
        switch(offsetPattern) {
          case 0:
            // Offset to the north-east
            latOffset = 0.0002 * (i/4 + 1); 
            lngOffset = 0.0002 * (i/4 + 1);
            break;
          case 1:
            // Offset to the south-east
            latOffset = -0.0002 * (i/4 + 1);
            lngOffset = 0.0002 * (i/4 + 1); 
            break;
          case 2:
            // Offset to the south-west
            latOffset = -0.0002 * (i/4 + 1);
            lngOffset = -0.0002 * (i/4 + 1);
            break;
          case 3:
            // Offset to the north-west
            latOffset = 0.0002 * (i/4 + 1);
            lngOffset = -0.0002 * (i/4 + 1);
            break;
        }

        // Create a request for this segment
        const request = new Promise<void>((resolve) => {
          directionsService.route({
            origin: new window.google.maps.LatLng(
              currentStartLocation.lat + latOffset,
              currentStartLocation.lng + lngOffset
            ),
            destination: new window.google.maps.LatLng(
              nextStartLocation.lat,
              nextStartLocation.lng
            ),
            travelMode: getTravelMode(travelMode),
            optimizeWaypoints: false
          }, (result, status) => {
            if (status === window.google.maps.DirectionsStatus.OK) {
              // Create a directions renderer for this segment
              const renderer = new window.google.maps.DirectionsRenderer({
                suppressMarkers: true,
                preserveViewport: true,
                polylineOptions: {
                  strokeColor: routeColor,
                  strokeWeight: 4 + (i % 3), // Vary line thickness (4, 5, or 6)
                  strokeOpacity: 0.8,
                  zIndex: 50 - i, // Higher indexes displayed on top
                  icons: [{
                    icon: {
                      path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                      scale: 3 + (i % 2), // Vary arrow size (3 or 4)
                      fillColor: '#FFFFFF',
                      fillOpacity: 1,
                      strokeColor: routeColor,
                      strokeWeight: 2,
                    },
                    offset: '0',
                    repeat: (80 + (i * 20)) + 'px' // Vary arrow spacing (80px, 100px, 120px, etc.)
                  }]
                }
              });
              renderer.setMap(map);
              renderer.setDirections(result);
              directionsRenderers.current.push(renderer);
            } else {
              console.error(`Directions request failed for segment ${i}: ${status}`);
            }
            resolve();
          });
        });

        requestPromises.push(request);
      }

      // After all direction requests are processed, fit the map
      Promise.all(requestPromises).then(() => {
        fitBounds();
      });
    } catch (error) {
      console.error("Error setting up directions:", error);
      setMapError("Error generating directions");
      fitBounds();
    }
  }, [map, schedule, fitBounds, travelMode]);

  // Helper function to convert string travel mode to Google Maps travel mode
  const getTravelMode = (mode: string): google.maps.TravelMode => {
    switch (mode.toLowerCase()) {
      case 'driving':
        return window.google.maps.TravelMode.DRIVING;
      case 'bicycling':
        return window.google.maps.TravelMode.BICYCLING;
      case 'transit':
        return window.google.maps.TravelMode.TRANSIT;
      case 'walking':
      default:
        return window.google.maps.TravelMode.WALKING;
    }
  };

  // Convert schedule items to Place objects for markers
  const schedulePlaces = schedule.items.map((item) => {
    const place = places.find(p => p.id === item.place_id);
    if (!place) {
      // Create a placeholder place if not found
      return {
        id: item.place_id,
        name: item.name,
        location: item.travel_to_next?.start_location || DEFAULT_CENTER,
        address: '',
        placeType: ''
      };
    }
    return place;
  }).filter(Boolean) as Place[];

  return (
    <div className="directions-map-wrapper">
      {mapError && (
        <div className="map-error-banner">
          {mapError}
        </div>
      )}
      <Map
        mapCenter={mapCenter}
        setMapCenter={setMapCenter}
        onMapLoad={handleMapLoad}
        className="directions-map"
        zoom={12}
        options={mapOptions}
      >
        {/* Display markers for each place in the schedule */}
        {schedulePlaces.map((place, index) => (
          <MapMarker
            key={`schedule-${place.id}-${index}-${directionsRenderers.current.length > 0 ? 'with-dir' : 'no-dir'}`}
            place={place}
            markerType="schedule"
            index={index}
          />
        ))}
      </Map>
    </div>
  );
};

export default DirectionsMap; 