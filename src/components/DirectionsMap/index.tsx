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
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinates>(initialCenter);
  const [mapError, setMapError] = useState<string | null>(null);
  const directionsAttempted = useRef(false);
  const directionsRenderer = useRef<google.maps.DirectionsRenderer | null>(null);

  // Reset directions when travel mode changes or component mounts
  useEffect(() => {
    // Clear existing directions renderer
    if (directionsRenderer.current) {
      directionsRenderer.current.setMap(null);
      directionsRenderer.current = null;
    }
    setDirections(null);
    directionsAttempted.current = false;
  }, [travelMode]);

  // Create bounds for all locations to fit the map
  const fitBounds = useCallback(() => {
    if (!map || !schedule || schedule.items.length === 0) {
      console.log("Cannot fit bounds - missing map or schedule data");
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
        console.log("No valid points found to fit bounds, setting default zoom");
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

  // Function to fetch directions
  useEffect(() => {
    if (!map || !schedule || schedule.items.length < 2 || directionsAttempted.current) {
      return;
    }

    try {
      directionsAttempted.current = true;

      // Clear any existing directions renderer
      if (directionsRenderer.current) {
        directionsRenderer.current.setMap(null);
        directionsRenderer.current = null;
      }

      // Validate each place has valid coordinates before attempting to get directions
      let allValid = true;
      let validWaypoints = [];

      for (let i = 0; i < schedule.items.length; i++) {
        const item = schedule.items[i];

        if (!item.travel_to_next ||
          !item.travel_to_next.start_location ||
          !item.travel_to_next.start_location.lat ||
          !item.travel_to_next.start_location.lng ||
          (item.travel_to_next.start_location.lat === 0 &&
            item.travel_to_next.start_location.lng === 0)) {
          console.log("Invalid place found:", item);
          allValid = false;
        } else if (i > 0 && i < schedule.items.length - 1) {
          // Add as waypoint (skip first and last)
          validWaypoints.push({
            location: new window.google.maps.LatLng(
              item.travel_to_next.start_location.lat,
              item.travel_to_next.start_location.lng
            ),
            stopover: true
          });
        }
      }

      if (!allValid || validWaypoints.length === 0) {
        console.log("Some places have invalid coordinates - falling back to markers only");
        fitBounds();
        return;
      }

      // Get first and last items with valid coordinates
      const firstItem = schedule.items[0];
      const lastItem = schedule.items[schedule.items.length - 1];

      if (!firstItem.travel_to_next ||
        !lastItem.travel_to_next ||
        !firstItem.travel_to_next.start_location ||
        !lastItem.travel_to_next.end_location) {
        console.log("Missing travel data for first or last item");
        fitBounds();
        return;
      }

      // Set up directions service
      const directionsService = new window.google.maps.DirectionsService();

      directionsService.route({
        origin: new window.google.maps.LatLng(
          firstItem.travel_to_next.start_location.lat,
          firstItem.travel_to_next.start_location.lng
        ),
        destination: new window.google.maps.LatLng(
          lastItem.travel_to_next.end_location.lat,
          lastItem.travel_to_next.end_location.lng
        ),
        waypoints: validWaypoints,
        travelMode: getTravelMode(travelMode),
        optimizeWaypoints: false
      }, (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          // Create new directions renderer
          const renderer = new window.google.maps.DirectionsRenderer({
            suppressMarkers: true,
            polylineOptions: {
              strokeColor: '#4285F4',
              strokeWeight: 5,
              strokeOpacity: 0.8,
              icons: [{
                icon: {
                  path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                  scale: 4,
                  fillColor: '#FFFFFF',
                  fillOpacity: 1,
                  strokeColor: '#4285F4',
                  strokeWeight: 2,
                },
                offset: '0',
                repeat: '100px'
              }]
            }
          });
          renderer.setMap(map);
          renderer.setDirections(result);
          directionsRenderer.current = renderer;
          setDirections(result);
          fitBounds();
        } else {
          console.error("Directions request failed:", status);
          setMapError(`Directions request failed: ${status}`);
          // If directions fail, at least fit the map to the markers
          fitBounds();
        }
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
            key={`schedule-${place.id}-${index}-${directions ? 'with-dir' : 'no-dir'}`}
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