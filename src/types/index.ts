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
}

export interface ArchivedList {
  id: string;
  name: string;
  date: string;
  places: Place[];
  note?: string;
}

export interface TabControlProps {
  activeTab: 'saved' | 'search';
  setActiveTab: (tab: 'saved' | 'search') => void;
}

export interface MapContainerProps extends TabControlProps {
  mapCenter: Coordinates;
  setMapCenter: (center: Coordinates) => void;
}