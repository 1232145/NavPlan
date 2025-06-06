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
 * - Displays AI-generated day overview and place reviews
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
import { Place } from '../../types';
import './index.css';

// Default location (New York) as fallback
const DEFAULT_CENTER = { lat: 40.7128, lng: -74.0060 };

// Travel mode options
const TRAVEL_MODES = [
  { value: "walking", label: "Walking", icon: "🚶" },
  { value: "driving", label: "Driving", icon: "🚗" },
  { value: "bicycling", label: "Bicycling", icon: "🚲" },
  { value: "transit", label: "Transit", icon: "🚆" }
];

// Custom marker colors for better visibility
const markerColors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#FF9800', '#9C27B0', '#795548'];

const SchedulePage: React.FC = () => {
  const { currentSchedule, favoritePlaces, generateSchedule, isLoading: isAppContextLoading } = useAppContext();
  const navigate = useNavigate();
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [travelMode, setTravelMode] = useState("walking");
  const [isUpdatingTravelMode, setIsUpdatingTravelMode] = useState(false);

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

  const handleTravelModeChange = async (newMode: string) => {
    if (newMode === travelMode || !currentSchedule || currentSchedule.items.length === 0) return;
    
    try {
      setIsUpdatingTravelMode(true);

      // Get the start time from the current schedule or use default
      const startTime = currentSchedule.items[0]?.start_time || "09:00";

      // Create a map of favorite places by ID for easy lookup if needed for `placesWithAiReview`.
      const placesForUpdate = currentSchedule.items.map(item => ({
        id: item.place_id,
        name: item.name,
        location: item.travel_to_next?.start_location || { lat: 0, lng: 0 },
        placeType: item.placeType || 'unknown',
        address: item.address || '',
        ai_review: item.ai_review || null,
      }));

      // Call generateSchedule from AppContext for the update
      await generateSchedule(
        startTime,
        newMode,
        undefined,
        placesForUpdate as Place[],
        currentSchedule.day_overview
      );
      setTravelMode(newMode);
      
    } catch (error) {
      console.error("Failed to update schedule with new travel mode:", error);
    } finally {
      setIsUpdatingTravelMode(false);
    }
  };

  if (!currentSchedule) {
    return <div className="schedule-loading">{isAppContextLoading ? 'Generating your initial schedule...' : 'Loading your schedule...'}</div>;
  }

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

      {/* AI Day Overview */}
      {currentSchedule.day_overview && (
        <div className="ai-overview-note">
          <p>{currentSchedule.day_overview}</p>
        </div>
      )}

      {/* AI Place Selection Info */}
      {favoritePlaces.length > 0 && currentSchedule.items.length < favoritePlaces.length && (
        <div className="ai-selection-info">
          <span className="ai-icon">✨</span>
          <p>AI selected {currentSchedule.items.length} out of {favoritePlaces.length} places for an optimal day itinerary.</p>
        </div>
      )}

      {/* Travel mode selector */}
      <div className="travel-mode-selector">
        <div className="travel-mode-label">Travel mode:</div>
        <div className="travel-mode-options">
          {TRAVEL_MODES.map(mode => (
            <button
              key={mode.value}
              className={`travel-mode-option ${travelMode === mode.value ? 'active' : ''}`}
              onClick={() => handleTravelModeChange(mode.value)}
              title={mode.label}
              disabled={isUpdatingTravelMode || isAppContextLoading}
            >
              <span className="travel-mode-icon">{mode.icon}</span>
              <span className="travel-mode-text">{mode.label}</span>
            </button>
          ))}
        </div>
        {(isUpdatingTravelMode || isAppContextLoading) && <div className="loading-indicator">Updating schedule...</div>}
      </div>

      {/* Map with route */}
      <div className="schedule-map-container">
        <DirectionsMap
          schedule={currentSchedule}
          places={favoritePlaces}
          initialCenter={mapCenter}
          travelMode={travelMode}
        />
      </div>

      {/* Timeline */}
      <div className="schedule-timeline">
        {currentSchedule.items.map((item, index) => {
          return (
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
                <p className="schedule-place-type">{item.placeType}</p>
                <p className="schedule-place-address">{item.address}</p>
                <p>{item.activity}</p>
                {item.ai_review && (
                  <div className="place-ai-review">
                    <span className="ai-icon">💡</span>
                    <span>{item.ai_review}</span>
                  </div>
                )}
              </div>

              {item.travel_to_next && (
                <div className="travel-segment">
                  <div className="travel-infor">
                    <i className="travel-icon">{TRAVEL_MODES.find(mode => mode.value === travelMode)?.icon}</i>
                    <div className="travel-details">
                      <div>{item.travel_to_next.duration.text} ({item.travel_to_next.distance.text})</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SchedulePage; 