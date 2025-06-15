// Default map coordinates (New York)
export const DEFAULT_MAP_CENTER = { 
  lat: 40.7128, 
  lng: -74.0060 
};

// Travel mode options
export const TRAVEL_MODES = [
  { value: "walking" as const, label: "Walking", icon: "🚶" },
  { value: "driving" as const, label: "Driving", icon: "🚗" },
  { value: "bicycling" as const, label: "Bicycling", icon: "🚲" },
  { value: "transit" as const, label: "Transit", icon: "🚆" }
];

// Default category selections
export const DEFAULT_CATEGORIES = [
  'food', 
  'cafe', 
  'attraction', 
  'outdoor', 
  'shopping', 
  'other'
];

// Common time values
export const DEFAULT_TIMES = {
  START_TIME: '09:00',
  END_TIME: '19:00',
  MIN_DURATION_HOURS: 2
};

// Form validation constants
export const VALIDATION_LIMITS = {
  MAX_NAME_LENGTH: 100,
  MAX_NOTE_PREVIEW_LENGTH: 120,
  MAX_SCHEDULE_SLOTS: 3,
  MAX_PLACES_PER_SCHEDULE: 12
};

// Animation durations (in ms)
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500
};

// Common breakpoints
export const BREAKPOINTS = {
  MOBILE: 480,
  TABLET: 768,
  DESKTOP: 1024,
  LARGE: 1440
};

// Z-index layers
export const Z_INDEX = {
  DROPDOWN: 100,
  MODAL: 1000,
  TOAST: 1100,
  LOADING: 1200
}; 