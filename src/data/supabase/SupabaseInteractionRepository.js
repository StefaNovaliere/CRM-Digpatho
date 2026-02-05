import { InteractionRepository } from '../../domain/repositories/InteractionRepository';

export class SupabaseInteractionRepository extends InteractionRepository {
  constructor(supabaseClient) {
    super();
    this.db = supabaseClient;
  }

  async getByContactId(contactId) {
    const { data, error } = await this.db
      .from('interactions')
      .select('*')
      .eq('contact_id', contactId)
      .order('occurred_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getRecentByContactId(contactId, limit = 5) {
    const { data, error } = await this.db
      .from('interactions')
      .select('*')
      .eq('contact_id', contactId)
      .order('occurred_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async create(interactionData) {
    const { data, error } = await this.db
      .from('interactions')
      .insert([interactionData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id, updates) {
    const { data, error } = await this.db
      .from('interactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id) {
    const { error } = await this.db
      .from('interactions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getThreadIds(contactId) {
    const { data, error } = await this.db
      .from('interactions')
      .select('thread_id')
      .eq('contact_id', contactId)
      .not('thread_id', 'is', null);

    if (error) throw error;
    return [...new Set((data || []).map(t => t.thread_id))];
  }

  async existsByGmailId(gmailId) {
    const { data, error } = await this.db
      .from('interactions')
      .select('id')
      .eq('gmail_id', gmailId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }

  async getEmailStatusByContacts() {
    const { data, error } = await this.db
      .from('interactions')
      .select('contact_id, type, direction')
      .in('type', ['email_sent', 'email_reply']);

    if (error) throw error;
    return data || [];
  }
}
