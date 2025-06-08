import React, { useState, useEffect } from 'react';
import './index.css';

interface LoadingScreenProps {
  message?: string;
}

// Travel tips to show during loading
const TRAVEL_TIPS = [
  "Try grouping nearby attractions to minimize travel time",
  "Schedule museums and indoor activities for rainy days",
  "The ideal day plan includes 5-7 main attractions",
  "Consider local food options for authentic experiences",
  "Morning hours are best for popular tourist attractions",
  "Allow extra time in your schedule for unexpected discoveries",
  "Local markets are great for experiencing the culture",
  "Walking between nearby attractions helps you discover hidden gems"
];

const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = "Optimizing your perfect day" }) => {
  const [tipIndex, setTipIndex] = useState(0);
  
  // Rotate through travel tips
  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % TRAVEL_TIPS.length);
    }, 4000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="loading-screen-overlay">
      <div className="loading-screen-content">
        <h2 className="loading-title">NavPlan</h2>
        
        {/* Map with route animation */}
        <div className="map-animation-container">
          <div className="map-circle">
            <div className="map-world"></div>
            <div className="map-details"></div>
            
            {/* Route lines */}
            <div className="route-line route-line-1"></div>
            <div className="route-line route-line-2"></div>
            <div className="route-line route-line-3"></div>
            
            {/* Location markers */}
            <div className="marker marker-1"></div>
            <div className="marker marker-2"></div>
            <div className="marker marker-3"></div>
            
            {/* Compass */}
            <div className="compass">
              <div className="compass-arrow"></div>
            </div>
          </div>
        </div>
        
        {/* Loading message with animated dots */}
        <div className="loading-message">
          {message}
        </div>
        <div className="loading-dots">
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
        </div>
        
        {/* Rotating travel tips */}
        <div className="loading-tips">
          {TRAVEL_TIPS[tipIndex]}
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen; 