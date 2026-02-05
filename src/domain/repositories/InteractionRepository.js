/**
 * InteractionRepository interface - defines the contract for interaction data access.
 */
export class InteractionRepository {
  async getByContactId(contactId) { throw new Error('Not implemented'); }
  async getRecentByContactId(contactId, limit = 5) { throw new Error('Not implemented'); }
  async create(interactionData) { throw new Error('Not implemented'); }
  async update(id, updates) { throw new Error('Not implemented'); }
  async delete(id) { throw new Error('Not implemented'); }
  async getThreadIds(contactId) { throw new Error('Not implemented'); }
  async existsByGmailId(gmailId) { throw new Error('Not implemented'); }
  async getEmailStatusByContacts() { throw new Error('Not implemented'); }
}
