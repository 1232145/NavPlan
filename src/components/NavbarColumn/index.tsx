import React from 'react';
import { Button } from '../Button';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { Map } from 'lucide-react';
import api from '../../services/api/axios';
import './index.css';

// We don't need props for now, but if we add them later, this is where they'd go
type NavbarColumnProps = Record<string, never>; // Empty props type

const NavbarColumn: React.FC<NavbarColumnProps> = () => {
  const navigate = useNavigate();
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

  return (
    <div className="navbar-column">
      <div className="navbar-logo" onClick={() => navigate('/')}>
        <Map size={28} />
        <h1>NavPlan</h1>
      </div>
      <Button size="md" onClick={() => navigate('/map')}>
        Map
      </Button>
      <Button size="md" onClick={handleMyListsClick}>
        My Lists
      </Button>
      <Button size="md" onClick={handleSignOut}>
        Sign Out
      </Button>
    </div>
  );
};

export default NavbarColumn; 