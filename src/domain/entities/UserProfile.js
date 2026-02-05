/**
 * UserProfile entity - pure domain model.
 */
export class UserProfile {
  constructor({
    id = null,
    full_name = '',
    email = '',
    email_signature = '',
    google_access_token = null,
    google_refresh_token = null,
    google_token_expires_at = null,
    last_login_at = null,
    created_at = null,
    updated_at = null
  } = {}) {
    this.id = id;
    this.full_name = full_name;
    this.email = email;
    this.email_signature = email_signature;
    this.google_access_token = google_access_token;
    this.google_refresh_token = google_refresh_token;
    this.google_token_expires_at = google_token_expires_at;
    this.last_login_at = last_login_at;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  get hasGmailAccess() {
    return !!this.google_access_token;
  }

  get isGoogleTokenExpired() {
    if (!this.google_token_expires_at) return true;
    const expiresAt = new Date(this.google_token_expires_at);
    const fiveMinutesFromNow = Date.now() + 5 * 60 * 1000;
    return expiresAt.getTime() < fiveMinutesFromNow;
  }
}
