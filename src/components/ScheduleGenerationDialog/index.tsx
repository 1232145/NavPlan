import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import { Button } from '../Button';
import { Clock, Info, ListChecks, Settings, Coffee, Utensils, Building, TreePine, ShoppingBag, Wine, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Place } from '../../types';
import './index.css';

export interface UserPreferences {
  must_include: string[];
  balance_mode: 'focused' | 'balanced' | 'diverse';
  max_places: number;
  meal_requirements: boolean;
}

export interface ScheduleGenerationOptions {
  startTime: string;
  endTime: string;
  prompt: string;
  includeCurrentLocation?: boolean;
  preferences?: UserPreferences;
}

interface ScheduleGenerationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (options: ScheduleGenerationOptions) => void;
  title?: string;
  description?: string;
  placeCount?: number;
  isLocationBased?: boolean;
  archiveListPlaces?: Place[];
}

// Category options with icons and descriptions
const CATEGORY_OPTIONS = [
  { id: 'restaurants', label: 'Restaurants', icon: <Utensils size={18} />, description: 'Dining establishments for meals' },
  { id: 'cafes', label: 'Cafés', icon: <Coffee size={18} />, description: 'Coffee shops and casual dining' },
  { id: 'museums', label: 'Museums & Attractions', icon: <Building size={18} />, description: 'Cultural sites and tourist attractions' },
  { id: 'parks', label: 'Parks & Outdoor', icon: <TreePine size={18} />, description: 'Parks, gardens, and outdoor spaces' },
  { id: 'shopping', label: 'Shopping', icon: <ShoppingBag size={18} />, description: 'Stores, markets, and shopping areas' },
  { id: 'bars', label: 'Bars & Nightlife', icon: <Wine size={18} />, description: 'Bars, pubs, and evening venues' }
];

const BALANCE_OPTIONS = [
  { id: 'focused', label: 'Focused', description: 'Heavy emphasis on selected categories' },
  { id: 'balanced', label: 'Balanced', description: 'Good mix of selected categories with some variety' },
  { id: 'diverse', label: 'Diverse', description: 'Light sampling of many different categories' }
];

// Categorize place types
const categorizePlaceType = (placeType: string): string => {
  const type = placeType.toLowerCase();
  if (type.includes('restaurant') || type.includes('food') || type.includes('meal')) return 'restaurants';
  if (type.includes('cafe') || type.includes('coffee')) return 'cafes';
  if (type.includes('museum') || type.includes('gallery') || type.includes('attraction') || type.includes('landmark')) return 'museums';
  if (type.includes('park') || type.includes('garden') || type.includes('outdoor')) return 'parks';
  if (type.includes('store') || type.includes('shop') || type.includes('mall') || type.includes('market')) return 'shopping';
  if (type.includes('bar') || type.includes('pub') || type.includes('nightlife') || type.includes('club')) return 'bars';
  return 'other';
};

// Get available categories based on archive list places
const getAvailableCategories = (places: Place[]): typeof CATEGORY_OPTIONS => {
  if (!places || places.length === 0) return CATEGORY_OPTIONS;
  
  const availableTypes = new Set(places.map(place => categorizePlaceType(place.placeType)));
  return CATEGORY_OPTIONS.filter(category => availableTypes.has(category.id));
};

// Check if meal coverage makes sense
const hasMealPlaces = (places: Place[]): boolean => {
  if (!places || places.length === 0) return false;
  return places.some(place => {
    const category = categorizePlaceType(place.placeType);
    return category === 'restaurants' || category === 'cafes';
  });
};

const ScheduleGenerationDialog: React.FC<ScheduleGenerationDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title = "Generate Schedule",
  description,
  placeCount,
  isLocationBased = false,
  archiveListPlaces
}) => {
  const { currentLocation } = useAppContext();
  const [currentStep, setCurrentStep] = useState(1);
  
  // Basic settings (Step 1)
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('19:00');
  const [prompt, setPrompt] = useState('');
  const [includeCurrentLocation, setIncludeCurrentLocation] = useState(true);
  
  // Advanced preferences (Step 2)
  const [mustInclude, setMustInclude] = useState<string[]>([]);
  const [balanceMode, setBalanceMode] = useState<'focused' | 'balanced' | 'diverse'>('balanced');
  const [maxPlaces, setMaxPlaces] = useState(12);
  const [mealRequirements, setMealRequirements] = useState(false);

  // Get contextual options based on archive list
  const availableCategories = getAvailableCategories(archiveListPlaces || []);
  const showMealOption = hasMealPlaces(archiveListPlaces || []);
  const maxAvailablePlaces = archiveListPlaces ? archiveListPlaces.length : 12;
  const minPlaces = Math.min(3, maxAvailablePlaces);
  const defaultMaxPlaces = Math.min(12, maxAvailablePlaces);

  // Update maxPlaces when dialog opens or archive list changes
  useEffect(() => {
    if (open) {
      setMaxPlaces(defaultMaxPlaces);
    }
  }, [open, defaultMaxPlaces]);

  const handleClose = () => {
    onClose();
    // Reset form when closing
    setCurrentStep(1);
    setStartTime('09:00');
    setEndTime('19:00');
    setPrompt('');
    setIncludeCurrentLocation(true);
    setMustInclude([]);
    setBalanceMode('balanced');
    setMaxPlaces(defaultMaxPlaces);
    setMealRequirements(false);
  };

  const handleConfirm = () => {
    const preferences: UserPreferences = {
      must_include: mustInclude,
      balance_mode: balanceMode,
      max_places: maxPlaces,
      meal_requirements: mealRequirements
    };

    onConfirm({
      startTime,
      endTime,
      prompt,
      includeCurrentLocation,
      preferences: mustInclude.length > 0 || mealRequirements ? preferences : undefined
    });
  };

  const toggleCategory = (categoryId: string) => {
    setMustInclude(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const getDefaultDescription = () => {
    if (isLocationBased) {
      return "AI will discover amazing places near your location and create an optimized schedule.";
    }
    if (placeCount) {
      return `Generating a schedule for ${placeCount} places. Our AI will optimize your day based on locations and preferences.`;
    }
    return "Our AI will optimize your day based on locations and preferences.";
  };

  const renderStep1 = () => (
    <div className="schedule-dialog-content">
      <p className="schedule-dialog-label">
        <Clock size={16} /> Set your schedule time range:
      </p>
      <div className="time-inputs-container">
        <div className="time-input-group">
          <p>Start time:</p>
          <TextField
            type="time"
            fullWidth
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            margin="dense"
            InputLabelProps={{ shrink: true }}
          />
        </div>
        <div className="time-input-group">
          <p>End time:</p>
          <TextField
            type="time"
            fullWidth
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            margin="dense"
            InputLabelProps={{ shrink: true }}
          />
        </div>
      </div>
      
      <p className="schedule-dialog-label">
        <Info size={16} /> Custom preferences (optional):
      </p>
      <TextField
        multiline
        rows={3}
        fullWidth
        placeholder={isLocationBased 
          ? "E.g., 'I love outdoor activities and local food' or 'Focus on museums and cultural attractions'"
          : "E.g., 'I like family restaurants and outdoor activities' or 'Focus on cultural attractions and cafes'"
        }
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <div className="schedule-location-option-container">
        <div className="schedule-location-option">
          <input 
            type="checkbox" 
            className="schedule-settings-checkbox"
            checked={includeCurrentLocation} 
            onChange={e => setIncludeCurrentLocation(e.target.checked)} 
          />
          <div className="schedule-location-option-content">
            <span className="schedule-location-option-label">Include my current location as starting point</span>
            <p className="schedule-location-option-description">
              {isLocationBased 
                ? "This will add your current location as the first place in the discovered route for better navigation."
                : "This will add your current location as the first place in the route, making navigation more convenient."
              }
              {currentLocation ? ' ✓ Current location available' : ' (Location will be requested if needed)'}
            </p>
          </div>
        </div>
      </div>

      <div className="schedule-summary-info">
        <div className="schedule-summary-icon"><ListChecks size={16} /></div>
        <p>
          {description || getDefaultDescription()}
        </p>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="schedule-dialog-content">
      <p className="schedule-dialog-label">
        <Settings size={16} /> What would you like to include? (Optional)
      </p>
      <p className="schedule-preferences-description">
        Select categories you want to prioritize. If none selected, we'll create a balanced mix.
      </p>
      
      <div className="schedule-categories-grid">
        {availableCategories.map(category => (
          <div 
            key={category.id}
            className={`schedule-category-option ${mustInclude.includes(category.id) ? 'selected' : ''}`}
            onClick={() => toggleCategory(category.id)}
          >
            <div className="schedule-category-icon">{category.icon}</div>
            <div className="schedule-category-content">
              <span className="schedule-category-label">{category.label}</span>
              <span className="schedule-category-description">{category.description}</span>
            </div>
          </div>
        ))}
      </div>

      {mustInclude.length > 0 && (
        <div className="schedule-balance-section">
          <p className="schedule-dialog-label">How should we balance your selections?</p>
          <div className="schedule-balance-options">
            {BALANCE_OPTIONS.map(option => (
              <label key={option.id} className="schedule-balance-option">
                <input
                  type="radio"
                  name="balance_mode"
                  value={option.id}
                  checked={balanceMode === option.id}
                  onChange={() => setBalanceMode(option.id as any)}
                />
                <div className="schedule-balance-content">
                  <span className="schedule-balance-label">{option.label}</span>
                  <span className="schedule-balance-description">{option.description}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="schedule-advanced-options">
        {showMealOption && (
          <div className="schedule-option-row">
            <label className="schedule-meal-option">
              <input
                type="checkbox"
                checked={mealRequirements}
                onChange={(e) => setMealRequirements(e.target.checked)}
              />
              <span>Ensure meal coverage (breakfast, lunch, dinner based on schedule time)</span>
            </label>
          </div>
        )}
        
        <div className="schedule-option-row">
          <label htmlFor="max-places">Maximum places in schedule:</label>
          {archiveListPlaces ? (
            <input
              id="max-places"
              type="number"
              min={minPlaces}
              max={maxAvailablePlaces}
              value={maxPlaces}
              onChange={(e) => setMaxPlaces(Math.min(maxAvailablePlaces, Math.max(minPlaces, Number(e.target.value))))}
              className="schedule-max-places-input"
            />
          ) : (
            <input
              id="max-places"
              type="number"
              min={3}
              max={12}
              value={maxPlaces}
              onChange={(e) => setMaxPlaces(Math.min(12, Math.max(3, Number(e.target.value))))}
              className="schedule-max-places-input"
            />
          )}
        </div>
      </div>

      <div className="schedule-preview-info">
        <div className="schedule-summary-icon"><Info size={16} /></div>
        <p>
          {mustInclude.length > 0 
            ? `Will prioritize: ${mustInclude.join(', ')} in ${balanceMode} mode`
            : "Will create a balanced mix of different place types"
          }
          {mealRequirements && showMealOption && " with meal coverage"}
          {archiveListPlaces && ` (max ${maxAvailablePlaces} places available)`}
        </p>
      </div>
    </div>
  );

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      aria-labelledby="schedule-dialog-title"
    >
      <DialogTitle id="schedule-dialog-title">
        <div className="schedule-dialog-header">
          <span>{title}</span>
          <div className="schedule-dialog-steps">
            <span className={`schedule-step ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}`}>1</span>
            <span className="schedule-step-divider"></span>
            <span className={`schedule-step ${currentStep === 2 ? 'active' : ''}`}>2</span>
          </div>
        </div>
      </DialogTitle>
      <DialogContent>
        {currentStep === 1 ? renderStep1() : renderStep2()}
      </DialogContent>
      <DialogActions className="schedule-dialog-actions">
        <Button variant="default" size="sm" onClick={handleClose}>Cancel</Button>
        <div className="schedule-dialog-navigation">
          {currentStep === 2 && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => setCurrentStep(1)}
              className="schedule-back-button"
            >
              <ChevronLeft size={16} /> Back
            </Button>
          )}
          {currentStep === 1 ? (
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => setCurrentStep(2)}
              className="schedule-next-button"
            >
              Advanced Options <ChevronRight size={16} />
            </Button>
          ) : null}
          <Button 
            variant="primary" 
            size="sm" 
            onClick={currentStep === 1 ? handleConfirm : handleConfirm}
          >
            Generate Schedule
          </Button>
        </div>
      </DialogActions>
    </Dialog>
  );
};

export default ScheduleGenerationDialog; 