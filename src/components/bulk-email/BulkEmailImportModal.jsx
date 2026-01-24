// src/components/bulk-email/BulkEmailImportModal.jsx
import { useState, useCallback } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Loader2,
  Mail,
  Users,
  Eye
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import * as XLSX from 'xlsx';

// Campos requeridos para envío masivo
const REQUIRED_FIELDS = [
  { key: 'email', label: 'Email (destino)', required: true },
  { key: 'subject', label: 'Asunto del Email', required: true },
  { key: 'body', label: 'Cuerpo del Email', required: true },
];

const OPTIONAL_CONTACT_FIELDS = [
  { key: 'first_name', label: 'Nombre' },
  { key: 'last_name', label: 'Apellido' },
  { key: 'institution_name', label: 'Institución' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'country', label: 'País' },
  { key: 'job_title', label: 'Cargo' },
  { key: 'ai_context', label: 'Contexto IA' },
];

export const BulkEmailImportModal = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1: Upload, 2: Map, 3: Preview, 4: Creating
  const [campaignName, setCampaignName] = useState('');

  // <--- NUEVO: Estado para CC (con valor por defecto)
  const [ccEmails, setCcEmails] = useState('octavio.carranza@digpatho.com');

  const [file, setFile] = useState(null);
  const [fileData, setFileData] = useState([]);
  const [fileColumns, setFileColumns] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [previewEmail, setPreviewEmail] = useState(null);

  // Leer archivo
  const handleFileUpload = useCallback(async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setError(null);
    setFile(uploadedFile);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        if (jsonData.length < 2) {
          setError('El archivo está vacío o no tiene datos');
          return;
        }

        const columns = jsonData[0].map(col => String(col || '').trim());
        const rows = jsonData.slice(1).map(row => {
          const obj = {};
          columns.forEach((col, idx) => {
            obj[col] = row[idx] !== undefined ? String(row[idx]).trim() : '';
          });
          return obj;
        }).filter(row => Object.values(row).some(v => v));

        setFileColumns(columns);
        setFileData(rows);
        setMapping(autoMapColumns(columns));

        // Nombre sugerido de campaña
        const fileName = uploadedFile.name.replace(/\.[^/.]+$/, '');
        setCampaignName(`Campaña - ${fileName}`);

        setStep(2);
      };
      reader.readAsArrayBuffer(uploadedFile);
    } catch (err) {
      setError('Error al leer el archivo');
      console.error(err);
    }
  }, []);

  // Auto-mapear columnas
  const autoMapColumns = (columns) => {
    const map = {};
    const lower = columns.map(c => c.toLowerCase());

    const autoMaps = {
      'email': ['email', 'correo', 'mail', 'e-mail'],
      'subject': ['asunto', 'subject', 'encabezado', 'titulo'],
      'body': ['cuerpo', 'body', 'mensaje', 'contenido', 'texto'],
      'first_name': ['nombre', 'first name', 'first_name'],
      'last_name': ['apellido', 'last name', 'last_name'],
      'institution_name': ['institución', 'institucion', 'empresa', 'organización'],
      'phone': ['teléfono', 'telefono', 'phone', 'celular'],
      'country': ['país', 'pais', 'country'],
      'job_title': ['cargo', 'puesto', 'position'],
      'ai_context': ['contexto', 'notas', 'argumento'],
    };

    Object.entries(autoMaps).forEach(([field, keywords]) => {
      const matched = columns.find((col, idx) =>
        keywords.some(kw => lower[idx].includes(kw))
      );
      if (matched) map[field] = matched;
    });

    // Nombre completo
    const fullName = columns.find(c =>
      c.toLowerCase().includes('nombre y apellido') ||
      c.toLowerCase().includes('nombre completo')
    );
    if (fullName) map['_full_name'] = fullName;

    return map;
  };

  const handleMappingChange = (field, col) => {
    setMapping(prev => {
      const next = { ...prev };
      if (col) next[field] = col;
      else delete next[field];
      return next;
    });
  };

  // Parsear nombre completo
  const parseFullName = (name) => {
    const clean = name.replace(/^(Dr\.|Dra\.|Lic\.|Ing\.)\s*/i, '').trim();
    const parts = clean.split(/\s+/);
    return parts.length === 1
      ? { firstName: parts[0], lastName: '' }
      : { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  };

  // Transformar fila
  const transformRow = (row) => {
    const result = {};

    // Nombre completo
    if (mapping['_full_name'] && row[mapping['_full_name']]) {
      const { firstName, lastName } = parseFullName(row[mapping['_full_name']]);
      result.first_name = firstName;
      result.last_name = lastName;
    }

    // Campos directos
    [...REQUIRED_FIELDS, ...OPTIONAL_CONTACT_FIELDS].forEach(f => {
      if (mapping[f.key] && !result[f.key]) {
        result[f.key] = row[mapping[f.key]] || '';
      }
    });

    return result;
  };

  // Preview data
  const getPreviewData = () => fileData.slice(0, 5).map(transformRow);

  // Validar mapeo
  const isValidMapping = () => {
    return mapping.email && mapping.subject && mapping.body;
  };

  // Crear campaña
  const handleCreateCampaign = async () => {
    if (!campaignName.trim()) {
      setError('Ingresá un nombre para la campaña');
      return;
    }

    setImporting(true);
    setError(null);

    try {
      // 1. Crear campaña
      const { data: campaign, error: campError } = await supabase
        .from('bulk_email_campaigns')
        .insert({
          name: campaignName.trim(),
          cc_emails: ccEmails.trim(), // <--- NUEVO: Guardamos los CC
          status: 'ready',
          total_emails: fileData.length,
          created_by: user.id
        })
        .select()
        .single();

      if (campError) throw campError;

      // 2. Procesar cada fila
      const queueItems = [];
      const seenEmails = new Set();

      for (const row of fileData) {
        const t = transformRow(row);

        if (!t.email || !t.email.includes('@')) continue;
        if (seenEmails.has(t.email.toLowerCase())) continue;
        seenEmails.add(t.email.toLowerCase());

        // Verificar si el contacto ya existe
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('email', t.email)
          .maybeSingle();

        let contactId = existingContact?.id;

        // Si no existe y tenemos nombre, crear contacto
        if (!contactId && (t.first_name || t.last_name)) {
          const { data: newContact, error: contactError } = await supabase
            .from('contacts')
            .insert({
              first_name: t.first_name || 'Sin',
              last_name: t.last_name || 'Nombre',
              email: t.email,
              phone: t.phone || null,
              job_title: t.job_title || null,
              country: t.country || null,
              ai_context: t.ai_context || null,
              interest_level: 'cold',
              source: `Importación masiva: ${campaignName}`
            })
            .select()
            .single();

          if (!contactError && newContact) {
            contactId = newContact.id;
          }
        }

        // Agregar a la cola
        queueItems.push({
          campaign_id: campaign.id,
          contact_id: contactId || null,
          to_email: t.email,
          to_name: t.first_name ? `${t.first_name} ${t.last_name || ''}`.trim() : null,
          subject: t.subject,
          body: t.body,
          status: 'pending'
        });
      }

      // 3. Insertar cola de emails
      if (queueItems.length > 0) {
        const { error: queueError } = await supabase
          .from('bulk_email_queue')
          .insert(queueItems);

        if (queueError) throw queueError;
      }

      // 4. Actualizar total real
      await supabase
        .from('bulk_email_campaigns')
        .update({ total_emails: queueItems.length })
        .eq('id', campaign.id);

      onSuccess();
    } catch (err) {
      console.error('Error creating campaign:', err);
      setError('Error al crear la campaña: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex items-center justify-center min-h-screen p-4">
        <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-primary-500 to-primary-700">
            <div className="text-white">
              <h2 className="text-lg font-semibold">Nueva Campaña de Envío Masivo</h2>
              <p className="text-sm text-primary-100">
                {step === 1 && 'Paso 1: Subí tu archivo Excel'}
                {step === 2 && 'Paso 2: Mapeá las columnas'}
                {step === 3 && 'Paso 3: Revisá y confirmá'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
            <div className="flex items-center gap-2">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= s ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {step > s ? <CheckCircle className="w-5 h-5" /> : s}
                  </div>
                  {s < 3 && <div className={`w-12 h-1 mx-2 rounded ${step > s ? 'bg-primary-500' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Step 1: Upload */}
            {step === 1 && (
              <div className="text-center py-8">
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-gray-300 rounded-2xl p-12 hover:border-primary-400 hover:bg-primary-50/50 transition-all">
                    <FileSpreadsheet className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      Arrastrá o hacé click para subir
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      Excel (.xlsx) o CSV con columnas: Email, Asunto, Cuerpo del mensaje
                    </p>
                    <p className="text-xs text-gray-400">
                      También podés incluir: Nombre, Apellido, Institución, etc.
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {/* Step 2: Mapping */}
            {step === 2 && (
              <div className="space-y-6">
                {/* Campaign Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de la Campaña
                  </label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="input w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Ej: Campaña Pharma Q1 2026"
                  />
                </div>

                {/* <--- NUEVO: INPUT PARA CC EMAILS ---> */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    En copia a (CC)
                  </label>
                  <input
                    type="text"
                    value={ccEmails}
                    onChange={(e) => setCcEmails(e.target.value)}
                    className="input w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="octavio@ejemplo.com, otro@ejemplo.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Opcional. Separa múltiples correos con comas.
                  </p>
                </div>
                {/* ------------------------------------- */}

                {/* File Info */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-sm text-blue-700">
                    <strong>Archivo:</strong> {file?.name} • <strong>{fileData.length}</strong> filas con datos
                  </p>
                </div>

                {/* Required Fields */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-primary-500" />
                    Campos del Email (requeridos)
                  </h3>
                  <div className="space-y-3">
                    {REQUIRED_FIELDS.map(f => (
                      <div key={f.key} className="flex items-center justify-between p-3 bg-primary-50 border border-primary-200 rounded-xl">
                        <p className="font-medium text-gray-900">
                          {f.label} <span className="text-red-500">*</span>
                        </p>
                        <select
                          value={mapping[f.key] || ''}
                          onChange={(e) => handleMappingChange(f.key, e.target.value)}
                          className="w-64 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:border-primary-500 outline-none"
                        >
                          <option value="">-- Seleccionar --</option>
                          {fileColumns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Optional Contact Fields */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-500" />
                    Datos del Contacto (opcionales, se guardarán en Contactos)
                  </h3>

                  {/* Nombre completo toggle */}
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 mb-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!mapping['_full_name']}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleMappingChange('_full_name', fileColumns[0]);
                          } else {
                            handleMappingChange('_full_name', null);
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-primary-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Usar columna de "Nombre Completo"
                      </span>
                    </label>
                    {mapping['_full_name'] && (
                      <select
                        value={mapping['_full_name']}
                        onChange={(e) => handleMappingChange('_full_name', e.target.value)}
                        className="mt-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      >
                        {fileColumns.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    )}
                  </div>

                  <div className="space-y-2">
                    {OPTIONAL_CONTACT_FIELDS.map(f => (
                      <div key={f.key} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl">
                        <p className="text-sm text-gray-700">{f.label}</p>
                        <select
                          value={mapping[f.key] || ''}
                          onChange={(e) => handleMappingChange(f.key, e.target.value)}
                          disabled={(f.key === 'first_name' || f.key === 'last_name') && mapping['_full_name']}
                          className="w-64 px-3 py-2 text-sm border border-gray-300 rounded-lg disabled:bg-gray-100"
                        >
                          <option value="">-- No importar --</option>
                          {fileColumns.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Preview */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                  <p className="text-sm text-green-700">
                    <strong>Campaña:</strong> {campaignName} • <strong>{fileData.length}</strong> emails a enviar
                    {/* <--- NUEVO: Mostrar aviso de CC en preview ---> */}
                    {ccEmails && (
                         <span className="block mt-1 text-xs">
                           (Con copia a: {ccEmails})
                         </span>
                    )}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Preview de los primeros 5 emails:
                  </h3>
                  <div className="space-y-3">
                    {getPreviewData().map((row, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-gray-50 border border-gray-200 rounded-xl"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              Para: {row.first_name ? `${row.first_name} ${row.last_name || ''}` : ''} &lt;{row.email}&gt;
                            </p>
                            <p className="text-sm text-gray-600 mt-1 truncate">
                              <strong>Asunto:</strong> {row.subject}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {row.body?.substring(0, 150)}...
                            </p>
                          </div>
                          <button
                            onClick={() => setPreviewEmail(row)}
                            className="ml-3 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-800">
                    <strong>Nota:</strong> Los contactos que no existan se crearán automáticamente
                    en la sección Contactos. Emails duplicados serán ignorados.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={step === 1 ? onClose : () => setStep(step - 1)}
              className="btn-secondary"
            >
              {step === 1 ? 'Cancelar' : 'Atrás'}
            </button>

            <div className="flex items-center gap-3">
              {step === 2 && (
                <button
                  onClick={() => setStep(3)}
                  disabled={!isValidMapping()}
                  className="btn-primary"
                >
                  Ver Preview
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {step === 3 && (
                <button
                  onClick={handleCreateCampaign}
                  disabled={importing}
                  className="btn-primary"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Crear Campaña ({fileData.length} emails)
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Email Preview Modal */}
      {previewEmail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setPreviewEmail(null)} />
          <div className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Preview del Email</h3>
              <button onClick={() => setPreviewEmail(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-gray-500 mb-1">Para:</p>
              <p className="font-medium text-gray-900 mb-4">{previewEmail.email}</p>

              <p className="text-sm text-gray-500 mb-1">Asunto:</p>
              <p className="font-medium text-gray-900 mb-4">{previewEmail.subject}</p>

              <p className="text-sm text-gray-500 mb-1">Mensaje:</p>
              <div className="p-4 bg-gray-50 rounded-lg whitespace-pre-wrap text-sm text-gray-700">
                {previewEmail.body}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkEmailImportModal;