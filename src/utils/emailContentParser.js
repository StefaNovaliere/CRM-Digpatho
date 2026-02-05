// src/utils/emailContentParser.js

/**
 * Limpia y formatea el contenido de emails para visualización
 * Remueve headers técnicos, caracteres extraños, y formatea el contenido
 */

export const parseEmailContent = (rawContent) => {
  if (!rawContent) return '';

  let content = rawContent;

  // 1. REMOVER HEADERS DE EMAIL CRUDO
  // Patrón para detectar bloques de headers (From:, To:, Subject:, Date:)
  const headerPatterns = [
    /^-+\s*Forwarded message\s*-+$/gim,
    /^From:\s*.+$/gim,
    /^To:\s*.+$/gim,
    /^Date:\s*.+$/gim,
    /^Subject:\s*.+$/gim,
    /^Cc:\s*.+$/gim,
    /^Bcc:\s*.+$/gim,
    /^Reply-To:\s*.+$/gim,
    /^Sender:\s*.+$/gim,
  ];

  headerPatterns.forEach(pattern => {
    content = content.replace(pattern, '');
  });

  // 2. LIMPIAR CARACTERES DE ENCODING MAL FORMADOS
  // Arreglar problemas comunes de encoding UTF-8
  const encodingFixes = {
    'Ã¡': 'á',
    'Ã©': 'é',
    'Ã­': 'í',
    'Ã³': 'ó',
    'Ãº': 'ú',
    'Ã±': 'ñ',
    'Ã': 'Á',
    'Ã‰': 'É',
    'Ã': 'Í',
    'Ã"': 'Ó',
    'Ãš': 'Ú',
    'Ã'': 'Ñ',
    'Â°': '°',
    'Â´': '´',
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
  };

  Object.entries(encodingFixes).forEach(([bad, good]) => {
    content = content.replace(new RegExp(bad, 'g'), good);
  });

  // 3. REMOVER DIRECCIONES DE EMAIL ENVUELTAS EN < >
  content = content.replace(/<[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}>/g, '');

  // 4. LIMPIAR MÚLTIPLES SALTOS DE LÍNEA
  content = content.replace(/\n{3,}/g, '\n\n');

  // 5. REMOVER ESPACIOS AL INICIO Y FINAL
  content = content.trim();

  // 6. REMOVER LÍNEAS QUE SOLO TIENEN GUIONES O ESPACIOS
  content = content.split('\n')
    .filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !/^[-\s]+$/.test(trimmed);
    })
    .join('\n');

  return content;
};

/**
 * Extrae información útil de headers si es necesario
 * (para mostrar de forma separada y limpia)
 */
export const extractEmailMetadata = (rawContent) => {
  const metadata = {};

  // Extraer From
  const fromMatch = rawContent.match(/^From:\s*(.+?)(?:<(.+?)>)?$/im);
  if (fromMatch) {
    metadata.from = {
      name: fromMatch[1]?.trim(),
      email: fromMatch[2]?.trim() || fromMatch[1]?.trim()
    };
  }

  // Extraer Subject
  const subjectMatch = rawContent.match(/^Subject:\s*(.+)$/im);
  if (subjectMatch) {
    metadata.subject = subjectMatch[1].trim();
  }

  // Extraer Date
  const dateMatch = rawContent.match(/^Date:\s*(.+)$/im);
  if (dateMatch) {
    metadata.date = dateMatch[1].trim();
  }

  return metadata;
};

/**
 * Determina si el contenido parece ser un email crudo
 */
export const isRawEmail = (content) => {
  if (!content) return false;

  const hasHeaders = /^(From|To|Subject|Date):/im.test(content);
  const hasForwarded = /Forwarded message/i.test(content);

  return hasHeaders || hasForwarded;
};