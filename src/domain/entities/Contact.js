/**
 * Contact entity - pure domain model, no framework dependencies.
 */
export class Contact {
  constructor({
    id = null,
    first_name = '',
    last_name = '',
    email = '',
    phone = '',
    job_title = '',
    role = 'other',
    interest_level = 'cold',
    institution_id = null,
    institution = null,
    linkedin_url = '',
    ai_context = '',
    tags = [],
    source = '',
    interaction_count = 0,
    last_interaction_at = null,
    created_at = null,
    updated_at = null
  } = {}) {
    this.id = id;
    this.first_name = first_name;
    this.last_name = last_name;
    this.email = email;
    this.phone = phone;
    this.job_title = job_title;
    this.role = role;
    this.interest_level = interest_level;
    this.institution_id = institution_id;
    this.institution = institution;
    this.linkedin_url = linkedin_url;
    this.ai_context = ai_context;
    this.tags = tags;
    this.source = source;
    this.interaction_count = interaction_count;
    this.last_interaction_at = last_interaction_at;
    this.created_at = created_at;
    this.updated_at = updated_at;
  }

  get fullName() {
    return `${this.first_name} ${this.last_name}`.trim();
  }

  get initials() {
    return `${this.first_name?.[0] || ''}${this.last_name?.[0] || ''}`.toUpperCase();
  }

  get isHot() {
    return this.interest_level === 'hot';
  }

  get isCustomer() {
    return this.interest_level === 'customer';
  }

  get needsFollowUp() {
    if (!this.last_interaction_at) return true;
    const daysSinceLastInteraction = (Date.now() - new Date(this.last_interaction_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLastInteraction > 14;
  }

  toJSON() {
    const { institution, ...data } = this;
    return data;
  }
}
