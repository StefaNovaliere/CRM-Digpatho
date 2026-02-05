/**
 * EmailService - pure business logic for email generation and management.
 * No framework or database dependencies.
 */
export class EmailService {
  parseEmailResponse(text) {
    const result = { subject: '', body: '', notes: '' };

    const subjectMatch = text.match(/\*\*Asunto:\*\*\s*(.+?)(?=\n|$)/i);
    if (subjectMatch) result.subject = subjectMatch[1].trim();

    const bodyMatch = text.match(/\*\*Cuerpo:\*\*\s*([\s\S]*?)(?=\*\*Notas internas:\*\*|$)/i);
    if (bodyMatch) {
      result.body = bodyMatch[1].trim();
    } else {
      result.body = text.replace(/\*\*Asunto:\*\*.*\n?/i, '').trim();
    }

    const notesMatch = text.match(/\*\*Notas internas:\*\*\s*([\s\S]*?)$/i);
    if (notesMatch) result.notes = notesMatch[1].trim();

    return result;
  }

  buildGenerationContext({ contactId, emailType, tone, language, project, customContext, contactSnapshot }) {
    return {
      email_type: emailType,
      tone,
      language,
      project,
      custom_context: customContext || null,
      contact_snapshot: contactSnapshot
    };
  }

  convertToHtml(text) {
    if (!text) return '';

    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    html = html
      .split('\n\n')
      .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
      .join('');

    return `<!DOCTYPE html>
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
</html>`;
  }
}
