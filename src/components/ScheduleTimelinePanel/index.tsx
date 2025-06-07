import React from 'react';
import { useAppContext } from '../../context/AppContext';
import './index.css';

// Custom marker colors for better visibility
const markerColors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#FF9800', '#9C27B0', '#795548'];

const ScheduleTimelinePanel: React.FC = () => {
  const { currentSchedule } = useAppContext();

  if (!currentSchedule) {
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
      <div className="schedule-summary">
        <div>Total time: {Math.floor(currentSchedule.total_duration_minutes / 60)}h {currentSchedule.total_duration_minutes % 60}m</div>
        <div>Total distance: {(currentSchedule.total_distance_meters / 1000).toFixed(1)} km</div>
      </div>
      <div className="schedule-items-list">
        {currentSchedule.items.map((item, index) => (
          <div key={item.place_id} className="schedule-item-card">
            <div className="schedule-time-infor">
              <div className="time">{item.start_time}</div>
              <div className="time-duration">{item.duration_minutes} min</div>
              <div className="time">{item.end_time}</div>
            </div>
            <div className="schedule-place-details">
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
              <div className="travel-segment-card">
                <div className="travel-infor">
                  <i className="travel-icon">🚗</i>
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