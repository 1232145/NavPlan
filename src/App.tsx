import { useEffect } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import MapPage from './pages/MapPage';
import ArchivedListsPage from './pages/ArchivedListsPage';
import LandingPage from './pages/LandingPage';
import ErrorPage from './pages/ErrorPage';
import MainLayout from './layout/MainLayout';
import './styles/App.css';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Outlet } from 'react-router-dom';

function SessionGuard({ children }: { children: React.ReactNode }) {
  const { sessionExpired, checkSession, setUser } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    const isError = location.pathname === '/error';
    if (!isError) {
      // Initial check
      checkSession();
      // Periodic check every 30 minutes
      interval = setInterval(() => {
        checkSession();
      }, 30 * 60 * 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [location.pathname, checkSession]);

  useEffect(() => {
    if (sessionExpired && location.pathname !== '/login') {
      setUser(null);
      navigate('/login');
    }
  }, [sessionExpired, navigate, location.pathname, setUser]);

  return <>{children}</>;
}

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/error" element={<ErrorPage />} />
          <Route path="/login" element={<LandingPage />} />
          <Route element={<SessionGuard>
            <MainLayout>
              <Outlet />
            </MainLayout>
          </SessionGuard>}>
            <Route path="/" element={<MapPage />} />
            <Route path="/lists" element={<ArchivedListsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;