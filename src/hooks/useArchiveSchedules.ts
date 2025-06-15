import { useState, useCallback, useMemo } from 'react';
import { ArchivedList, SavedSchedule, TravelMode } from '../types';
import { archiveScheduleService } from '../services/archiveScheduleService';
import { useAppContext } from '../context/AppContext';

interface UseArchiveSchedulesState {
  selectedList: ArchivedList | null;
  selectedSchedule: SavedSchedule | null;
  isViewingSchedule: boolean;
  isSavingSchedule: boolean;
  saveDialogOpen: boolean;
  scheduleSlotSelection: number | null;
  error: string | null;
}

interface SaveScheduleOptions {
  name: string;
  travelMode: TravelMode;
  startTime: string;
  endTime: string;
  replaceSlotIndex?: number;
}

export const useArchiveSchedules = () => {
  const { currentSchedule, favoritePlaces } = useAppContext();
  
  const [state, setState] = useState<UseArchiveSchedulesState>({
    selectedList: null,
    selectedSchedule: null,
    isViewingSchedule: false,
    isSavingSchedule: false,
    saveDialogOpen: false,
    scheduleSlotSelection: null,
    error: null
  });

  // Memoized helpers
  const helpers = useMemo(() => ({
    canAddSchedule: (list: ArchivedList) => archiveScheduleService.canAddSchedule(list),
    getAvailableSlot: (list: ArchivedList) => archiveScheduleService.getAvailableSlotNumber(list),
    getScheduleById: (list: ArchivedList, id: string) => archiveScheduleService.getScheduleById(list, id),
    getSlotName: (slot: number) => archiveScheduleService.getScheduleSlotName(slot)
  }), []);

  // State update helper
  const updateState = useCallback((updates: Partial<UseArchiveSchedulesState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Error handler
  const handleError = useCallback((error: any, context: string) => {
    console.error(`Archive schedule error (${context}):`, error);
    updateState({ 
      error: error.response?.data?.detail || error.message || `Failed to ${context}`,
      isSavingSchedule: false 
    });
  }, [updateState]);

  // Open save dialog
  const openSaveDialog = useCallback((list: ArchivedList, slotSelection?: number) => {
    updateState({
      selectedList: list,
      scheduleSlotSelection: slotSelection || null,
      saveDialogOpen: true,
      error: null
    });
  }, [updateState]);

  // Close save dialog
  const closeSaveDialog = useCallback(() => {
    updateState({
      saveDialogOpen: false,
      selectedList: null,
      scheduleSlotSelection: null,
      error: null
    });
  }, [updateState]);

  // Save schedule to archive
  const saveScheduleToArchive = useCallback(async (options: SaveScheduleOptions) => {
    if (!state.selectedList || !currentSchedule) {
      throw new Error('No list selected or schedule available');
    }

    updateState({ isSavingSchedule: true, error: null });

    try {
      // Create place toggles from current favorite places
      const placeToggles = favoritePlaces.reduce((acc, place) => {
        acc[place.id] = true; // All places enabled by default
        return acc;
      }, {} as Record<string, boolean>);

      const request = {
        archive_list_id: state.selectedList.id,
        schedule_name: options.name,
        schedule: currentSchedule,
        travel_mode: options.travelMode,
        start_time: options.startTime,
        end_time: options.endTime,
        place_toggles: placeToggles,
        replace_existing_slot: options.replaceSlotIndex
      };

      const result = await archiveScheduleService.saveSchedule(request);
      
      updateState({ 
        isSavingSchedule: false,
        saveDialogOpen: false,
        selectedList: null,
        scheduleSlotSelection: null
      });

      return result;
    } catch (error) {
      handleError(error, 'save schedule');
      throw error;
    }
  }, [state.selectedList, currentSchedule, favoritePlaces, updateState, handleError]);

  // View schedule
  const viewSchedule = useCallback(async (list: ArchivedList, scheduleId: string) => {
    updateState({ error: null });
    
    try {
      const schedule = await archiveScheduleService.getSchedule(list.id, scheduleId);
      updateState({
        selectedList: list,
        selectedSchedule: schedule,
        isViewingSchedule: true
      });
      return schedule;
    } catch (error) {
      handleError(error, 'load schedule');
      throw error;
    }
  }, [updateState, handleError]);

  // Close schedule view
  const closeScheduleView = useCallback(() => {
    updateState({
      selectedSchedule: null,
      isViewingSchedule: false,
      selectedList: null
    });
  }, [updateState]);

  // Update schedule metadata
  const updateScheduleMetadata = useCallback(async (
    listId: string, 
    scheduleId: string, 
    updates: Record<string, any>
  ) => {
    updateState({ error: null });
    
    try {
      await archiveScheduleService.updateSchedule(listId, scheduleId, updates);
      
      // Update local state if viewing this schedule
      if (state.selectedSchedule?.metadata.schedule_id === scheduleId) {
        updateState({
          selectedSchedule: {
            ...state.selectedSchedule,
            metadata: { ...state.selectedSchedule.metadata, ...updates }
          }
        });
      }
    } catch (error) {
      handleError(error, 'update schedule');
      throw error;
    }
  }, [state.selectedSchedule, updateState, handleError]);

  // Delete schedule
  const deleteSchedule = useCallback(async (listId: string, scheduleId: string) => {
    updateState({ error: null });
    
    try {
      await archiveScheduleService.deleteSchedule(listId, scheduleId);
      
      // Close view if deleting currently viewed schedule
      if (state.selectedSchedule?.metadata.schedule_id === scheduleId) {
        updateState({
          selectedSchedule: null,
          isViewingSchedule: false,
          selectedList: null
        });
      }
    } catch (error) {
      handleError(error, 'delete schedule');
      throw error;
    }
  }, [state.selectedSchedule, updateState, handleError]);

  // Get schedules for a list
  const getListSchedules = useCallback(async (listId: string) => {
    updateState({ error: null });
    
    try {
      return await archiveScheduleService.getArchiveSchedules(listId);
    } catch (error) {
      handleError(error, 'load schedules');
      throw error;
    }
  }, [updateState, handleError]);

  // Clear error
  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  return {
    // State
    ...state,
    
    // Actions
    openSaveDialog,
    closeSaveDialog,
    saveScheduleToArchive,
    viewSchedule,
    closeScheduleView,
    updateScheduleMetadata,
    deleteSchedule,
    getListSchedules,
    clearError,
    
    // Helpers
    helpers,
    
    // Computed
    canSaveCurrentSchedule: !!currentSchedule,
    hasSelectedList: !!state.selectedList,
    hasSelectedSchedule: !!state.selectedSchedule
  };
}; 