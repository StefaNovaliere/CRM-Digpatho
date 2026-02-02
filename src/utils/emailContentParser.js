// src/utils/emailContentParser.js

/**
 * Limpia y formatea el contenido de emails para visualización
 * Remueve headers técnicos, caracteres extraños, y formatea el contenido
 */

export const parseEmailContent = (rawContent) => {
  if (!rawContent) return '';

  let content = rawContent;

  // 0. REMOVER CONTENIDO CITADO DE RESPUESTAS (QUOTED CONTENT)
  // Detectar el inicio de la cita y eliminar todo desde ahí
  const quoteStartPatterns = [
    // Español: "El lun, 2 feb 2026 a la(s) 6:26 p. m., Nombre <email> escribió:"
    /El\s+(?:El\s+)?(?:lun|mar|mi[eé]|jue|vie|s[aá]b|dom)[^<]*<[^>]+>\s*escribi[oó]:\s*/gi,
    // Español alternativo: "El 2 de febrero de 2026, ... escribió:"
    /El\s+\d{1,2}\s+de\s+\w+\s+de\s+\d{4}[^<]*<[^>]+>\s*escribi[oó]:\s*/gi,
    // Inglés: "On Mon, Feb 2, 2026 at 6:26 PM Name <email> wrote:"
    /On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^<]*<[^>]+>\s*wrote:\s*/gi,
    // Variante sin día de semana
    /On\s+\w+\s+\d{1,2},\s+\d{4}[^<]*<[^>]+>\s*wrote:\s*/gi,
    // Gmail forward markers
    /^-+\s*(?:Mensaje reenviado|Forwarded message)\s*-+\s*$/gim,
  ];

  // Encontrar la primera coincidencia de cualquier patrón de cita
  let quoteStartIndex = content.length;
  for (const pattern of quoteStartPatterns) {
    const match = content.match(pattern);
    if (match) {
      const idx = content.indexOf(match[0]);
      if (idx !== -1 && idx < quoteStartIndex) {
        quoteStartIndex = idx;
      }
    }
  }

  // Si encontramos contenido citado, cortar ahí
  if (quoteStartIndex < content.length) {
    content = content.substring(0, quoteStartIndex);
  }

  // También remover líneas que empiezan con ">" (quoted lines)
  content = content.split('\n')
    .filter(line => !line.trim().startsWith('>'))
    .join('\n');

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
    'Ã\x81': 'Á',
    'Ã‰': 'É',
    'Ã\x8D': 'Í',
    'Ã"': 'Ó',
    'Ãš': 'Ú',
    "Ã'": 'Ñ',
    'Â°': '°',
    'Â´': '´',
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    "&#39;": "'",
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
 * Determina si el contenido parece ser un email crudo o tiene contenido citado
 */
export const isRawEmail = (content) => {
  if (!content) return false;

  const hasHeaders = /^(From|To|Subject|Date):/im.test(content);
  const hasForwarded = /Forwarded message/i.test(content);
  // Detectar contenido citado de respuestas
  const hasQuotedContent = /escribi[oó]:|wrote:/i.test(content);
  const hasQuotedLines = /^>/m.test(content);

  return hasHeaders || hasForwarded || hasQuotedContent || hasQuotedLines;
};