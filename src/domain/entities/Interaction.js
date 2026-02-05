/**
 * Interaction entity - pure domain model.
 */
export const INTERACTION_DIRECTIONS = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
  INTERNAL: 'internal'
};

export class Interaction {
  constructor({
    id = null,
    contact_id = null,
    type = 'note',
    subject = '',
    content = '',
    direction = INTERACTION_DIRECTIONS.INTERNAL,
    occurred_at = null,
    email_draft_id = null,
    created_by = null,
    thread_id = null,
    gmail_id = null,
    created_at = null
  } = {}) {
    this.id = id;
    this.contact_id = contact_id;
    this.type = type;
    this.subject = subject;
    this.content = content;
    this.direction = direction;
    this.occurred_at = occurred_at || new Date().toISOString();
    this.email_draft_id = email_draft_id;
    this.created_by = created_by;
    this.thread_id = thread_id;
    this.gmail_id = gmail_id;
    this.created_at = created_at;
  }

  get isEmail() {
    return ['email_sent', 'email_reply', 'email_received'].includes(this.type);
  }

  get isInbound() {
    return this.direction === INTERACTION_DIRECTIONS.INBOUND;
  }

  get isOutbound() {
    return this.direction === INTERACTION_DIRECTIONS.OUTBOUND;
  }
}
