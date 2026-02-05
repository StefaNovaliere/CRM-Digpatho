/**
 * EmailDraftRepository interface - defines the contract for email draft data access.
 */
export class EmailDraftRepository {
  async create(draftData) { throw new Error('Not implemented'); }
  async update(id, updates) { throw new Error('Not implemented'); }
  async getByStatus(status, limit = 50) { throw new Error('Not implemented'); }
  async getByContactId(contactId) { throw new Error('Not implemented'); }
  async getSentEmails(limit = 50) { throw new Error('Not implemented'); }
}
