import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import './index.css';

// Map component imports
import { GoogleMap, DirectionsRenderer, Marker, useJsApiLoader, Libraries } from '@react-google-maps/api';

// Define libraries array outside component to prevent reloading warning
const libraries: Libraries = ['places'];

const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '8px'
};

// Default location (New York) as fallback
const DEFAULT_CENTER = { lat: 40.7128, lng: -74.0060 };

// Custom marker colors for better visibility
const markerColors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#FF9800', '#9C27B0', '#795548'];

const SchedulePage: React.FC = () => {
  const { currentSchedule } = useAppContext();
  const navigate = useNavigate();
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const directionsAttempted = useRef(false);
  
  // Use the same useJsApiLoader hook with static libraries array
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries
  });
  
  // Set initial map center based on first place
  useEffect(() => {
    if (!currentSchedule) {
      navigate('/map');
      return;
    }
    
    if (currentSchedule.items.length > 0) {
      const firstItem = currentSchedule.items[0];
      if (firstItem && firstItem.travel_to_next && 
          firstItem.travel_to_next.start_location && 
          firstItem.travel_to_next.start_location.lat && 
          firstItem.travel_to_next.start_location.lng) {
        setMapCenter({
          lat: firstItem.travel_to_next.start_location.lat,
          lng: firstItem.travel_to_next.start_location.lng
        });
      }
    }
  }, [currentSchedule, navigate]);

  const handleBackToMap = () => {
    navigate('/map');
  };

  const onMapLoad = useCallback((mapInstance: google.maps.Map) => {
    console.log("Map loaded");
    setMap(mapInstance);
    mapRef.current = mapInstance;
    
    // Once the map is loaded, immediately try to fit bounds
    if (currentSchedule && currentSchedule.items.length > 0) {
      setTimeout(() => {
        fitBounds();
      }, 100);
    }
  }, [currentSchedule]);

  // Create bounds for all locations to fit the map
  const fitBounds = useCallback(() => {
    console.log("Attempting to fit bounds");
    if (!mapRef.current || !currentSchedule || currentSchedule.items.length === 0) {
      console.log("Cannot fit bounds - missing map or schedule data");
      return;
    }
    
    const bounds = new window.google.maps.LatLngBounds();
    let addedPoints = 0;
    
    currentSchedule.items.forEach(item => {
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
        if (item === currentSchedule.items[currentSchedule.items.length - 1]) {
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
      mapRef.current.fitBounds(bounds);
      
      // Slightly zoom out to give some padding
      setTimeout(() => {
        if (mapRef.current) {
          const zoom = mapRef.current.getZoom();
          if (zoom && zoom > 15) mapRef.current.setZoom(zoom - 1);
        }
      }, 200);
    } else {
      console.log("No valid points found to fit bounds");
    }
  }, [currentSchedule]);

  // Function to fetch directions
  useEffect(() => {
    if (!map || !currentSchedule || !isLoaded || currentSchedule.items.length < 2 || directionsAttempted.current) {
      return;
    }

    // Make sure the Google Maps API is loaded
    if (!window.google || !window.google.maps) {
      console.log("Google Maps API not loaded yet");
      return;
    }

    try {
      console.log("Attempting to get directions");
      directionsAttempted.current = true;
      
      // Validate each place has valid coordinates before attempting to get directions
      let allValid = true;
      let validWaypoints = [];
      
      for (let i = 0; i < currentSchedule.items.length; i++) {
        const item = currentSchedule.items[i];
        
        if (!item.travel_to_next || 
            !item.travel_to_next.start_location || 
            !item.travel_to_next.start_location.lat || 
            !item.travel_to_next.start_location.lng ||
            (item.travel_to_next.start_location.lat === 0 && 
             item.travel_to_next.start_location.lng === 0)) {
          console.log("Invalid place found:", item);
          allValid = false;
        } else if (i > 0 && i < currentSchedule.items.length - 1) {
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
      const firstItem = currentSchedule.items[0];
      const lastItem = currentSchedule.items[currentSchedule.items.length - 1];
      
      // Check if the items have valid travel_to_next data
      if (!firstItem.travel_to_next || 
          !lastItem.travel_to_next ||
          !firstItem.travel_to_next.start_location ||
          !lastItem.travel_to_next.end_location) {
        console.log("Missing travel data for first or last item");
        fitBounds();
        return;
      }
      
      // Check for zero coordinates
      if ((firstItem.travel_to_next.start_location.lat === 0 && 
           firstItem.travel_to_next.start_location.lng === 0) ||
          (lastItem.travel_to_next.end_location.lat === 0 &&
           lastItem.travel_to_next.end_location.lng === 0)) {
        console.log("First or last location has zero coordinates");
        fitBounds();
        return;
      }
      
      console.log("Origin:", firstItem.travel_to_next.start_location);
      console.log("Destination:", lastItem.travel_to_next.end_location);
      
      const origin = new window.google.maps.LatLng(
        firstItem.travel_to_next.start_location.lat, 
        firstItem.travel_to_next.start_location.lng
      );
        
      const destination = new window.google.maps.LatLng(
        lastItem.travel_to_next.end_location.lat,
        lastItem.travel_to_next.end_location.lng
      );

      const directionsService = new window.google.maps.DirectionsService();
      
      directionsService.route(
        {
          origin,
          destination,
          waypoints: validWaypoints,
          travelMode: window.google.maps.TravelMode.WALKING,
          optimizeWaypoints: false
        },
        (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            console.log("Directions received successfully");
            setDirections(result);
          } else {
            console.error(`Directions request failed: ${status}`);
            // If directions fail, at least fit the map to the markers
            fitBounds();
          }
        }
      );
    } catch (error) {
      console.error("Error generating directions:", error);
      fitBounds();
    }
  }, [map, currentSchedule, isLoaded, fitBounds]);

  // Map options with better defaults
  const mapOptions = useMemo(() => ({
    fullscreenControl: false,
    streetViewControl: false,
    mapTypeControl: false,
    zoomControl: true,
    scrollwheel: true,
    gestureHandling: 'greedy' as const,
    mapTypeId: 'roadmap' as const,
    styles: [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }]
      }
    ]
  }), []);

  if (!currentSchedule) {
    return <div className="schedule-loading">Loading your schedule...</div>;
  }

  // Create an array of valid schedule items for rendering
  const validItems = currentSchedule.items.filter(item => 
    item.travel_to_next && 
    item.travel_to_next.start_location && 
    item.travel_to_next.start_location.lat && 
    item.travel_to_next.start_location.lng &&
    (item.travel_to_next.start_location.lat !== 0 || 
     item.travel_to_next.start_location.lng !== 0)
  );

  return (
    <div className="schedule-page">
      <div className="schedule-page-header">
        <Button variant="default" size="sm" onClick={handleBackToMap}>
          Back to Map
        </Button>
        <h1>Your Optimized Day Plan</h1>
        <div className="schedule-summary">
          <div>Total time: {Math.floor(currentSchedule.total_duration_minutes / 60)}h {currentSchedule.total_duration_minutes % 60}m</div>
          <div>Total distance: {(currentSchedule.total_distance_meters / 1000).toFixed(1)} km</div>
        </div>
      </div>

      {/* Map with route */}
      <div className="schedule-map-container">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={mapCenter}
            zoom={13}
            onLoad={onMapLoad}
            options={mapOptions}
          >
            {/* Render directions if available */}
            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                  polylineOptions: {
                    strokeColor: '#5A8EA3',
                    strokeWeight: 5,
                    strokeOpacity: 0.7
                  }
                }}
              />
            )}
            
            {/* Render markers for each place */}
            {validItems.map((item, index) => {
              // Use a different color for each marker (cycling through the array)
              const colorIndex = index % markerColors.length;
              
              return (
                <Marker
                  key={item.place_id}
                  position={{
                    lat: item.travel_to_next!.start_location.lat,
                    lng: item.travel_to_next!.start_location.lng
                  }}
                  label={{
                    text: `${index + 1}`,
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                  icon={{
                    path: window.google?.maps.SymbolPath.CIRCLE,
                    fillColor: markerColors[colorIndex],
                    fillOpacity: 1,
                    strokeWeight: 1,
                    strokeColor: '#FFFFFF',
                    scale: 10
                  }}
                />
              );
            })}
            
            {/* Add a final destination marker if available */}
            {currentSchedule.items.length > 0 && 
              currentSchedule.items[currentSchedule.items.length - 1].travel_to_next &&
              currentSchedule.items[currentSchedule.items.length - 1].travel_to_next!.end_location && 
              (currentSchedule.items[currentSchedule.items.length - 1].travel_to_next!.end_location.lat !== 0 ||
               currentSchedule.items[currentSchedule.items.length - 1].travel_to_next!.end_location.lng !== 0) && (
                <Marker
                  key="destination"
                  position={{
                    lat: currentSchedule.items[currentSchedule.items.length - 1].travel_to_next!.end_location.lat,
                    lng: currentSchedule.items[currentSchedule.items.length - 1].travel_to_next!.end_location.lng
                  }}
                  icon={{
                    url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                    scaledSize: new window.google.maps.Size(40, 40)
                  }}
                />
              )
            }
          </GoogleMap>
        ) : (
          <div className="map-loading">Loading map...</div>
        )}
      </div>

      {/* Timeline */}
      <div className="schedule-timeline">
        {currentSchedule.items.map((item, index) => (
          <div key={item.place_id} className="schedule-item">
            <div className="schedule-time">
              <div className="time-start">{item.start_time}</div>
              <div className="time-duration">{item.duration_minutes} min</div>
              <div className="time-end">{item.end_time}</div>
            </div>
            
            <div className="schedule-place">
              <h3>
                <span className="place-number" style={{ backgroundColor: markerColors[index % markerColors.length] }}>
                  {index + 1}
                </span> 
                {item.name}
              </h3>
              <p>{item.activity}</p>
            </div>
            
            {item.travel_to_next && (
              <div className="travel-segment">
                <div className="travel-info">
                  <i className="travel-icon">🚶</i>
                  <span>{item.travel_to_next.duration.text} ({item.travel_to_next.distance.text})</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      <div className="schedule-actions">
        <button className="schedule-btn export">Export PDF</button>
        <button className="schedule-btn share">Share</button>
        <button 
          className="schedule-btn directions"
          onClick={() => {
            const lastItem = currentSchedule.items[currentSchedule.items.length-1];
            if (lastItem.travel_to_next && lastItem.travel_to_next.end_location) {
              const url = `https://www.google.com/maps/dir/?api=1&origin=${mapCenter.lat},${mapCenter.lng}&destination=${lastItem.travel_to_next.end_location.lat},${lastItem.travel_to_next.end_location.lng}&travelmode=walking`;
              window.open(url, '_blank');
            }
          }}
        >
          Open in Google Maps
        </button>
      </div>
    </div>
  );
};

export default SchedulePage; 