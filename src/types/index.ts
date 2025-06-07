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
}

export interface ArchivedList {
  id: string;
  name: string;
  date: string;
  places: Place[];
  note?: string;
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
