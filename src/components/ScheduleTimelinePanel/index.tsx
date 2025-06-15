import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { useArchiveSchedules } from '../../hooks';
import { Schedule, TravelMode } from '../../types';
import { Button } from '../Button';
import SaveScheduleDialog from '../SaveScheduleDialog';
import { Bookmark } from 'lucide-react';
import './index.css';
import { MdLocationOn, MdCategory } from 'react-icons/md';

// Custom marker colors for better visibility
const markerColors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#FF9800', '#9C27B0', '#795548'];

// Travel mode icons
const TRAVEL_MODE_ICONS: { [key: string]: string } = {
  "walking": "🚶",
  "bicycling": "🚲",
  "driving": "🚗",
  "transit": "🚆",
};

// Place type mapping to more readable formats
const PLACE_TYPE_LABELS: { [key: string]: string } = {
  "tourist_attraction": "Tourist Attraction",
  "restaurant": "Restaurant",
  "cafe": "Café",
  "bar": "Bar",
  "museum": "Museum",
  "park": "Park",
  "art_gallery": "Art Gallery",
  "bakery": "Bakery",
  "shopping_mall": "Shopping Mall",
  "hotel": "Hotel",
  "movie_theater": "Movie Theater",
  "point_of_interest": "Point of Interest",
  "establishment": "Establishment",
  "food": "Food",
  "store": "Store",
  "church": "Church",
  "night_club": "Night Club",
  "lodging": "Lodging",
  "amusement_park": "Amusement Park",
  "aquarium": "Aquarium",
  "zoo": "Zoo",
  "stadium": "Stadium",
  "university": "University",
  "library": "Library",
  "hospital": "Hospital"
};

interface ScheduleTimelinePanelProps {
  travelMode: string;
  schedule?: Schedule;
  isViewingSaved?: boolean;
  savedScheduleName?: string;
}

const ScheduleTimelinePanel: React.FC<ScheduleTimelinePanelProps> = ({ 
  travelMode, 
  schedule: propSchedule,
  isViewingSaved = false,
  savedScheduleName
}) => {
  const { currentSchedule, sourceArchiveList } = useAppContext();
  
  // Archive schedule management
  const archiveSchedules = useArchiveSchedules();
  
  // Use provided schedule or fall back to current schedule
  const displaySchedule = propSchedule || currentSchedule;

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
    // Could show a toast notification here
  };

  // Format place type to be more readable
  const formatPlaceType = (placeType: string): string => {
    return PLACE_TYPE_LABELS[placeType.toLowerCase()] || 
      placeType.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
  };

  if (!displaySchedule) {
    return (
      <div className="schedule-timeline-panel expanded">
        <div className="empty-state">
          <p>No schedule available. Please generate a schedule first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="schedule-timeline-panel expanded">
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

      <div className="schedule-summary">
        <div>Total time: {Math.floor(displaySchedule.total_duration_minutes / 60)}h {displaySchedule.total_duration_minutes % 60}m</div>
        <div>Total distance: {(displaySchedule.total_distance_meters / 1000).toFixed(1)} km</div>
        {isViewingSaved && (
          <div className="saved-schedule-indicator">📁 {savedScheduleName || 'Saved Schedule'}</div>
        )}
      </div>

      {/* Save button only for current schedules with source list */}
      {!isViewingSaved && currentSchedule && sourceArchiveList && (
        <div className="schedule-save-section">
          <Button
            variant="primary"
            size="md"
            onClick={handleSaveSchedule}
            className="save-schedule-button"
          >
            <Bookmark size={16} />
            Save to "{sourceArchiveList.name}"
          </Button>
        </div>
      )}

      <div className="schedule-items-list">
        {displaySchedule.items.map((item, index) => (
          <div key={item.place_id} className="schedule-item-card">
            <div className="schedule-time-infor">
              <div className="timeline-time">{item.start_time}</div>
              <div className="time-duration">{item.duration_minutes} min</div>
              <div className="timeline-time">{item.end_time}</div>
            </div>
            <div className="schedule-place-details">
              <h3>
                <span className="schedule-place-number" style={{ backgroundColor: markerColors[index % markerColors.length] }}>
                  {index + 1}
                </span>
                {item.name}
              </h3>
              <div className="place-info-container">
                <div className="place-info-item">
                  <MdCategory className="place-info-icon" />
                  <span className="schedule-place-type">{formatPlaceType(item.placeType)}</span>
                </div>
                <div className="place-info-item">
                  <MdLocationOn className="place-info-icon" />
                  <span className="schedule-place-address">{item.address}</span>
                </div>
              </div>
              {item.ai_review && (
                <div className="place-ai-review">
                  <span className="ai-icon">🤖</span>
                  <span><strong>AI Insight:</strong> {item.ai_review}</span>
                </div>
              )}
            </div>
            {item.travel_to_next && (
              <div className="travel-segment-card">
                <div className="travel-infor">
                  <i className="travel-icon">{TRAVEL_MODE_ICONS[travelMode] || TRAVEL_MODE_ICONS["walking"]}</i>
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

export default ScheduleTimelinePanel; 