import { useState, useCallback, useMemo, useRef } from 'react';
import { Place, Coordinates } from '../types';
import { MapService } from '../services/mapService';

interface UseSearchBarReturn {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearching: boolean;
  performSearch: () => Promise<void>;
  clearSearch: () => void;
  // Performance helpers
  searchHistory: string[];
  clearHistory: () => void;
  hasResults: boolean;
  lastSearchTime: number | null;
}

// Simple in-memory cache for search results
interface SearchCache {
  [key: string]: {
    results: Place[];
    timestamp: number;
  };
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_HISTORY_SIZE = 10;

export const useSearchBar = (
  onSearchResults?: (places: Place[]) => void, 
  mapCenter?: Coordinates
): UseSearchBarReturn => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [lastSearchTime, setLastSearchTime] = useState<number | null>(null);
  
  const cacheRef = useRef<SearchCache>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastResultsRef = useRef<Place[]>([]);

  // Memoized cache key generator
  const generateCacheKey = useCallback((query: string, center?: Coordinates): string => {
    const centerKey = center ? `${center.lat.toFixed(4)},${center.lng.toFixed(4)}` : 'no-center';
    return `${query.toLowerCase().trim()}|${centerKey}`;
  }, []);

  // Memoized cache operations
  const getCachedResults = useCallback((key: string): Place[] | null => {
    const cached = cacheRef.current[key];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.results;
    }
    // Clean up expired cache entry
    if (cached) {
      delete cacheRef.current[key];
    }
    return null;
  }, []);

  const setCachedResults = useCallback((key: string, results: Place[]): void => {
    cacheRef.current[key] = {
      results,
      timestamp: Date.now()
    };
  }, []);

  // Optimized search history management
  const addToHistory = useCallback((query: string): void => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) return;

    setSearchHistory(prev => {
      const filtered = prev.filter(item => item !== trimmedQuery);
      const newHistory = [trimmedQuery, ...filtered];
      return newHistory.slice(0, MAX_HISTORY_SIZE);
    });
  }, []);

  const clearHistory = useCallback((): void => {
    setSearchHistory([]);
  }, []);

  // Optimized search function with caching and abort handling
  const performSearch = useCallback(async (): Promise<void> => {
    const trimmedQuery = searchQuery.trim();
    
    if (!trimmedQuery) {
      if (onSearchResults) onSearchResults([]);
      lastResultsRef.current = [];
      return;
    }

    // Cancel previous search if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();
    const currentController = abortControllerRef.current;

    // Check cache first
    const cacheKey = generateCacheKey(trimmedQuery, mapCenter);
    const cachedResults = getCachedResults(cacheKey);
    
    if (cachedResults) {
      if (onSearchResults) onSearchResults(cachedResults);
      lastResultsRef.current = cachedResults;
      addToHistory(trimmedQuery);
      setLastSearchTime(Date.now());
      return;
    }

    setIsSearching(true);
    const searchStartTime = Date.now();
    
    try {
      // Primary search strategy
      let results = await MapService.searchPlaces(trimmedQuery, mapCenter);
      
      // Check if request was aborted
      if (currentController.signal.aborted) {
        return;
      }
      
      // Fallback search strategy if no results and we have map center
      if (results.length === 0 && mapCenter && mapCenter.lat && mapCenter.lng) {
        results = await MapService.searchNearby(mapCenter, 10000);
        
        // Check abort again after fallback
        if (currentController.signal.aborted) {
          return;
        }
      }
      
      // Cache successful results
      setCachedResults(cacheKey, results);
      
      // Update state and notify
      if (onSearchResults) onSearchResults(results);
      lastResultsRef.current = results;
      addToHistory(trimmedQuery);
      setLastSearchTime(searchStartTime);
      
    } catch (error) {
      // Don't log abort errors
      if (!currentController.signal.aborted) {
        console.error("Search error:", error);
        // Return empty array on error
        if (onSearchResults) onSearchResults([]);
        lastResultsRef.current = [];
      }
    } finally {
      // Only update loading state if this request wasn't aborted
      if (!currentController.signal.aborted) {
        setIsSearching(false);
      }
    }
  }, [searchQuery, mapCenter, onSearchResults, generateCacheKey, getCachedResults, setCachedResults, addToHistory]);

  // Optimized clear function
  const clearSearch = useCallback((): void => {
    // Cancel any ongoing search
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setSearchQuery('');
    setIsSearching(false);
    
    if (onSearchResults) onSearchResults([]);
    lastResultsRef.current = [];
  }, [onSearchResults]);

  // Memoized computed properties
  const hasResults = useMemo(() => lastResultsRef.current.length > 0, [lastResultsRef.current]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Memoized return object
  return useMemo(() => ({
    searchQuery,
    setSearchQuery,
    isSearching,
    performSearch,
    clearSearch,
    searchHistory,
    clearHistory,
    hasResults,
    lastSearchTime,
    // Expose cleanup for manual use if needed
    cleanup,
  }), [
    searchQuery,
    isSearching,
    performSearch,
    clearSearch,
    searchHistory,
    clearHistory,
    hasResults,
    lastSearchTime,
    cleanup,
  ]);
}; 