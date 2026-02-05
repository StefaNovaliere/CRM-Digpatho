/**
 * AuthRepository interface - defines the contract for authentication operations.
 */
export class AuthRepository {
  async getSession() { throw new Error('Not implemented'); }
  async signInWithGoogle(options) { throw new Error('Not implemented'); }
  async signOut() { throw new Error('Not implemented'); }
  async refreshSession() { throw new Error('Not implemented'); }
  onAuthStateChange(callback) { throw new Error('Not implemented'); }
}
