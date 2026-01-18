// src/api/resend.js
// Cliente para Resend API (envío de emails)
// Documentación: https://resend.com/docs

const RESEND_API_URL = 'https://api.resend.com/emails';

export const resendClient = {
  /**
   * Envía un email usando Resend
   * @param {object} params - Parámetros del email
   */
  async sendEmail({ to, subject, body, from = null, replyTo = null }) {
    const apiKey = import.meta.env.VITE_RESEND_API_KEY;

    if (!apiKey) {
      throw new Error('VITE_RESEND_API_KEY no está configurada');
    }

    const emailData = {
      from: from || import.meta.env.VITE_EMAIL_FROM || 'Digpatho CRM <noreply@digpatho.com>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html: convertToHtml(body),
      text: body
    };

    if (replyTo) {
      emailData.reply_to = replyTo;
    }

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(emailData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al enviar email');
    }

    return response.json();
  },

  /**
   * Envía un email de prueba
   */
  async sendTestEmail(to) {
    return this.sendEmail({
      to,
      subject: 'Test desde Digpatho CRM',
      body: 'Este es un email de prueba para verificar la integración con Resend.'
    });
  }
};

/**
 * Convierte texto plano a HTML básico
 */
function convertToHtml(text) {
  if (!text) return '';

  // Escapar HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Convertir saltos de línea a <br> y párrafos
  html = html
    .split('\n\n')
    .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('');

  // Wrap en template básico
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        p { margin: 0 0 1em 0; }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `;
}

// Alternativa: Gmail API (para usuarios que prefieren enviar desde su cuenta)
export const gmailClient = {
  /**
   * Abre Gmail con el email pre-llenado
   */
  openCompose({ to, subject, body }) {
    const params = new URLSearchParams({
      view: 'cm',
      fs: '1',
      to: to || '',
      su: subject || '',
      body: body || ''
    });

    window.open(`https://mail.google.com/mail/?${params}`, '_blank');
  },

  /**
   * Genera un mailto link
   */
  getMailtoLink({ to, subject, body }) {
    const params = new URLSearchParams();
    if (subject) params.set('subject', subject);
    if (body) params.set('body', body);

    return `mailto:${to || ''}?${params}`;
  }
};

export default resendClient;
