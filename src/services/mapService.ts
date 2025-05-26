import { Place, RouteSegment, Coordinates } from '../types';

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GOOGLE_PLACES_BASE = 'https://places.googleapis.com/v1';

export const MapService = {
  searchPlaces: async (query: string, center?: Coordinates): Promise<Place[]> => {
    const fieldMask = 'places.id,places.displayName,places.location,places.formattedAddress,places.primaryType,places.rating,places.userRatingCount,places.photos,places.regularOpeningHours,places.websiteUri,places.internationalPhoneNumber,places.businessStatus,places.priceLevel';
    const payload: any = {
      textQuery: query,
      pageSize: 10,
      languageCode: 'en',
    };
    if (center) {
      payload.locationBias = {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius: 10000,
        },
      };
    }
    const res = await fetch(`${GOOGLE_PLACES_BASE}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.places) return [];
    return data.places.map(mapGooglePlaceToPlace);
  },

  searchNearby: async (center: Coordinates, radius = 5000, type?: string): Promise<Place[]> => {
    const fieldMask = 'places.id,places.displayName,places.location,places.formattedAddress,places.primaryType,places.rating,places.userRatingCount,places.photos,places.regularOpeningHours,places.websiteUri,places.internationalPhoneNumber,places.businessStatus,places.priceLevel';
    const payload: any = {
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius,
        },
      },
      languageCode: 'en',
    };
    if (type && type !== 'point_of_interest' && type !== 'all') {
      payload.includedTypes = [type];
    }
    const res = await fetch(`${GOOGLE_PLACES_BASE}/places:searchNearby`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.places) return [];
    return data.places.map(mapGooglePlaceToPlace);
  },

  getPlaceDetails: async (placeId: string): Promise<Place | null> => {
    const fieldMask = 'id,displayName,location,formattedAddress,primaryType,rating,photos,types,regularOpeningHours';
    const url = `${GOOGLE_PLACES_BASE}/places/${placeId}?languageCode=en`;
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return mapGooglePlaceToPlace(data);
  },

  calculateRoute: async (
    origin: Coordinates,
    destination: Coordinates,
    mode: 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT' = 'DRIVING',
  ): Promise<RouteSegment | null> => {
    // Still mock for now
    return {
      origin: {
        id: 'origin',
        name: 'Origin',
        location: origin,
        address: 'Origin Address',
        placeType: 'point',
      },
      destination: {
        id: 'destination',
        name: 'Destination',
        location: destination,
        address: 'Destination Address',
        placeType: 'point',
      },
      distance: '2.5 km',
      duration: '30 mins',
      mode,
      polyline: 'mock_polyline_string',
    };
  },
};

function mapGooglePlaceToPlace(googlePlace: any): Place {
  const photoUrls =
    googlePlace.photos?.map((p: any) =>
      p.photoUri
        ? p.photoUri
        : p.name
          ? `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=400&key=${GOOGLE_API_KEY}`
          : null
    ).filter(Boolean) || [];
  return {
    id: googlePlace.id || googlePlace.name,
    name: googlePlace.displayName?.text || '',
    location: {
      lat: googlePlace.location?.latitude,
      lng: googlePlace.location?.longitude,
    },
    address: googlePlace.formattedAddress,
    placeType: googlePlace.primaryType || (googlePlace.types?.[0] ?? ''),
    rating: googlePlace.rating,
    userRatingCount: googlePlace.userRatingCount,
    photos: photoUrls,
    openingHours: googlePlace.regularOpeningHours
      ? { open: googlePlace.regularOpeningHours.openNow, periods: googlePlace.regularOpeningHours.periods }
      : undefined,
    website: googlePlace.websiteUri,
    phoneNumber: googlePlace.internationalPhoneNumber,
    businessStatus: googlePlace.businessStatus,
    priceLevel: googlePlace.priceLevel,
    userAdded: false,
  };
}