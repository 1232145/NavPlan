import React from 'react';
import Header from '../Header';
import './index.css';
import { useNavigate } from 'react-router-dom';

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  return (
    <div className="main-layout">
      <Header
        mapCenter={undefined}
        onMyListsClick={() => navigate('/lists')}
        onLogoClick={() => navigate('/')}
      />
      <main className="main-content">{children}</main>
    </div>
  );
};

export default MainLayout; 