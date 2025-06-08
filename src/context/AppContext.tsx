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
    places?: Place[], // If provided, this is an update
    dayOverviewForUpdate?: string,
    totalPlaces?: number,
    endTime: string = "19:00"
  ) => {
    const placesToUse = places || favoritePlaces;
    
    setIsLoading(true);
    
    // Set appropriate loading message based on context
    const isUpdate = !!dayOverviewForUpdate;
    if (isUpdate) {
      setLoadingMessage(`Updating your route to ${travelMode} mode`);
    } else if (placesToUse.length > 7) {
      setLoadingMessage(`Crafting your perfect day from ${placesToUse.length} places`);
    } else {
      setLoadingMessage('Creating your perfect day itinerary');
    }
    
    try {
      if (favoritePlaces.length > 5) {
        console.log(`You have ${favoritePlaces.length} favorite places saved. The AI will select an optimal subset for your day itinerary.`);
      }
      
      // The scheduleService now handles caching internally
      const newSchedule = await scheduleService.generateSchedule(
        placesToUse, 
        startTime, 
        travelMode, 
        prompt, 
        dayOverviewForUpdate,
        totalPlaces,
        endTime
      );
      
      setCurrentSchedule(newSchedule);
    } catch (error) {
      console.error('Failed to generate schedule:', error);
      // Potentially show a user-facing error message
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [favoritePlaces, setIsLoading, setCurrentSchedule]);

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