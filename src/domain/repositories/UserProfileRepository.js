/**
 * UserProfileRepository interface - defines the contract for user profile data access.
 */
export class UserProfileRepository {
  async getById(id) { throw new Error('Not implemented'); }
  async update(id, updates) { throw new Error('Not implemented'); }
  async updateGoogleTokens(userId, tokens) { throw new Error('Not implemented'); }
  async updateLastLogin(userId) { throw new Error('Not implemented'); }
}
