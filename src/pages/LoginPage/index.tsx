import React, { useEffect, useRef, useState } from 'react';
import './index.css';
import axios from 'axios';
import { useAppContext } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

const LoginPage: React.FC = () => {
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
        navigate('/map');
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
      navigate('/map');
    } catch (err) {
      setAuthError('Failed to authenticate with server.');
      setUser(null);
    }
  }

  return (
    <div className="login-page-root">
      <div className="login-page-content">
        <h1 className="login-page-logo">Nav Plan</h1>
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

export default LoginPage; 