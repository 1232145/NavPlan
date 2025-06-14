import React, { useState, useEffect, useCallback } from 'react';
import { ArchivedList, TravelMode } from '../../types';
import { Button } from '../Button';
import { X, Save, Clock, MapPin, Calendar } from 'lucide-react';
import './index.css';

interface SaveScheduleDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (options: SaveScheduleOptions) => Promise<void>;
  selectedList: ArchivedList | null;
  suggestedSlot?: number | null;
  loading?: boolean;
  error?: string | null;
}

export interface SaveScheduleOptions {
  name: string;
  travelMode: TravelMode;
  startTime: string;
  endTime: string;
  replaceSlot?: number;
}

const TRAVEL_MODES: { value: TravelMode; label: string; icon: string }[] = [
  { value: 'walking', label: 'Walking', icon: '🚶' },
  { value: 'driving', label: 'Driving', icon: '🚗' },
  { value: 'bicycling', label: 'Bicycling', icon: '🚲' },
  { value: 'transit', label: 'Transit', icon: '🚆' }
];

const SLOT_NAMES = ['', 'Morning Route', 'Afternoon Route', 'Evening Route'];

const SaveScheduleDialog: React.FC<SaveScheduleDialogProps> = ({
  open,
  onClose,
  onSave,
  selectedList,
  suggestedSlot,
  loading = false,
  error = null
}) => {
  const [formData, setFormData] = useState({
    name: '',
    travelMode: 'walking' as TravelMode,
    startTime: '09:00',
    endTime: '19:00',
    replaceSlot: undefined as number | undefined
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open && selectedList) {
      const defaultName = suggestedSlot 
        ? SLOT_NAMES[suggestedSlot] || `Schedule ${suggestedSlot}`
        : `${selectedList.name} Schedule`;
        
      setFormData({
        name: defaultName,
        travelMode: 'walking',
        startTime: '09:00',
        endTime: '19:00',
        replaceSlot: suggestedSlot || undefined
      });
      setValidationErrors({});
    }
  }, [open, selectedList, suggestedSlot]);

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Schedule name is required';
    } else if (formData.name.length > 100) {
      errors.name = 'Name must be 100 characters or less';
    }

    // Time validation
    const startHour = parseInt(formData.startTime.split(':')[0]);
    const endHour = parseInt(formData.endTime.split(':')[0]);
    const startMinute = parseInt(formData.startTime.split(':')[1]);
    const endMinute = parseInt(formData.endTime.split(':')[1]);
    
    const startTotalMinutes = startHour * 60 + startMinute;
    const endTotalMinutes = endHour * 60 + endMinute;

    if (startTotalMinutes >= endTotalMinutes) {
      errors.time = 'End time must be after start time';
    }

    if (endTotalMinutes - startTotalMinutes < 120) {
      errors.time = 'Schedule must be at least 2 hours long';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // Handle form submission
  const handleSave = useCallback(async () => {
    if (!validateForm()) return;

    try {
      await onSave({
        name: formData.name.trim(),
        travelMode: formData.travelMode,
        startTime: formData.startTime,
        endTime: formData.endTime,
        replaceSlot: formData.replaceSlot
      });
    } catch (error) {
      // Error handling is done in parent component
    }
  }, [formData, validateForm, onSave]);

  // Handle input changes
  const updateFormData = useCallback((field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [validationErrors]);

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

  const hasErrors = Object.keys(validationErrors).length > 0;
  const canSave = !loading && !hasErrors && formData.name.trim();

  return (
    <div className="save-schedule-overlay" onClick={onClose}>
      <div className="save-schedule-dialog" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="save-schedule-header">
          <div className="save-schedule-title">
            <Save size={20} />
            <h3>Save Schedule to Archive</h3>
          </div>
          <button className="save-schedule-close" onClick={onClose} disabled={loading}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="save-schedule-content">
          {/* Archive List Info */}
          <div className="archive-list-info">
            <MapPin size={16} />
            <span>Saving to: <strong>{selectedList.name}</strong></span>
            <span className="schedule-slots-info">
              ({selectedList.saved_schedules.length}/3 slots used)
            </span>
          </div>

          {/* Form */}
          <div className="save-schedule-form">
            {/* Schedule Name */}
            <div className="form-group">
              <label htmlFor="schedule-name">Schedule Name</label>
              <input
                id="schedule-name"
                type="text"
                value={formData.name}
                onChange={e => updateFormData('name', e.target.value)}
                placeholder="Enter schedule name..."
                maxLength={100}
                disabled={loading}
                className={validationErrors.name ? 'error' : ''}
              />
              {validationErrors.name && (
                <span className="error-message">{validationErrors.name}</span>
              )}
            </div>

            {/* Travel Mode */}
            <div className="form-group">
              <label>Travel Mode</label>
              <div className="travel-mode-grid">
                {TRAVEL_MODES.map(mode => (
                  <button
                    key={mode.value}
                    type="button"
                    className={`travel-mode-option ${formData.travelMode === mode.value ? 'selected' : ''}`}
                    onClick={() => updateFormData('travelMode', mode.value)}
                    disabled={loading}
                  >
                    <span className="travel-mode-icon">{mode.icon}</span>
                    <span>{mode.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Time Range */}
            <div className="form-group">
              <label>Schedule Time</label>
              <div className="time-range-inputs">
                <div className="time-input-group">
                  <Clock size={16} />
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={e => updateFormData('startTime', e.target.value)}
                    disabled={loading}
                  />
                  <span>to</span>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={e => updateFormData('endTime', e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              {validationErrors.time && (
                <span className="error-message">{validationErrors.time}</span>
              )}
            </div>

            {/* Slot Selection (if replacing) */}
            {suggestedSlot && (
              <div className="form-group">
                <label>Schedule Slot</label>
                <div className="slot-info">
                  <Calendar size={16} />
                  <span>This will be saved as <strong>{SLOT_NAMES[suggestedSlot]}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="save-schedule-error">
              <span>⚠️ {error}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="save-schedule-actions">
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

        {/* Keyboard Shortcuts Hint */}
        <div className="keyboard-shortcuts">
          <span>Press <kbd>Esc</kbd> to cancel or <kbd>Ctrl+Enter</kbd> to save</span>
        </div>
      </div>
    </div>
  );
};

export default SaveScheduleDialog; 