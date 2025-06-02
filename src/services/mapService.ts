import { Place, Coordinates } from '../types';

// Service singleton to ensure we only create the PlacesService once
class GooglePlacesServiceSingleton {
  private static instance: google.maps.places.PlacesService | null = null;
  private static attributionElement: HTMLDivElement | null = null;

  static getService(): google.maps.places.PlacesService {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
      throw new Error('Google Maps API is not loaded. Make sure the script is included and the API key is valid.');
    }
    
    if (!this.instance) {
      // Create an attribution div required by Google Places API
      if (!this.attributionElement) {
        this.attributionElement = document.createElement('div');
        this.attributionElement.id = 'google-places-attribution';
        this.attributionElement.style.display = 'none';
        document.body.appendChild(this.attributionElement);
      }
      
      // Create the PlacesService instance
      this.instance = new window.google.maps.places.PlacesService(this.attributionElement);
    }
    return this.instance;
  }
}

export const MapService = {
  searchPlaces: async (query: string, center?: Coordinates): Promise<Place[]> => {
    const service = GooglePlacesServiceSingleton.getService();
    
    return new Promise((resolve, reject) => {
      const request: google.maps.places.TextSearchRequest = {
        query,
      };
      
      if (center) {
        request.location = new google.maps.LatLng(center.lat, center.lng);
        request.radius = 10000; // 10km
      }
      
      service.textSearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          resolve(results.map(mapGooglePlaceToPlace));
        } else {
          console.error("Places API error:", status);
          resolve([]);
        }
      });
    });
  },

  searchNearby: async (center: Coordinates, radius = 5000, type?: string): Promise<Place[]> => {
    const service = GooglePlacesServiceSingleton.getService();
    
    return new Promise((resolve, reject) => {
      const request: google.maps.places.PlaceSearchRequest = {
        location: new google.maps.LatLng(center.lat, center.lng),
        radius,
      };
      
      if (type && type !== 'point_of_interest' && type !== 'all') {
        request.type = type as any; // Using 'any' to bypass type checking since PlaceType is not exported
      }
      
      service.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          resolve(results.map(mapGooglePlaceToPlace));
        } else {
          console.error("Places API error:", status);
          resolve([]);
        }
      });
    });
  },

  getPlaceDetails: async (placeId: string): Promise<Place | null> => {
    const service = GooglePlacesServiceSingleton.getService();
    
    return new Promise((resolve, reject) => {
      const request: google.maps.places.PlaceDetailsRequest = {
        placeId,
        fields: ['place_id', 'name', 'geometry', 'formatted_address', 'types', 'rating', 'user_ratings_total', 'photos', 'opening_hours', 'website', 'formatted_phone_number', 'business_status', 'price_level']
      };
      
      service.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          resolve(mapGooglePlaceToPlace(place));
        } else {
          console.error("Places API error:", status);
          resolve(null);
        }
      });
    });
  },
};

function mapGooglePlaceToPlace(googlePlace: google.maps.places.PlaceResult): Place {
  const location = googlePlace.geometry?.location;
  const lat = location ? location.lat() : 0;
  const lng = location ? location.lng() : 0;
  
  const photoUrls = googlePlace.photos?.map(photo => 
    photo.getUrl({ maxWidth: 400, maxHeight: 300 })
  ) || [];
  
  // Determine the place type from the types array
  let placeType = 'point_of_interest';
  if (googlePlace.types && googlePlace.types.length > 0) {
    // Filter out generic types
    const specificTypes = googlePlace.types.filter(type => 
      !['point_of_interest', 'establishment'].includes(type)
    );
    placeType = specificTypes.length > 0 ? specificTypes[0] : googlePlace.types[0];
  }
  
  // Map opening hours to the expected format
  let openingHours: { open: boolean; periods?: { open: string; close: string; }[] } | undefined = undefined;
  
  if (googlePlace.opening_hours) {
    // Get isOpen() result, defaulting to false if the function doesn't exist
    const open = typeof googlePlace.opening_hours.isOpen === 'function' 
      ? googlePlace.opening_hours.isOpen() === true // Force boolean result
      : false;
    
    // Convert periods to the expected format if they exist
    const periods = googlePlace.opening_hours.periods?.map(period => {
      return {
        open: `${period.open?.day || 0}:${period.open?.hours || 0}:${period.open?.minutes || 0}`,
        close: `${period.close?.day || 0}:${period.close?.hours || 0}:${period.close?.minutes || 0}`
      };
    });
    
    openingHours = {
      open,
      periods
    };
  }
  
  return {
    id: googlePlace.place_id || '',
    name: googlePlace.name || '',
    location: { lat, lng },
    address: googlePlace.formatted_address || '',
    placeType,
    rating: googlePlace.rating,
    userRatingCount: googlePlace.user_ratings_total,
    photos: photoUrls,
    openingHours,
    website: googlePlace.website,
    phoneNumber: googlePlace.formatted_phone_number,
    businessStatus: googlePlace.business_status,
    priceLevel: googlePlace.price_level,
    userAdded: false,
  };
}
