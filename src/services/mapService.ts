import { Place, Coordinates } from '../types';
import api from './api/axios'; // Assuming you have an axios instance

// NOTE: For a production environment, it is highly recommended to proxy these API calls
// through your backend server to keep your API key secure.
// This API key is used on the frontend ONLY for constructing publicly accessible photo URLs.
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// This cache is still useful for Place Details, even with the new API
const placeDetailsCache: Map<string, Place> = new Map();

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
    const url = "/places:searchText"; // Updated to hit backend proxy
    const headers = {
      "Content-Type": "application/json",
    };

    const data: any = {
      textQuery: query,
      maxResults: 10, // Max results to control costs and processing
      languageCode: "en",
      regionCode: "US"
    };

    if (center) {
      data.locationRestriction = {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius: 10000 // 10km radius
        }
      };
    }

    try {
      const response = await api.post(url, data, { headers });
      if (response.data && response.data.places) {
        return response.data.places.map(mapNewPlaceToPlace);
      }
      return [];
    } catch (error: any) {
      console.error("New Places API Text Search error:", error.response ? error.response.data : error.message, error);
      return [];
    }
  },

  searchNearby: async (center: Coordinates, radius = 5000, type?: string): Promise<Place[]> => {
    const url = "/places:searchNearby"; // Updated to hit backend proxy
    const headers = {
      "Content-Type": "application/json",
    };

    const data: any = {
      locationRestriction: {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius: radius
        }
      },
      maxResults: 10,
      languageCode: "en",
      regionCode: "US"
    };

    if (type && type !== 'point_of_interest' && type !== 'all') {
      data.includedTypes = [type];
    }

    try {
      const response = await api.post(url, data, { headers });
      if (response.data && response.data.places) {
        return response.data.places.map(mapNewPlaceToPlace);
      }
      return [];
    } catch (error: any) {
      console.error("New Places API Nearby Search error:", error.response ? error.response.data : error.message, error);
      return [];
    }
  },

  getPlaceDetails: async (placeId: string): Promise<Place | null> => {
    // Check cache first
    if (placeDetailsCache.has(placeId)) {
      return placeDetailsCache.get(placeId)!;
    }

    const url = `/places/${placeId}`; // Updated to hit backend proxy
    const headers = {
      "Content-Type": "application/json",
    };

    try {
      const response = await api.get(url, { headers });
      if (response.data) {
        const mappedPlace = mapNewPlaceToPlace(response.data);
        placeDetailsCache.set(placeId, mappedPlace);
        return mappedPlace;
      }
      return null;
    } catch (error: any) {
      console.error("New Places API Get Details error:", error.response ? error.response.data : error.message, error);
      return null;
    }
  },
};
