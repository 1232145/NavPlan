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
 * - Save schedule functionality
 * - View saved schedules from archive lists
 * 
 * This page uses the DirectionsMap component to display the route and
 * provides a detailed timeline of the schedule generated from the user's
 * favorite places.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { useArchiveSchedules } from '../../hooks';
import { SavedSchedule, TravelMode } from '../../types';
import DirectionsMap from '../../components/DirectionsMap';
import ScheduleTimelinePanel from '../../components/ScheduleTimelinePanel';
import SaveScheduleDialog from '../../components/SaveScheduleDialog';
import NavbarColumn from '../../components/NavbarColumn';
import LoadingScreen from '../../components/LoadingScreen';
import { Button } from '../../components/Button';
import { Bookmark } from 'lucide-react';
import './index.css';

import { DEFAULT_MAP_CENTER, TRAVEL_MODES } from '../../constants/common';

const SchedulePage: React.FC = () => {
  const { currentSchedule, favoritePlaces, sourceArchiveList } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [mapCenter, setMapCenter] = useState(DEFAULT_MAP_CENTER);
  const [travelMode, setTravelMode] = useState("walking");
  const [viewingSavedSchedule, setViewingSavedSchedule] = useState<SavedSchedule | null>(null);
  const [hasScheduleBeenSaved, setHasScheduleBeenSaved] = useState(false);
  
  // Archive schedule management
  const archiveSchedules = useArchiveSchedules();

  // Check if we're viewing a saved schedule from navigation state
  useEffect(() => {
    const savedSchedule = location.state?.savedSchedule as SavedSchedule;
    if (savedSchedule) {
      // console.log('Setting viewingSavedSchedule:', savedSchedule);
      setViewingSavedSchedule(savedSchedule);
      setTravelMode(savedSchedule.metadata.travel_mode);
    }
  }, [location.state]);

  // Reset save state when current schedule changes (new schedule generated)
  useEffect(() => {
    setHasScheduleBeenSaved(false);
  }, [currentSchedule]);

  // Redirect to map if no schedule and not viewing saved schedule
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!currentSchedule && !viewingSavedSchedule && !location.state?.savedSchedule) {
        console.log('No schedule found, redirecting to map');
        navigate('/map');
      }
    }, 100); // Small delay to allow state updates

    return () => clearTimeout(timer);
  }, [currentSchedule, viewingSavedSchedule, navigate, location.state]);

  // Set initial map center based on first place
  useEffect(() => {
    const schedule = viewingSavedSchedule?.schedule || currentSchedule;
    if (schedule && schedule.items.length > 0) {
      const firstItem = schedule.items[0];
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
  }, [currentSchedule, viewingSavedSchedule]);

  const handleTravelModeChange = (newMode: string) => {
    if (newMode === travelMode) return;
    
    // For saved schedules, we can't change travel mode
    if (viewingSavedSchedule) {
      return;
    }
    
    // For current schedules, update the travel mode
    if (currentSchedule && currentSchedule.items.length > 0) {
      setTravelMode(newMode);
    }
  };

  // Handle save schedule button click - only available for current schedules
  const handleSaveSchedule = async () => {
    if (!currentSchedule || !sourceArchiveList) {
      console.error('No current schedule or source list to save to');
      return;
    }
    
    // Open save dialog with the source archive list
    archiveSchedules.openSaveDialog(sourceArchiveList);
  };

  // Handle successful schedule save
  const handleScheduleSaved = async () => {
    setHasScheduleBeenSaved(true);
    // Could show a toast notification here
    navigate('/lists', { state: { refreshLists: true } });
  };

  // Get the schedule to display (either current or saved)
  const displaySchedule = viewingSavedSchedule?.schedule || currentSchedule;
  const isViewingSaved = !!viewingSavedSchedule;

  // Create places array for the map - use saved schedule places if viewing saved, otherwise use favoritePlaces
  const displayPlaces = React.useMemo(() => {
    if (isViewingSaved && displaySchedule) {
      // Convert schedule items to places format for the map
      return displaySchedule.items.map((item) => ({
        id: item.place_id,
        name: item.name,
        placeType: item.placeType || 'point_of_interest',
        address: item.address || '',
        location: item.travel_to_next ? {
          lat: item.travel_to_next.start_location.lat,
          lng: item.travel_to_next.start_location.lng
        } : { lat: 0, lng: 0 },
        geometry: {
          location: item.travel_to_next ? {
            lat: item.travel_to_next.start_location.lat,
            lng: item.travel_to_next.start_location.lng
          } : { lat: 0, lng: 0 }
        },
        ai_review: item.ai_review,
        userAdded: false
      }));
    }
    return favoritePlaces;
  }, [isViewingSaved, displaySchedule, favoritePlaces]);

  // Show loading state while schedule is being set
  if (!displaySchedule && location.state?.savedSchedule) {
    return <LoadingScreen message="Loading saved schedule..." />;
  }

  if (!displaySchedule) {
    return null;
  }

  return (
    <div className="schedule-page-content">
      <NavbarColumn />

      {/* Save Schedule Dialog - only for current schedules */}
      {!isViewingSaved && currentSchedule && (
        <SaveScheduleDialog
          open={archiveSchedules.saveDialogOpen}
          onClose={archiveSchedules.closeSaveDialog}
          onSave={async (options) => {
            await archiveSchedules.saveScheduleToArchive(options);
            handleScheduleSaved();
          }}
          selectedList={archiveSchedules.selectedList}
          loading={archiveSchedules.isSavingSchedule}
          error={archiveSchedules.error}
          scheduleStartTime={currentSchedule.items[0]?.start_time || '09:00'}
          scheduleEndTime={currentSchedule.items[currentSchedule.items.length - 1]?.end_time || '19:00'}
          defaultName={sourceArchiveList ? `${sourceArchiveList.name} Schedule` : ''}
          originalTravelMode={travelMode as TravelMode}
        />
      )}
      
      <div className="schedule-container-wrapper">
        {/* Schedule Header with Actions */}
        <div className="schedule-header-actions">
          {/* Save button only for current schedules with source list */}
          {!isViewingSaved && currentSchedule && sourceArchiveList && (
            <Button
              variant={hasScheduleBeenSaved ? "secondary" : "primary"}
              size="md"
              onClick={handleSaveSchedule}
              className="save-schedule-button"
              disabled={hasScheduleBeenSaved}
            >
              <Bookmark size={16} />
              {hasScheduleBeenSaved ? "Saved to" : "Save to"} "{sourceArchiveList.name}"
            </Button>
          )}

          {/* Show schedule info for saved schedules */}
          {isViewingSaved && (
            <>
              <span className="saved-schedule-name">
                {viewingSavedSchedule.metadata.name}
              </span>
              <span className="saved-schedule-date">
                Saved {new Date(viewingSavedSchedule.metadata.created_at).toLocaleDateString()}
              </span>
            </>
          )}
        </div>
        
        <div className="schedule-main-content">
          <div className="schedule-left-panel">
            {/* AI Day Overview */}
            {displaySchedule.day_overview && (
              <div className="ai-overview-note">
                <p>{displaySchedule.day_overview}</p>
              </div>
            )}

            {/* AI Place Selection Info - only for current schedules */}
            {!isViewingSaved && displaySchedule.total_places !== undefined && displaySchedule.items.length < displaySchedule.total_places && (
              <div className="ai-selection-info">
                <span className="ai-icon">✨</span>
                <p>AI selected {displaySchedule.items.length} out of {displaySchedule.total_places} places for an optimal day itinerary.</p>
              </div>
            )}

            {/* Travel mode selector */}
            <div className="travel-mode-selector">
              <div className="travel-mode-label">Travel mode:</div>
              <div className="travel-mode-options">
                {TRAVEL_MODES.map(mode => (
                  <button
                    key={mode.value}
                    className={`travel-mode-option ${travelMode === mode.value ? 'active' : ''} ${isViewingSaved ? 'disabled' : ''}`}
                    onClick={() => handleTravelModeChange(mode.value)}
                    disabled={isViewingSaved}
                    title={isViewingSaved ? 'Cannot change travel mode for saved schedules' : mode.label}
                  >
                    <span className="travel-mode-icon">{mode.icon}</span>
                    <span className="travel-mode-text">{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <DirectionsMap
              schedule={displaySchedule}
              places={displayPlaces}
              initialCenter={mapCenter}
              travelMode={travelMode}
            />
          </div>
          <ScheduleTimelinePanel 
            travelMode={travelMode} 
            schedule={displaySchedule}
            isViewingSaved={isViewingSaved}
          />
        </div>
      </div>
    </div>
  );
};

export default SchedulePage; 