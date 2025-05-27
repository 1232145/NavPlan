import React, { useRef, useEffect, useState } from 'react';
import './index.css';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
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

  const handleSignOut = async () => {
    await api.post('/logout');
    setUser(null);
    navigate('/');
  };

  if (!user) {
    return (
      <div className="landing-page-root">
        <div className="landing-page-content">
          <h1 className="landing-page-logo">Nav Plan</h1>
          {loading && <div style={{ marginTop: 24 }}>Loading Google Login...</div>}
          {sdkError && !sdkLoaded && (
            <div style={{ color: 'red', marginTop: 24 }}>
              Failed to load Google Login. Please refresh or check your connection.
              <br />
              <button style={{ marginTop: 12 }} onClick={() => window.location.reload()}>Retry</button>
            </div>
          )}
          {authError && <div style={{ color: 'red', marginTop: 16 }}>{authError}</div>}
          <div ref={buttonDiv}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-page-root">
      <div className="landing-page-content">
        <h1 className="landing-page-logo">Nav Plan</h1>
        <button className="landing-login-btn" onClick={() => navigate('/map')}>
          Go to Map
        </button>
        <button className="landing-login-btn" onClick={handleSignOut} style={{ background: '#d32f2f' }}>
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default LandingPage; 