import { EmailDraftRepository } from '../../domain/repositories/EmailDraftRepository';

export class SupabaseEmailDraftRepository extends EmailDraftRepository {
  constructor(supabaseClient) {
    super();
    this.db = supabaseClient;
  }

  async create(draftData) {
    const { data, error } = await this.db
      .from('email_drafts')
      .insert(draftData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id, updates) {
    const { data, error } = await this.db
      .from('email_drafts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getByStatus(status, limit = 50) {
    const { data, error } = await this.db
      .from('email_drafts')
      .select(`
        id, subject, body, created_at, status,
        contact:contacts (id, first_name, last_name, email, institution:institutions(name))
      `)
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async getByContactId(contactId) {
    const { data, error } = await this.db
      .from('email_drafts')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getSentEmails(limit = 50) {
    return this.getByStatus('sent', limit);
  }

  async getCount(status) {
    const { count, error } = await this.db
      .from('email_drafts')
      .select('id', { count: 'exact' })
      .eq('status', status);

    if (error) throw error;
    return count || 0;
  }
}
