import { AuthRepository } from '../../domain/repositories/AuthRepository';

export class SupabaseAuthRepository extends AuthRepository {
  constructor(supabaseClient) {
    super();
    this.auth = supabaseClient.auth;
  }

  async getSession() {
    const { data: { session }, error } = await this.auth.getSession();
    if (error) throw error;
    return session;
  }

  async signInWithGoogle(options = {}) {
    const { data, error } = await this.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
        redirectTo: window.location.origin + '/dashboard',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        },
        ...options
      }
    });

    if (error) throw error;
    return data;
  }

  async signOut() {
    const { error } = await this.auth.signOut();
    if (error) throw error;
  }

  async refreshSession() {
    const { data: { session }, error } = await this.auth.refreshSession();
    if (error) throw error;
    return session;
  }

  onAuthStateChange(callback) {
    const { data: { subscription } } = this.auth.onAuthStateChange(callback);
    return subscription;
  }
}
