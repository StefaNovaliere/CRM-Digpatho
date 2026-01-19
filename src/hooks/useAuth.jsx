// src/hooks/useAuth.js
import { useState, useEffect, createContext, useContext } from 'react';
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

  // Funciones auxiliares definidas fuera del useEffect para que sean estables
  const loadProfile = async (userId) => {
    try {
      const { data, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      setProfile(data);

      if (data) {
        // Actualizar last_login sin bloquear
        await supabase
          .from('user_profiles')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', userId);
      }
    } catch (err) {
      console.warn('Error loading profile (puede ser normal si es login nuevo):', err);
      // No seteamos error global para no romper la UI
    }
  };

  const saveGoogleTokens = async (session) => {
    if (!session.user?.id || !session.provider_token) return;

    try {
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + (session.expires_in || 3600));

      // Importante: Esto fallará si no tienes la función RPC creada en Supabase,
      // pero el catch evitará que la app se cuelgue.
      await supabase.rpc('update_google_tokens', {
        p_user_id: session.user.id,
        p_access_token: session.provider_token,
        p_refresh_token: session.provider_refresh_token || null,
        p_expires_at: expiresAt.toISOString()
      });
    } catch (err) {
      console.warn('Error saving Google tokens:', err);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // 1. Obtener sesión inicial
        const { data: { session } } = await supabase.auth.getSession();

        if (mounted) {
          if (session?.user) {
            setUser(session.user);
            // Intentamos cargar perfil y tokens, pero capturamos errores individualmente
            await loadProfile(session.user.id).catch(e => console.warn(e));

            if (session.provider_token) {
              await saveGoogleTokens(session).catch(e => console.warn(e));
            }
          }
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
        if (mounted) setError(err.message);
      } finally {
        // 2. CRÍTICO: Pase lo que pase, dejamos de cargar
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // 3. Escuchar cambios de estado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('Auth event:', event);

        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          setLoading(false); // Asegurar que deje de cargar
          await loadProfile(session.user.id);

          if (session.provider_token) {
            await saveGoogleTokens(session);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && session) {
          setUser(session.user);
          // Actualizar tokens silenciosamente
          if (session.provider_token) {
            saveGoogleTokens(session);
          }
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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

  const signOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      throw signOutError;
    }
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates) => {
    if (!user?.id) return null;
    const { data, error: updateError } = await supabase
      .from('user_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) throw updateError;
    setProfile(data);
    return data;
  };

  const getGoogleAccessToken = async () => {
    if (!profile?.google_access_token) {
      // Si no hay perfil cargado, intentamos usar la sesión actual como fallback
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.provider_token) return session.provider_token;

      throw new Error('No hay token de Google disponible.');
    }

    // Lógica simple de expiración
    if (profile.google_token_expires_at) {
      const expiresAt = new Date(profile.google_token_expires_at);
      const now = new Date();
      // Si expira en menos de 5 min, refrescar
      if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
        const { data: { session }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !session?.provider_token) {
          throw new Error('No se pudo refrescar el token.');
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