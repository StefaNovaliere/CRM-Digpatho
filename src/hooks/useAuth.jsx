// src/hooks/useAuth.jsx
import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar perfil del usuario - CON MANEJO DE ERRORES ROBUSTO
  const loadProfile = useCallback(async (userId) => {
    // Si no hay userId, no hacer nada
    if (!userId) {
      console.log('loadProfile: No userId provided');
      return null;
    }

    try {
      const { data, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // PGRST116 = no rows returned (perfil no existe aún)
      if (profileError) {
        if (profileError.code === 'PGRST116') {
          // Perfil no existe - esto es normal para usuarios nuevos
          console.log('Profile not found for user, will be created on first login');
          setProfile(null);
          return null;
        }
        // Otro error (ej: tabla no existe, RLS, etc.)
        console.error('Error loading profile:', profileError);
        setProfile(null);
        return null;
      }

      setProfile(data);

      // Actualizar último login (fire and forget, no esperamos)
      if (data) {
        supabase
          .from('user_profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', userId)
          .then(() => {})
          .catch((err) => console.warn('Could not update last_login_at:', err));
      }

      return data;
    } catch (err) {
      console.error('Unexpected error loading profile:', err);
      setProfile(null);
      return null;
    }
  }, []);

  // Guardar tokens de Google para Gmail API
  const saveGoogleTokens = useCallback(async (session) => {
    if (!session?.user?.id || !session?.provider_token) return;

    try {
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (session.expires_in || 3600));

      // Intentar con RPC primero
      const { error: rpcError } = await supabase.rpc('update_google_tokens', {
        p_user_id: session.user.id,
        p_access_token: session.provider_token,
        p_refresh_token: session.provider_refresh_token || null,
        p_expires_at: expiresAt.toISOString()
      });

      if (rpcError) {
        // Si la función RPC no existe, intentar update directo
        console.warn('RPC update_google_tokens failed, trying direct update:', rpcError);

        await supabase
          .from('user_profiles')
          .update({
            google_access_token: session.provider_token,
            google_refresh_token: session.provider_refresh_token || null,
            google_token_expires_at: expiresAt.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', session.user.id);
      }
    } catch (err) {
      // No bloquear la app si falla guardar tokens
      console.warn('Error saving Google tokens (non-blocking):', err);
    }
  }, []);

  // Inicialización - SOLO UNA VEZ
  useEffect(() => {
    let mounted = true;
    let authSubscription = null;

    const initAuth = async () => {
      try {
        console.log('Initializing auth...');

        // Obtener sesión actual
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Error getting session:', sessionError);
          if (mounted) {
            setUser(null);
            setProfile(null);
            setLoading(false);
          }
          return;
        }

        if (session?.user) {
          console.log('Session found for user:', session.user.email);
          if (mounted) {
            setUser(session.user);
            await loadProfile(session.user.id);

            // Guardar tokens de Google si vienen en la sesión
            if (session.provider_token) {
              saveGoogleTokens(session);
            }
          }
        } else {
          console.log('No active session');
          if (mounted) {
            setUser(null);
            setProfile(null);
          }
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        if (mounted) {
          setError(err.message);
        }
      } finally {
        // SIEMPRE setear loading a false
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);

        // Ignorar eventos si el componente está desmontado
        if (!mounted) return;

        switch (event) {
          case 'SIGNED_IN':
            if (session?.user) {
              setUser(session.user);
              // No bloquear - cargar perfil en background
              loadProfile(session.user.id);
              if (session.provider_token) {
                saveGoogleTokens(session);
              }
            }
            break;

          case 'SIGNED_OUT':
            setUser(null);
            setProfile(null);
            break;

          case 'TOKEN_REFRESHED':
            if (session?.user) {
              setUser(session.user);
              if (session.provider_token) {
                saveGoogleTokens(session);
              }
            }
            break;

          case 'USER_UPDATED':
            if (session?.user) {
              setUser(session.user);
              loadProfile(session.user.id);
            }
            break;

          default:
            // Otros eventos (INITIAL_SESSION, etc.) - no hacer nada especial
            break;
        }
      }
    );

    authSubscription = subscription;

    return () => {
      mounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, [loadProfile, saveGoogleTokens]);

  // Login con Google
  const signInWithGoogle = async () => {
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
        redirectTo: window.location.origin + '/dashboard',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });

    if (signInError) {
      setError(signInError.message);
      throw signInError;
    }

    return data;
  };

  // Logout
  const signOut = async () => {
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error('Sign out error:', signOutError);
      }
    } catch (err) {
      console.error('Unexpected sign out error:', err);
    } finally {
      // Siempre limpiar el estado local
      setUser(null);
      setProfile(null);
    }
  };

  // Actualizar perfil
  const updateProfile = async (updates) => {
    if (!user?.id) return null;

    const { data, error: updateError } = await supabase
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) throw updateError;
    setProfile(data);
    return data;
  };

  // Obtener token de Google válido
  const getGoogleAccessToken = async () => {
    if (!profile?.google_access_token) {
      throw new Error('No hay token de Google. Por favor, vuelve a iniciar sesión.');
    }

    if (profile.google_token_expires_at) {
      const expiresAt = new Date(profile.google_token_expires_at);
      const now = new Date();

      // Si expira en menos de 5 minutos, refrescar sesión
      if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !session?.provider_token) {
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