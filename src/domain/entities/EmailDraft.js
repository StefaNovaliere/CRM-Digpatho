/**
 * EmailDraft entity - pure domain model.
 */
export class EmailDraft {
  constructor({
    id = null,
    contact_id = null,
    subject = '',
    body = '',
    edited_body = null,
    status = 'generated',
    generation_context = null,
    ai_model = null,
    sent_at = null,
    sent_by = null,
    edited_at = null,
    created_at = null
  } = {}) {
    this.id = id;
    this.contact_id = contact_id;
    this.subject = subject;
    this.body = body;
    this.edited_body = edited_body;
    this.status = status;
    this.generation_context = generation_context;
    this.ai_model = ai_model;
    this.sent_at = sent_at;
    this.sent_by = sent_by;
    this.edited_at = edited_at;
    this.created_at = created_at;
  }

  get effectiveBody() {
    return this.edited_body || this.body;
  }

  get isSent() {
    return this.status === 'sent';
  }

  get isEditable() {
    return ['generated', 'edited', 'approved'].includes(this.status);
  }
}
