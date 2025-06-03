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
import { DirectionsRenderer } from '@react-google-maps/api';
import Map from '../Map';
import MapMarker from '../MapMarker';
import { Schedule, Place, Coordinates } from '../../types';
import './index.css';

export interface DirectionsMapProps {
  schedule: Schedule;
  places: Place[];
  initialCenter?: Coordinates;
}

const DEFAULT_CENTER = { lat: 40.7128, lng: -74.0060 }; // New York as default

const DirectionsMap: React.FC<DirectionsMapProps> = ({
  schedule,
  places,
  initialCenter = DEFAULT_CENTER
}) => {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinates>(initialCenter);
  const [mapError, setMapError] = useState<string | null>(null);
  const directionsAttempted = useRef(false);

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
        console.log(`Fitting map to ${addedPoints} points`);
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
    console.log("Map loaded successfully");
    setMap(mapInstance);

    // Ensure the map is visible by triggering a resize event
    window.google.maps.event.trigger(mapInstance, 'resize');

    setTimeout(() => {
      fitBounds();
    }, 500); // Increased timeout to ensure the map is fully loaded
  }, [fitBounds]);

  // Function to fetch directions
  useEffect(() => {
    if (!map || !schedule || schedule.items.length < 2 || directionsAttempted.current) {
      console.log("No map or schedule or schedule items < 2 or directionsAttempted");
      return;
    }

    try {
      console.log("Attempting to get directions");
      directionsAttempted.current = true;

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

      console.log("Origin:", firstItem.travel_to_next.start_location);
      console.log("Destination:", lastItem.travel_to_next.end_location);

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
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false
      }, (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          console.log("Directions received successfully");
          setDirections(result);
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
  }, [map, schedule, fitBounds]);

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
      >
        {/* Display the route if directions are available */}
        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: '#4285F4',
                strokeWeight: 5,
                strokeOpacity: 0.8
              }
            }}
          />
        )}
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