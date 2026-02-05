// src/utils/emailContentParser.js

/**
 * Limpia y formatea el contenido de emails para visualización
 * Remueve headers técnicos, caracteres extraños, y formatea el contenido
 */

export const parseEmailContent = (rawContent) => {
  if (!rawContent) return '';

  let content = rawContent;

  // 0. REMOVER CONTENIDO CITADO DE RESPUESTAS (QUOTED CONTENT)
  // Buscar el patrón "El [día de semana]," que indica inicio de cita
  // Ejemplos: "El lun, 2 feb 2026...", "El El vie, 30 ene 2026..."

  // PATRÓN MEJORADO: Detecta el formato completo de Gmail en español
  // "El lun, 2 feb 2026 a la(s) 6:26 p.m."
  // Captura: día, número, mes, año, hora
  const spanishQuotePatternFull = /(?:El\s+)?El\s+(?:lun|mar|mi[eé]|jue|vie|s[aá]b|dom)\s*,\s*\d+\s+\w+\s+\d{4}\s+a\s+la\(s\)\s+\d+:\d+/i;
  
  // Patrón simple como fallback: "El " seguido de día de semana abreviado y coma
  const spanishQuotePattern = /(?:El\s+)?El\s+(?:lun|mar|mi[eé]|jue|vie|s[aá]b|dom)\s*,/i;

  // Patrón inglés completo: "On Mon, Feb 2, 2026 at 6:26 PM"
  const englishQuotePatternFull = /On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*,\s*\w+\s+\d+\s*,\s*\d{4}\s+at\s+\d+:\d+\s*(?:AM|PM)/i;
  
  // Patrón inglés simple: "On Mon," "On Tue," etc.
  const englishQuotePattern = /On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*,/i;

  // Buscar la primera ocurrencia de cualquier patrón de cita
  // Priorizar patrones completos (más específicos) sobre patrones simples
  let cutIndex = content.length;

  // Intentar con patrón completo español primero
  const spanishMatchFull = content.match(spanishQuotePatternFull);
  if (spanishMatchFull) {
    const idx = content.indexOf(spanishMatchFull[0]);
    if (idx !== -1 && idx < cutIndex) {
      cutIndex = idx;
    }
  } else {
    // Fallback a patrón simple
    const spanishMatch = content.match(spanishQuotePattern);
    if (spanishMatch) {
      const idx = content.indexOf(spanishMatch[0]);
      if (idx !== -1 && idx < cutIndex) {
        cutIndex = idx;
      }
    }
  }

  // Intentar con patrón completo inglés
  const englishMatchFull = content.match(englishQuotePatternFull);
  if (englishMatchFull) {
    const idx = content.indexOf(englishMatchFull[0]);
    if (idx !== -1 && idx < cutIndex) {
      cutIndex = idx;
    }
  } else {
    // Fallback a patrón simple
    const englishMatch = content.match(englishQuotePattern);
    if (englishMatch) {
      const idx = content.indexOf(englishMatch[0]);
      if (idx !== -1 && idx < cutIndex) {
        cutIndex = idx;
      }
    }
  }

  // Cortar en el índice encontrado
  if (cutIndex < content.length) {
    content = content.substring(0, cutIndex);
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
  const dateMatch = rawContent.match(/^Date:\s*.+$/im);
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
  
  // Detectar contenido citado - patrones completos
  const hasSpanishQuoteFull = /(?:El\s+)?El\s+(?:lun|mar|mi[eé]|jue|vie|s[aá]b|dom)\s*,\s*\d+\s+\w+\s+\d{4}\s+a\s+la\(s\)\s+\d+:\d+/i.test(content);
  const hasEnglishQuoteFull = /On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*,\s*\w+\s+\d+\s*,\s*\d{4}\s+at\s+\d+:\d+\s*(?:AM|PM)/i.test(content);
  
  // Detectar contenido citado - patrones simples como fallback
  const hasSpanishQuote = /(?:El\s+)?El\s+(?:lun|mar|mi[eé]|jue|vie|s[aá]b|dom)\s*,/i.test(content);
  const hasEnglishQuote = /On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*,/i.test(content);
  
  const hasQuotedLines = /^>/m.test(content);

  return hasHeaders || hasForwarded || hasSpanishQuoteFull || hasEnglishQuoteFull || 
         hasSpanishQuote || hasEnglishQuote || hasQuotedLines;
};
