/**
 * GmailClient - handles Gmail API communication.
 * Pure data layer - no React dependencies.
 */
import { env } from '../../infrastructure/config/env';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export class GmailClient {
  async refreshAccessToken(refreshToken) {
    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Configuración de Google incompleta.');
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) throw new Error('Error al refrescar token de Google');
    return response.json();
  }

  async sendEmail(accessToken, rawMimeBase64) {
    const response = await fetch(`${GMAIL_API_BASE}/messages/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: rawMimeBase64 })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Error al enviar email');
    }

    return response.json();
  }

  async getThread(accessToken, threadId) {
    const response = await fetch(
      `${GMAIL_API_BASE}/threads/${threadId}?format=full`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );

    if (!response.ok) return null;
    return response.json();
  }

  buildMimeEmail({ from, fromName, to, cc, subject, body, signature, attachments }) {
    const fullBody = body + (signature ? `\n\n--\n${signature}` : '');
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2)}`;

    let headers = [
      `From: "${fromName}" <${from}>`,
      `To: ${to}`,
    ];

    if (cc && cc.length > 0) {
      headers.push(`Cc: ${Array.isArray(cc) ? cc.join(', ') : cc}`);
    }

    const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
    headers.push(`Subject: ${encodedSubject}`);
    headers.push('MIME-Version: 1.0');

    if (attachments && attachments.length > 0) {
      headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

      let mimeBody = headers.join('\r\n') + '\r\n\r\n';

      mimeBody += `--${boundary}\r\n`;
      mimeBody += 'Content-Type: text/plain; charset=UTF-8\r\n';
      mimeBody += 'Content-Transfer-Encoding: base64\r\n\r\n';
      mimeBody += btoa(unescape(encodeURIComponent(fullBody))) + '\r\n';

      for (const att of attachments) {
        mimeBody += `--${boundary}\r\n`;
        mimeBody += `Content-Type: ${att.type || 'application/octet-stream'}; name="${att.name}"\r\n`;
        mimeBody += 'Content-Transfer-Encoding: base64\r\n';
        mimeBody += `Content-Disposition: attachment; filename="${att.name}"\r\n\r\n`;
        mimeBody += att.data + '\r\n';
      }

      mimeBody += `--${boundary}--`;
      return mimeBody;
    } else {
      headers.push('Content-Type: text/plain; charset=UTF-8');
      return headers.join('\r\n') + '\r\n\r\n' + fullBody;
    }
  }

  encodeForGmail(mimeEmail) {
    return btoa(unescape(encodeURIComponent(mimeEmail)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  extractMessageBody(payload) {
    if (payload.body?.data) {
      try {
        return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      } catch {
        return payload.body.data;
      }
    }

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          try {
            return atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          } catch {
            return part.body.data;
          }
        }
        if (part.parts) {
          const nested = this.extractMessageBody(part);
          if (nested) return nested;
        }
      }
    }

    return null;
  }

  extractSubject(headers) {
    const subjectHeader = headers?.find(h => h.name.toLowerCase() === 'subject');
    return subjectHeader?.value || 'Sin asunto';
  }
}
