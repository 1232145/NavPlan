import { useState, useCallback } from 'react';

/**
 * Custom hook for handling image loading errors
 * Reduces duplicate imageError state across components
 */
export const useImageError = (initialError: boolean = false) => {
  const [imageError, setImageError] = useState(initialError);
  
  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);
  
  const resetImageError = useCallback(() => {
    setImageError(false);
  }, []);
  
  return {
    imageError,
    handleImageError,
    resetImageError,
    setImageError
  };
}; 