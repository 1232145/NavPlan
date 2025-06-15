import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import './index.css';
import { Button } from '../../components/Button';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArchivedList, Place, SavedSchedule } from '../../types';
import { useArchiveSchedules, useArchivedLists } from '../../hooks';
import { DEFAULT_CATEGORIES } from '../../constants/common';
import CategoryFilter from '../../components/CategoryFilter';
import ScheduleGenerationDialog, { ScheduleGenerationOptions } from '../../components/ScheduleGenerationDialog';
import SaveScheduleDialog from '../../components/SaveScheduleDialog';
import ScheduleSlots from '../../components/ScheduleSlots';
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
  ShoppingBag,
  Trash2,
  Edit3,
  Save,
  X,
  Eye,
  EyeOff,
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
    return [];
  }
  
  return places.filter(place => {
    const category = categorizePlaceType(place.placeType);
    return selectedCategories.includes(category);
  });
};

const ArchivedListsPage: React.FC = () => {
  const { generateSchedule } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Archive list management
  const {
    archivedLists,
    loading,
    error,
    expanded,
    editingList,
    editedPlaces,
    placesToggles,
    deleteConfirmOpen,
    listToDelete,
    deleteLoading,
    fetchArchivedLists,
    toggleExpanded,
    startEditing,
    saveEdit,
    cancelEdit,
    doneEditing,
    removePlace,
    togglePlace,
    hasUnsavedChanges,
    getEnabledPlaces,
    startDelete,
    confirmDelete,
    cancelDelete
  } = useArchivedLists();
  
  // Archive schedule management
  const archiveSchedules = useArchiveSchedules();
  
  // Schedule modal state for choosing start time
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedList, setSelectedList] = useState<ArchivedList | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  // Refresh data when navigating back from schedule page after saving
  useEffect(() => {
    const state = location.state as { refreshLists?: boolean } | null;
    if (state?.refreshLists) {
      fetchArchivedLists(true);
      // Clear the state to prevent unnecessary re-fetches
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, fetchArchivedLists, navigate, location.pathname]);

  const handleGenerateSchedule = (list: ArchivedList) => {
    // Get enabled places (considering edit mode toggles)
    const enabledPlaces = getEnabledPlaces(list);
    // Filter the enabled places based on selected categories
    const filteredPlaces = filterPlacesByCategories(enabledPlaces, selectedCategories);
    
    if (filteredPlaces.length === 0) {
      alert('No places are enabled and match your selected categories. Please enable at least one place and select matching categories to generate a schedule.');
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
    setSelectedCategories(DEFAULT_CATEGORIES); // Reset to all categories
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
          options.endTime,
          options.includeCurrentLocation,
          options.preferences,
          selectedList
        );
        navigate('/schedule');
      }
    }, 50);
  };

  // Delete list handlers
  const handleDeleteList = (list: ArchivedList) => {
    startDelete(list);
  };

  const handleDeleteConfirm = async () => {
    await confirmDelete();
  };

  const handleDeleteCancel = () => {
    cancelDelete();
  };

  // Edit list handlers
  const handleEditList = (list: ArchivedList) => {
    startEditing(list);
  };

  const handleSaveEdit = async () => {
    await saveEdit();
  };

  const handleCancelEdit = () => {
    cancelEdit();
  };

  const handleDoneEditing = () => {
    doneEditing();
  };

  const handleRemovePlace = (placeId: string) => {
    removePlace(placeId);
  };

  const handleTogglePlace = (placeId: string) => {
    togglePlace(placeId);
  };

  const handleViewSchedule = async (schedule: SavedSchedule) => {
    try {
      // Set the schedule in context and navigate to schedule page

      // TODO: Update AppContext to handle viewing saved schedules
      // For now, we'll navigate to schedule page
      navigate('/schedule', { state: { savedSchedule: schedule } });
    } catch (err) {
      console.error('Failed to view schedule:', err);
    }
  };

  const handleDeleteSchedule = async (listId: string, scheduleId: string) => {
    try {
      await archiveSchedules.deleteSchedule(listId, scheduleId);
      // Refresh the lists to show updated schedule count
      await fetchArchivedLists(true);
    } catch (err) {
      console.error('Failed to delete schedule:', err);
    }
  };

  const handleToggleFavorite = async (listId: string, scheduleId: string, isFavorite: boolean) => {
    try {
      await archiveSchedules.updateScheduleMetadata(listId, scheduleId, { is_favorite: isFavorite });
      // Refresh the lists to show updated favorite status
      await fetchArchivedLists(true);
    } catch (err) {
      console.error('Failed to update schedule:', err);
    }
  };

  const handleSaveScheduleWrapper = async (options: any) => {
    try {
      await archiveSchedules.saveScheduleToArchive(options);
      // Refresh the lists to show updated schedule count
      await fetchArchivedLists(true);
    } catch (err) {
      console.error('Failed to save schedule:', err);
    }
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
          archiveListPlaces={selectedList?.places}
        />

        {/* Save Schedule Dialog */}
        <SaveScheduleDialog
          open={archiveSchedules.saveDialogOpen}
          onClose={archiveSchedules.closeSaveDialog}
          onSave={handleSaveScheduleWrapper}
          selectedList={archiveSchedules.selectedList}
          loading={archiveSchedules.isSavingSchedule}
          error={archiveSchedules.error}
        />

        {/* Delete Confirmation Dialog */}
        {deleteConfirmOpen && (
          <div className="delete-confirmation-overlay">
            <div className="delete-confirmation-dialog">
              <div className="delete-confirmation-header">
                <h3>Delete List</h3>
                <button 
                  className="delete-confirmation-close"
                  onClick={handleDeleteCancel}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="delete-confirmation-content">
                <div className="delete-confirmation-icon">
                  <Trash2 size={24} />
                </div>
                <p>
                  Are you sure you want to delete <strong>"{listToDelete?.name}"</strong>?
                </p>
                <p className="delete-confirmation-warning">
                  This action cannot be undone. The list and all its places will be permanently removed.
                </p>
              </div>
              <div className="delete-confirmation-actions">
                <Button 
                  variant="secondary" 
                  size="md" 
                  onClick={handleDeleteCancel}
                  disabled={deleteLoading}
                >
                  Cancel
                </Button>
                <Button 
                  variant="danger" 
                  size="md" 
                  onClick={handleDeleteConfirm}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? 'Deleting...' : 'Delete List'}
                </Button>
              </div>
            </div>
          </div>
        )}
        
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
                // Get the places to display (either all places in edit mode, or filtered places in normal mode)
                const placesToShow = editingList === list.id ? list.places : list.places;
                const filteredPlaces = filterPlacesByCategories(placesToShow, selectedCategories);
                const categoryCounts = getCategoryCounts(filteredPlaces);
                
                // Don't show lists that have no places after filtering (unless in edit mode)
                if (filteredPlaces.length === 0 && editingList !== list.id) {
                  return null;
                }
              
              return (
                <div key={list.id} className={`archived-list-card ${expanded.includes(list.id) ? 'expanded' : ''}`}>
                  <div className="archived-list-header">
                    <div 
                      className="archived-list-header-clickable"
                      onClick={() => toggleExpanded(list.id)}
                    >
                      <div className="archived-list-icon">
                        <Map size={20} />
                      </div>
                      <div className="archived-list-info">
                        <div className="archived-list-name-row">
                          <h3 className="archived-list-name">{list.name}</h3>
                          <div className="archived-list-badge">
                            {editingList === list.id 
                              ? `${editedPlaces.length} ${editedPlaces.length === 1 ? 'place' : 'places'}`
                              : `${filteredPlaces.length} ${filteredPlaces.length === 1 ? 'place' : 'places'}`
                            }
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
                      {editingList === list.id ? (
                        <>
                          {hasUnsavedChanges(list) && (
                            <>
                              <Button 
                                variant="primary" 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveEdit();
                                }}
                                className="save-button-header"
                              >
                                <Save size={16} />
                                Save Changes
                              </Button>
                              <Button 
                                variant="secondary" 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelEdit();
                                }}
                                className="cancel-button-header"
                              >
                                <X size={16} />
                                Cancel
                              </Button>
                            </>
                          )}
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDoneEditing();
                            }}
                            className="done-edit-button-header"
                          >
                            <X size={16} />
                            Done Editing
                          </Button>
                        </>
                      ) : (
                        <>
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
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditList(list);
                            }}
                            className="edit-button-header"
                          >
                            <Edit3 size={16} />
                            Edit
                          </Button>
                          <Button 
                            variant="danger" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteList(list);
                            }}
                            className="delete-button-header"
                          >
                            <Trash2 size={16} />
                            Delete
                          </Button>
                        </>
                      )}
                      <button 
                        className="archived-expand-button"
                        aria-label={expanded.includes(list.id) ? "Collapse" : "Expand"}
                        onClick={() => toggleExpanded(list.id)}
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



                      {editingList === list.id && hasUnsavedChanges(list) && (
                        <div className="edit-mode-warning">
                          <Edit3 size={16} />
                          <p>
                            <strong style={{color: '#dc2626'}}>⚠️ You have unsaved changes!</strong> Click "Save Changes" to keep them.
                          </p>
                        </div>
                      )}

                      {/* Schedule Slots */}
                      {list.saved_schedules.length > 0 && (
                        <ScheduleSlots
                          list={list}
                          onViewSchedule={handleViewSchedule}
                          onDeleteSchedule={(scheduleId) => handleDeleteSchedule(list.id, scheduleId)}
                          onToggleFavorite={(scheduleId, isFavorite) => handleToggleFavorite(list.id, scheduleId, isFavorite)}
                          loading={archiveSchedules.isSavingSchedule}
                        />
                      )}
                      
                      {filteredPlaces.length === 0 ? (
                        <div className="archived-list-empty">No places match the selected categories.</div>
                      ) : (
                        <div className="archived-places-grid">
                          {(editingList === list.id ? editedPlaces : list.places).map((place, index) => {
                            const isEnabled = placesToggles[place.id] !== false;
                            const shouldShow = editingList === list.id || selectedCategories.includes(categorizePlaceType(place.placeType));
                            
                            if (!shouldShow) return null;
                            
                            return (
                              <div key={place.id} className={`archived-place-card ${editingList === list.id ? 'edit-mode' : ''} ${!isEnabled ? 'disabled' : ''}`}>
                                <div className="archived-place-number">{index + 1}</div>
                                <div className="archived-place-content">
                                  <div className="archived-place-header">
                                    <h4 className="archived-place-name">{place.name}</h4>
                                    <div className="archived-place-controls">
                                      <div className="archived-place-type-badge">
                                        {getPlaceTypeIcon(place.placeType)}
                                        <span>{place.placeType.replace(/_/g, ' ')}</span>
                                      </div>
                                      {editingList === list.id && (
                                        <div className="archived-place-edit-controls">
                                          <button
                                            className={`place-toggle-button ${isEnabled ? 'enabled' : 'disabled'}`}
                                            onClick={() => handleTogglePlace(place.id)}
                                            title={isEnabled ? 'Disable for schedule generation' : 'Enable for schedule generation'}
                                          >
                                            {isEnabled ? <Eye size={16} /> : <EyeOff size={16} />}
                                          </button>
                                          <button
                                            className="place-remove-button"
                                            onClick={() => handleRemovePlace(place.id)}
                                            title="Remove from list"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </div>
                                      )}
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
                                        {Array.from({ length: 5 }, (_, i) => 
                                          i < Math.floor(place.rating!) ? '★' : '☆'
                                        ).join('')}
                                      </span>
                                      <span className="archived-place-rating-text">
                                        {place.rating.toFixed(1)}
                                        {place.userRatingCount ? ` (${place.userRatingCount})` : ''}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
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