import React from 'react';
import './index.css';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = "Loading..." }) => {
  return (
    <div className="loading-screen-overlay">
      <div className="loading-screen-content">
        <div className="spinner"></div>
        <p>{message}</p>
      </div>
    </div>
  );
};

export default LoadingScreen; 