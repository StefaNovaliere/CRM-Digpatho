/**
 * Input sanitizer - prevents XSS and injection attacks.
 * Used at system boundaries (user input, external data).
 */

/**
 * Sanitize a string by escaping HTML entities.
 */
export function sanitizeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Strip all HTML tags from a string.
 */
export function stripTags(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize an object by applying sanitizeHtml to all string values (shallow).
 */
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = typeof value === 'string' ? sanitizeHtml(value) : value;
  }
  return sanitized;
}

/**
 * Validate and sanitize email address.
 */
export function sanitizeEmail(email) {
  if (typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Validate URL format.
 */
export function isValidUrl(str) {
  try {
    const url = new URL(str);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}
