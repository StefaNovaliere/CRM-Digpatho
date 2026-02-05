import { BulkEmailRepository } from '../../domain/repositories/BulkEmailRepository';

export class SupabaseBulkEmailRepository extends BulkEmailRepository {
  constructor(supabaseClient) {
    super();
    this.db = supabaseClient;
  }

  async getCampaigns() {
    const { data, error } = await this.db
      .from('bulk_email_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getCampaignById(id) {
    const { data, error } = await this.db
      .from('bulk_email_campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async createCampaign(campaignData) {
    const { data, error } = await this.db
      .from('bulk_email_campaigns')
      .insert(campaignData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateCampaign(id, updates) {
    const { data, error } = await this.db
      .from('bulk_email_campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteCampaign(id) {
    const { error } = await this.db
      .from('bulk_email_campaigns')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getQueueByCampaignId(campaignId) {
    const { data, error } = await this.db
      .from('bulk_email_queue')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }
}
