import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Place } from '../../types';
import './index.css';
import { PlaceCard } from '../../components/PlaceCard';
import { Button } from '../../components/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import { 
  Search, 
  Heart, 
  Archive, 
  Trash2, 
  Plus, 
  Map,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

export interface TabControlProps {
  activeTab: 'saved' | 'search';
  setActiveTab: (tab: 'saved' | 'search') => void;
}

function useItineraryPanelLogic(activeTab: 'saved' | 'search', setActiveTab: (tab: 'saved' | 'search') => void) {
  const { favoritePlaces, removeFavoritePlace, addFavoritePlace, clearAllFavorites, archiveFavorites, searchResults, setSearchResults } = useAppContext();
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);

  useEffect(() => {
    const handleSearchResults = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (Array.isArray(customEvent.detail)) {
        setSearchResults(customEvent.detail);
        if (customEvent.detail.length === 0) {
          setSelectedPlace(null);
        }
      } else {
        setSearchResults([]);
      }
      if (activeTab === 'saved') setActiveTab('search');
    };

    const handleSelectPlace = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { place, tab } = customEvent.detail || {};
      setSelectedPlace(place);
      if (tab && tab !== activeTab) {
        setActiveTab(tab);
      }
    };

    const handleClearSelectedPlace = () => {
      setSelectedPlace(null);
    };

    window.addEventListener('search-places', handleSearchResults);
    window.addEventListener('select-place', handleSelectPlace);
    window.addEventListener('clear-selected-place', handleClearSelectedPlace);
    
    return () => {
      window.removeEventListener('search-places', handleSearchResults);
      window.removeEventListener('select-place', handleSelectPlace);
      window.removeEventListener('clear-selected-place', handleClearSelectedPlace);
    };
  }, [activeTab, setActiveTab]);

  const handleTabChange = (tab: 'saved' | 'search') => {
    setActiveTab(tab);
    window.dispatchEvent(new CustomEvent('itinerary-tab-changed', { detail: tab }));
    if (tab === 'search' && searchResults.length > 0) {
      window.dispatchEvent(new CustomEvent('search-places', { detail: searchResults }));
    }
  };

  return { favoritePlaces, removeFavoritePlace, addFavoritePlace, searchResults, handleTabChange, selectedPlace, clearAllFavorites, archiveFavorites };
}

const FavoritePlacesList: React.FC<{ 
  favoritePlaces: Place[]; 
  removeFavoritePlace: (id: string) => void; 
  selectedPlace: Place | null; 
  clearAllFavorites: () => void; 
  archiveFavorites: (name?: string, note?: string) => void; 
}> = ({ favoritePlaces, removeFavoritePlace, selectedPlace, clearAllFavorites, archiveFavorites }) => {
  let results = favoritePlaces;
  let selected = null;
  if (selectedPlace && favoritePlaces.some(p => p.id === selectedPlace.id)) {
    selected = selectedPlace;
    results = favoritePlaces.filter(p => p.id !== selectedPlace.id);
  }

  // Archive modal state
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveName, setArchiveName] = useState('');
  const [archiveNote, setArchiveNote] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const handleArchive = () => {
    setArchiveOpen(true);
  };

  const handleArchiveClose = () => {
    setArchiveOpen(false);
    setArchiveName('');
    setArchiveNote('');
  };

  const handleArchiveConfirm = async () => {
    try {
      await archiveFavorites(archiveName.trim() || undefined, archiveNote.trim() || undefined);
      setArchiveOpen(false);
      setArchiveName('');
      setArchiveNote('');
      setShowSuccessMessage(true);
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);
    } catch (error) {
      console.error('Failed to archive favorites:', error);
    }
  };

  return (
    <div className="places-list">
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="archive-success-message">
          <div className="success-content">
            <CheckCircle size={20} color="var(--color-success-600)" />
            <div className="success-text">
              <strong>List archived successfully!</strong>
              <p>Go to <strong>Generate Schedule</strong> to create your itinerary from archived lists.</p>
            </div>
            <ArrowRight size={16} color="var(--color-success-600)" />
          </div>
        </div>
      )}
      
      {favoritePlaces.length > 0 && (
        <div className="places-header">
          <div className="places-count">
            {favoritePlaces.length} place{favoritePlaces.length !== 1 ? 's' : ''} selected
            {favoritePlaces.length < 3 && (
              <span style={{ color: 'var(--color-secondary-500)', marginLeft: 8, fontSize: '0.75rem' }}>
                (Need 3+ for archive)
              </span>
            )}
          </div>
          <div className="places-actions">
            <button className="action-button secondary" onClick={clearAllFavorites}>
              <Trash2 size={16} />
              Clear
            </button>
            <button 
              className="action-button"
              onClick={handleArchive}
              disabled={favoritePlaces.length < 3}
            >
              <Archive size={16} />
              Archive
            </button>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      <Dialog open={archiveOpen} onClose={handleArchiveClose} maxWidth="xs" fullWidth>
        <DialogTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Archive size={24} color="var(--color-primary-600)" />
            Archive List
          </div>
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name this list"
            type="text"
            fullWidth
            variant="outlined"
            value={archiveName}
            onChange={e => setArchiveName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Note (optional)"
            type="text"
            fullWidth
            variant="outlined"
            value={archiveNote}
            onChange={e => setArchiveNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="default" size="sm" onClick={handleArchiveClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleArchiveConfirm}>Archive</Button>
        </DialogActions>
      </Dialog>

      {selected && (
        <div className="selected-place">
          <div className="selected-badge">Selected</div>
          <PlaceCard place={selected} onRemoveFavorite={() => removeFavoritePlace(selected.id)} />
        </div>
      )}
      
      {favoritePlaces.length === 0 && !selected ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Heart size={28} />
          </div>
          <h3>No Saved Places</h3>
          <p>Search and add places to build your perfect day. Start exploring to create your custom itinerary!</p>
        </div>
      ) : (
        results.map(place => (
          <PlaceCard key={place.id} place={place} onRemoveFavorite={() => removeFavoritePlace(place.id)} />
        ))
      )}
    </div>
  );
};

const SearchResultsList: React.FC<{ 
  searchResults: Place[]; 
  selectedPlace: Place | null; 
  addFavoritePlace: (place: Place) => void 
}> = ({ searchResults, selectedPlace, addFavoritePlace }) => {
  const { favoritePlaces } = useAppContext();
  let results = searchResults;
  let selected = null;
  if (selectedPlace && searchResults.some(p => p.id === selectedPlace.id)) {
    selected = selectedPlace;
    results = searchResults.filter(p => p.id !== selectedPlace.id);
  }
  
  // Note Modal State
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [pendingPlace, setPendingPlace] = useState<Place | null>(null);
  const [note, setNote] = useState('');
  const [dontAskForNote, setDontAskForNote] = useState(false);

  const handleAddToFavorites = (place: Place) => {
    if (!dontAskForNote) {
      setPendingPlace(place);
      setShowNoteModal(true);
    } else {
      addFavoritePlace(place);
    }
  };
  
  const handleNoteConfirm = () => {
    if (pendingPlace) {
      addFavoritePlace({ ...pendingPlace, note: note.trim() || undefined });
      setPendingPlace(null);
      setNote('');
      setShowNoteModal(false);
    }
  };
  
  const handleNoteCancel = () => {
    setPendingPlace(null);
    setNote('');
    setShowNoteModal(false);
  };

  return (
    <div className="places-list">
      {searchResults.length > 0 && (
        <>
          <div className="places-count">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
          </div>
          
          <div className="settings-section">
            <div className="settings-item">
              <input 
                type="checkbox" 
                className="settings-checkbox"
                checked={dontAskForNote} 
                onChange={e => setDontAskForNote(e.target.checked)} 
              />
              <span>Skip note when saving places</span>
            </div>
          </div>
        </>
      )}
      
      <Dialog open={showNoteModal} onClose={handleNoteCancel} maxWidth="xs" fullWidth>
        <DialogTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Plus size={24} color="var(--color-primary-600)" />
            Add a Note (Optional)
          </div>
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Note or review (optional)"
            type="text"
            fullWidth
            variant="outlined"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { handleNoteConfirm(); } }}
          />
        </DialogContent>
        <DialogActions>
          <Button variant="default" size="sm" onClick={handleNoteCancel}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleNoteConfirm}>Save</Button>
        </DialogActions>
      </Dialog>
      
      {selected && (
        <div className="selected-place">
          <div className="selected-badge">Selected</div>
          <PlaceCard 
            place={selected} 
            onAddToFavorites={handleAddToFavorites}
            isSaved={favoritePlaces.some(p => p.id === selected.id)}
          />
        </div>
      )}
      
      {searchResults.length === 0 && !selected ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Search size={28} />
          </div>
          <h3>Start Exploring</h3>
          <p>Use the search bar above to discover amazing places for your next adventure. We'll show you the best matches here!</p>
        </div>
      ) : (
        results.map(place => (
          <PlaceCard 
            key={place.id} 
            place={place} 
            onAddToFavorites={handleAddToFavorites}
            isSaved={favoritePlaces.some(p => p.id === place.id)}
          />
        ))
      )}
    </div>
  );
};

const ItineraryPanel: React.FC<TabControlProps> = ({ activeTab, setActiveTab }) => {
  const { favoritePlaces, removeFavoritePlace, addFavoritePlace, searchResults, handleTabChange, selectedPlace, clearAllFavorites, archiveFavorites } = useItineraryPanelLogic(activeTab, setActiveTab);
  
  return (
    <div className="itinerary-panel expanded">
      <div className="panel-header">
        <div className="panel-title">
          <div className="panel-title-icon">
            <Map size={18} />
          </div>
          <h2>Travel Planner</h2>
        </div>
        
        <div className="panel-tabs" data-active-tab={activeTab}>
          <button
            className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => handleTabChange('search')}
          >
            <Search size={16} />
            <span>Search</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'saved' ? 'active' : ''}`}
            onClick={() => handleTabChange('saved')}
          >
            <Heart size={16} />
            <span>Saved</span>
          </button>
        </div>
      </div>
      
      <div className="panel-content">
        {activeTab === 'saved'
          ? <FavoritePlacesList 
              favoritePlaces={favoritePlaces} 
              removeFavoritePlace={removeFavoritePlace} 
              selectedPlace={selectedPlace} 
              clearAllFavorites={clearAllFavorites} 
              archiveFavorites={archiveFavorites} 
            />
          : <SearchResultsList 
              searchResults={searchResults} 
              selectedPlace={selectedPlace} 
              addFavoritePlace={addFavoritePlace} 
            />
        }
      </div>
    </div>
  );
};

export default ItineraryPanel;