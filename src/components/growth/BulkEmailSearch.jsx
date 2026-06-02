// src/components/growth/BulkEmailSearch.jsx
// Buscador masivo de emails vía Vertex AI (Gemini + Google Search grounding).
// Busca emails en la web abierta a partir de una lista de contactos con
// nombre + características (institución, procedencia, especialidad, etc.).
// Opcionalmente guarda los resultados como leads en growth_leads.

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Search,
  Upload,
  Keyboard,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Mail,
  Building2,
  ExternalLink,
  Trash2,
  Copy,
  FileSpreadsheet,
  Brain,
  Info,
  Save,
  CheckSquare,
  Square,
  MapPin,
  Stethoscope,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { GROWTH_VERTICALS } from '../../config/constants';

const INPUT_MODES = {
  MANUAL: 'manual',
  EXCEL: 'excel',
};

const HEADER_ALIASES = {
  first_name: ['first_name', 'firstname', 'nombre', 'name', 'first', 'given_name'],
  last_name: ['last_name', 'lastname', 'apellido', 'surname', 'last', 'family_name'],
  organization_name: ['organization', 'organization_name', 'company', 'empresa', 'institution', 'institucion', 'org', 'employer', 'universidad', 'hospital'],
  location: ['location', 'ubicacion', 'pais', 'country', 'ciudad', 'city', 'geo', 'procedencia', 'region'],
  specialty: ['specialty', 'especialidad', 'area', 'field', 'departamento', 'department', 'discipline'],
  context: ['context', 'notas', 'notes', 'info', 'additional', 'extra', 'descripcion', 'description'],
  linkedin_url: ['linkedin', 'linkedin_url', 'linkedinurl', 'linkedin_link'],
};

function matchHeader(header) {
  const norm = String(header || '').trim().toLowerCase().replace(/[\s\-]+/g, '_');
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(norm)) return field;
  }
  return null;
}

function parseManualInput(text) {
  return text.split('\n').map(line => {
    const parts = line.split(/[\t,|;]/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return null;

    if (parts.length >= 3) {
      return {
        first_name: parts[0],
        last_name: parts[1],
        organization_name: parts[2],
        location: parts[3] || '',
        specialty: parts[4] || '',
        context: parts[5] || '',
      };
    }

    const nameParts = parts[0].split(/\s+/);
    return {
      first_name: nameParts[0] || '',
      last_name: nameParts.slice(1).join(' '),
      organization_name: parts[1] || '',
    };
  }).filter(Boolean);
}

function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (rows.length < 2) {
          reject(new Error('El archivo no tiene datos.'));
          return;
        }

        const headers = rows[0].map(h => String(h).trim());
        const fieldMap = headers.map(matchHeader);

        if (!fieldMap.includes('first_name') && !fieldMap.includes('last_name')) {
          reject(new Error('No se encontraron columnas de nombre. Usá columnas: first_name, last_name, organization (o equivalentes en español).'));
          return;
        }

        const contacts = rows.slice(1).map(row => {
          const contact = {};
          fieldMap.forEach((field, idx) => {
            if (field && row[idx]) {
              contact[field] = String(row[idx]).trim();
            }
          });
          return contact;
        }).filter(c => c.first_name || c.last_name);

        resolve(contacts);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsArrayBuffer(file);
  });
}

function exportResultsToExcel(results) {
  const rows = results.map(r => ({
    nombre: `${r.input.first_name} ${r.input.last_name}`.trim(),
    organizacion: r.input.organization || '',
    ubicacion: r.input.location || '',
    especialidad: r.input.specialty || '',
    email: r.email || '',
    estado: r.status === 'found' ? 'Encontrado' : r.status === 'not_found' ? 'No encontrado' : 'Error',
    confianza: r.confidence || '',
    fuente: r.source_url || '',
    fuente_descripcion: r.source_description || '',
    emails_alternativos: (r.alternative_emails || []).join(', '),
    notas: r.notes || '',
    error: r.error || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Resultados Vertex AI');
  const filename = `vertex_emails_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

const StatusBadge = ({ status }) => {
  const config = {
    found: { label: 'Encontrado', color: 'bg-green-100 text-green-700', Icon: CheckCircle },
    not_found: { label: 'No encontrado', color: 'bg-gray-100 text-gray-500', Icon: XCircle },
    error: { label: 'Error', color: 'bg-red-100 text-red-700', Icon: AlertCircle },
  }[status] || { label: status, color: 'bg-gray-100 text-gray-500', Icon: AlertCircle };

  const { label, color, Icon } = config;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${color}`}>
      <Icon size={12} />
      {label}
    </span>
  );
};

export const BulkEmailSearch = () => {
  const [mode, setMode] = useState(INPUT_MODES.MANUAL);
  const [manualText, setManualText] = useState('');
  const [excelContacts, setExcelContacts] = useState([]);
  const [excelFileName, setExcelFileName] = useState('');
  const [parseError, setParseError] = useState(null);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(null);
  const fileInputRef = useRef(null);

  // Save-as-leads state
  const [selectedForSave, setSelectedForSave] = useState(new Set());
  const [saveVertical, setSaveVertical] = useState('DIRECT_B2B');
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);

  const handleExcelUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setExcelFileName(file.name);
    try {
      const contacts = await parseExcelFile(file);
      setExcelContacts(contacts);
      if (contacts.length === 0) {
        setParseError('No se encontraron contactos válidos en el archivo.');
      }
    } catch (err) {
      setParseError(err.message);
      setExcelContacts([]);
    }
  }, []);

  const handleClearExcel = () => {
    setExcelContacts([]);
    setExcelFileName('');
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const contactsToSearch = useMemo(
    () => (mode === INPUT_MODES.EXCEL ? excelContacts : parseManualInput(manualText)),
    [mode, excelContacts, manualText]
  );

  const handleSearch = async () => {
    const contacts = contactsToSearch;
    if (contacts.length === 0) {
      setSearchError('Ingresá al menos un contacto.');
      return;
    }

    setSearching(true);
    setSearchError(null);
    setResults([]);
    setSummary(null);
    setSelectedForSave(new Set());
    setSaveResult(null);

    try {
      const response = await fetch('/api/vertex-email-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts }),
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (_) {
        throw new Error(`Error del servidor (${response.status}): ${responseText.slice(0, 150)}`);
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || `Error ${response.status}`);
      }

      setResults(data.results || []);
      setSummary(data.summary || null);

      // Auto-select all found results for save
      const foundIndices = new Set();
      (data.results || []).forEach((r, i) => {
        if (r.status === 'found') foundIndices.add(i);
      });
      setSelectedForSave(foundIndices);
    } catch (err) {
      console.error('Vertex AI search error:', err);
      setSearchError(err.message || 'Error al buscar emails.');
    } finally {
      setSearching(false);
    }
  };

  const handleClearResults = () => {
    setResults([]);
    setSummary(null);
    setSearchError(null);
    setSelectedForSave(new Set());
    setSaveResult(null);
  };

  const handleCopyEmail = (email) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 1500);
  };

  const toggleSelect = (index) => {
    setSelectedForSave(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const foundIndices = results
      .map((r, i) => r.status === 'found' ? i : null)
      .filter(i => i !== null);
    const allSelected = foundIndices.every(i => selectedForSave.has(i));
    if (allSelected) {
      setSelectedForSave(new Set());
    } else {
      setSelectedForSave(new Set(foundIndices));
    }
  };

  const handleSaveAsLeads = async () => {
    const toSave = results.filter((r, i) => selectedForSave.has(i) && r.status === 'found');
    if (toSave.length === 0) return;

    setSaving(true);
    setSaveResult(null);

    let saved = 0;
    let errors = 0;

    for (const r of toSave) {
      const leadData = {
        full_name: `${r.input.first_name} ${r.input.last_name}`.trim(),
        email: r.email,
        company: r.input.organization || null,
        geo: r.input.location || null,
        vertical: saveVertical,
        source_query: 'vertex_ai_bulk_search',
        status: 'new',
        extra_data: {
          email_source_url: r.source_url || null,
          email_confidence: r.confidence || null,
          specialty: r.input.specialty || null,
          notes: r.notes || null,
          bulk_search_date: new Date().toISOString(),
        },
      };

      // Metadata columns from migration 005
      leadData.email_discovery_method = 'vertex_ai_search';
      if (r.confidence) leadData.email_confidence = r.confidence;
      if (r.source_url) leadData.email_source_url = r.source_url;

      const { error } = await supabase
        .from('growth_leads')
        .insert(leadData);

      if (error) {
        console.error('Error saving lead:', error.message);
        errors++;
      } else {
        saved++;
      }
    }

    setSaving(false);
    setSaveResult({ saved, errors, total: toSave.length });
  };

  const contactCount = contactsToSearch.length;
  const foundResults = results.filter(r => r.status === 'found');
  const selectedCount = [...selectedForSave].filter(i => results[i]?.status === 'found').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-200 rounded-xl">
        <div className="w-10 h-10 bg-violet-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">Búsqueda masiva de emails (Vertex AI)</h3>
          <p className="text-sm text-gray-600">
            Cargá una lista de contactos con <strong>nombre + características</strong> (institución,
            procedencia, especialidad) y Vertex AI busca sus emails en la <strong>web abierta</strong>.
            Los resultados se pueden exportar a Excel o guardar como leads en el Growth System.
          </p>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setMode(INPUT_MODES.MANUAL)}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
            mode === INPUT_MODES.MANUAL
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Keyboard size={16} />
          Ingreso manual
        </button>
        <button
          onClick={() => setMode(INPUT_MODES.EXCEL)}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
            mode === INPUT_MODES.EXCEL
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileSpreadsheet size={16} />
          Subir Excel
        </button>
      </div>

      {/* Manual input */}
      {mode === INPUT_MODES.MANUAL && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              Un contacto por línea. Formatos aceptados:
              <ul className="mt-1 ml-4 list-disc space-y-0.5">
                <li><code className="bg-white px-1 rounded">Nombre Apellido, Institución</code></li>
                <li><code className="bg-white px-1 rounded">Nombre, Apellido, Institución, País, Especialidad</code></li>
                <li>O pegá directo desde Excel (separado por tabs)</li>
              </ul>
            </div>
          </div>
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            rows={8}
            placeholder={'Juan Pérez, Hospital Italiano, Argentina, Patología\nMaría García, Roche, Suiza\nCarlos López, FLENI, Buenos Aires'}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none text-sm font-mono"
          />
        </div>
      )}

      {/* Excel input */}
      {mode === INPUT_MODES.EXCEL && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              El archivo debe tener una fila de headers. Columnas reconocidas:{' '}
              <code className="bg-white px-1 rounded">nombre</code>,{' '}
              <code className="bg-white px-1 rounded">apellido</code>,{' '}
              <code className="bg-white px-1 rounded">empresa/institución</code>,{' '}
              <code className="bg-white px-1 rounded">país/ubicación</code>,{' '}
              <code className="bg-white px-1 rounded">especialidad</code>,{' '}
              <code className="bg-white px-1 rounded">notas</code>.
            </div>
          </div>

          {!excelFileName ? (
            <label className="flex flex-col items-center justify-center px-4 py-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
              <Upload className="w-8 h-8 text-gray-400 mb-2" />
              <span className="text-sm font-medium text-gray-700">Subir archivo Excel/CSV</span>
              <span className="text-xs text-gray-500 mt-1">.xlsx, .xls, .csv</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleExcelUpload}
                className="hidden"
              />
            </label>
          ) : (
            <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{excelFileName}</p>
                  <p className="text-xs text-gray-500">{excelContacts.length} contactos cargados</p>
                </div>
              </div>
              <button
                onClick={handleClearExcel}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}

          {parseError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              {parseError}
            </div>
          )}
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {contactCount > 0 ? `${contactCount} contacto${contactCount !== 1 ? 's' : ''} listo${contactCount !== 1 ? 's' : ''} para buscar` : 'Sin contactos cargados'}
        </p>
        <button
          onClick={handleSearch}
          disabled={searching || contactCount === 0}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {searching ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              Buscando emails en la web...
            </>
          ) : (
            <>
              <Search size={16} />
              Buscar emails
            </>
          )}
        </button>
      </div>

      {/* Search error */}
      {searchError && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          {searchError}
        </div>
      )}

      {/* Results */}
      {summary && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Summary header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-500">
                Total: <strong className="text-gray-900">{summary.total}</strong>
              </span>
              <span className="text-green-600">
                Encontrados: <strong>{summary.found}</strong>
              </span>
              <span className="text-gray-500">
                No encontrados: <strong>{summary.not_found}</strong>
              </span>
              {summary.errors > 0 && (
                <span className="text-red-600">
                  Errores: <strong>{summary.errors}</strong>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportResultsToExcel(results)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <Download size={14} />
                Exportar Excel
              </button>
              <button
                onClick={handleClearResults}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Trash2 size={14} />
                Limpiar
              </button>
            </div>
          </div>

          {/* Results table */}
          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Checkbox for save */}
                    {r.status === 'found' && (
                      <button
                        onClick={() => toggleSelect(i)}
                        className="mt-0.5 text-gray-400 hover:text-violet-600 transition-colors flex-shrink-0"
                      >
                        {selectedForSave.has(i) ? (
                          <CheckSquare size={16} className="text-violet-600" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 truncate">
                          {r.input.first_name} {r.input.last_name}
                        </span>
                        <StatusBadge status={r.status} />
                        {r.confidence && r.status === 'found' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            r.confidence === 'high' ? 'bg-green-50 text-green-600' :
                            r.confidence === 'medium' ? 'bg-amber-50 text-amber-600' :
                            'bg-gray-50 text-gray-500'
                          }`}>
                            {r.confidence}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                        {r.input.organization && (
                          <span className="flex items-center gap-1">
                            <Building2 size={12} />
                            {r.input.organization}
                          </span>
                        )}
                        {r.input.location && (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} />
                            {r.input.location}
                          </span>
                        )}
                        {r.input.specialty && (
                          <span className="flex items-center gap-1">
                            <Stethoscope size={12} />
                            {r.input.specialty}
                          </span>
                        )}
                      </div>
                      {r.source_url && r.status === 'found' && (
                        <a
                          href={r.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:text-blue-700 mt-1 inline-flex items-center gap-1"
                        >
                          <ExternalLink size={10} />
                          {r.source_description || 'Fuente'}
                        </a>
                      )}
                      {r.notes && r.status === 'not_found' && (
                        <p className="text-xs text-gray-400 mt-1">{r.notes}</p>
                      )}
                      {r.error && (
                        <p className="text-xs text-red-600 mt-1">{r.error}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {r.email && (
                      <button
                        onClick={() => handleCopyEmail(r.email)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors"
                      >
                        <Mail size={14} />
                        <span className="font-mono">{r.email}</span>
                        {copiedEmail === r.email ? (
                          <CheckCircle size={14} className="text-green-500" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Save as leads */}
          {foundResults.length > 0 && (
            <div className="px-5 py-4 border-t border-gray-200 bg-violet-50/50">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs text-violet-600 hover:text-violet-800 font-medium"
                  >
                    {selectedCount === foundResults.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  </button>
                  <span className="text-xs text-gray-500">
                    {selectedCount} de {foundResults.length} seleccionados
                  </span>
                  <select
                    value={saveVertical}
                    onChange={(e) => setSaveVertical(e.target.value)}
                    className="text-xs px-2 py-1 border border-gray-300 rounded-md bg-white"
                  >
                    {Object.entries(GROWTH_VERTICALS).map(([key, v]) => (
                      <option key={key} value={key}>{v.label || key}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleSaveAsLeads}
                  disabled={saving || selectedCount === 0}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      Guardar como leads
                    </>
                  )}
                </button>
              </div>
              {saveResult && (
                <div className={`mt-3 text-xs p-2 rounded-lg ${
                  saveResult.errors > 0
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {saveResult.saved} lead{saveResult.saved !== 1 ? 's' : ''} guardado{saveResult.saved !== 1 ? 's' : ''} en Growth System
                  {saveResult.errors > 0 && ` (${saveResult.errors} error${saveResult.errors !== 1 ? 'es' : ''})`}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BulkEmailSearch;
