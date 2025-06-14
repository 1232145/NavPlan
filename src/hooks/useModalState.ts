import { useState, useCallback } from 'react';

/**
 * Custom hook for managing modal/dialog state
 * Reduces duplicate open/close state logic across components
 */
export const useModalState = (initialOpen: boolean = false) => {
  const [isOpen, setIsOpen] = useState(initialOpen);
  
  const openModal = useCallback(() => {
    setIsOpen(true);
  }, []);
  
  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);
  
  const toggleModal = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);
  
  return {
    isOpen,
    openModal,
    closeModal,
    toggleModal,
    setIsOpen
  };
}; 