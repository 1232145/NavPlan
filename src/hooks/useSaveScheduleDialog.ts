import { useState, useEffect, useCallback } from 'react';
import { ArchivedList, TravelMode } from '../types';

interface SaveScheduleFormData {
  scheduleName: string;
  travelMode: TravelMode;
  startTime: string;
  endTime: string;
  replaceSlot: number | null;
}

interface UseSaveScheduleDialogState {
  formData: SaveScheduleFormData;
  validationErrors: Record<string, string>;
}

interface UseSaveScheduleDialogReturn extends UseSaveScheduleDialogState {
  // Form updates
  updateFormData: (field: keyof SaveScheduleFormData, value: any) => void;
  
  // Validation
  validateForm: () => boolean;
  clearValidationErrors: () => void;
  
  // Form management
  resetForm: (selectedList?: ArchivedList | null, suggestedSlot?: number | null) => void;
  getFormData: () => SaveScheduleFormData;
  
  // Computed properties
  isFormValid: boolean;
  hasValidationErrors: boolean;
}

const getDefaultScheduleName = (selectedList: ArchivedList | null, slotNumber: number | null): string => {
  if (!selectedList) return '';
  
  const slotNames = ['Morning Route', 'Afternoon Route', 'Evening Route'];
  const baseSlotName = slotNumber && slotNumber >= 1 && slotNumber <= 3 
    ? slotNames[slotNumber - 1] 
    : 'New Route';
  
  return `${selectedList.name} - ${baseSlotName}`;
};

const initialFormData: SaveScheduleFormData = {
  scheduleName: '',
  travelMode: 'walking' as TravelMode,
  startTime: '09:00',
  endTime: '19:00',
  replaceSlot: null,
};

export const useSaveScheduleDialog = (
  selectedList?: ArchivedList | null,
  suggestedSlot?: number | null
): UseSaveScheduleDialogReturn => {
  const [state, setState] = useState<UseSaveScheduleDialogState>({
    formData: initialFormData,
    validationErrors: {},
  });

  // Initialize form when selectedList or suggestedSlot changes
  useEffect(() => {
    if (selectedList) {
      const defaultName = getDefaultScheduleName(selectedList, suggestedSlot || null);
      setState(prev => ({
        ...prev,
        formData: {
          ...prev.formData,
          scheduleName: defaultName,
          replaceSlot: suggestedSlot || null,
        },
        validationErrors: {}
      }));
    }
  }, [selectedList, suggestedSlot]);

  // Form validation
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    
    if (!state.formData.scheduleName.trim()) {
      errors.scheduleName = 'Schedule name is required';
    } else if (state.formData.scheduleName.length > 100) {
      errors.scheduleName = 'Schedule name must be less than 100 characters';
    }
    
    if (!state.formData.startTime) {
      errors.startTime = 'Start time is required';
    }
    
    if (!state.formData.endTime) {
      errors.endTime = 'End time is required';
    }
    
    // Validate time range (minimum 2 hours)
    if (state.formData.startTime && state.formData.endTime) {
      const [startHour, startMin] = state.formData.startTime.split(':').map(Number);
      const [endHour, endMin] = state.formData.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      if (endMinutes <= startMinutes) {
        errors.endTime = 'End time must be after start time';
      } else if (endMinutes - startMinutes < 120) {
        errors.endTime = 'Schedule must be at least 2 hours long';
      }
    }
    
    setState(prev => ({ ...prev, validationErrors: errors }));
    return Object.keys(errors).length === 0;
  }, [state.formData]);

  // Clear validation errors
  const clearValidationErrors = useCallback(() => {
    setState(prev => ({ ...prev, validationErrors: {} }));
  }, []);

  // Update form data
  const updateFormData = useCallback((field: keyof SaveScheduleFormData, value: any) => {
    setState(prev => {
      const newValidationErrors = { ...prev.validationErrors };
      delete newValidationErrors[field];
      return {
        ...prev,
        formData: { ...prev.formData, [field]: value },
        validationErrors: newValidationErrors
      };
    });
  }, []);

  // Reset form
  const resetForm = useCallback((newSelectedList?: ArchivedList | null, newSuggestedSlot?: number | null) => {
    const defaultName = getDefaultScheduleName(newSelectedList || null, newSuggestedSlot || null);
    setState({
      formData: {
        ...initialFormData,
        scheduleName: defaultName,
        replaceSlot: newSuggestedSlot || null,
      },
      validationErrors: {}
    });
  }, []);

  // Get form data
  const getFormData = useCallback(() => state.formData, [state.formData]);

  // Computed properties
  const isFormValid = Object.keys(state.validationErrors).length === 0 && 
    state.formData.scheduleName.trim() !== '' &&
    state.formData.startTime !== '' &&
    state.formData.endTime !== '';

  const hasValidationErrors = Object.keys(state.validationErrors).length > 0;

  return {
    ...state,
    updateFormData,
    validateForm,
    clearValidationErrors,
    resetForm,
    getFormData,
    isFormValid,
    hasValidationErrors,
  };
}; 