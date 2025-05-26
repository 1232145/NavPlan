import { useEffect, useRef } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import MapPage from './pages/MapPage';
import ArchivedListsPage from './pages/ArchivedListsPage';
import LandingPage from './pages/LandingPage';
import ErrorPage from './pages/ErrorPage';
import MainLayout from './layout/MainLayout';
import './styles/App.css';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Outlet } from 'react-router-dom';
import LoginPage from './pages/LoginPage';

function SessionGuard({ children }: { children: React.ReactNode }) {
  const { sessionExpired, checkSession, setUser } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check session on route change (except error page)
  useEffect(() => {
    const isError = location.pathname === '/error';
    console.log('Checking session on route change');
    if (!isError) {
      checkSession();
    }
  }, [location.pathname]);

  // Set up periodic session check only once on mount
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      console.log('Checking session...');
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
          <Route path="/login" element={<LoginPage />} />
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
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;