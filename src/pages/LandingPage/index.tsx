import React, { useRef, useEffect, useState } from 'react';
import './index.css';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { Map, Navigation, Calendar, Heart, Star, MapPin } from 'lucide-react';
import api from '../../services/api/axios';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAppContext();
  const buttonDiv = useRef<HTMLDivElement>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [sdkError, setSdkError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (user) return;
    let timeout: ReturnType<typeof setTimeout>;
    let errorTimeout: ReturnType<typeof setTimeout>;
    function checkGoogleLoaded() {
      // @ts-ignore
      if (window.google && window.google.accounts && window.google.accounts.id && buttonDiv.current) {
        setSdkLoaded(true);
        setLoading(false);
        setSdkError(false);
        // @ts-ignore
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: any) => {
            setAuthError(null);
            handleGoogleSignIn(response.credential);
          },
        });
        // @ts-ignore
        window.google.accounts.id.renderButton(buttonDiv.current, {
          theme: 'outline',
          size: 'large',
          width: 260,
        });
      } else {
        timeout = setTimeout(checkGoogleLoaded, 200);
      }
    }
    setLoading(true);
    setSdkError(false);
    checkGoogleLoaded();
    errorTimeout = setTimeout(() => {
      setSdkError(true);
      setLoading(false);
    }, 10000);
    return () => {
      clearTimeout(timeout);
      clearTimeout(errorTimeout);
    };
  }, [user]);

  async function handleGoogleSignIn(credential: string) {
    try {
      const res = await api.post('/auth/google', { token: credential });
      setUser(res.data.user);
      navigate('/');
    } catch (err) {
      setAuthError('Failed to authenticate with server.');
      setUser(null);
    }
  }

  if (!user) {
    return (
      <div className="landing-page-root">
        <div className="landing-page-content">
          <h1 className="landing-page-title">Plan Your Perfect Journey</h1>
          <p className="landing-page-subtitle">
            Discover amazing places, create custom itineraries, and make every trip unforgettable with NavPlan's intelligent travel planning.
          </p>
          
          <div className="landing-features">
            <div className="landing-feature">
              <MapPin />
              <span>Discover Places</span>
            </div>
            <div className="landing-feature">
              <Calendar />
              <span>Smart Itineraries</span>
            </div>
            <div className="landing-feature">
              <Navigation />
              <span>Easy Navigation</span>
            </div>
            <div className="landing-feature">
              <Heart />
              <span>Save Favorites</span>
            </div>
          </div>

          {loading && (
            <div className="loading-message">
              <div className="loading-spinner"></div>
              <span>Loading Google Sign-In...</span>
            </div>
          )}
          
          {sdkError && !sdkLoaded && (
            <div className="error-message">
              <p>Failed to load Google Sign-In. Please refresh or check your connection.</p>
              <button 
                className="retry-button" 
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          )}
          
          {authError && (
            <div className="auth-error">
              {authError}
            </div>
          )}
          
          <div ref={buttonDiv} className="google-signin-container"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-page-root">
      <div className="landing-page-content">
        <h1 className="landing-page-title">Welcome to NavPlan!</h1>
        <p className="landing-page-subtitle">
          Ready to continue planning your next adventure? Let's explore new places and create amazing itineraries.
        </p>
        
        <div className="landing-features">
          <div className="landing-feature">
            <Map />
            <span>Interactive Maps</span>
          </div>
          <div className="landing-feature">
            <Star />
            <span>Curated Lists</span>
          </div>
          <div className="landing-feature">
            <Calendar />
            <span>Schedule Trips</span>
          </div>
        </div>

        <button className="landing-login-btn" onClick={() => navigate('/map')}>
          <Map size={20} />
          <span>Explore Map</span>
        </button>
      </div>
    </div>
  );
};

export default LandingPage; 