import { useState, useCallback } from 'react';

export interface ScheduleGenerationOptions {
  startTime: string;
  endTime: string;
  prompt: string;
  includeCurrentLocation: boolean;
  preferences: {
    mustInclude: string[];
    balanceMode: 'focused' | 'balanced' | 'diverse';
    maxPlaces: number;
    mealRequirements: boolean;
  };
}

interface UseScheduleGenerationState {
  currentStep: number;
  startTime: string;
  endTime: string;
  prompt: string;
  includeCurrentLocation: boolean;
  mustInclude: string[];
  balanceMode: 'focused' | 'balanced' | 'diverse';
  maxPlaces: number;
  mealRequirements: boolean;
}

interface UseScheduleGenerationReturn extends UseScheduleGenerationState {
  // Step navigation
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  
  // Form updates
  setStartTime: (time: string) => void;
  setEndTime: (time: string) => void;
  setPrompt: (prompt: string) => void;
  setIncludeCurrentLocation: (include: boolean) => void;
  setMustInclude: (categories: string[]) => void;
  setBalanceMode: (mode: 'focused' | 'balanced' | 'diverse') => void;
  setMaxPlaces: (max: number) => void;
  setMealRequirements: (required: boolean) => void;
  
  // Validation
  canProceedToStep2: boolean;
  
  // Form data
  getFormData: () => ScheduleGenerationOptions;
  resetForm: () => void;
}

const initialState: UseScheduleGenerationState = {
  currentStep: 1,
  startTime: '09:00',
  endTime: '19:00',
  prompt: '',
  includeCurrentLocation: true,
  mustInclude: [],
  balanceMode: 'balanced',
  maxPlaces: 12,
  mealRequirements: false,
};

export const useScheduleGeneration = (): UseScheduleGenerationReturn => {
  const [state, setState] = useState<UseScheduleGenerationState>(initialState);

  // State update helper
  const updateState = useCallback((updates: Partial<UseScheduleGenerationState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Step navigation
  const nextStep = useCallback(() => {
    setState(prev => ({ ...prev, currentStep: Math.min(prev.currentStep + 1, 2) }));
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => ({ ...prev, currentStep: Math.max(prev.currentStep - 1, 1) }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setState(prev => ({ ...prev, currentStep: Math.max(1, Math.min(step, 2)) }));
  }, []);

  // Form field setters
  const setStartTime = useCallback((time: string) => {
    updateState({ startTime: time });
  }, [updateState]);

  const setEndTime = useCallback((time: string) => {
    updateState({ endTime: time });
  }, [updateState]);

  const setPrompt = useCallback((prompt: string) => {
    updateState({ prompt });
  }, [updateState]);

  const setIncludeCurrentLocation = useCallback((include: boolean) => {
    updateState({ includeCurrentLocation: include });
  }, [updateState]);

  const setMustInclude = useCallback((categories: string[]) => {
    updateState({ mustInclude: categories });
  }, [updateState]);

  const setBalanceMode = useCallback((mode: 'focused' | 'balanced' | 'diverse') => {
    updateState({ balanceMode: mode });
  }, [updateState]);

  const setMaxPlaces = useCallback((max: number) => {
    updateState({ maxPlaces: max });
  }, [updateState]);

  const setMealRequirements = useCallback((required: boolean) => {
    updateState({ mealRequirements: required });
  }, [updateState]);

  // Validation
  const canProceedToStep2 = state.startTime !== '' && state.endTime !== '';

  // Form data getter
  const getFormData = useCallback((): ScheduleGenerationOptions => ({
    startTime: state.startTime,
    endTime: state.endTime,
    prompt: state.prompt,
    includeCurrentLocation: state.includeCurrentLocation,
    preferences: {
      mustInclude: state.mustInclude,
      balanceMode: state.balanceMode,
      maxPlaces: state.maxPlaces,
      mealRequirements: state.mealRequirements,
    }
  }), [state]);

  // Reset form
  const resetForm = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    nextStep,
    prevStep,
    goToStep,
    setStartTime,
    setEndTime,
    setPrompt,
    setIncludeCurrentLocation,
    setMustInclude,
    setBalanceMode,
    setMaxPlaces,
    setMealRequirements,
    canProceedToStep2,
    getFormData,
    resetForm,
  };
}; 