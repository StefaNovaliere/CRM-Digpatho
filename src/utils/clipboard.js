// src/utils/clipboard.js
//
// Copiado al portapapeles. Antes había tres implementaciones distintas:
// una sin manejo de error (BulkEmailSearch), otra sin fallback
// (DraftReviewModal) y una tercera que sí devolvía un booleano (useGmail).
//
// navigator.clipboard sólo existe en contextos seguros (HTTPS o localhost) y
// puede fallar si el usuario no dio permiso, así que siempre hay que manejar
// el error — nunca asumir que funcionó.

/**
 * Copia texto al portapapeles.
 * @returns {Promise<boolean>} true si se copió, false si falló.
 */
export async function copyToClipboard(text) {
  if (!text) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('No se pudo copiar con navigator.clipboard:', err?.message);
  }

  // Fallback para contextos no seguros o navegadores viejos.
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch (err) {
    console.error('Error al copiar al portapapeles:', err?.message);
    return false;
  }
}

export default copyToClipboard;
