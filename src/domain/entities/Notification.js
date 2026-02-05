/**
 * Notification entity - pure domain model.
 */
export class Notification {
  constructor({
    id = null,
    user_id = null,
    type = '',
    title = '',
    message = '',
    link = '',
    is_read = false,
    created_at = null
  } = {}) {
    this.id = id;
    this.user_id = user_id;
    this.type = type;
    this.title = title;
    this.message = message;
    this.link = link;
    this.is_read = is_read;
    this.created_at = created_at;
  }
}
