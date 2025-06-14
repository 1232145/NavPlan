import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArchivedList, Place } from '../types';
import { archivedListService } from '../services/archivedListService';

interface UseArchivedListsState {
  archivedLists: ArchivedList[];
  loading: boolean;
  error: string | null;
  expanded: string[];
  editingList: string | null;
  editedPlaces: Place[];
  placesToggles: Record<string, boolean>;
  deleteConfirmOpen: boolean;
  listToDelete: ArchivedList | null;
  deleteLoading: boolean;
}

interface UseArchivedListsReturn extends UseArchivedListsState {
  // List operations
  fetchArchivedLists: () => Promise<void>;
  
  // Expansion
  toggleExpanded: (listId: string) => void;
  
  // Edit operations
  startEditing: (list: ArchivedList) => void;
  saveEdit: () => Promise<void>;
  cancelEdit: () => void;
  doneEditing: () => void;
  removePlace: (placeId: string) => void;
  togglePlace: (placeId: string) => void;
  hasUnsavedChanges: (list: ArchivedList) => boolean;
  getEnabledPlaces: (list: ArchivedList) => Place[];
  
  // Delete operations
  startDelete: (list: ArchivedList) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
  
  // Utility
  clearError: () => void;
  
  // Performance helpers
  getListById: (id: string) => ArchivedList | undefined;
  isListExpanded: (id: string) => boolean;
  getListStats: (list: ArchivedList) => {
    totalPlaces: number;
    enabledPlaces: number;
    scheduleSlots: number;
    availableSlots: number;
  };
}

export const useArchivedLists = (): UseArchivedListsReturn => {
  const [state, setState] = useState<UseArchivedListsState>({
    archivedLists: [],
    loading: true,
    error: null,
    expanded: [],
    editingList: null,
    editedPlaces: [],
    placesToggles: {},
    deleteConfirmOpen: false,
    listToDelete: null,
    deleteLoading: false,
  });

  // Memoized state update helper to prevent unnecessary re-renders
  const updateState = useCallback((updates: Partial<UseArchivedListsState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Memoized list lookup for performance
  const getListById = useCallback((id: string): ArchivedList | undefined => {
    return state.archivedLists.find(list => list.id === id);
  }, [state.archivedLists]);

  // Memoized expansion check
  const isListExpanded = useCallback((id: string): boolean => {
    return state.expanded.includes(id);
  }, [state.expanded]);

  // Memoized list statistics calculator
  const getListStats = useCallback((list: ArchivedList) => {
    const enabledPlaces = list.places.filter(place => state.placesToggles[place.id] !== false);
    return {
      totalPlaces: list.places.length,
      enabledPlaces: enabledPlaces.length,
      scheduleSlots: list.saved_schedules.length,
      availableSlots: 3 - list.saved_schedules.length,
    };
  }, [state.placesToggles]);

  // Optimized fetch with error handling and loading states
  const fetchArchivedLists = useCallback(async () => {
    try {
      updateState({ loading: true, error: null });
      const lists = await archivedListService.getLists();
      updateState({ archivedLists: lists });
    } catch (err) {
      console.error('Error fetching archived lists:', err);
      updateState({ error: 'Failed to load archived lists' });
    } finally {
      updateState({ loading: false });
    }
  }, [updateState]);

  // Initial fetch with cleanup
  useEffect(() => {
    let isMounted = true;
    
    const loadLists = async () => {
      if (isMounted) {
        await fetchArchivedLists();
      }
    };
    
    loadLists();
    
    return () => {
      isMounted = false;
    };
  }, [fetchArchivedLists]);

  // Optimized expansion operations with batch updates
  const toggleExpanded = useCallback((listId: string) => {
    setState(prev => ({
      ...prev,
      expanded: prev.expanded.includes(listId)
        ? prev.expanded.filter(id => id !== listId)
        : [...prev.expanded, listId]
    }));
  }, []);

  // Optimized edit operations with memoized place initialization
  const startEditing = useCallback((list: ArchivedList) => {
    const initialToggles = list.places.reduce((acc, place) => {
      if (state.placesToggles[place.id] === undefined) {
        acc[place.id] = true;
      }
      return acc;
    }, {} as Record<string, boolean>);

    setState(prev => ({
      ...prev,
      editingList: list.id,
      editedPlaces: [...list.places],
      placesToggles: {
        ...prev.placesToggles,
        ...initialToggles
      }
    }));
  }, [state.placesToggles]);

  // Optimized save with batch state updates
  const saveEdit = useCallback(async () => {
    if (!state.editingList) return;
    
    const listToUpdate = getListById(state.editingList);
    if (!listToUpdate) return;

    try {
      await archivedListService.updateList(
        state.editingList,
        listToUpdate.name,
        state.editedPlaces,
        listToUpdate.note
      );
      
      // Batch update for better performance
      setState(prev => ({
        ...prev,
        archivedLists: prev.archivedLists.map(list => 
          list.id === state.editingList 
            ? { ...list, places: state.editedPlaces }
            : list
        ),
        editingList: null,
        editedPlaces: [],
        error: null
      }));
    } catch (err) {
      console.error('Error updating list:', err);
      updateState({ error: 'Failed to update list' });
    }
  }, [state.editingList, state.editedPlaces, getListById, updateState]);

  // Optimized cancel with proper cleanup
  const cancelEdit = useCallback(() => {
    if (state.editingList) {
      const originalList = getListById(state.editingList);
      if (originalList && state.editedPlaces.length !== originalList.places.length) {
        setState(prev => ({ 
          ...prev, 
          editedPlaces: [...originalList.places],
          editingList: null,
          error: null
        }));
        return;
      }
    }
    
    setState(prev => ({
      ...prev,
      editingList: null,
      editedPlaces: [],
      error: null
    }));
  }, [state.editingList, state.editedPlaces, getListById]);

  const doneEditing = useCallback(() => {
    setState(prev => ({
      ...prev,
      editingList: null,
      editedPlaces: []
      // Keep placesToggles for schedule generation
    }));
  }, []);

  // Optimized place operations with immutable updates
  const removePlace = useCallback((placeId: string) => {
    setState(prev => ({
      ...prev,
      editedPlaces: prev.editedPlaces.filter(place => place.id !== placeId)
    }));
  }, []);

  const togglePlace = useCallback((placeId: string) => {
    setState(prev => {
      const currentValue = prev.placesToggles[placeId];
      const newValue = currentValue === undefined ? false : !currentValue;
      return {
        ...prev,
        placesToggles: {
          ...prev.placesToggles,
          [placeId]: newValue
        }
      };
    });
  }, []);

  // Memoized change detection
  const hasUnsavedChanges = useCallback((list: ArchivedList): boolean => {
    if (state.editingList !== list.id) return false;
    return state.editedPlaces.length !== list.places.length;
  }, [state.editingList, state.editedPlaces]);

  // Memoized enabled places calculation
  const getEnabledPlaces = useCallback((list: ArchivedList): Place[] => {
    const hasToggles = Object.keys(state.placesToggles).some(placeId => 
      list.places.some(place => place.id === placeId)
    );
    
    if (hasToggles) {
      return list.places.filter(place => state.placesToggles[place.id] !== false);
    }
    return list.places;
  }, [state.placesToggles]);

  // Optimized delete operations
  const startDelete = useCallback((list: ArchivedList) => {
    setState(prev => ({
      ...prev,
      listToDelete: list,
      deleteConfirmOpen: true,
      error: null
    }));
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!state.listToDelete) return;
    
    try {
      updateState({ deleteLoading: true, error: null });
      await archivedListService.deleteList(state.listToDelete.id);
      
      setState(prev => ({
        ...prev,
        archivedLists: prev.archivedLists.filter(list => list.id !== state.listToDelete!.id),
        deleteConfirmOpen: false,
        listToDelete: null,
        deleteLoading: false,
        error: null
      }));
    } catch (err) {
      console.error('Error deleting list:', err);
      updateState({ error: 'Failed to delete list', deleteLoading: false });
    }
  }, [state.listToDelete, updateState]);

  const cancelDelete = useCallback(() => {
    setState(prev => ({
      ...prev,
      deleteConfirmOpen: false,
      listToDelete: null,
      error: null
    }));
  }, []);

  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  // Memoized return object to prevent unnecessary re-renders
  return useMemo(() => ({
    ...state,
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
    cancelDelete,
    clearError,
    getListById,
    isListExpanded,
    getListStats,
  }), [
    state,
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
    cancelDelete,
    clearError,
    getListById,
    isListExpanded,
    getListStats,
  ]);
}; 