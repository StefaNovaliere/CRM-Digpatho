// src/components/growth/ApolloEmailSearch.jsx
// Buscador masivo de emails via Apollo.io
// Diferente del Growth System (descubrimiento en LinkedIn): este toma una lista
// de contactos YA conocidos y busca el email asociado a cada uno.

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
  Zap,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';

const INPUT_MODES = {
  MANUAL: 'manual',
  EXCEL: 'excel',
};

const HEADER_ALIASES = {
  first_name: ['first_name', 'firstname', 'nombre', 'name', 'first', 'given_name'],
  last_name: ['last_name', 'lastname', 'apellido', 'surname', 'last', 'family_name'],
  organization_name: ['organization', 'organization_name', 'company', 'empresa', 'institution', 'institucion', 'org', 'employer'],
  domain: ['domain', 'website', 'dominio', 'web'],
  linkedin_url: ['linkedin', 'linkedin_url', 'linkedinurl', 'linkedin_link'],
};

function matchHeader(header) {
  const norm = String(header || '').trim().toLowerCase().replace(/[\s\-]+/g, '_');
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(norm)) return field;
  }
  return null;
}

// Parse manual textarea input. Formats supported per line:
//   "Nombre Apellido"                            → first/last name split
//   "Nombre Apellido, Empresa"                   → name + company
//   "Nombre, Apellido, Empresa[, dominio.com]"   → all fields explicit
//   tab-separated (paste from Excel) — also works
function parseManualInput(text) {
  return text.split('\n').map(line => {
    const parts = line.split(/[\t,|;]/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return null;

    // 3+ parts → assume explicit columns
    if (parts.length >= 3) {
      return {
        first_name: parts[0],
        last_name: parts[1],
        organization_name: parts[2],
        domain: parts[3] || '',
      };
    }

    // 1-2 parts → first token group is full name, second (if any) is company
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
          reject(new Error('No se encontraron columnas de nombre. Usá columnas: first_name, last_name, organization_name (o equivalentes en español).'));
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
    empresa_input: r.input.organization_name || '',
    email: r.email || '',
    estado: r.status === 'found' ? 'Encontrado' : r.status === 'not_found' ? 'No encontrado' : 'Error',
    email_verificacion: r.email_status || '',
    cargo: r.title || '',
    seniority: r.seniority || '',
    organizacion_apollo: r.organization || '',
    dominio: r.organization_domain || '',
    linkedin: r.linkedin_url || '',
    ciudad: r.city || '',
    pais: r.country || '',
    error: r.error || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Resultados Apollo');
  const filename = `apollo_emails_${new Date().toISOString().slice(0, 10)}.xlsx`;
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

export const ApolloEmailSearch = () => {
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

    try {
      const response = await fetch('/api/apollo-bulk-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Error ${response.status}`);
      }

      setResults(data.results || []);
      setSummary(data.summary || null);
    } catch (err) {
      console.error('Apollo search error:', err);
      setSearchError(err.message || 'Error al buscar emails.');
    } finally {
      setSearching(false);
    }
  };

  const handleClearResults = () => {
    setResults([]);
    setSummary(null);
    setSearchError(null);
  };

  const handleCopyEmail = (email) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 1500);
  };

  const contactCount = contactsToSearch.length;

  return (
    <div className="space-y-5">
      {/* Header explicativo */}
      <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-xl">
        <div className="w-10 h-10 bg-cyan-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">Buscador masivo de emails (Apollo.io)</h3>
          <p className="text-sm text-gray-600">
            Cargá una lista de contactos que <strong>ya conocés</strong> (nombre + empresa) y Apollo
            devuelve sus emails profesionales en bloque. Distinto del Growth System, que descubre
            contactos nuevos desde LinkedIn.
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
                <li><code className="bg-white px-1 rounded">Nombre Apellido, Empresa</code></li>
                <li><code className="bg-white px-1 rounded">Nombre, Apellido, Empresa, dominio.com</code></li>
                <li>O pegá directo desde Excel (separado por tabs)</li>
              </ul>
            </div>
          </div>
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            rows={8}
            placeholder={'Juan Pérez, Hospital Italiano\nMaría García, Roche Argentina\nCarlos López, FLENI'}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-mono"
          />
        </div>
      )}

      {/* Excel input */}
      {mode === INPUT_MODES.EXCEL && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              El archivo debe tener una fila de headers con columnas como:{' '}
              <code className="bg-white px-1 rounded">first_name</code>,{' '}
              <code className="bg-white px-1 rounded">last_name</code>,{' '}
              <code className="bg-white px-1 rounded">organization_name</code> (o sus equivalentes en español:
              nombre, apellido, empresa).
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
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {searching ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              Buscando emails...
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 truncate">
                        {r.input.first_name} {r.input.last_name}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {r.input.organization_name && (
                        <span className="flex items-center gap-1">
                          <Building2 size={12} />
                          {r.input.organization_name}
                        </span>
                      )}
                      {r.title && r.status === 'found' && (
                        <span>{r.title}</span>
                      )}
                      {r.country && r.status === 'found' && (
                        <span>{r.country}</span>
                      )}
                    </div>
                    {r.error && (
                      <p className="text-xs text-red-600 mt-1">{r.error}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {r.email && (
                      <button
                        onClick={() => handleCopyEmail(r.email)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
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
                    {r.linkedin_url && (
                      <a
                        href={r.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ver en LinkedIn"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApolloEmailSearch;
