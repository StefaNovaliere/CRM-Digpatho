/**
 * ContactService - pure business logic for contacts.
 * No framework or database dependencies.
 */

const VALID_INTEREST_LEVELS = ['cold', 'warm', 'hot', 'customer', 'churned'];
const VALID_ROLES = ['pathologist', 'researcher', 'hospital_director', 'lab_manager', 'procurement', 'other'];

export class ContactService {
  validateContact(data) {
    const errors = [];

    if (!data.first_name?.trim()) errors.push('El nombre es obligatorio');
    if (!data.last_name?.trim()) errors.push('El apellido es obligatorio');
    if (data.email && !this.isValidEmail(data.email)) errors.push('Email inválido');
    if (data.interest_level && !VALID_INTEREST_LEVELS.includes(data.interest_level)) {
      errors.push('Nivel de interés inválido');
    }
    if (data.role && !VALID_ROLES.includes(data.role)) {
      errors.push('Rol inválido');
    }

    return { valid: errors.length === 0, errors };
  }

  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  calculateResponseStatus(interactions) {
    if (!interactions || interactions.length === 0) return 'not_contacted';

    const hasSentEmail = interactions.some(
      i => i.type === 'email_sent' || i.direction === 'outbound'
    );
    const hasReceivedReply = interactions.some(
      i => i.type === 'email_reply' || i.direction === 'inbound'
    );

    if (hasReceivedReply) return 'responded';
    if (hasSentEmail) return 'no_response';
    return 'not_contacted';
  }

  filterContacts(contacts, { search = '', interest_level = 'all', role = 'all', institution_id = 'all' } = {}) {
    return contacts.filter(contact => {
      if (interest_level !== 'all' && contact.interest_level !== interest_level) return false;
      if (role !== 'all' && contact.role !== role) return false;
      if (institution_id !== 'all' && contact.institution_id !== institution_id) return false;

      if (search) {
        const query = search.toLowerCase();
        const fullName = `${contact.first_name} ${contact.last_name}`.toLowerCase();
        const email = contact.email?.toLowerCase() || '';
        const institution = contact.institution?.name?.toLowerCase() || '';
        if (!fullName.includes(query) && !email.includes(query) && !institution.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }

  computeStats(contacts) {
    return {
      total: contacts.length,
      hot: contacts.filter(c => c.interest_level === 'hot').length,
      warm: contacts.filter(c => c.interest_level === 'warm').length,
      cold: contacts.filter(c => c.interest_level === 'cold').length,
      customers: contacts.filter(c => c.interest_level === 'customer').length
    };
  }
}
