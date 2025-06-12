import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import './index.css';
import { Button } from '../../components/Button';
import { useNavigate } from 'react-router-dom';
import { ArchivedList, Place } from '../../types';
import { archivedListService } from '../../services/archivedListService';
import CategoryFilter from '../../components/CategoryFilter';
import ScheduleGenerationDialog, { ScheduleGenerationOptions } from '../../components/ScheduleGenerationDialog';
import LoadingScreen from '../../components/LoadingScreen';
import NavbarColumn from '../../components/NavbarColumn';
import { 
  Map, 
  Calendar, 
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

// Helper to categorize a place
const categorizePlaceType = (placeType: string): string => {
  const type = placeType.toLowerCase();
  if (type.includes('restaurant') || type.includes('food')) {
    return 'food';
  } else if (type.includes('cafe') || type.includes('coffee')) {
    return 'cafe';
  } else if (type.includes('museum') || type.includes('gallery') || type.includes('attraction')) {
    return 'attraction';
  } else if (type.includes('park') || type.includes('garden')) {
    return 'outdoor';
  } else if (type.includes('store') || type.includes('shop') || type.includes('mall')) {
    return 'shopping';
  }
  return 'other';
};

// Helper to filter places by selected categories
const filterPlacesByCategories = (places: Place[], selectedCategories: string[]): Place[] => {
  if (selectedCategories.length === 0) {
    return []; // No categories selected means no places
  }
  
  return places.filter(place => {
    const category = categorizePlaceType(place.placeType);
    return selectedCategories.includes(category);
  });
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
  const [selectedList, setSelectedList] = useState<ArchivedList | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['food', 'cafe', 'attraction', 'outdoor', 'shopping', 'other']);

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
    // Filter the list's places based on selected categories before setting
    const filteredPlaces = filterPlacesByCategories(list.places, selectedCategories);
    
    if (filteredPlaces.length === 0) {
      alert('No places match your selected categories. Please select at least one category to generate a schedule.');
      return;
    }
    
    // Create a filtered version of the list
    const filteredList = {
      ...list,
      places: filteredPlaces
    };
    
    setSelectedList(filteredList);
    setScheduleOpen(true);
  };

  const handleScheduleClose = () => {
    setScheduleOpen(false);
    setSelectedList(null);
    setSelectedCategories(['food', 'cafe', 'attraction', 'outdoor', 'shopping', 'other']); // Reset to all categories
  };

  const handleScheduleConfirm = async (options: ScheduleGenerationOptions) => {
    // Move focus to a safe element before navigation
    document.body.focus();
    // Close the modal first to avoid aria-hidden issues
    setScheduleOpen(false);
    
    // Wait a bit to ensure modal is closed before generating schedule
    setTimeout(async () => {
      if (selectedList) {
        await generateSchedule(
          options.startTime, 
          "walking", 
          options.prompt, 
          selectedList.places, 
          undefined, 
          selectedList.places.length,
          options.endTime
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
        {/* Schedule Generation Dialog */}
        <ScheduleGenerationDialog
          open={scheduleOpen}
          onClose={handleScheduleClose}
          onConfirm={handleScheduleConfirm}
          title="Generate Schedule"
          placeCount={selectedList?.places.length}
        />
        
        {archivedLists.length === 0 ? (
          <div className="archived-empty">
            <Map size={48} strokeWidth={1.5} />
            <p>No saved lists yet</p>
            <Button variant="primary" size="md" onClick={() => navigate('/map')}>
              Go to Map
            </Button>
          </div>
        ) : (
          <>
            <div className="archived-lists-filters">
              <CategoryFilter
                selectedCategories={selectedCategories}
                onCategoryChange={setSelectedCategories}
                title="Filter Places by Category"
                size="md"
                defaultExpanded={false}
              />
            </div>
            
            <div className="archived-list-container">
              {archivedLists.map(list => {
                // Filter places in this list based on selected categories
                const filteredPlaces = filterPlacesByCategories(list.places, selectedCategories);
                const categoryCounts = getCategoryCounts(filteredPlaces);
                
                // Don't show lists that have no places after filtering
                if (filteredPlaces.length === 0) {
                  return null;
                }
              
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
                            {filteredPlaces.length} {filteredPlaces.length === 1 ? 'place' : 'places'}
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
                      

                      
                      {filteredPlaces.length === 0 ? (
                        <div className="archived-list-empty">No places match the selected categories.</div>
                      ) : (
                        <div className="archived-places-grid">
                          {filteredPlaces.map((place, index) => (
                            <div key={place.id} className="archived-place-card">
                              <div className="archived-place-number">{index + 1}</div>
                              <div className="archived-place-content">
                                <div className="archived-place-header">
                                  <h4 className="archived-place-name">{place.name}</h4>
                                  <div className="archived-place-type-badge">
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
                                    <span className="archived-place-note-label">Note:</span> <span className="archived-place-note-content">"{place.note}"</span>
                                  </div>
                                )}
                                {place.rating && (
                                  <div className="archived-place-rating">
                                    <span className="archived-place-stars">
                                      {'★'.repeat(Math.floor(place.rating))}
                                      {place.rating % 1 >= 0.5 ? '½' : ''}
                                      {'☆'.repeat(5 - Math.ceil(place.rating))}
                                    </span>
                                    <span className="archived-place-rating-text">
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
          </>
        )}
      </div>
    </div>
  );
};

export default ArchivedListsPage; 