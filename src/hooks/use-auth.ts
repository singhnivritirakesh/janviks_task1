import { useState, useEffect, useCallback, createContext, useContext, ReactNode, createElement } from 'react';
import { api, setAccessToken, User, UserProfile } from '../lib/api';

export interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isVenueManager: boolean;
  login: (credentials: { email: string; password: string }) => Promise<{
    requireMfa?: boolean;
    preAuthToken?: string;
  }>;
  register: (details: { email: string; password: string; fullName: string; role?: string }) => Promise<void>;
  verifyMfa: (challenge: { preAuthToken: string; code: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async () => {
    try {
      const me = await api.auth.getMe();
      setUser(me.user);
      setProfile(me.profile);
    } catch {
      setUser(null);
      setProfile(null);
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check initial session via silent refresh with HttpOnly cookie
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        const res = await api.auth.refresh();
        if (res.accessToken && isMounted) {
          setAccessToken(res.accessToken);
          await fetchProfile();
        } else if (isMounted) {
          setLoading(false);
        }
      } catch {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, [fetchProfile]);

  const login = useCallback(async (credentials: { email: string; password: string }) => {
    setLoading(true);
    try {
      const res = await api.auth.login(credentials);

      if (res.requireMfa && res.preAuthToken) {
        setLoading(false);
        return { requireMfa: true, preAuthToken: res.preAuthToken };
      }

      if (res.accessToken && res.user) {
        setAccessToken(res.accessToken);
        setUser(res.user);
        await fetchProfile();
      }
      return { requireMfa: false };
    } finally {
      setLoading(false);
    }
  }, [fetchProfile]);

  const register = useCallback(async (details: {
    email: string;
    password: string;
    fullName: string;
    role?: string;
  }) => {
    await api.auth.register(details);
  }, []);

  const verifyMfa = useCallback(async (challenge: { preAuthToken: string; code: string }) => {
    setLoading(true);
    try {
      const res = await api.auth.mfaChallenge(challenge);
      setAccessToken(res.accessToken);
      setUser(res.user);
      await fetchProfile();
    } finally {
      setLoading(false);
    }
  }, [fetchProfile]);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setAccessToken(null);
      setUser(null);
      setProfile(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  const value: AuthContextType = {
    user,
    profile,
    loading,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === 'admin',
    isVenueManager: user?.role === 'venue_manager' || user?.role === 'admin',
    login,
    register,
    verifyMfa,
    logout,
    refreshUser,
  };

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
