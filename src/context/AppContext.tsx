import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Place, Schedule, ScheduleItem } from '../types';
import api from '../services/api/axios';
import { archivedListService } from '../services/archivedListService';
import { scheduleService as actualScheduleService } from '../services/scheduleService';

// Cache for schedules
interface CachedSchedule {
  schedule: Schedule;
  timestamp: number;
}

// Cache TTL - 1 hour (in milliseconds)
const CACHE_TTL = 60 * 60 * 1000;

// Generate a cache key from schedule parameters
// Accepts either Place[] (with id) or ScheduleItem[] (with place_id)
const generateCacheKey = (
  items: (Place | ScheduleItem)[], 
  startTime: string, 
  travelMode: string
): string => {
  const placeIds = items.map(item => ('id' in item ? item.id : item.place_id)).sort().join(',');
  return `${placeIds}|${startTime}|${travelMode}`;
};

interface AppContextType {
  favoritePlaces: Place[];
  setFavoritePlaces: React.Dispatch<React.SetStateAction<Place[]>>;
  addFavoritePlace: (place: Place) => void;
  removeFavoritePlace: (id: string) => void;
  clearAllFavorites: () => void;
  archiveFavorites: (name?: string, note?: string) => Promise<void>;
  currentSchedule: Schedule | null;
  setCurrentSchedule: React.Dispatch<React.SetStateAction<Schedule | null>>;
  generateSchedule: (
    startTime: string, 
    travelMode?: string, 
    prompt?: string,
    placesForScheduleUpdate?: Place[], // Places from current schedule for update
    dayOverviewForUpdate?: string // Signals an update, uses specific places
  ) => Promise<void>;
  searchResults: Place[];
  setSearchResults: React.Dispatch<React.SetStateAction<Place[]>>;
  user: any;
  setUser: React.Dispatch<React.SetStateAction<any>>;
  checkSession: () => Promise<boolean>;
  isLoading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const FAVORITE_PLACES_KEY = 'favorite_places';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favoritePlaces, setFavoritePlaces] = useState<Place[]>(() => {
    const savedPlaces = localStorage.getItem(FAVORITE_PLACES_KEY);
    return savedPlaces ? JSON.parse(savedPlaces) : [];
  });
  const [currentSchedule, setCurrentSchedule] = useState<Schedule | null>(null);
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const schedulesCache = useRef<Map<string, CachedSchedule>>(new Map());

  useEffect(() => {
    const initSessionCheck = async () => {
      await checkSession();
    };
    initSessionCheck();
  }, []);

  // Save favorite places to local storage whenever they change
  useEffect(() => {
    localStorage.setItem(FAVORITE_PLACES_KEY, JSON.stringify(favoritePlaces));
  }, [favoritePlaces]);

  const checkSession = async (): Promise<boolean> => {
    try {
      const res = await api.get('/me');
      setUser(res.data.user);
      return true;
    } catch (e) {
      setUser(null);
      return false;
    }
  };

  const addFavoritePlace = useCallback((place: Place) => {
    setFavoritePlaces((prev) => {
      if (prev.some(p => p.id === place.id)) {
        return prev;
      }
      const newPlaces = [...prev, place];
      return newPlaces;
    });
  }, []);

  const removeFavoritePlace = useCallback((id: string) => {
    setFavoritePlaces((prev) => prev.filter(p => p.id !== id));
  }, []);

  const clearAllFavorites = useCallback(() => {
    setFavoritePlaces([]);
  }, []);

  const archiveFavorites = useCallback(async (name?: string, note?: string) => {
    if (favoritePlaces.length === 0) return;
    try {
      await archivedListService.createList(
        name || `List ${new Date().toLocaleString()}`,
        favoritePlaces,
        note
      );
      clearAllFavorites();
    } catch (error) {
      console.error('Failed to archive favorites:', error);
      throw error;
    }
  }, [favoritePlaces, clearAllFavorites]);
  
  const generateSchedule = useCallback(async (
    startTime: string, 
    travelMode: string = "walking", 
    prompt?: string,
    placesForScheduleUpdate?: Place[], // If provided, this is an update
    dayOverviewForUpdate?: string 
  ) => {
    
    const isUpdate = !!(placesForScheduleUpdate && dayOverviewForUpdate);
    const placesToUse = isUpdate ? placesForScheduleUpdate! : favoritePlaces;

    if (placesToUse.length < 1 && isUpdate) { // Should have at least 1 for an update
        console.error("Need at least 1 place for a schedule update.");
        return;
    }
    if (placesToUse.length < 3 && !isUpdate) { // Need 3 for new schedule
        console.error("Need at least 3 favorite places to generate a new schedule.");
        // Potentially show a user-facing message here
        return;
    }

    const cacheKey = generateCacheKey(placesToUse, startTime, travelMode);

    if (isUpdate) {
      const cached = schedulesCache.current.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        console.log(`Using cached schedule for: ${cacheKey}`);
        setCurrentSchedule(cached.schedule);
        return;
      }
    } else {
      // For new schedule generation, always clear relevant old cache entries if any.
      // However, a full clear might be too broad.
      // For now, new schedule generation bypasses reading from cache and always fetches.
      console.log("Generating a new schedule, bypassing cache read for this key:", cacheKey);
    }
    
    setIsLoading(true);
    try {
      if (!isUpdate && favoritePlaces.length > 5) {
        console.log(`You have ${favoritePlaces.length} favorite places saved. The AI will select an optimal subset for your day itinerary.`);
      }
      
      const newSchedule = await actualScheduleService.generateSchedule(
        placesToUse, 
        startTime, 
        travelMode, 
        prompt, 
        dayOverviewForUpdate // Pass this for the service call
      );
      
      setCurrentSchedule(newSchedule);
      
      // Cache the newly fetched schedule.
      // The key should be based on the actual items in the newSchedule if AI selected a subset.
      // However, placesToUse (if it was favoritePlaces) might be different from newSchedule.items.
      // For simplicity and consistency with cache retrieval, we use the `placesToUse` for the cache key
      // that initiated this request. If it was a new schedule, the key is based on original favoritePlaces.
      // If it was an update, it's based on placesForScheduleUpdate.
      // A more robust key for new schedules *after* AI optimization would use newSchedule.items,
      // but that makes cache lookup before fetching harder if the subset is unknown.
      // For now, this simpler keying is acceptable.
      const effectiveCacheKey = generateCacheKey(newSchedule.items, startTime, travelMode);
      schedulesCache.current.set(effectiveCacheKey, { schedule: newSchedule, timestamp: Date.now() });
      console.log(`Cached new schedule for: ${effectiveCacheKey}`);

    } catch (error) {
      console.error('Failed to generate schedule:', error);
      // Potentially show a user-facing error message
    } finally {
      setIsLoading(false);
    }
  }, [favoritePlaces, setIsLoading, setCurrentSchedule]); // Added dependencies

  return (
    <AppContext.Provider value={{
      favoritePlaces,
      setFavoritePlaces,
      addFavoritePlace,
      removeFavoritePlace,
      clearAllFavorites,
      archiveFavorites,
      currentSchedule,
      setCurrentSchedule,
      generateSchedule,
      searchResults,
      setSearchResults,
      user,
      setUser,
      checkSession,
      isLoading,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
};