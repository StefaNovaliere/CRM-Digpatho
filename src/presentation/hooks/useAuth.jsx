/**
 * useAuth hook - refactored to use repository pattern.
 * Auth context provider with Google OAuth and profile management.
 */
import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { useRepository } from './useRepository';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const authRepo = useRepository('authRepository');
  const profileRepo = useRepository('userProfileRepository');

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) return null;

    try {
      const data = await profileRepo.getById(userId);
      setProfile(data);

      if (data) {
        profileRepo.updateLastLogin(userId).catch(() => {});
      }

      return data;
    } catch (err) {
      console.error('Error loading profile:', err);
      setProfile(null);
      return null;
    }
  }, [profileRepo]);

  const saveGoogleTokens = useCallback(async (session) => {
    if (!session?.user?.id || !session?.provider_token) return;

    try {
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (session.expires_in || 3600));

      await profileRepo.updateGoogleTokens(session.user.id, {
        access_token: session.provider_token,
        refresh_token: session.provider_refresh_token || null,
        expires_at: expiresAt.toISOString()
      });
    } catch (err) {
      console.warn('Error saving Google tokens (non-blocking):', err);
    }
  }, [profileRepo]);

  useEffect(() => {
    let mounted = true;
    let authSubscription = null;

    const initAuth = async () => {
      try {
        const session = await authRepo.getSession();

        if (session?.user) {
          if (mounted) {
            setUser(session.user);
            await loadProfile(session.user.id);

            if (session.provider_token) {
              saveGoogleTokens(session);
            }
          }
        } else {
          if (mounted) {
            setUser(null);
            setProfile(null);
          }
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    authSubscription = authRepo.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      switch (event) {
        case 'SIGNED_IN':
          if (session?.user) {
            setUser(session.user);
            loadProfile(session.user.id);
            if (session.provider_token) saveGoogleTokens(session);
          }
          break;
        case 'SIGNED_OUT':
          setUser(null);
          setProfile(null);
          break;
        case 'TOKEN_REFRESHED':
          if (session?.user) {
            setUser(session.user);
            if (session.provider_token) saveGoogleTokens(session);
          }
          break;
        case 'USER_UPDATED':
          if (session?.user) {
            setUser(session.user);
            loadProfile(session.user.id);
          }
          break;
      }
    });

    return () => {
      mounted = false;
      if (authSubscription) authSubscription.unsubscribe();
    };
  }, [authRepo, loadProfile, saveGoogleTokens]);

  const signInWithGoogle = async () => {
    setError(null);
    return authRepo.signInWithGoogle();
  };

  const signOut = async () => {
    try {
      await authRepo.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setUser(null);
      setProfile(null);
    }
  };

  const updateProfile = async (updates) => {
    if (!user?.id) return null;
    const data = await profileRepo.update(user.id, updates);
    setProfile(data);
    return data;
  };

  const getGoogleAccessToken = async () => {
    if (!profile?.google_access_token) {
      throw new Error('No hay token de Google. Por favor, vuelve a iniciar sesión.');
    }

    if (profile.google_token_expires_at) {
      const expiresAt = new Date(profile.google_token_expires_at);
      if (expiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
        const session = await authRepo.refreshSession();
        if (!session?.provider_token) {
          throw new Error('No se pudo refrescar el token. Por favor, vuelve a iniciar sesión.');
        }
        await saveGoogleTokens(session);
        return session.provider_token;
      }
    }

    return profile.google_access_token;
  };

  const value = {
    user,
    profile,
    loading,
    error,
    isAuthenticated: !!user,
    signInWithGoogle,
    signOut,
    updateProfile,
    getGoogleAccessToken,
    refreshProfile: () => user?.id ? loadProfile(user.id) : Promise.resolve(null)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default useAuth;
