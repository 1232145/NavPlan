import { useState, useCallback } from 'react';
import { ArchivedList } from '../types';
import { archivedListService } from '../services/archivedListService';

interface UseArchiveListSelectorState {
  isOpen: boolean;
  availableLists: ArchivedList[];
  loading: boolean;
  error: string | null;
  selectedList: ArchivedList | null;
}

export const useArchiveListSelector = () => {
  const [state, setState] = useState<UseArchiveListSelectorState>({
    isOpen: false,
    availableLists: [],
    loading: false,
    error: null,
    selectedList: null
  });

  // Update state helper
  const updateState = useCallback((updates: Partial<UseArchiveListSelectorState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Load available archive lists
  const loadAvailableLists = useCallback(async () => {
    updateState({ loading: true, error: null });
    
    try {
      const lists = await archivedListService.getLists();
      // Filter lists that can accept more schedules (less than 3 saved schedules)
      const availableLists = lists.filter(list => list.saved_schedules.length < 3);
      
      updateState({ 
        availableLists,
        loading: false 
      });
    } catch (error) {
      console.error('Failed to load archive lists:', error);
      updateState({ 
        error: 'Failed to load archive lists',
        loading: false 
      });
    }
  }, [updateState]);

  // Open selector dialog
  const openSelector = useCallback(async () => {
    updateState({ isOpen: true, selectedList: null });
    await loadAvailableLists();
  }, [updateState, loadAvailableLists]);

  // Close selector dialog
  const closeSelector = useCallback(() => {
    updateState({ 
      isOpen: false, 
      selectedList: null,
      error: null 
    });
  }, [updateState]);

  // Select a list
  const selectList = useCallback((list: ArchivedList) => {
    updateState({ selectedList: list });
  }, [updateState]);

  // Clear error
  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  // Get available slot for selected list
  const getAvailableSlot = useCallback((list: ArchivedList): number | null => {
    if (list.saved_schedules.length >= 3) return null;
    
    const usedSlots = new Set(
      list.saved_schedules.map((_, index) => index + 1)
    );
    
    for (let slot = 1; slot <= 3; slot++) {
      if (!usedSlots.has(slot)) return slot;
    }
    return null;
  }, []);

  return {
    // State
    ...state,
    
    // Actions
    openSelector,
    closeSelector,
    selectList,
    loadAvailableLists,
    clearError,
    
    // Helpers
    getAvailableSlot,
    
    // Computed
    hasAvailableLists: state.availableLists.length > 0,
    canConfirm: !!state.selectedList
  };
}; 