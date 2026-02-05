import { NotificationRepository } from '../../domain/repositories/NotificationRepository';

export class SupabaseNotificationRepository extends NotificationRepository {
  constructor(supabaseClient) {
    super();
    this.db = supabaseClient;
  }

  async create(notificationData) {
    const { data, error } = await this.db
      .from('notifications')
      .insert(notificationData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getByUserId(userId) {
    const { data, error } = await this.db
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async markAsRead(id) {
    const { error } = await this.db
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) throw error;
  }
}
