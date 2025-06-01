import React, { createContext, useContext, useState, useEffect } from 'react';
import { Place } from '../types';
import api from '../services/api/axios';
import { archivedListService } from '../services/archivedListService';

interface AppContextType {
  favoritePlaces: Place[];
  addFavoritePlace: (place: Place) => void;
  removeFavoritePlace: (id: string) => void;
  clearAllFavorites: () => void;
  archiveFavorites: (name?: string, note?: string) => Promise<void>;
  selectedPlace: Place | null;
  setSelectedPlace: (place: Place | null) => void;
  searchResults: Place[];
  setSearchResults: React.Dispatch<React.SetStateAction<Place[]>>;
  dontAskForNote: boolean;
  setDontAskForNote: React.Dispatch<React.SetStateAction<boolean>>;
  user: any;
  setUser: React.Dispatch<React.SetStateAction<any>>;
  checkSession: () => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const FAVORITE_PLACES_KEY = 'favorite_places';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favoritePlaces, setFavoritePlaces] = useState<Place[]>(() => {
    const savedPlaces = localStorage.getItem(FAVORITE_PLACES_KEY);
    return savedPlaces ? JSON.parse(savedPlaces) : [];
  });
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [dontAskForNote, setDontAskForNote] = useState(false);
  const [user, setUser] = useState<any>(null);

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

  const addFavoritePlace = (place: Place) => {
    setFavoritePlaces((prev) => {
      if (prev.some(p => p.id === place.id)) {
        return prev;
      }
      const newPlaces = [...prev, place];
      return newPlaces;
    });
  };

  const removeFavoritePlace = (id: string) => {
    setFavoritePlaces((prev) => prev.filter(p => p.id !== id));
  };

  const clearAllFavorites = () => {
    setFavoritePlaces([]);
  };

  const archiveFavorites = async (name?: string, note?: string) => {
    if (favoritePlaces.length === 0) return;
    try {
      await archivedListService.createList(
        name || `List ${new Date().toLocaleString()}`,
        favoritePlaces,
        note
      );
      setFavoritePlaces([]);
    } catch (error) {
      console.error('Failed to archive favorites:', error);
      throw error;
    }
  };

  return (
    <AppContext.Provider value={{
      favoritePlaces,
      addFavoritePlace,
      removeFavoritePlace,
      clearAllFavorites,
      archiveFavorites,
      selectedPlace,
      setSelectedPlace,
      searchResults,
      setSearchResults,
      dontAskForNote,
      setDontAskForNote,
      user,
      setUser,
      checkSession,
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