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
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';

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

const FavoritePlacesList: React.FC<{ favoritePlaces: Place[]; removeFavoritePlace: (id: string) => void; selectedPlace: Place | null; clearAllFavorites: () => void; archiveFavorites: (name?: string, note?: string) => void; }> = ({ favoritePlaces, removeFavoritePlace, selectedPlace, clearAllFavorites, archiveFavorites }) => {
  let results = favoritePlaces;
  let selected = null;
  if (selectedPlace && favoritePlaces.some(p => p.id === selectedPlace.id)) {
    selected = selectedPlace;
    results = favoritePlaces.filter(p => p.id !== selectedPlace.id);
  }
  const [open, setOpen] = useState(false);
  const [archiveName, setArchiveName] = useState('');
  const [archiveNote, setArchiveNote] = useState('');
  const handleArchive = () => {
    setOpen(true);
  };
  const handleDialogClose = () => {
    setOpen(false);
    setArchiveName('');
    setArchiveNote('');
  };
  const handleArchiveConfirm = () => {
    archiveFavorites(archiveName.trim() || undefined, archiveNote.trim() || undefined);
    setOpen(false);
    setArchiveName('');
    setArchiveNote('');
  };
  return (
    <div className="places-list">
      {favoritePlaces.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <Button variant="default" size="sm" onClick={clearAllFavorites}>Clear All</Button>
          <Button variant="primary" size="sm" onClick={handleArchive}>Archive This</Button>
        </div>
      )}
      <Dialog open={open} onClose={handleDialogClose} maxWidth="xs" fullWidth>
        <DialogTitle>Archive List</DialogTitle>
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
          <Button variant="default" size="sm" onClick={handleDialogClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleArchiveConfirm} disabled={!favoritePlaces.length}>Archive</Button>
        </DialogActions>
      </Dialog>
      {selected && (
        <div style={{ marginBottom: 12, background: '#f0f6ff', padding: '10px 10px 1px 10px' }}>
          <PlaceCard place={selected} onRemoveFavorite={() => removeFavoritePlace(selected.id)} />
        </div>
      )}
      {favoritePlaces.length === 0 && !selected ? (
        <div className="empty-state">
          <p>Search and add places to build your perfect day</p>
        </div>
      ) : (
        <>
          <p className="places-count">
            {favoritePlaces.length} place{favoritePlaces.length !== 1 ? 's' : ''} selected
          </p>
          {results.map(place => (
            <PlaceCard key={place.id} place={place} onRemoveFavorite={() => removeFavoritePlace(place.id)} />
          ))}
        </>
      )}
    </div>
  );
};

const SearchResultsList: React.FC<{ searchResults: Place[]; selectedPlace: Place | null; addFavoritePlace: (place: Place) => void }> = ({ searchResults, selectedPlace, addFavoritePlace }) => {
  const { dontAskForNote, setDontAskForNote } = useAppContext();
  let results = searchResults;
  let selected = null;
  if (selectedPlace && searchResults.some(p => p.id === selectedPlace.id)) {
    selected = selectedPlace;
    results = searchResults.filter(p => p.id !== selectedPlace.id);
  }
  // --- Note Modal State ---
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [pendingPlace, setPendingPlace] = useState<Place | null>(null);
  const [note, setNote] = useState('');

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
        <FormControlLabel
          control={<Checkbox checked={dontAskForNote} onChange={e => setDontAskForNote(e.target.checked)} />}
          label="Don't ask for a note when saving to favorites."
          sx={{ mb: 2 }}
        />
      )}
      <Dialog open={showNoteModal} onClose={handleNoteCancel} maxWidth="xs" fullWidth>
        <DialogTitle>Add a Note (Optional)</DialogTitle>
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
        <div style={{ marginBottom: 12, background: '#f0f6ff', padding: '10px 10px 1px 10px' }}>
          <PlaceCard place={selected} onAddToFavorites={handleAddToFavorites} />
        </div>
      )}
      {searchResults.length === 0 && !selected ? (
        <div className="empty-state">
          <p>No search results yet. Try searching for a place!</p>
        </div>
      ) : (
        <>
          <p className="places-count">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
          </p>
          {results.map(place => (
            <PlaceCard key={place.id} place={place} onAddToFavorites={handleAddToFavorites} />
          ))}
        </>
      )}
    </div>
  );
};

const ItineraryPanel: React.FC<TabControlProps> = ({ activeTab, setActiveTab }) => {
  const { favoritePlaces, removeFavoritePlace, addFavoritePlace, searchResults, handleTabChange, selectedPlace, clearAllFavorites, archiveFavorites } = useItineraryPanelLogic(activeTab, setActiveTab);
  return (
    <div className="itinerary-panel expanded">
      <div className="panel-tabs">
        <>
          <Button
            variant={activeTab === 'search' ? 'primary' : 'default'}
            size="md"
            style={{ borderRadius: '12px', marginRight: 2 }}
            onClick={() => handleTabChange('search')}
          >
            Search Results
          </Button>
          <Button
            variant={activeTab === 'saved' ? 'primary' : 'default'}
            size="md"
            style={{ borderRadius: '12px' }}
            onClick={() => handleTabChange('saved')}
          >
            Saved Places
          </Button>
        </>
      </div>
      {activeTab === 'saved'
        ? <FavoritePlacesList favoritePlaces={favoritePlaces} removeFavoritePlace={removeFavoritePlace} selectedPlace={selectedPlace} clearAllFavorites={clearAllFavorites} archiveFavorites={archiveFavorites} />
        : <SearchResultsList searchResults={searchResults} selectedPlace={selectedPlace} addFavoritePlace={addFavoritePlace} />
      }
    </div>
  );
};

export default ItineraryPanel;