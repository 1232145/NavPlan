import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { Place } from '../../types';
import './index.css';
import { PlaceCard } from '../../components/PlaceCard';
import { Button } from '../../components/Button';
import ScheduleGenerationDialog, { ScheduleGenerationOptions } from '../ScheduleGenerationDialog';
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
  CheckCircle,
  ArrowRight,
  MapPin,
  Sparkles
} from 'lucide-react';

export interface TabControlProps {
  activeTab: 'saved' | 'search';
  setActiveTab: (tab: 'saved' | 'search') => void;
}

function useItineraryPanelLogic(activeTab: 'saved' | 'search', setActiveTab: (tab: 'saved' | 'search') => void) {
  const { favoritePlaces, removeFavoritePlace, addFavoritePlace, clearAllFavorites, archiveFavorites, searchResults, setSearchResults } = useAppContext();
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const navigate = useNavigate();

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

  return { navigate, favoritePlaces, removeFavoritePlace, addFavoritePlace, searchResults, handleTabChange, selectedPlace, clearAllFavorites, archiveFavorites };
}

const FavoritePlacesList: React.FC<{ 
  navigate: (path: string, options?: { state?: any }) => void;
  favoritePlaces: Place[]; 
  removeFavoritePlace: (id: string) => void; 
  selectedPlace: Place | null; 
  clearAllFavorites: () => void; 
  archiveFavorites: (name?: string, note?: string) => Promise<void>; 
  setActiveTab: (tab: 'saved' | 'search') => void;
}> = ({ navigate, favoritePlaces, removeFavoritePlace, selectedPlace, clearAllFavorites, archiveFavorites, setActiveTab }) => {
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
      
      await archiveFavorites(
        archiveName.trim() || undefined, 
        archiveNote.trim() || undefined
      );
      setArchiveOpen(false);
      setArchiveName('');
      setArchiveNote('');
      
      // Switch to search tab immediately to show that saved places are cleared
      setActiveTab('search');
      
      // Show success message after switching tabs
      setTimeout(() => {
        setShowSuccessMessage(true);
      }, 100);
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 5000);

      navigate('/lists');
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
        <>
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
        </>
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
            sx={{ mb: 2 }}
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
          <p>Search and add places to build your perfect day.</p>
        </div>
      ) : (
        results.map(place => (
          <PlaceCard key={place.id} place={place} onRemoveFavorite={() => removeFavoritePlace(place.id)} />
        ))
      )}
    </div>
  );
};

const LocationBasedExploration: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [locationStatus, setLocationStatus] = useState<string>('');
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const { generateLocationBasedSchedule, currentLocation, requestLocationPermission } = useAppContext();
  const navigate = useNavigate();

  const handleGenerateFromLocation = async () => {
    setIsGenerating(true);
    setLocationStatus('Requesting location permission...');
    
    try {
      if (!currentLocation) {
        await requestLocationPermission();
        if (!currentLocation) {
          throw new Error('Location permission denied');
        }
      }
      
      setLocationStatus('Location found! Please choose your schedule preferences...');
      setIsGenerating(false);
      setLocationStatus('');
      setScheduleDialogOpen(true);
      
    } catch (error) {
      console.error('Location error:', error);
      setLocationStatus('Failed to get current location. Please enable location permissions and try again.');
      setTimeout(() => {
        setIsGenerating(false);
        setLocationStatus('');
      }, 3000);
    }
  };

  const handleScheduleDialogClose = () => {
    setScheduleDialogOpen(false);
  };

  const handleScheduleDialogConfirm = async (options: ScheduleGenerationOptions) => {
    if (!currentLocation) return;
    
    try {
      setScheduleDialogOpen(false);
      
      // Generate location-based schedule with user preferences
      await generateLocationBasedSchedule(
        currentLocation.lat,
        currentLocation.lng,
        {
          radius_meters: 5000,
          travel_mode: "walking",
          start_time: options.startTime,
          end_time: options.endTime,
          prompt: options.prompt,
          includeCurrentLocation: options.includeCurrentLocation
        }
      );
      
      // Navigate to schedule page
      navigate('/schedule');
      
    } catch (error) {
      console.error('Failed to generate location-based schedule:', error);
      setLocationStatus('Failed to generate schedule. Please try again.');
      setTimeout(() => {
        setLocationStatus('');
      }, 5000);
    }
  };

  return (
    <>
      <div className="location-exploration">
        <div className="location-exploration-icon">
          <Sparkles size={28} />
        </div>
        <h3>No place in mind?</h3>
        <p>Let AI discover amazing places near you and create the perfect day schedule.</p>
        
        {locationStatus && (
          <div className="location-status">
            <p>{locationStatus}</p>
          </div>
        )}
        
        <Button 
          variant="primary" 
          size="md" 
          onClick={handleGenerateFromLocation}
          disabled={isGenerating}
          className="location-exploration-button"
        >
          <MapPin size={16} />
          {isGenerating ? 'Getting your location...' : 'Try AI Recommendations'}
        </Button>
      </div>

      {/* Schedule Generation Dialog */}
      <ScheduleGenerationDialog
        open={scheduleDialogOpen}
        onClose={handleScheduleDialogClose}
        onConfirm={handleScheduleDialogConfirm}
        title="AI Recommendations Setup"
        description="AI will discover amazing places near your location and create an optimized schedule."
        isLocationBased={true}
      />
    </>
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
        <>
          <div className="empty-state">
            <div className="empty-state-icon">
              <Search size={28} />
            </div>
            <h3>Start Exploring</h3>
            <p>Use the search bar above to discover amazing places for your next adventure.</p>
          </div>
          
          <LocationBasedExploration />
        </>
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
  const { navigate, favoritePlaces, removeFavoritePlace, addFavoritePlace, searchResults, handleTabChange, selectedPlace, clearAllFavorites, archiveFavorites } = useItineraryPanelLogic(activeTab, setActiveTab);
  
  return (
    <div className="itinerary-panel expanded">
      <div className="panel-header">
        
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
              navigate={navigate}
              favoritePlaces={favoritePlaces} 
              removeFavoritePlace={removeFavoritePlace} 
              selectedPlace={selectedPlace} 
              clearAllFavorites={clearAllFavorites} 
              archiveFavorites={archiveFavorites} 
              setActiveTab={setActiveTab}
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