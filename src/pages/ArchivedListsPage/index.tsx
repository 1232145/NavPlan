import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import './index.css';
import { Button } from '../../components/Button';
import { useNavigate } from 'react-router-dom';
import { ArchivedList, Place } from '../../types';
import { archivedListService } from '../../services/archivedListService';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import LoadingScreen from '../../components/LoadingScreen';
import NavbarColumn from '../../components/NavbarColumn';
import { 
  Map, 
  Calendar, 
  Clock, 
  ListChecks, 
  Navigation, 
  MapPin, 
  Info, 
  Coffee, 
  Utensils, 
  LandPlot, 
  Building, 
  Landmark, 
  ShoppingBag
} from 'lucide-react';

// Helper to get the icon for a place type
const getPlaceTypeIcon = (placeType: string) => {
  const type = placeType.toLowerCase();
  if (type.includes('restaurant') || type.includes('food')) return <Utensils size={16} />;
  if (type.includes('cafe') || type.includes('coffee')) return <Coffee size={16} />;
  if (type.includes('park') || type.includes('garden')) return <LandPlot size={16} />;
  if (type.includes('museum') || type.includes('gallery') || type.includes('attraction')) return <Landmark size={16} />;
  if (type.includes('store') || type.includes('shop') || type.includes('mall')) return <ShoppingBag size={16} />;
  return <Building size={16} />;
};

// Helper to format date nicely
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { 
    weekday: 'short', 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

// Helper to calculate category counts
const getCategoryCounts = (places: Place[]) => {
  const categories: Record<string, number> = {};
  
  places.forEach(place => {
    const type = place.placeType.toLowerCase();
    let category = 'other';
    
    if (type.includes('restaurant') || type.includes('food')) {
      category = 'food';
    } else if (type.includes('museum') || type.includes('gallery') || type.includes('attraction')) {
      category = 'attraction';
    } else if (type.includes('park') || type.includes('garden')) {
      category = 'outdoor';
    } else if (type.includes('store') || type.includes('shop') || type.includes('mall')) {
      category = 'shopping';
    }
    
    categories[category] = (categories[category] || 0) + 1;
  });
  
  return categories;
};

const ArchivedListsPage: React.FC = () => {
  const { generateSchedule } = useAppContext();
  const [archivedLists, setArchivedLists] = useState<ArchivedList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const navigate = useNavigate();
  
  // Schedule modal state for choosing start time
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('19:00');
  const [prompt, setPrompt] = useState('');
  const [selectedList, setSelectedList] = useState<ArchivedList | null>(null);

  useEffect(() => {
    fetchArchivedLists();
  }, []);

  const fetchArchivedLists = async () => {
    try {
      setLoading(true);
      const lists = await archivedListService.getLists();
      setArchivedLists(lists);
      setError(null);
    } catch (err) {
      setError('Failed to load archived lists');
      console.error('Error fetching archived lists:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSchedule = (list: ArchivedList) => {
    setSelectedList(list);
    setScheduleOpen(true);
  };

  const handleScheduleClose = () => {
    setScheduleOpen(false);
    setSelectedList(null);
    setPrompt('');
  };

  const handleScheduleConfirm = async () => {
    // Move focus to a safe element before navigation
    document.body.focus();
    // Close the modal first to avoid aria-hidden issues
    setScheduleOpen(false);
    
    // Wait a bit to ensure modal is closed before generating schedule
    setTimeout(async () => {
      if (selectedList) {
        await generateSchedule(
          startTime, 
          "walking", 
          prompt, 
          selectedList.places, 
          undefined, 
          selectedList.places.length,
          endTime
        );
        navigate('/schedule');
      }
    }, 50);
  };

  // Show loading screen for initial list loading
  if (loading) {
    return <LoadingScreen message="Loading your saved lists" />;
  }

  if (error) {
    return (
      <div className="archived-page-layout">
        <NavbarColumn />
        <div className="archived-lists-content">
          <div className="error-state">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="archived-page-layout">
      <NavbarColumn />
      <div className="archived-lists-content">
        {/* Schedule Modal */}
        <Dialog 
          open={scheduleOpen} 
          onClose={handleScheduleClose} 
          maxWidth="sm" 
          fullWidth
          aria-labelledby="schedule-dialog-title"
        >
          <DialogTitle id="schedule-dialog-title">
          </DialogTitle>
          <DialogContent>
            <div className="schedule-dialog-content">
              <p className="schedule-dialog-label">
                <Clock size={16} /> Set your schedule time range:
              </p>
              <div className="time-inputs-container">
                <div className="time-input-group">
                  <p>Start time:</p>
                  <TextField
                    type="time"
                    fullWidth
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    margin="dense"
                    InputLabelProps={{ shrink: true }}
                  />
                </div>
                <div className="time-input-group">
                  <p>End time:</p>
                  <TextField
                    type="time"
                    fullWidth
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    margin="dense"
                    InputLabelProps={{ shrink: true }}
                  />
                </div>
              </div>
              
              <p className="schedule-dialog-label">
                <Info size={16} /> Custom preferences (optional):
              </p>
              <TextField
                multiline
                rows={3}
                fullWidth
                placeholder="E.g., 'Focus on outdoor activities' or 'Include more food stops'"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                margin="dense"
              />

              <div className="schedule-summary-info">
                <div className="schedule-summary-icon"><ListChecks size={16} /></div>
                <p>
                  Generating a schedule for <strong>{selectedList?.places.length || 0} places</strong>.
                  Our AI will optimize your day based on locations and preferences.
                </p>
              </div>
            </div>
          </DialogContent>
          <DialogActions className="schedule-dialog-actions">
            <Button variant="default" size="sm" onClick={handleScheduleClose}>Cancel</Button>
            <Button 
              variant="primary" 
              size="sm" 
              onClick={handleScheduleConfirm}
            >
              Generate Schedule
            </Button>
          </DialogActions>
        </Dialog>
        
        {archivedLists.length === 0 ? (
          <div className="archived-empty">
            <Map size={48} strokeWidth={1.5} />
            <p>No saved lists yet</p>
            <Button variant="primary" size="md" onClick={() => navigate('/map')}>
              Go to Map
            </Button>
          </div>
        ) : (
          <div className="archived-list-container">
            {archivedLists.map(list => {
              const categoryCounts = getCategoryCounts(list.places);
              
              return (
                <div key={list.id} className={`archived-list-card ${expanded.includes(list.id) ? 'expanded' : ''}`}>
                  <div className="archived-list-header">
                    <div 
                      className="archived-list-header-clickable"
                      onClick={() => {
                        if (expanded.includes(list.id)) {
                          setExpanded(expanded.filter(id => id !== list.id));
                        } else {
                          setExpanded([...expanded, list.id]);
                        }
                      }}
                    >
                      <div className="archived-list-icon">
                        <Map size={20} />
                      </div>
                      <div className="archived-list-info">
                        <div className="archived-list-name-row">
                          <h3 className="archived-list-name">{list.name}</h3>
                          <div className="archived-list-badge">
                            {list.places.length} {list.places.length === 1 ? 'place' : 'places'}
                          </div>
                        </div>
                        <div className="archived-list-details">
                          <span className="archived-list-date">
                            <Calendar size={14} />
                            {formatDate(list.date)}
                          </span>
                          
                          <div className="archived-list-categories">
                            {Object.entries(categoryCounts).map(([category, count]) => (
                              <span key={category} className={`category-badge category-${category}`}>
                                {category}: {count}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="archived-list-header-actions">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateSchedule(list);
                        }}
                        className="generate-button-header"
                      >
                        <Navigation size={16} />
                        Generate Schedule
                      </Button>
                      <button 
                        className="archived-expand-button"
                        aria-label={expanded.includes(list.id) ? "Collapse" : "Expand"}
                        onClick={() => {
                          if (expanded.includes(list.id)) {
                            setExpanded(expanded.filter(id => id !== list.id));
                          } else {
                            setExpanded([...expanded, list.id]);
                          }
                        }}
                      >
                        <span className="archived-expand-icon">{expanded.includes(list.id) ? '▼' : '▶'}</span>
                      </button>
                    </div>
                  </div>
                  
                  {expanded.includes(list.id) && (
                    <div className="archived-list-content">
                      {list.note && (
                        <div className="archived-list-note">
                          <Info size={16} />
                          <p><span className="note-label">Your note:</span> {list.note}</p>
                        </div>
                      )}
                      

                      
                      {list.places.length === 0 ? (
                        <div className="archived-list-empty">No places in this list.</div>
                      ) : (
                        <div className="archived-places-grid">
                          {list.places.map((place, index) => (
                            <div key={place.id} className="archived-place-card">
                              <div className="place-number">{index + 1}</div>
                              <div className="place-content">
                                <div className="place-header">
                                  <h4 className="archived-place-name">{place.name}</h4>
                                  <div className="place-type-badge">
                                    {getPlaceTypeIcon(place.placeType)}
                                    <span>{place.placeType.replace(/_/g, ' ')}</span>
                                  </div>
                                </div>
                                <div className="archived-place-address">
                                  <MapPin size={14} />
                                  {place.address}
                                </div>
                                {place.note && (
                                  <div className="archived-place-note">
                                    <span className="place-note-label">Note:</span> <span className="place-note-content">"{place.note}"</span>
                                  </div>
                                )}
                                {place.rating && (
                                  <div className="place-rating">
                                    <span className="stars">
                                      {'★'.repeat(Math.floor(place.rating))}
                                      {place.rating % 1 >= 0.5 ? '½' : ''}
                                      {'☆'.repeat(5 - Math.ceil(place.rating))}
                                    </span>
                                    <span className="rating-text">
                                      {place.rating.toFixed(1)}
                                      {place.userRatingCount ? ` (${place.userRatingCount})` : ''}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ArchivedListsPage; 