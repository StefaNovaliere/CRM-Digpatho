/**
 * InteractionService - pure business logic for interactions.
 */

const VALID_TYPES = [
  'email_sent', 'email_received', 'email_reply',
  'meeting', 'call', 'demo', 'note', 'linkedin', 'conference'
];

const VALID_DIRECTIONS = ['inbound', 'outbound', 'internal'];

export class InteractionService {
  validateInteraction(data) {
    const errors = [];

    if (!data.contact_id) errors.push('El contacto es obligatorio');
    if (!data.type || !VALID_TYPES.includes(data.type)) errors.push('Tipo de interacción inválido');
    if (data.direction && !VALID_DIRECTIONS.includes(data.direction)) errors.push('Dirección inválida');

    return { valid: errors.length === 0, errors };
  }

  determineEmailDirection(isSentByMe) {
    return isSentByMe ? 'outbound' : 'inbound';
  }

  determineEmailType(isSentByMe) {
    return isSentByMe ? 'email_sent' : 'email_reply';
  }
}
