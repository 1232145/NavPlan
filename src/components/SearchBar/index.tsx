import React from 'react';
import { Search, X } from 'lucide-react';
import './index.css';
import { Place, Coordinates } from '../../types';
import { Button } from '../Button';
import { useSearchBar } from '../../hooks';

export interface SearchBarProps {
  onSearchResults?: (places: Place[]) => void;
  mapCenter?: Coordinates;
}

// --- Main Component ---
export const SearchBar: React.FC<SearchBarProps> = ({ onSearchResults, mapCenter }) => {
  const {
    searchQuery,
    setSearchQuery,
    isSearching,
    performSearch,
    clearSearch
  } = useSearchBar(onSearchResults, mapCenter);

  return (
    <div className="search-container">
      <form className="search-form" onSubmit={(e) => {
        e.preventDefault();
        performSearch(); // Call performSearch on form submission
      }}>
        <div className="search-input-container">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search for places..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            disabled={isSearching}
          />
          {searchQuery && !isSearching && (
            <button type="button" className="clear-search" onClick={clearSearch}>
              <X size={16} />
            </button>
          )}
          <Button type="submit" variant="primary" size="sm" disabled={isSearching} className="search-button">
            {isSearching ? <span className="search-spinner" /> : 'Search'}
          </Button>
        </div>
      </form>
    </div>
  );
};