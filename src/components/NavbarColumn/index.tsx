import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { Map, List, LogOut, Home, Sparkles } from 'lucide-react';
import api from '../../services/api/axios';
import './index.css';

// We don't need props for now, but if we add them later, this is where they'd go
type NavbarColumnProps = Record<string, never>; // Empty props type

const NavbarColumn: React.FC<NavbarColumnProps> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser } = useAppContext();

  const handleMyListsClick = () => {
    navigate('/lists');
  };

  const handleSignOut = async () => {
    try {
      await api.post('/logout');
      setUser(null);
      navigate('/');
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  // Helper function to determine if a menu item is active
  const isActive = (path: string) => {
    if (path === '/map') {
      return location.pathname === '/map';
    }
    if (path === '/lists') {
      return location.pathname.startsWith('/lists') || location.pathname.includes('archived');
    }
    if (path === '/') {
      return location.pathname === '/';
    }
    return false;
  };

  return (
    <div className="navbar-column">
      <div className="navbar-header">
        <div className="navbar-logo" onClick={() => navigate('/')}>
          <div className="logo-icon">
            <Map size={32} />
            <div className="logo-sparkle">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="logo-text">
            <h1>NavPlan</h1>
            <span className="logo-subtitle">Explore & Plan</span>
          </div>
        </div>
      </div>
      
      <div className="navbar-menu">
        <div className="menu-section">
          <div 
            className={`menu-item ${isActive('/map') ? 'active' : ''}`} 
            onClick={() => navigate('/map')}
          >
            <Map size={20} />
            <span>Explore Map</span>
            <div className="menu-item-glow"></div>
          </div>
          
          <div 
            className={`menu-item ${isActive('/lists') ? 'active' : ''}`} 
            onClick={handleMyListsClick}
          >
            <List size={20} />
            <span>Generate Schedule</span>
            <div className="menu-item-glow"></div>
          </div>
          
          <div 
            className={`menu-item ${isActive('/') ? 'active' : ''}`} 
            onClick={() => navigate('/')}
          >
            <Home size={20} />
            <span>Home</span>
            <div className="menu-item-glow"></div>
          </div>
        </div>
      </div>
      
      <div className="navbar-footer">
        <div className="menu-item logout" onClick={handleSignOut}>
          <LogOut size={20} />
          <span>Sign Out</span>
          <div className="menu-item-glow"></div>
        </div>
      </div>
    </div>
  );
};

export default NavbarColumn; 