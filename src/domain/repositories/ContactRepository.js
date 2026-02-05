/**
 * ContactRepository interface - defines the contract for contact data access.
 * Implementations must fulfill all methods.
 * This is a pure domain contract - no framework or DB dependencies.
 */
export class ContactRepository {
  async getAll(filters = {}) { throw new Error('Not implemented'); }
  async getById(id) { throw new Error('Not implemented'); }
  async create(contactData) { throw new Error('Not implemented'); }
  async update(id, updates) { throw new Error('Not implemented'); }
  async delete(id) { throw new Error('Not implemented'); }
  async getByInstitution(institutionId) { throw new Error('Not implemented'); }
}
