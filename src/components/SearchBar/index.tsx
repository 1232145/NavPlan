import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import './index.css';
import { MapService } from '../../services/mapService';
import { Place, Coordinates } from '../../types';
import { Button } from '../Button';

export interface SearchBarProps {
  onSearchResults?: (places: Place[]) => void;
  mapCenter?: Coordinates;
}

// --- Custom Hook for Logic ---
function useSearchBarLogic(onSearchResults?: (places: Place[]) => void, mapCenter?: Coordinates) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const performSearch = async () => {
    if (searchQuery.trim()) {
      setIsSearching(true);
      
      try {
        // Try text search first
        let results = await MapService.searchPlaces(searchQuery, mapCenter);
        
        // If no results and we have mapCenter, try nearby search as fallback
        if (results.length === 0 && mapCenter && mapCenter.lat && mapCenter.lng) {
          results = await MapService.searchNearby(mapCenter, 10000);
        }
        
        if (onSearchResults) onSearchResults(results);
      } catch (error) {
        console.error("Search error:", error);
        // Return empty array on error
        if (onSearchResults) onSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    } else {
      // Clear results if search query is empty
      if (onSearchResults) onSearchResults([]);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    if (onSearchResults) onSearchResults([]);
  };

  return {
    searchQuery,
    setSearchQuery,
    isSearching,
    performSearch, // Expose performSearch to be called by onSubmit
    clearSearch,
  };
}

// --- Main Component ---
export const SearchBar: React.FC<SearchBarProps> = ({ onSearchResults, mapCenter }) => {
  const logic = useSearchBarLogic(onSearchResults, mapCenter);

  return (
    <div className="search-container">
      <form className="search-form" onSubmit={(e) => {
        e.preventDefault();
        logic.performSearch(); // Call performSearch on form submission
      }}>
        <div className="search-input-container">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search for places..."
            value={logic.searchQuery}
            onChange={(e) => logic.setSearchQuery(e.target.value)}
            className="search-input"
            disabled={logic.isSearching}
          />
          {logic.searchQuery && !logic.isSearching && (
            <button type="button" className="clear-search" onClick={logic.clearSearch}>
              <X size={16} />
            </button>
          )}
        </div>
        <Button type="submit" variant="primary" size="md" disabled={logic.isSearching}>
          {logic.isSearching ? <span className="search-spinner" /> : 'Search'}
        </Button>
      </form>
    </div>
  );
};