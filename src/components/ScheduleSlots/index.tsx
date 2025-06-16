import React, { useState, useCallback } from 'react';
import { ArchivedList, SavedSchedule } from '../../types';
import { Calendar, Star, Clock, MapPin, ChevronUp, ChevronDown } from 'lucide-react';
import { TRAVEL_MODES } from '../../constants/common';
import './index.css';

interface ScheduleSlotsProps {
  list: ArchivedList;
  onViewSchedule: (schedule: SavedSchedule) => void;
  onSaveNewSchedule?: (slotNumber?: number) => void;
}

const ScheduleSlots: React.FC<ScheduleSlotsProps> = ({
  list,
  onViewSchedule
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Format time display
  const formatTime = useCallback((time: string): string => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  }, []);

  // Format date display
  const formatDate = useCallback((dateString: string): string => {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  }, []);

  // Calculate duration
  const calculateDuration = useCallback((startTime: string, endTime: string): string => {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }, []);

  // Render minimal slot header for collapsed state
  const renderSlotHeader = useCallback((schedule: SavedSchedule | null, slotNumber: number) => {
    return (
      <div 
        className={`slot-header-minimal ${schedule ? 'filled' : 'empty'}`}
        onClick={() => schedule && onViewSchedule(schedule)}
      >
        <div className="slot-basic-info">
          <Calendar size={16} />
          <span className="slot-name">
            {schedule ? schedule.metadata.name : `Empty Slot`}
          </span>
          {schedule?.metadata.is_favorite && <Star size={14} className="favorite-icon" />}
        </div>
        
        <div className="slot-header-actions">
          <span className="slot-number">Slot {slotNumber}</span>
        </div>
      </div>
    );
  }, [onViewSchedule]);

  // Render expanded content for a schedule
  const renderExpandedContent = useCallback((schedule: SavedSchedule) => (
    <div className="schedule-expanded-content">
      <div className="schedule-meta">
        <div className="meta-item">
          <Clock size={14} />
          <span>
            {formatTime(schedule.metadata.start_time)} - {formatTime(schedule.metadata.end_time)}
          </span>
          <span className="duration">
            ({calculateDuration(schedule.metadata.start_time, schedule.metadata.end_time)})
          </span>
        </div>
        
        <div className="meta-item">
          <span className="travel-mode">
            {TRAVEL_MODES.find(mode => mode.value === schedule.metadata.travel_mode)?.icon || TRAVEL_MODES[0].icon} {schedule.metadata.travel_mode}
          </span>
        </div>
      </div>

      <div className="schedule-stats">
        <span>{schedule.schedule.items.length} places</span>
        <span>•</span>
        <span>Updated {formatDate(schedule.metadata.last_modified)}</span>
      </div>

      <div className="schedule-places-preview">
        <h5>Places in this schedule:</h5>
        <div className="places-list">
          {schedule.schedule.items.slice(0, 3).map((item, index) => (
            <div key={item.place_id} className="place-preview">
              <span className="place-number">{index + 1}</span>
              <span className="place-name">{item.name}</span>
              <span className="place-time">{item.start_time}</span>
            </div>
          ))}
          {schedule.schedule.items.length > 3 && (
            <div className="place-preview more-places">
              <span>+{schedule.schedule.items.length - 3} more places</span>
            </div>
          )}
        </div>
      </div>
    </div>
  ), [formatTime, formatDate, calculateDuration]);

  const hasSchedules = list.saved_schedules.length > 0;

  return (
    <div className="schedule-slots-container">
      <div className="schedule-slots-header">
        <div className="slots-title">
          <MapPin size={18} />
          <h4>Saved Schedules</h4>
        </div>
        <div className="slots-header-actions">
          <span className="slots-count">
            {list.saved_schedules.length}/3 slots used
          </span>
          {hasSchedules && (
            <button
              className="expand-toggle-button"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </div>
      </div>
      
      <div className="schedule-slots-list">
        {Array.from({ length: 3 }, (_, index) => {
          const slotNumber = index + 1;
          const schedule = list.saved_schedules[index] || null;
          
          return (
            <div key={`slot-${slotNumber}`} className="schedule-slot">
              {renderSlotHeader(schedule, slotNumber)}
              {isExpanded && schedule && renderExpandedContent(schedule)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScheduleSlots; 