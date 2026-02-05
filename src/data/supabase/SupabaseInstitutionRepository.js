import { InstitutionRepository } from '../../domain/repositories/InstitutionRepository';

export class SupabaseInstitutionRepository extends InstitutionRepository {
  constructor(supabaseClient) {
    super();
    this.db = supabaseClient;
  }

  async getAll() {
    const { data, error } = await this.db
      .from('institutions')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  }

  async getById(id) {
    const { data, error } = await this.db
      .from('institutions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async create(institutionData) {
    const { data, error } = await this.db
      .from('institutions')
      .insert([institutionData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id, updates) {
    const { data, error } = await this.db
      .from('institutions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id) {
    const { error } = await this.db
      .from('institutions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getContactCounts() {
    const { data, error } = await this.db
      .from('contacts')
      .select('institution_id');

    if (error) throw error;

    const counts = {};
    data?.forEach(c => {
      if (c.institution_id) {
        counts[c.institution_id] = (counts[c.institution_id] || 0) + 1;
      }
    });
    return counts;
  }
}
