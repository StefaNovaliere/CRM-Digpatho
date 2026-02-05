import { ContactRepository } from '../../domain/repositories/ContactRepository';

export class SupabaseContactRepository extends ContactRepository {
  constructor(supabaseClient) {
    super();
    this.db = supabaseClient;
  }

  async getAll(filters = {}) {
    let query = this.db
      .from('contacts')
      .select(`*, institution:institutions(id, name, city, type)`)
      .order('created_at', { ascending: false });

    if (filters.interest_level && filters.interest_level !== 'all') {
      query = query.eq('interest_level', filters.interest_level);
    }
    if (filters.role && filters.role !== 'all') {
      query = query.eq('role', filters.role);
    }
    if (filters.institution_id && filters.institution_id !== 'all') {
      query = query.eq('institution_id', filters.institution_id);
    }
    if (filters.search) {
      query = query.or(
        `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getById(id) {
    const { data, error } = await this.db
      .from('contacts')
      .select(`*, institution:institutions(*)`)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async create(contactData) {
    const { data, error } = await this.db
      .from('contacts')
      .insert([contactData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id, updates) {
    const { data, error } = await this.db
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id) {
    const { error } = await this.db
      .from('contacts')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getByInstitution(institutionId) {
    const { data, error } = await this.db
      .from('contacts')
      .select('institution_id')
      .eq('institution_id', institutionId);

    if (error) throw error;
    return data || [];
  }
}
