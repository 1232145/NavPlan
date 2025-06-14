import React, { useState, useEffect, useCallback } from 'react';
import { ArchivedList, TravelMode } from '../../types';
import { Button } from '../Button';
import { X, Save, Clock, MapPin } from 'lucide-react';
import { TRAVEL_MODES, VALIDATION_LIMITS } from '../../constants/common';
import './index.css';

interface SaveScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (options: SaveScheduleOptions) => Promise<void>;
  selectedList: ArchivedList | null;
  loading?: boolean;
  error?: string | null;
  // Schedule details from the generated schedule
  scheduleStartTime?: string;
  scheduleEndTime?: string;
  defaultName?: string;
}

export interface SaveScheduleOptions {
  name: string;
  travelMode: TravelMode;
  startTime: string;
  endTime: string;
}

const SaveScheduleDialog: React.FC<SaveScheduleDialogProps> = ({
  open,
  onClose,
  onSave,
  selectedList,
  loading = false,
  error = null,
  scheduleStartTime = '09:00',
  scheduleEndTime = '19:00',
  defaultName = ''
}) => {
  const [name, setName] = useState('');
  const [travelMode, setTravelMode] = useState<TravelMode>('walking');
  const [nameError, setNameError] = useState('');

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(defaultName || (selectedList ? `${selectedList.name} Schedule` : ''));
      setTravelMode('walking');
      setNameError('');
    }
  }, [open, defaultName, selectedList]);

  // Validate name
  const validateName = useCallback((value: string): string => {
    if (!value.trim()) {
      return 'Schedule name is required';
    }
    if (value.length > VALIDATION_LIMITS.MAX_NAME_LENGTH) {
      return `Name must be ${VALIDATION_LIMITS.MAX_NAME_LENGTH} characters or less`;
    }
    return '';
  }, []);

  // Handle name change
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    setNameError(validateName(value));
  }, [validateName]);

  // Handle save
  const handleSave = useCallback(async () => {
    const error = validateName(name);
    if (error) {
      setNameError(error);
      return;
    }

    try {
      await onSave({
        name: name.trim(),
        travelMode,
        startTime: scheduleStartTime,
        endTime: scheduleEndTime
      });
    } catch (err) {
      // Error handling is done in parent component
    }
  }, [name, travelMode, scheduleStartTime, scheduleEndTime, onSave, validateName]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        handleSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, handleSave]);

  if (!open || !selectedList) return null;

  const canSave = !loading && !nameError && name.trim();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">
            <Save size={20} style={{ marginRight: '12px' }} />
            Save Schedule
          </h3>
          <button className="modal-close" onClick={onClose} disabled={loading}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="save-schedule-content">
          {/* Archive List Info */}
          <div className="archive-list-info">
            <MapPin size={16} />
            <div className="archive-list-details">
              <span>Saving to: <strong>{selectedList.name}</strong></span>
              <span className="schedule-slots-info">
                {selectedList.saved_schedules.length}/3 slots used
              </span>
            </div>
          </div>

          {/* Schedule Summary */}
          <div className="schedule-summary">
            <div className="schedule-summary-item">
              <Clock size={16} />
              <span>Time: {scheduleStartTime} - {scheduleEndTime}</span>
            </div>
          </div>

          {/* Schedule Name */}
          <div className="form-group">
            <label htmlFor="schedule-name" className="form-label">Schedule Name</label>
            <input
              id="schedule-name"
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="Enter schedule name..."
              maxLength={VALIDATION_LIMITS.MAX_NAME_LENGTH}
              disabled={loading}
              className={`form-input ${nameError ? 'error' : ''}`}
            />
            {nameError && (
              <span className="form-error-text">{nameError}</span>
            )}
          </div>

          {/* Travel Mode */}
          <div className="form-group">
            <label className="form-label">Travel Mode</label>
            <div className="travel-mode-grid">
              {TRAVEL_MODES.map(mode => (
                <button
                  key={mode.value}
                  type="button"
                  className={`travel-mode-option ${travelMode === mode.value ? 'selected' : ''}`}
                  onClick={() => setTravelMode(mode.value)}
                  disabled={loading}
                >
                  <span className="travel-mode-icon">{mode.icon}</span>
                  <span>{mode.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="save-schedule-actions">
          <div className="button-group end">
            <Button
              variant="secondary"
              size="md"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSave}
              disabled={!canSave}
            >
              {loading ? 'Saving...' : 'Save Schedule'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SaveScheduleDialog; 