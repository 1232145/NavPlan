import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Place, Schedule } from '../types';
import api from '../services/api/axios';
import { archivedListService } from '../services/archivedListService';
import { scheduleService } from '../services/scheduleService';

interface AppContextType {
  favoritePlaces: Place[];
  setFavoritePlaces: React.Dispatch<React.SetStateAction<Place[]>>;
  addFavoritePlace: (place: Place) => void;
  removeFavoritePlace: (id: string) => void;
  clearAllFavorites: () => void;
  archiveFavorites: (name?: string, note?: string) => Promise<void>;
  currentSchedule: Schedule | null;
  setCurrentSchedule: React.Dispatch<React.SetStateAction<Schedule | null>>;
  generateSchedule: (startTime: string, travelMode?: string, prompt?: string) => Promise<void>;
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
  
  const generateSchedule = useCallback(async (startTime: string, travelMode: string = "walking", prompt?: string) => {
    if (favoritePlaces.length < 3) {
      console.error("Need at least 3 places to generate a schedule");
      return;
    }
    
    setIsLoading(true);
    try {
      const schedule = await scheduleService.generateSchedule(favoritePlaces, startTime, travelMode, prompt);
      setCurrentSchedule(schedule);
    } catch (error) {
      console.error('Failed to generate schedule:', error);
    } finally {
      setIsLoading(false);
    }
  }, [favoritePlaces]);

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