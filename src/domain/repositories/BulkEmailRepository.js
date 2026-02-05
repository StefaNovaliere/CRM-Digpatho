/**
 * BulkEmailRepository interface - defines the contract for bulk email campaign data access.
 */
export class BulkEmailRepository {
  async getCampaigns() { throw new Error('Not implemented'); }
  async getCampaignById(id) { throw new Error('Not implemented'); }
  async createCampaign(campaignData) { throw new Error('Not implemented'); }
  async updateCampaign(id, updates) { throw new Error('Not implemented'); }
  async deleteCampaign(id) { throw new Error('Not implemented'); }
  async getQueueByCampaignId(campaignId) { throw new Error('Not implemented'); }
}
