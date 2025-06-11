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
import DirectionsMap from '../../components/DirectionsMap';
import { Place } from '../../types';
import ScheduleTimelinePanel from '../../components/ScheduleTimelinePanel';
import NavbarColumn from '../../components/NavbarColumn';
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

const SchedulePage: React.FC = () => {
  const { currentSchedule, favoritePlaces, generateSchedule } = useAppContext();
  const navigate = useNavigate();
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [travelMode, setTravelMode] = useState("walking");

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

  const handleTravelModeChange = (newMode: string) => {
    if (newMode === travelMode || !currentSchedule || currentSchedule.items.length === 0) return;
    
    console.log(`Changing travel mode from ${travelMode} to ${newMode}`);
    
    // Simply update the travel mode - the DirectionsMap will handle re-routing
    setTravelMode(newMode);
  };

  if (!currentSchedule) {
    return null;
  }

  return (
    <div className="schedule-page-content">
      <NavbarColumn />
      <div className="schedule-container-wrapper">
        <div className="schedule-main-content">
          <div className="schedule-left-panel">
            {/* AI Day Overview */}
            {currentSchedule.day_overview && (
              <div className="ai-overview-note">
                <p>{currentSchedule.day_overview}</p>
              </div>
            )}

            {/* AI Place Selection Info */}
            {currentSchedule.total_places !== undefined && currentSchedule.items.length < currentSchedule.total_places && (
              <div className="ai-selection-info">
                <span className="ai-icon">✨</span>
                <p>AI selected {currentSchedule.items.length} out of {currentSchedule.total_places} places for an optimal day itinerary.</p>
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
                  >
                    <span className="travel-mode-icon">{mode.icon}</span>
                    <span className="travel-mode-text">{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <DirectionsMap
              schedule={currentSchedule}
              places={favoritePlaces}
              initialCenter={mapCenter}
              travelMode={travelMode}
            />
          </div>
          <ScheduleTimelinePanel travelMode={travelMode} />
        </div>
      </div>
    </div>
  );
};

export default SchedulePage; 