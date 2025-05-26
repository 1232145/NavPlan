import React, { createContext, useContext, useState } from 'react';
import { Place, ArchivedList } from '../types';
import axios from 'axios';

interface AppContextType {
  favoritePlaces: Place[];
  addFavoritePlace: (place: Place) => void;
  removeFavoritePlace: (id: string) => void;
  clearAllFavorites: () => void;
  archiveFavorites: (name?: string, note?: string) => void;
  archivedLists: ArchivedList[];
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

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favoritePlaces, setFavoritePlaces] = useState<Place[]>([]);
  const [archivedLists, setArchivedLists] = useState<ArchivedList[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [dontAskForNote, setDontAskForNote] = useState(false);
  const [user, setUser] = useState<any>(null);

  // Provide a method to check session, to be called from components
  const checkSession = async (): Promise<boolean> => {
    try {
      const res = await axios.get('http://localhost:8000/api/me', { withCredentials: true });
      setUser(res.data.user);
      return true;
    } catch (e) {
      setUser(null);
      return false;
    }
  };

  const addFavoritePlace = (place: Place) => {
    setFavoritePlaces((prev) => (prev.some(p => p.id === place.id) ? prev : [...prev, place]));
  };

  const removeFavoritePlace = (id: string) => {
    setFavoritePlaces((prev) => prev.filter(p => p.id !== id));
  };

  const clearAllFavorites = () => {
    setFavoritePlaces([]);
  };

  const archiveFavorites = (name?: string, note?: string) => {
    if (favoritePlaces.length === 0) return;
    const newArchive: ArchivedList = {
      id: Date.now().toString(),
      name: name || `List ${new Date().toLocaleString()}`,
      date: new Date().toLocaleString(),
      places: favoritePlaces,
      note,
    };
    setArchivedLists((prev) => [newArchive, ...prev]);
    setFavoritePlaces([]);
  };

  return (
    <AppContext.Provider value={{
      favoritePlaces,
      addFavoritePlace,
      removeFavoritePlace,
      clearAllFavorites,
      archiveFavorites,
      archivedLists,
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