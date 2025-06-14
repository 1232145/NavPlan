export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Place {
  id: string;
  name: string;
  location: Coordinates;
  address: string;
  placeType: string;
  rating?: number;
  userRatingCount?: number;
  openingHours?: {
    open: boolean;
    periods?: { open: string; close: string }[];
  };
  website?: string;
  phoneNumber?: string;
  businessStatus?: string;
  priceLevel?: number;
  photos?: string[];
  userAdded?: boolean;
  note?: string;
  ai_review?: string | null;
  duration_minutes?: number;
}

export interface ArchivedList {
  id: string;
  name: string;
  date: string;
  places: Place[];
  note?: string;
  similar_public_places?: string[];
  popularity_score?: number;
  ai_generated_tags?: string[];
  saved_schedules: SavedSchedule[];
}

export interface RouteSegment {
  start_location: Coordinates;
  end_location: Coordinates;
  distance: { text: string; value: number };
  duration: { text: string; value: number };
  polyline: string;
}

export interface ScheduleItem {
  place_id: string;
  name: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  travel_to_next?: RouteSegment;
  placeType: string;
  address: string;
  ai_review?: string;
}

export interface Schedule {
  items: ScheduleItem[];
  total_duration_minutes: number;
  total_distance_meters: number;
  day_overview?: string;
  total_places?: number;
}

export type TravelMode = 'walking' | 'driving' | 'bicycling' | 'transit';

export type BalanceMode = 'focused' | 'balanced' | 'diverse';

export interface UserPreferences {
  must_include: string[];
  balance_mode: BalanceMode;
  max_places: number;
  meal_requirements: boolean;
}

export interface SavedScheduleMetadata {
  schedule_id: string;
  name: string;
  travel_mode: TravelMode;
  start_time: string;
  end_time: string;
  created_at: string;
  last_modified: string;
  is_favorite: boolean;
}

export interface SavedSchedule {
  metadata: SavedScheduleMetadata;
  schedule: Schedule;
  generation_preferences?: Record<string, any>;
  place_toggles: Record<string, boolean>;
}

export interface SaveScheduleRequest {
  archive_list_id: string;
  schedule_name: string;
  schedule: Schedule;
  travel_mode: TravelMode;
  start_time: string;
  end_time: string;
  generation_preferences?: Record<string, any>;
  place_toggles: Record<string, boolean>;
  replace_existing_slot?: number;
}

export interface UpdateScheduleRequest {
  archive_list_id: string;
  schedule_id: string;
  updates: Record<string, any>;
}

export interface BaseScheduleRequest {
  start_time: string;
  end_time: string;
  travel_mode: TravelMode;
  prompt?: string;
  day_overview?: string;
  preferences?: UserPreferences;
}

export interface ScheduleRequest extends BaseScheduleRequest {
  places: Place[];
}

export interface LocationScheduleRequest extends BaseScheduleRequest {
  latitude: number;
  longitude: number;
  radius_meters: number;
  categories?: string[];
  max_places: number;
  include_current_location: boolean;
}

export interface ArchiveListHelpers {
  canAddSchedule: (list: ArchivedList) => boolean;
  getAvailableSlotNumber: (list: ArchivedList) => number | null;
  getScheduleById: (list: ArchivedList, scheduleId: string) => SavedSchedule | null;
  getScheduleSlotName: (slotNumber: number) => string;
}

export interface ArchiveScheduleUIState {
  selectedList: ArchivedList | null;
  selectedSchedule: SavedSchedule | null;
  isViewingSchedule: boolean;
  isSavingSchedule: boolean;
  saveScheduleDialogOpen: boolean;
  scheduleSlotSelection: number | null;
}
