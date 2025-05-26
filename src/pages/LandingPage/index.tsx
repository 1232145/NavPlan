import React, { useEffect, useRef, useState } from 'react';
import './index.css';
import { useAppContext } from '../../context/AppContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export const LandingPage: React.FC<{ onGoogleSignIn?: (user: any) => void }> = () => {
  const buttonDiv = useRef<HTMLDivElement>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [sdkError, setSdkError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const { setUser, checkSession } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    checkSession().then(valid => {
      if (valid) {
        navigate('/');
      }
    });

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
  }, []);

  async function handleGoogleSignIn(credential: string) {
    try {
      const res = await axios.post(
        'http://localhost:8000/api/auth/google',
        { token: credential },
        { withCredentials: true }
      );
      setUser(res.data.user);
      navigate('/');
    } catch (err) {
      setAuthError('Failed to authenticate with server.');
      setUser(null);
    }
  }

  return (
    <div className="landing-root">
      <div className="landing-content">
        <h1 className="landing-logo">Nav Plan</h1>
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
};

export default LandingPage; 