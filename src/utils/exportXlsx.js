// src/utils/exportXlsx.js
//
// Exportación a Excel. Antes esto estaba escrito inline en
// BulkEmailSearch.jsx y sólo sabía armar una hoja; las planillas de
// seguimiento necesitan varias, así que vive acá y se comparte.
//
// Uso:
//   exportarXlsx('seguimientos_2026-08-26.xlsx', [
//     { nombre: 'Actividad',    filas: [{ Fecha: '...', Quién: '...' }] },
//     { nombre: 'Seguimientos', filas: [...] },
//   ]);
//
// Las filas son objetos planos: las claves son los encabezados de la planilla,
// tal cual, así que van en español y con mayúscula.

import * as XLSX from 'xlsx';

// Excel rechaza los nombres de hoja con : \ / ? * [ ] y corta a los 31
// caracteres. Si le pasás uno inválido tira sin decir por qué.
const nombreDeHojaValido = (nombre) =>
  String(nombre || 'Hoja').replace(/[:\\/?*[\]]/g, '-').slice(0, 31);

// Ancho de columna aproximado según el contenido, para no tener que
// arrastrar cada columna a mano al abrir el archivo.
const calcularAnchos = (filas) => {
  if (filas.length === 0) return [];
  return Object.keys(filas[0]).map(clave => {
    const largos = filas.map(f => String(f[clave] ?? '').length);
    const max = Math.max(clave.length, ...largos);
    return { wch: Math.min(Math.max(max + 2, 10), 60) };
  });
};

/**
 * Descarga un .xlsx con una o varias hojas.
 *
 * @param {string} nombreArchivo  Con extensión, ej. 'seguimientos_2026-08-26.xlsx'
 * @param {Array<{nombre: string, filas: Array<Object>}>} hojas
 */
export function exportarXlsx(nombreArchivo, hojas) {
  const conDatos = (hojas || []).filter(h => h && Array.isArray(h.filas));
  if (conDatos.length === 0) {
    throw new Error('No hay nada para exportar.');
  }

  const workbook = XLSX.utils.book_new();

  for (const hoja of conDatos) {
    // Una hoja vacía igual se incluye: que el archivo tenga la hoja y esté
    // vacía dice más que que la hoja no exista.
    const worksheet = XLSX.utils.json_to_sheet(hoja.filas);
    worksheet['!cols'] = calcularAnchos(hoja.filas);
    XLSX.utils.book_append_sheet(workbook, worksheet, nombreDeHojaValido(hoja.nombre));
  }

  XLSX.writeFile(workbook, nombreArchivo);
}

/**
 * Sufijo de fecha para los nombres de archivo: '2026-08-26'.
 * Se usa la fecha local, no la UTC: un export hecho a las 21hs en Argentina
 * tiene que decir el día de hoy, no el de mañana.
 */
export function sufijoFecha(fecha = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}

/**
 * Fecha y hora legibles para una celda. Se exporta como TEXTO a propósito:
 * si se manda un Date, Excel lo reinterpreta con el formato regional de quien
 * abre el archivo y las fechas terminan mostrándose mal.
 */
export function fechaHoraTexto(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fechaTexto(valor) {
  if (!valor) return '';
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
