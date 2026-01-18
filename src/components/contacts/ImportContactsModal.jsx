// src/components/contacts/ImportContactsModal.jsx
import { useState, useCallback } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  ChevronDown,
  Loader2,
  Download,
  Eye,
  Users
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import * as XLSX from 'xlsx';

// ========================================
// CAMPOS DEL CRM
// ========================================
const CRM_FIELDS = [
  { key: 'first_name', label: 'Nombre', required: true },
  { key: 'last_name', label: 'Apellido', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'phone', label: 'Teléfono', required: false },
  { key: 'institution_name', label: 'Institución', required: false },
  { key: 'role', label: 'Rol', required: false },
  { key: 'job_title', label: 'Cargo', required: false },
  { key: 'linkedin_url', label: 'LinkedIn', required: false },
  { key: 'interest_level', label: 'Nivel de Interés', required: false },
  { key: 'source', label: 'Fuente', required: false },
  { key: 'ai_context', label: 'Notas / Contexto IA', required: false },
];

// Mapeo de roles del Excel a valores del CRM
const ROLE_MAPPING = {
  'patólogo': 'pathologist',
  'patologo': 'pathologist',
  'patóloga': 'pathologist',
  'investigador': 'researcher',
  'investigadora': 'researcher',
  'director': 'hospital_director',
  'directora': 'hospital_director',
  'jefe': 'hospital_director',
  'jefa': 'hospital_director',
  'gerente': 'lab_manager',
  'lab manager': 'lab_manager',
  'compras': 'procurement',
  'adquisiciones': 'procurement',
  'médico': 'pathologist',
  'médica': 'pathologist',
  'medico': 'pathologist',
  'medica': 'pathologist',
};

// Mapeo de niveles de interés
const INTEREST_MAPPING = {
  'frío': 'cold',
  'frio': 'cold',
  'cold': 'cold',
  'tibio': 'warm',
  'warm': 'warm',
  'caliente': 'hot',
  'hot': 'hot',
  'cliente': 'customer',
  'customer': 'customer',
  'ex-cliente': 'churned',
  'churned': 'churned',
};

// ========================================
// COMPONENTE PRINCIPAL
// ========================================
export const ImportContactsModal = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState(1); // 1: Upload, 2: Map, 3: Preview, 4: Result
  const [file, setFile] = useState(null);
  const [fileData, setFileData] = useState([]);
  const [fileColumns, setFileColumns] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);

  // ========================================
  // PASO 1: Cargar archivo
  // ========================================
  const handleFileUpload = useCallback(async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setError(null);
    setFile(uploadedFile);

    try {
      const data = await readFile(uploadedFile);
      setFileData(data.rows);
      setFileColumns(data.columns);

      // Auto-mapear columnas similares
      const autoMapping = autoMapColumns(data.columns);
      setMapping(autoMapping);

      setStep(2);
    } catch (err) {
      setError('Error al leer el archivo. Asegurate de que sea un Excel (.xlsx) o CSV válido.');
      console.error(err);
    }
  }, []);

  // Leer archivo Excel o CSV
  const readFile = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

          if (jsonData.length < 2) {
            reject(new Error('El archivo está vacío o no tiene datos'));
            return;
          }

          const columns = jsonData[0].map(col => String(col || '').trim());
          const rows = jsonData.slice(1).map(row => {
            const obj = {};
            columns.forEach((col, idx) => {
              obj[col] = row[idx] !== undefined ? String(row[idx]).trim() : '';
            });
            return obj;
          }).filter(row => Object.values(row).some(v => v)); // Filtrar filas vacías

          resolve({ columns, rows });
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  // Auto-mapear columnas basándose en nombres similares
  const autoMapColumns = (columns) => {
    const mapping = {};
    const columnLower = columns.map(c => c.toLowerCase());

    // Mapeos comunes
    const autoMaps = {
      'first_name': ['nombre', 'first name', 'first_name', 'primer nombre'],
      'last_name': ['apellido', 'last name', 'last_name', 'segundo nombre'],
      'email': ['email', 'correo', 'e-mail', 'mail'],
      'phone': ['teléfono', 'telefono', 'phone', 'celular', 'whatsapp', 'tel'],
      'institution_name': ['institución', 'institucion', 'institution', 'empresa', 'hospital', 'organización'],
      'role': ['rol', 'role', 'tipo'],
      'job_title': ['cargo', 'puesto', 'job title', 'position', 'título'],
      'linkedin_url': ['linkedin', 'linkedin url'],
      'interest_level': ['interés', 'interes', 'interest', 'nivel'],
      'source': ['fuente', 'source', 'origen', 'canal'],
      'ai_context': ['notas', 'notes', 'contexto', 'perfil', 'comentarios', 'observaciones'],
    };

    Object.entries(autoMaps).forEach(([crmField, keywords]) => {
      const matchedCol = columns.find((col, idx) =>
        keywords.some(kw => columnLower[idx].includes(kw))
      );
      if (matchedCol) {
        mapping[crmField] = matchedCol;
      }
    });

    // Caso especial: "Nombre del Contacto" -> separar en nombre y apellido
    const nombreCompleto = columns.find(c =>
      c.toLowerCase().includes('nombre del contacto') ||
      c.toLowerCase().includes('nombre completo')
    );
    if (nombreCompleto && !mapping.first_name) {
      mapping['_full_name'] = nombreCompleto; // Marcador especial
    }

    return mapping;
  };

  // ========================================
  // PASO 2: Mapear columnas
  // ========================================
  const handleMappingChange = (crmField, excelColumn) => {
    setMapping(prev => ({
      ...prev,
      [crmField]: excelColumn || undefined
    }));
  };

  // ========================================
  // PASO 3: Preview y transformar datos
  // ========================================
  const getPreviewData = () => {
    return fileData.slice(0, 5).map(row => transformRow(row));
  };

  const transformRow = (row) => {
    const contact = {};

    // Caso especial: nombre completo a separar
    if (mapping['_full_name']) {
      const fullName = row[mapping['_full_name']] || '';
      const parts = splitName(fullName);
      contact.first_name = parts.firstName;
      contact.last_name = parts.lastName;
    }

    // Mapear campos normales
    CRM_FIELDS.forEach(field => {
      if (field.key === 'first_name' && contact.first_name) return;
      if (field.key === 'last_name' && contact.last_name) return;

      const excelCol = mapping[field.key];
      if (excelCol && row[excelCol]) {
        let value = row[excelCol];

        // Transformaciones especiales
        if (field.key === 'role') {
          value = normalizeRole(value);
        } else if (field.key === 'interest_level') {
          value = normalizeInterestLevel(value);
        }

        contact[field.key] = value;
      }
    });

    return contact;
  };

  // Separar nombre completo en nombre y apellido
  const splitName = (fullName) => {
    // Quitar títulos como "Dr.", "Dra.", "Lic.", etc.
    const cleanName = fullName
      .replace(/^(dr\.?|dra\.?|lic\.?|ing\.?|prof\.?)\s+/i, '')
      .trim();

    const parts = cleanName.split(/\s+/);

    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    } else if (parts.length === 2) {
      return { firstName: parts[0], lastName: parts[1] };
    } else {
      // Asumir que el último es apellido, el resto es nombre
      return {
        firstName: parts.slice(0, -1).join(' '),
        lastName: parts[parts.length - 1]
      };
    }
  };

  // Normalizar rol
  const normalizeRole = (value) => {
    const lower = value.toLowerCase();
    for (const [keyword, role] of Object.entries(ROLE_MAPPING)) {
      if (lower.includes(keyword)) {
        return role;
      }
    }
    return 'other';
  };

  // Normalizar nivel de interés
  const normalizeInterestLevel = (value) => {
    const lower = value.toLowerCase();
    for (const [keyword, level] of Object.entries(INTEREST_MAPPING)) {
      if (lower.includes(keyword)) {
        return level;
      }
    }
    return 'cold'; // Default
  };

  // ========================================
  // PASO 4: Importar a Supabase
  // ========================================
  const handleImport = async () => {
    setImporting(true);
    setError(null);

    try {
      const contacts = fileData.map(row => transformRow(row));

      // Validar que tengan al menos nombre
      const validContacts = contacts.filter(c => c.first_name);
      const invalidCount = contacts.length - validContacts.length;

      // Buscar o crear instituciones
      const institutionNames = [...new Set(validContacts.map(c => c.institution_name).filter(Boolean))];
      const institutionMap = {};

      for (const name of institutionNames) {
        // Buscar si existe
        const { data: existing } = await supabase
          .from('institutions')
          .select('id')
          .ilike('name', name)
          .limit(1);

        if (existing && existing.length > 0) {
          institutionMap[name] = existing[0].id;
        } else {
          // Crear nueva institución
          const { data: newInst } = await supabase
            .from('institutions')
            .insert([{ name }])
            .select('id')
            .single();

          if (newInst) {
            institutionMap[name] = newInst.id;
          }
        }
      }

      // Preparar contactos para insertar
      const contactsToInsert = validContacts.map(c => {
        const { institution_name, ...rest } = c;
        return {
          ...rest,
          institution_id: institution_name ? institutionMap[institution_name] : null,
          interest_level: rest.interest_level || 'cold',
        };
      });

      // Insertar en batches de 50
      const batchSize = 50;
      let inserted = 0;
      let errors = 0;

      for (let i = 0; i < contactsToInsert.length; i += batchSize) {
        const batch = contactsToInsert.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('contacts')
          .insert(batch)
          .select();

        if (error) {
          console.error('Batch error:', error);
          errors += batch.length;
        } else {
          inserted += data.length;
        }
      }

      setImportResult({
        total: contacts.length,
        imported: inserted,
        skipped: invalidCount,
        errors,
        institutions: institutionNames.length
      });

      setStep(4);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Import error:', err);
      setError('Error durante la importación: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  // ========================================
  // RESET
  // ========================================
  const handleReset = () => {
    setStep(1);
    setFile(null);
    setFileData([]);
    setFileColumns([]);
    setMapping({});
    setImportResult(null);
    setError(null);
  };

  // ========================================
  // RENDER
  // ========================================
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary-100">
                <FileSpreadsheet className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Importar Contactos</h2>
                <p className="text-sm text-gray-500">
                  {step === 1 && 'Subí tu archivo Excel o CSV'}
                  {step === 2 && 'Mapeá las columnas'}
                  {step === 3 && 'Revisá el preview'}
                  {step === 4 && 'Importación completada'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 rounded-lg hover:bg-gray-200 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Steps Indicator */}
          <div className="px-6 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between max-w-md mx-auto">
              {[1, 2, 3, 4].map((s) => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    step >= s
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step > s ? <CheckCircle className="w-4 h-4" /> : s}
                  </div>
                  {s < 4 && (
                    <div className={`w-12 h-1 mx-1 rounded ${
                      step > s ? 'bg-primary-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {/* Error */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Step 1: Upload */}
            {step === 1 && (
              <div className="text-center py-8">
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-gray-300 rounded-2xl p-12 hover:border-primary-500 hover:bg-primary-50/50 transition-all">
                    <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      Arrastrá o hacé click para subir
                    </p>
                    <p className="text-sm text-gray-500">
                      Archivos soportados: .xlsx, .xls, .csv
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-left">
                  <p className="text-sm text-amber-800">
                    <strong>Tip:</strong> Tu archivo debe tener una fila de encabezados.
                    Los campos obligatorios son <strong>Nombre</strong> y <strong>Apellido</strong>
                    (o una columna de "Nombre Completo" que se separará automáticamente).
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Mapping */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-sm text-blue-800">
                    <strong>Archivo cargado:</strong> {file?.name} ({fileData.length} filas)
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">
                    Seleccioná qué columna del Excel corresponde a cada campo del CRM:
                  </p>

                  {/* Caso especial: nombre completo */}
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">Nombre Completo</p>
                        <p className="text-xs text-gray-500">Se separará automáticamente en nombre y apellido</p>
                      </div>
                      <select
                        value={mapping['_full_name'] || ''}
                        onChange={(e) => handleMappingChange('_full_name', e.target.value)}
                        className="w-64 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none"
                      >
                        <option value="">-- No usar --</option>
                        {fileColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Campos normales */}
                  <div className="grid gap-3">
                    {CRM_FIELDS.map(field => (
                      <div
                        key={field.key}
                        className={`flex items-center justify-between p-3 rounded-xl border ${
                          field.required ? 'bg-primary-50/50 border-primary-200' : 'bg-white border-gray-200'
                        }`}
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </p>
                        </div>
                        <select
                          value={mapping[field.key] || ''}
                          onChange={(e) => handleMappingChange(field.key, e.target.value)}
                          disabled={
                            (field.key === 'first_name' || field.key === 'last_name') &&
                            mapping['_full_name']
                          }
                          className="w-64 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none disabled:bg-gray-100 disabled:text-gray-500"
                        >
                          <option value="">-- No importar --</option>
                          {fileColumns.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Preview */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-700">
                    Preview de las primeras 5 filas:
                  </p>
                  <span className="text-sm text-gray-500">
                    Total a importar: {fileData.length} contactos
                  </span>
                </div>

                <div className="overflow-x-auto border border-gray-200 rounded-xl">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Nombre</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Apellido</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Email</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Institución</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Rol</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {getPreviewData().map((row, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3">{row.first_name || '-'}</td>
                          <td className="px-4 py-3">{row.last_name || '-'}</td>
                          <td className="px-4 py-3 text-gray-500">{row.email || '-'}</td>
                          <td className="px-4 py-3 text-gray-500">{row.institution_name || '-'}</td>
                          <td className="px-4 py-3">
                            {row.role && (
                              <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-700">
                                {row.role}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-800">
                    <strong>Nota:</strong> Los contactos sin nombre serán omitidos.
                    Las instituciones nuevas se crearán automáticamente.
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Result */}
            {step === 4 && importResult && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  ¡Importación Completada!
                </h3>
                <p className="text-gray-500 mb-6">
                  Se procesaron {importResult.total} filas del archivo
                </p>

                <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto text-left">
                  <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                    <p className="text-2xl font-bold text-green-700">{importResult.imported}</p>
                    <p className="text-sm text-green-600">Contactos importados</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-2xl font-bold text-blue-700">{importResult.institutions}</p>
                    <p className="text-sm text-blue-600">Instituciones</p>
                  </div>
                  {importResult.skipped > 0 && (
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <p className="text-2xl font-bold text-amber-700">{importResult.skipped}</p>
                      <p className="text-sm text-amber-600">Omitidos (sin nombre)</p>
                    </div>
                  )}
                  {importResult.errors > 0 && (
                    <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                      <p className="text-2xl font-bold text-red-700">{importResult.errors}</p>
                      <p className="text-sm text-red-600">Errores</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={step === 4 ? handleReset : onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              {step === 4 ? 'Importar más' : 'Cancelar'}
            </button>

            <div className="flex items-center gap-3">
              {step > 1 && step < 4 && (
                <button
                  onClick={() => setStep(step - 1)}
                  className="btn-secondary"
                >
                  Atrás
                </button>
              )}

              {step === 2 && (
                <button
                  onClick={() => setStep(3)}
                  disabled={!mapping.first_name && !mapping['_full_name']}
                  className="btn-primary"
                >
                  Ver Preview
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {step === 3 && (
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="btn-primary"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Importar {fileData.length} contactos
                    </>
                  )}
                </button>
              )}

              {step === 4 && (
                <button onClick={onClose} className="btn-primary">
                  <CheckCircle className="w-4 h-4" />
                  Listo
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportContactsModal;
