import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Place, Schedule } from '../types';
import api from '../services/api/axios';
import { archivedListService } from '../services/archivedListService';
import { scheduleService } from '../services/scheduleService';
import LoadingScreen from '../components/LoadingScreen';

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
    places?: Place[],
    dayOverviewForUpdate?: string,
    totalPlaces?: number,
    endTime?: string
  ) => Promise<void>;
  generateLocationBasedSchedule: (
    latitude: number,
    longitude: number,
    options?: {
      radius_meters?: number;
      travel_mode?: string;
      prompt?: string;
      start_time?: string;
      end_time?: string;
      categories?: string[];
    }
  ) => Promise<void>;
  searchResults: Place[];
  setSearchResults: React.Dispatch<React.SetStateAction<Place[]>>;
  user: any;
  setUser: React.Dispatch<React.SetStateAction<any>>;
  checkSession: () => Promise<boolean>;
  isLoading: boolean;
  loadingMessage: string;
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
  const [loadingMessage, setLoadingMessage] = useState('');

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
    places?: Place[],
    dayOverviewForUpdate?: string,
    totalPlaces?: number,
    endTime: string = "19:00"
  ) => {
    setIsLoading(true);

    const placesToUse = places || favoritePlaces;
    const isUpdate = !!dayOverviewForUpdate;

    if (isUpdate) {
      setLoadingMessage('📍 Updating your schedule with new travel mode...');
    } else {
      setLoadingMessage('🤖 AI is analyzing your places and creating the perfect schedule...');

      // Add progressive loading messages for new schedule generation
      setTimeout(() => {
        setLoadingMessage('⚡ AI is selecting the best places and optimizing timing...');
      }, 3000);

      setTimeout(() => {
        setLoadingMessage('🗺️ Calculating routes and travel times...');
      }, 8000);
    }

    try {
      const schedule = await scheduleService.generateSchedule(
        placesToUse,
        startTime,
        travelMode,
        prompt,
        dayOverviewForUpdate,
        totalPlaces,
        endTime
      );

      setCurrentSchedule(schedule);

      if (!isUpdate) {
        setLoadingMessage('✅ Your optimized schedule is ready!');
        setTimeout(() => {
          setLoadingMessage('');
        }, 1000);
      }

    } catch (error) {
      console.error('Failed to generate schedule:', error);
      throw error;
    } finally {
      setTimeout(() => {
        setIsLoading(false);
        setLoadingMessage('');
      }, isUpdate ? 0 : 1200); // Quick for updates, delay for new schedules
    }
  }, [favoritePlaces, setIsLoading, setCurrentSchedule]);

  const generateLocationBasedSchedule = useCallback(async (
    latitude: number,
    longitude: number,
    options: {
      radius_meters?: number;
      travel_mode?: string;
      prompt?: string;
      start_time?: string;
      end_time?: string;
      categories?: string[];
    } = {}
  ) => {
    setIsLoading(true);
    setLoadingMessage('🗺️ AI is discovering amazing places near you...');

    try {
      // Add progressive loading messages to indicate progress
      const progressTimer1 = setTimeout(() => {
        setLoadingMessage('🔍 Searching database and generating fresh POI data...');
      }, 2000);

      const progressTimer2 = setTimeout(() => {
        setLoadingMessage('🤖 AI is optimizing your perfect day schedule with route planning...');
      }, 6000);

      const progressTimer3 = setTimeout(() => {
        setLoadingMessage('⚡ Almost done! Calculating travel times and finalizing your itinerary...');
      }, 12000);

      try {
        const response = await api.post('/schedules/generate-from-location', {
          latitude,
          longitude,
          radius_meters: options.radius_meters || 5000,
          travel_mode: options.travel_mode || 'walking',
          prompt: options.prompt || '',
          start_time: options.start_time || '09:00',
          end_time: options.end_time || '19:00',
          categories: options.categories || null,
          max_places: 20
        });

        // Clear all timers
        clearTimeout(progressTimer1);
        clearTimeout(progressTimer2);
        clearTimeout(progressTimer3);

        const { schedule, discovery_stats } = response.data;

        setCurrentSchedule({
          ...schedule,
          generated_from_location: true,
          discovery_stats,
          total_places: discovery_stats?.nearby_pois_found
        });

      } catch (error) {
        // Clear all timers in case of error
        clearTimeout(progressTimer1);
        clearTimeout(progressTimer2);
        clearTimeout(progressTimer3);
        throw error;
      }

    } catch (error) {
      console.error('Error generating location-based schedule:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [user]);

  // Show loading screen when app is loading
  if (isLoading) {
    return <LoadingScreen message={loadingMessage} />;
  }

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
      generateLocationBasedSchedule,
      searchResults,
      setSearchResults,
      user,
      setUser,
      checkSession,
      isLoading,
      loadingMessage,
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