import React, { useState, useRef, useEffect } from 'react';
import { Map, LogOut } from 'lucide-react';
import './index.css';
import { Button } from '../../components/Button';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import api from '../../services/api/axios';

export interface HeaderProps {
  onMyListsClick: () => void;
  onLogoClick: () => void;
}

// --- Main Component ---
const Header: React.FC<HeaderProps> = ({ onMyListsClick, onLogoClick }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser, user } = useAppContext();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMapPage = location.pathname === '/map';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleGoToMap = () => {
    navigate('/map');
  };

  const handleSignOut = async () => {
    try {
      await api.post('/logout');
      setUser(null);
      navigate('/');
      setIsDropdownOpen(false);
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <header className={`header ${isMapPage ? 'map-page' : ''}`}>
      <div className="header-content">
        <div className="logo" style={{ cursor: 'pointer' }} onClick={onLogoClick}>
          <Map size={28} />
          <h1>NavPlan</h1>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Button variant="primary" size="md" onClick={handleGoToMap}>
            Explore map
          </Button>
          <Button variant="primary" size="md" onClick={onMyListsClick}>
            Generate Schedule
          </Button>
          {user?.picture && (
            <div className="user-avatar-container" ref={dropdownRef}>
              <div className="user-avatar" onClick={toggleDropdown}>
                <img 
                  src={user.picture} 
                  alt={user.name || 'User avatar'} 
                  className="avatar-image"
                />
              </div>
              {isDropdownOpen && (
                <div className="avatar-dropdown">
                  <div className="dropdown-header">
                    <div className="user-info">
                      <img 
                        src={user.picture} 
                        alt={user.name || 'User avatar'} 
                        className="dropdown-avatar"
                      />
                      <div className="user-details">
                        <div className="user-name">{user.name}</div>
                        <div className="user-email">{user.email}</div>
                      </div>
                    </div>
                  </div>
                  <div className="dropdown-divider"></div>
                  <div className="dropdown-item" onClick={handleSignOut}>
                    <LogOut size={16} />
                    <span>Sign Out</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;