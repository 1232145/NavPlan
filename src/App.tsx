import { useEffect, useRef } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import MapPage from './pages/MapPage';
import ArchivedListsPage from './pages/ArchivedListsPage';
import LandingPage from './pages/LandingPage';
import ErrorPage from './pages/ErrorPage';
import MainLayout from './layout/MainLayout';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Outlet } from 'react-router-dom';
import './styles/App.css';

function SessionGuard({ children }: { children: React.ReactNode }) {
  const { user, checkSession, setUser } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    checkSession();
  }, [location.pathname]);

  // Set up periodic session check
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      checkSession();
    }, 30 * 60 * 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!user && location.pathname !== '/') {
      setUser(null);
      navigate('/');
    }
  }, [user, navigate, location.pathname, setUser]);

  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAppContext();
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LandingPage />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="/error" element={<ErrorPage />} />
      <Route element={<SessionGuard>
        <MainLayout>
          <Outlet />
        </MainLayout>
      </SessionGuard>}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/lists" element={<ArchivedListsPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;