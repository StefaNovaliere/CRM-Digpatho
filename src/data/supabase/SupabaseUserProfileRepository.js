import { UserProfileRepository } from '../../domain/repositories/UserProfileRepository';

export class SupabaseUserProfileRepository extends UserProfileRepository {
  constructor(supabaseClient) {
    super();
    this.db = supabaseClient;
  }

  async getById(id) {
    const { data, error } = await this.db
      .from('user_profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      // PGRST116 = no rows returned (new user)
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  async update(id, updates) {
    const { data, error } = await this.db
      .from('user_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateGoogleTokens(userId, tokens) {
    // Try RPC first, then fall back to direct update
    const { error: rpcError } = await this.db.rpc('update_google_tokens', {
      p_user_id: userId,
      p_access_token: tokens.access_token,
      p_refresh_token: tokens.refresh_token || null,
      p_expires_at: tokens.expires_at
    });

    if (rpcError) {
      await this.db
        .from('user_profiles')
        .update({
          google_access_token: tokens.access_token,
          google_refresh_token: tokens.refresh_token || null,
          google_token_expires_at: tokens.expires_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
    }
  }

  async updateLastLogin(userId) {
    await this.db
      .from('user_profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', userId);
  }
}
