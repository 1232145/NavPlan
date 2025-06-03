/**
 * SchedulePage Component
 * 
 * A page that displays an optimized schedule based on saved places.
 * 
 * Features:
 * - Interactive map showing the route between scheduled places
 * - Timeline view of the day's activities
 * - Details for each stop including times and travel information
 * - Navigation back to the main map
 * 
 * This page uses the DirectionsMap component to display the route and
 * provides a detailed timeline of the schedule generated from the user's
 * favorite places.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import DirectionsMap from '../../components/DirectionsMap';
import './index.css';

// Default location (New York) as fallback
const DEFAULT_CENTER = { lat: 40.7128, lng: -74.0060 };

// Custom marker colors for better visibility
const markerColors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#FF9800', '#9C27B0', '#795548'];

const SchedulePage: React.FC = () => {
  const { currentSchedule, favoritePlaces } = useAppContext();
  const navigate = useNavigate();
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  
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
        <DirectionsMap 
          schedule={currentSchedule}
          places={favoritePlaces}
          initialCenter={mapCenter}
        />
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
                <div className="travel-infor">
                  <i className="travel-icon">🚶</i>
                  <div className="travel-details">
                    <div>{item.travel_to_next.duration.text} ({item.travel_to_next.distance.text})</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SchedulePage; 