import { Place, Coordinates } from '../types';
import api from './api/axios'; // Assuming you have an axios instance

// NOTE: For a production environment, it is highly recommended to proxy these API calls
// through your backend server to keep your API key secure.
// This API key is used on the frontend ONLY for constructing publicly accessible photo URLs.
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Cache TTL - 5 minutes for search results, 1 hour for place details
const SEARCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const PLACE_DETAILS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// In-memory cache for Place Details
interface CachedPlace {
  place: Place;
  timestamp: number;
}

// In-memory cache for search results
interface CachedSearchResults {
  places: Place[];
  timestamp: number;
}

// Cache structures
const placeDetailsCache = new Map<string, CachedPlace>();
const searchResultsCache = new Map<string, CachedSearchResults>();

// Helper to map new Places API response to existing Place interface
// This function will need to be comprehensive to handle all fields you need.
function mapNewPlaceToPlace(newPlace: any): Place {
  const lat = newPlace.location?.latitude || 0;
  const lng = newPlace.location?.longitude || 0;

  // Construct photo URLs using the photo.name and API key, including size parameters
  const photoUrls = newPlace.photos?.map((photo: any) => {
    // Add maxWidthPx to get a displayable image
    const url = `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=400&key=${GOOGLE_API_KEY}`;
    return url;
  }) || [];

  // Determine place type (new API returns an array of strings)
  let placeType = 'point_of_interest';
  if (newPlace.types && newPlace.types.length > 0) {
    const specificTypes = newPlace.types.filter((type: string) => 
      !['point_of_interest', 'establishment'].includes(type)
    );
    placeType = specificTypes.length > 0 ? specificTypes[0] : newPlace.types[0];
  }

  // Map opening hours
  let openingHours: { open: boolean; periods?: { open: string; close: string; }[] } | undefined = undefined;
  if (newPlace.currentOpeningHours) {
    openingHours = {
      open: newPlace.currentOpeningHours.openNow || false,
      // The new API's periods structure is different, you might need to adjust this
      // based on how you want to display past/future opening hours.
      // For simplicity, I'm just checking if it's currently open.
      // If you need detailed periods, you'll need to parse newPlace.regularOpeningHours.periods
    };
  }

  return {
    id: newPlace.id || '',
    name: newPlace.displayName?.text || '',
    location: { lat, lng },
    address: newPlace.formattedAddress || '',
    placeType,
    rating: newPlace.rating,
    userRatingCount: newPlace.userRatingCount,
    photos: photoUrls,
    openingHours,
    website: newPlace.websiteUri,
    phoneNumber: newPlace.internationalPhoneNumber,
    businessStatus: newPlace.businessStatus,
    priceLevel: newPlace.priceLevel,
    userAdded: false, // Assuming always false for API-fetched places
    ai_review: null, // AI review is handled on backend, not from Place API
  };
}

export const MapService = {
  searchPlaces: async (query: string, center?: Coordinates): Promise<Place[]> => {
    // Clear cache if center coordinates are provided to ensure fresh location-based results
    if (center && center.lat && center.lng) {
      searchResultsCache.clear();
    }
    
    const cacheKey = JSON.stringify({ query, center });
    const cached = searchResultsCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < SEARCH_CACHE_TTL)) {
      return cached.places;
    }

    const url = "/places:searchText"; // Updated to hit backend proxy
    const headers = {
      "Content-Type": "application/json",
    };

    const data: any = {
      textQuery: query,
      languageCode: "en"
    };

    // Add location bias if center coordinates are provided
    if (center && center.lat && center.lng) {
      data.locationBias = {
        circle: {
          center: {
            latitude: center.lat,
            longitude: center.lng
          },
          radius: 10000 // 10km
        }
      };
    }

    try {
      const response = await api.post(url, data, { headers });
      
      if (response.data && response.data.places) {
        const mappedPlaces = response.data.places.map(mapNewPlaceToPlace);
        
        // Cache the results
        searchResultsCache.set(cacheKey, { 
          places: mappedPlaces, 
          timestamp: Date.now() 
        });
        
        return mappedPlaces;
      }
      return [];
    } catch (error: any) {
      console.error("New Places API Text Search error:", error.response ? error.response.data : error.message, error);
      // Don't throw the error - return empty array to prevent app crashes
      return [];
    }
  },

  searchNearby: async (center: Coordinates, radius = 5000, type?: string): Promise<Place[]> => {
    const cacheKey = JSON.stringify({ center, radius, type });
    const cached = searchResultsCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < SEARCH_CACHE_TTL)) {
      return cached.places;
    }

    const url = "/places:searchNearby"; // Updated to hit backend proxy
    const headers = {
      "Content-Type": "application/json",
    };

    const data: any = {
      locationRestriction: {
        circle: {
          center: {
            latitude: center.lat,
            longitude: center.lng
          },
          radius: radius
        }
      },
      languageCode: "en"
    };

    // Add included types if specified
    if (type) {
      // Convert type query to proper Google Places API types
      const typeMapping: { [key: string]: string[] } = {
        'bakery': ['bakery'],
        'restaurant': ['restaurant'],
        'cafe': ['cafe'],
        'gas_station': ['gas_station'],
        'shopping': ['shopping_mall', 'store'],
        'hospital': ['hospital'],
        'pharmacy': ['pharmacy'],
        'bank': ['bank'],
        'atm': ['atm'],
        'park': ['park'],
        'gym': ['gym'],
        'hotel': ['lodging']
      };

      const mappedTypes = typeMapping[type.toLowerCase()] || [type];
      data.includedTypes = mappedTypes;
    }

    try {
      const response = await api.post(url, data, { headers });
      if (response.data && response.data.places) {
        const mappedPlaces = response.data.places.map(mapNewPlaceToPlace);
        
        // Cache the results
        searchResultsCache.set(cacheKey, { 
          places: mappedPlaces, 
          timestamp: Date.now() 
        });
        
        return mappedPlaces;
      }
      return [];
    } catch (error: any) {
      console.error("New Places API Nearby Search error:", error.response ? error.response.data : error.message, error);
      return [];
    }
  },

  getPlaceDetails: async (placeId: string): Promise<Place | null> => {
    // Check cache first
    const cached = placeDetailsCache.get(placeId);
    if (cached && (Date.now() - cached.timestamp < PLACE_DETAILS_CACHE_TTL)) {
      return cached.place;
    }

    const url = `/places/${placeId}`; // Updated to hit backend proxy
    const headers = {
      "Content-Type": "application/json",
    };

    try {
      const response = await api.get(url, { headers });
      if (response.data) {
        const mappedPlace = mapNewPlaceToPlace(response.data);
        
        // Cache the place details
        placeDetailsCache.set(placeId, {
          place: mappedPlace,
          timestamp: Date.now()
        });
        
        return mappedPlace;
      }
      return null;
    } catch (error: any) {
      console.error("New Places API Get Details error:", error.response ? error.response.data : error.message, error);
      return null;
    }
  },
  
  /**
   * Clear all caches
   * 
   * This can be used to force fresh data fetching.
   */
  clearAllCaches(): void {
    searchResultsCache.clear();
    placeDetailsCache.clear();
  },
  
  /**
   * Clear only the search results cache
   */
  clearSearchCache(): void {
    searchResultsCache.clear();
  },
  
  /**
   * Clear only the place details cache
   */
  clearPlaceDetailsCache(): void {
    placeDetailsCache.clear();
  }
};
