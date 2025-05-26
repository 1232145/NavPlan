import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import './index.css';
import { MapService } from '../../services/mapService';
import { Place, Coordinates } from '../../types';
import { Button } from '../Button';

interface SearchBarProps {
  onSearchResults?: (places: Place[]) => void;
  mapCenter?: Coordinates;
}

// --- Custom Hook for Logic ---
function useSearchBarLogic(onSearchResults?: (places: Place[]) => void, mapCenter?: { lat: number; lng: number }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const results = await MapService.searchPlaces(searchQuery, mapCenter);
    setIsSearching(false);
    if (onSearchResults) onSearchResults(results);
  };

  const clearSearch = () => {
    setSearchQuery('');
    if (onSearchResults) onSearchResults([]);
  };

  return {
    searchQuery,
    setSearchQuery,
    isSearching,
    handleSearch,
    clearSearch,
  };
}

// --- Main Component ---
export const SearchBar: React.FC<SearchBarProps> = ({ onSearchResults, mapCenter }) => {
  const logic = useSearchBarLogic(onSearchResults, mapCenter);

  return (
    <div className="search-container">
      <form className="search-form" onSubmit={logic.handleSearch}>
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
          {logic.isSearching ? <span className="loading-spinner small" /> : 'Search'}
        </Button>
      </form>
    </div>
  );
};