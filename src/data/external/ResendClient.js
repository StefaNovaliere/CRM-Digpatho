/**
 * ResendClient - handles Resend email API communication.
 */
import { env } from '../../infrastructure/config/env';

const RESEND_API_URL = 'https://api.resend.com/emails';

export class ResendClient {
  async sendEmail({ to, subject, html, text, from = null, replyTo = null, cc = null, bcc = null }) {
    const apiKey = env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error('VITE_RESEND_API_KEY no está configurada');
    }

    const emailData = {
      from: from || env.EMAIL_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text
    };

    if (replyTo) emailData.reply_to = replyTo;
    if (cc) emailData.cc = Array.isArray(cc) ? cc : [cc];
    if (bcc) emailData.bcc = Array.isArray(bcc) ? bcc : [bcc];

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
  }
}
