import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import api from '../services/api/axios';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

interface UseGoogleAuthReturn {
  sdkLoaded: boolean;
  sdkError: boolean;
  loading: boolean;
  authError: string | null;
  buttonRef: React.RefObject<HTMLDivElement>;
  handleGoogleSignIn: (credential: string) => Promise<void>;
}

export const useGoogleAuth = (): UseGoogleAuthReturn => {
  const navigate = useNavigate();
  const { user, setUser } = useAppContext();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [sdkError, setSdkError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleSignIn = async (credential: string) => {
    try {
      const res = await api.post('/auth/google', { token: credential });
      setUser(res.data.user);
      navigate('/');
    } catch (err) {
      setAuthError('Failed to authenticate with server.');
      setUser(null);
    }
  };

  useEffect(() => {
    if (user) return;
    
    let timeout: ReturnType<typeof setTimeout>;
    let errorTimeout: ReturnType<typeof setTimeout>;
    
    function checkGoogleLoaded() {
      // @ts-ignore
      if (window.google && window.google.accounts && window.google.accounts.id && buttonRef.current) {
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
        window.google.accounts.id.renderButton(buttonRef.current, {
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
  }, [user, handleGoogleSignIn]);

  return {
    sdkLoaded,
    sdkError,
    loading,
    authError,
    buttonRef,
    handleGoogleSignIn
  };
}; 