import { useState } from 'react';
import { MapContainer } from './pages/MapContainer';
import { Header } from './layout/Header';
import { ItineraryPanel } from './pages/ItineraryPanel';
import { AppProvider } from './context/AppContext';
import { ArchivedListsPage } from './pages/ArchivedListsPage';
import './styles/App.css';

function App() {
  const [mapCenter, setMapCenter] = useState({ lat: 40.7128, lng: -74.0060 });
  const [activeTab, setActiveTab] = useState<'saved' | 'search'>('search');
  const [view, setView] = useState<'map' | 'lists'>('map');
  return (
    <AppProvider>
      <div className="app">
        <Header
          mapCenter={mapCenter}
          onMyListsClick={() => setView('lists')}
          onLogoClick={() => setView('map')}
        />
        <main className="main-content">
          {view === 'map' ? (
            <>
              <MapContainer mapCenter={mapCenter} setMapCenter={setMapCenter} activeTab={activeTab} setActiveTab={setActiveTab} />
              <ItineraryPanel activeTab={activeTab} setActiveTab={setActiveTab} />
            </>
          ) : (
            <ArchivedListsPage onBack={() => setView('map')} />
          )}
        </main>
      </div>
    </AppProvider>
  );
}

export default App;