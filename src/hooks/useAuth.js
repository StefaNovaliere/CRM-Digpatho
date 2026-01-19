// src/hooks/useAuth.js
import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';

// ========================================
// CONTEXT
// ========================================
const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ========================================
// PROVIDER
// ========================================
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cargar sesión inicial
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Obtener sesión actual
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          setUser(session.user);
          await loadProfile(session.user.id);

          // Guardar tokens de Google si vienen en la sesión
          if (session.provider_token) {
            await saveGoogleTokens(session);
          }
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          await loadProfile(session.user.id);

          // Guardar tokens de Google
          if (session.provider_token) {
            await saveGoogleTokens(session);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setUser(session.user);
          if (session.provider_token) {
            await saveGoogleTokens(session);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Cargar perfil del usuario
  const loadProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setProfile(data);

      // Actualizar último login
      if (data) {
        await supabase
          .from('user_profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', userId);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    }
  };

  // Guardar tokens de Google para Gmail API
  const saveGoogleTokens = async (session) => {
    if (!session.user?.id || !session.provider_token) return;

    try {
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (session.expires_in || 3600));

      await supabase.rpc('update_google_tokens', {
        p_user_id: session.user.id,
        p_access_token: session.provider_token,
        p_refresh_token: session.provider_refresh_token || null,
        p_expires_at: expiresAt.toISOString()
      });
    } catch (err) {
      console.error('Error saving Google tokens:', err);
    }
  };

  // Login con Google (incluye permisos de Gmail)
  const signInWithGoogle = async () => {
    setError(null);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
        redirectTo: `${window.location.origin}/dashboard`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });

    if (error) {
      setError(error.message);
      throw error;
    }

    return data;
  };

  // Logout
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError(error.message);
      throw error;
    }
    setUser(null);
    setProfile(null);
  };

  // Actualizar perfil
  const updateProfile = async (updates) => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    setProfile(data);
    return data;
  };

  // Obtener token de Google válido (refresh si es necesario)
  const getGoogleAccessToken = async () => {
    if (!profile?.google_access_token) {
      throw new Error('No hay token de Google. Por favor, vuelve a iniciar sesión.');
    }

    // Verificar si el token expiró
    if (profile.google_token_expires_at) {
      const expiresAt = new Date(profile.google_token_expires_at);
      const now = new Date();

      // Si expira en menos de 5 minutos, refrescar sesión
      if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
        const { data: { session }, error } = await supabase.auth.refreshSession();

        if (error || !session?.provider_token) {
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
    refreshProfile: () => user?.id && loadProfile(user.id)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default useAuth;