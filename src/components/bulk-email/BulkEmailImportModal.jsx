// src/components/bulk-email/BulkEmailImportModal.jsx
import { useState, useCallback, useEffect } from 'react';
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
  Eye,
  AlertTriangle,
  Paperclip,
  Trash2,
  Send
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

// Auto-mapeo EXPANDIDO con más variantes
const AUTO_MAP_KEYWORDS = {
  'email': ['email', 'correo', 'mail', 'e-mail', 'mail principal', 'email principal', 'mail address'],
  'subject': ['asunto', 'subject', 'encabezado', 'titulo', 'encabezado email', 'asunto email', 'subject line'],
  'body': ['cuerpo', 'body', 'mensaje', 'contenido', 'texto', 'cuerpo email', 'cuerpo del email', 'message', 'cuerpo del correo'],
  'first_name': ['nombre', 'first name', 'first_name', 'nombres', 'name'],
  'last_name': ['apellido', 'last name', 'last_name', 'apellidos', 'surname'],
  'institution_name': ['institución', 'institucion', 'empresa', 'organización', 'organizacion', 'institution', 'company', 'hospital', 'centro'],
  'phone': ['teléfono', 'telefono', 'phone', 'celular', 'móvil', 'movil', 'whatsapp', 'tel'],
  'country': ['país', 'pais', 'country', 'region'],
  'job_title': ['cargo', 'puesto', 'position', 'title', 'rol', 'role', 'job'],
  'ai_context': ['contexto', 'notas', 'argumento', 'notes', 'context', 'tema', 'importancia'],
};

export const BulkEmailImportModal = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState('');
  const [file, setFile] = useState(null);
  const [fileData, setFileData] = useState([]);
  const [fileColumns, setFileColumns] = useState([]);
  const [mapping, setMapping] = useState({});
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [previewEmail, setPreviewEmail] = useState(null);
  const [ccEmails, setCcEmails] = useState(''); // Campo CC global para toda la campaña
  const [attachmentFile, setAttachmentFile] = useState(null); // Archivo adjunto para toda la campaña
  const [senderUsers, setSenderUsers] = useState([]); // Usuarios con Gmail conectado
  const [selectedSenderId, setSelectedSenderId] = useState(user?.id || ''); // Remitente seleccionado

  // Cargar usuarios con Gmail conectado
  useEffect(() => {
    const loadSenders = async () => {
      const { data, error: fetchErr } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, google_access_token')
        .not('google_access_token', 'is', null);

      if (!fetchErr && data) {
        setSenderUsers(data);
        // Si el usuario actual no está en la lista, seleccionar el primero
        if (!data.find(u => u.id === user?.id) && data.length > 0) {
          setSelectedSenderId(data[0].id);
        }
      }
    };
    loadSenders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detectar si una fila parece ser de headers (tiene texto, no datos)
  const isHeaderRow = (row) => {
    if (!row || row.length === 0) return false;
    
    // Contar cuántas celdas tienen valores que parecen headers
    let headerLikeCount = 0;
    let emptyCount = 0;
    
    for (const cell of row) {
      const val = String(cell || '').trim().toLowerCase();
      if (!val || val === 'nan' || val === 'undefined') {
        emptyCount++;
        continue;
      }
      // Verificar si parece un header (palabras comunes de headers)
      const headerKeywords = ['nombre', 'email', 'mail', 'asunto', 'mensaje', 'telefono', 'pais', 'cargo', 
                             'institucion', 'apellido', 'cuerpo', 'encabezado', 'linkedin', 'whatsapp',
                             'name', 'subject', 'body', 'phone', 'country', 'title', 'message'];
      if (headerKeywords.some(kw => val.includes(kw))) {
        headerLikeCount++;
      }
    }
    
    // Si más del 30% de las celdas parecen headers, probablemente es una fila de headers
    const nonEmptyCount = row.length - emptyCount;
    return nonEmptyCount > 0 && (headerLikeCount / nonEmptyCount) > 0.3;
  };

  // Leer archivo con detección inteligente de headers Y CORRECCIÓN DE ÍNDICES
  const handleFileUpload = useCallback(async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    setError(null);
    setWarning(null);
    setFile(uploadedFile);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (jsonData.length < 2) {
          setError('El archivo está vacío o no tiene datos suficientes');
          return;
        }

        // DETECTAR FILA DE HEADERS
        let headerRowIndex = 0;
        let foundHeaders = false;

        // Buscar la primera fila que parece tener headers (en las primeras 5 filas)
        for (let i = 0; i < Math.min(5, jsonData.length); i++) {
          if (isHeaderRow(jsonData[i])) {
            headerRowIndex = i;
            foundHeaders = true;
            break;
          }
        }

        // Si la primera fila tiene muchos "Unnamed" o está vacía, buscar la siguiente
        const firstRow = jsonData[0];
        const unnamedCount = firstRow.filter(cell => {
          const val = String(cell || '').trim().toLowerCase();
          return !val || val.includes('unnamed') || val === 'nan';
        }).length;

        if (unnamedCount > firstRow.length * 0.5 && !foundHeaders) {
          // La primera fila parece vacía, buscar headers más abajo
          for (let i = 1; i < Math.min(5, jsonData.length); i++) {
            const row = jsonData[i];
            const hasContent = row.some(cell => {
              const val = String(cell || '').trim();
              return val && val.toLowerCase() !== 'nan';
            });
            if (hasContent && isHeaderRow(row)) {
              headerRowIndex = i;
              setWarning(`Se detectó que los headers están en la fila ${i + 1}. Ajustando automáticamente...`);
              break;
            }
          }
        }

        // --- CORRECCIÓN CRÍTICA DE ÍNDICES ---
        // 1. Identificar columnas válidas y sus ÍNDICES ORIGINALES
        const rawHeaderRow = jsonData[headerRowIndex];
        const validColumnsMap = []; // Guardará { name: 'Email', index: 2 }

        rawHeaderRow.forEach((cell, originalIndex) => {
            const colName = String(cell || '').trim();
            if (colName && colName.toLowerCase() !== 'nan') {
                validColumnsMap.push({
                    name: colName,
                    index: originalIndex // Guardamos dónde está realmente en el Excel
                });
            }
        });

        // Extraemos solo los nombres para el estado
        const columns = validColumnsMap.map(c => c.name);
        
        // 2. Extraer filas usando los ÍNDICES ORIGINALES para no desfasar datos
        const rows = jsonData.slice(headerRowIndex + 1).map(row => {
          const obj = {};
          
          // Iteramos sobre nuestro mapa que tiene los índices correctos
          validColumnsMap.forEach(({ name, index }) => {
            const val = row[index]; // Usamos el índice original
            
            obj[name] = val !== undefined && val !== null && String(val).toLowerCase() !== 'nan' 
              ? String(val).trim() 
              : '';
          });
          
          return obj;
        }).filter(row => {
          // Filtrar filas completamente vacías
          return Object.values(row).some(v => v && v.trim());
        });
        // -------------------------------------

        if (columns.length === 0) {
          setError('No se pudieron detectar columnas válidas en el archivo');
          return;
        }

        if (rows.length === 0) {
          setError('No se encontraron datos en el archivo');
          return;
        }

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
      setError('Error al leer el archivo: ' + err.message);
      console.error(err);
    }
  }, []);

  // Auto-mapear columnas con keywords expandidos
  const autoMapColumns = (columns) => {
    const map = {};
    const lowerColumns = columns.map(c => c.toLowerCase().trim());

    // Para cada campo, buscar la mejor coincidencia
    Object.entries(AUTO_MAP_KEYWORDS).forEach(([field, keywords]) => {
      // Buscar coincidencia exacta primero
      let matched = columns.find((col, idx) => 
        keywords.some(kw => lowerColumns[idx] === kw)
      );
      
      // Si no hay exacta, buscar parcial
      if (!matched) {
        matched = columns.find((col, idx) => 
          keywords.some(kw => lowerColumns[idx].includes(kw))
        );
      }
      
      if (matched) {
        map[field] = matched;
      }
    });

    // Detectar nombre completo
    const fullNameCol = columns.find(c => {
      const lower = c.toLowerCase();
      return lower.includes('nombre y apellido') || 
             lower.includes('nombre completo') ||
             lower === 'nombre' && !columns.some(col => col.toLowerCase().includes('apellido'));
    });
    
    if (fullNameCol && !map.first_name) {
      map['_full_name'] = fullNameCol;
    }

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
    if (!name) return { firstName: '', lastName: '' };
    const clean = name.replace(/^(Dr\.|Dra\.|Lic\.|Ing\.|Prof\.)\s*/i, '').trim();
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

  // Contar emails válidos
  const getValidEmailCount = () => {
    return fileData.filter(row => {
      const email = row[mapping.email];
      return email && email.includes('@');
    }).length;
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
      // 0. Subir adjunto a Supabase Storage si existe
      let attachmentData = null;
      if (attachmentFile) {
        const filePath = `campaign-attachments/${user.id}/${Date.now()}_${attachmentFile.name}`;

        try {
          const { error: uploadError } = await supabase.storage
            .from('attachments')
            .upload(filePath, attachmentFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;

          attachmentData = {
            name: attachmentFile.name,
            path: filePath,
            content_type: attachmentFile.type || 'application/octet-stream',
            size: attachmentFile.size,
          };
        } catch (uploadErr) {
          console.warn('No se pudo subir adjunto (¿bucket "attachments" no existe?):', uploadErr.message);
          setWarning(`No se pudo subir el adjunto: ${uploadErr.message}. La campaña se creará sin adjunto.`);
          // Continuar sin adjunto
        }
      }

      // 1. Crear campaña
      const campaignInsert = {
        name: campaignName.trim(),
        status: 'ready',
        total_emails: fileData.length,
        created_by: user.id,
        sender_id: selectedSenderId || user.id
      };

      // Agregar datos del adjunto si existe
      if (attachmentData) {
        campaignInsert.attachment_name = attachmentData.name;
        campaignInsert.attachment_path = attachmentData.path;
        campaignInsert.attachment_content_type = attachmentData.content_type;
        campaignInsert.attachment_size = attachmentData.size;
      }

      // Campos opcionales que pueden no existir en la tabla aún
      const optionalFields = ['sender_id', 'attachment_name', 'attachment_path', 'attachment_content_type', 'attachment_size'];

      let campaign;
      let insertPayload = { ...campaignInsert };

      // Intentar insertar, si falla por columna inexistente, quitar ese campo y reintentar
      for (let attempt = 0; attempt <= optionalFields.length; attempt++) {
        const { data: campData, error: campError } = await supabase
          .from('bulk_email_campaigns')
          .insert(insertPayload)
          .select()
          .single();

        if (!campError) {
          campaign = campData;
          break;
        }

        // Buscar qué columna no existe en el mensaje de error
        const missingCol = optionalFields.find(
          col => insertPayload[col] !== undefined && campError.message?.includes(col)
        );

        if (missingCol) {
          console.warn(`Columna "${missingCol}" no existe en bulk_email_campaigns, reintentando sin ella.`);
          delete insertPayload[missingCol];
          continue;
        }

        // Si el error no es de columna inexistente, fallar
        throw campError;
      }

      if (!campaign) throw new Error('No se pudo crear la campaña después de múltiples intentos.');

      // 2. Procesar cada fila
      const queueItems = [];
      const seenEmails = new Set();
      let skippedCount = 0;

      for (const row of fileData) {
        const t = transformRow(row);
        
        // Validar email
        if (!t.email || !t.email.includes('@')) {
          skippedCount++;
          continue;
        }
        
        // Skip duplicados
        if (seenEmails.has(t.email.toLowerCase())) {
          skippedCount++;
          continue;
        }
        seenEmails.add(t.email.toLowerCase());

        // Validar que tenga asunto y cuerpo
        if (!t.subject || !t.body) {
          skippedCount++;
          continue;
        }

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

        // Parsear CC emails
        const ccList = ccEmails
          .split(/[,;]/)
          .map(email => email.trim())
          .filter(email => email && email.includes('@'));

        // Agregar a la cola
        queueItems.push({
          campaign_id: campaign.id,
          contact_id: contactId || null,
          to_email: t.email,
          to_name: t.first_name ? `${t.first_name} ${t.last_name || ''}`.trim() : null,
          subject: t.subject,
          body: t.body,
          cc_emails: ccList.length > 0 ? ccList : null,
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
            {/* Error */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Warning */}
            {warning && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <p className="text-sm text-amber-700">{warning}</p>
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
                      El sistema detectará automáticamente los headers aunque no estén en la primera fila
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
                    className="input"
                    placeholder="Ej: Campaña Pharma Q1 2026"
                  />
                </div>

                {/* Sender Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Send className="w-4 h-4 inline mr-1" />
                    Remitente (¿Quién envía?)
                  </label>
                  {senderUsers.length > 0 ? (
                    <select
                      value={selectedSenderId}
                      onChange={(e) => setSelectedSenderId(e.target.value)}
                      className="input"
                    >
                      {senderUsers.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.full_name || 'Sin nombre'} — {u.email}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                      No hay usuarios con Gmail conectado. Pedile a los usuarios que inicien sesión con Google.
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Los emails se enviarán desde la cuenta de Gmail de este usuario.
                  </p>
                </div>

                {/* CC Emails */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    En copia a (CC)
                  </label>
                  <input
                    type="text"
                    value={ccEmails}
                    onChange={(e) => setCcEmails(e.target.value)}
                    className="input"
                    placeholder="octavio.carranza.torres@digpatho.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Opcional. Separa múltiples correos con comas.
                  </p>
                </div>

                {/* Archivo adjunto */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Paperclip className="w-4 h-4 inline mr-1" />
                    Archivo adjunto (se envía a todos los emails)
                  </label>
                  {!attachmentFile ? (
                    <label className="block cursor-pointer">
                      <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-primary-400 hover:bg-primary-50/50 transition-all text-center">
                        <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                        <p className="text-sm text-gray-600">
                          Click para seleccionar archivo
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          PDF, Word, Excel, imágenes, etc. (máx. 10 MB)
                        </p>
                      </div>
                      <input
                        type="file"
                        onChange={(e) => {
                          const f = e.target.files[0];
                          if (!f) return;
                          if (f.size > 10 * 1024 * 1024) {
                            setError('El archivo adjunto no puede superar los 10 MB');
                            return;
                          }
                          setAttachmentFile(f);
                        }}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-primary-50 border border-primary-200 rounded-xl">
                      <div className="flex items-center gap-3 min-w-0">
                        <Paperclip className="w-5 h-5 text-primary-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{attachmentFile.name}</p>
                          <p className="text-xs text-gray-500">
                            {(attachmentFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setAttachmentFile(null)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0"
                        title="Quitar adjunto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Opcional. Este archivo se adjuntará a cada email de la campaña.
                  </p>
                </div>

                {/* File Info */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <p className="text-sm text-blue-700">
                    <strong>Archivo:</strong> {file?.name} • <strong>{fileData.length}</strong> filas con datos • <strong>{fileColumns.length}</strong> columnas detectadas
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
                      <div key={f.key} className={`flex items-center justify-between p-3 rounded-xl border ${
                        mapping[f.key] ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          {mapping[f.key] ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-red-500" />
                          )}
                          <p className="font-medium text-gray-900">
                            {f.label} <span className="text-red-500">*</span>
                          </p>
                        </div>
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
                    Datos del Contacto (opcionales)
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
                    <strong>Campaña:</strong> {campaignName} • <strong>{getValidEmailCount()}</strong> emails válidos de {fileData.length} filas
                  </p>
                  {(() => {
                    const sender = senderUsers.find(u => u.id === selectedSenderId);
                    return sender ? (
                      <p className="text-sm text-green-600 mt-1">
                        <strong>Remitente:</strong> {sender.full_name || 'Sin nombre'} ({sender.email})
                      </p>
                    ) : null;
                  })()}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Preview de los primeros 5 emails:
                  </h3>
                  <div className="space-y-3">
                    {getPreviewData().map((row, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border ${
                          row.email && row.email.includes('@') && row.subject && row.body
                            ? 'bg-gray-50 border-gray-200'
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              Para: {row.first_name ? `${row.first_name} ${row.last_name || ''}` : ''} &lt;{row.email || 'SIN EMAIL'}&gt;
                            </p>
                            <p className="text-sm text-gray-600 mt-1 truncate">
                              <strong>Asunto:</strong> {row.subject || 'SIN ASUNTO'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {row.body?.substring(0, 150) || 'SIN CUERPO'}...
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

                {attachmentFile && (
                  <div className="p-4 bg-primary-50 border border-primary-200 rounded-xl flex items-center gap-3">
                    <Paperclip className="w-5 h-5 text-primary-500 flex-shrink-0" />
                    <p className="text-sm text-primary-700">
                      <strong>Adjunto:</strong> {attachmentFile.name} ({(attachmentFile.size / 1024).toFixed(1)} KB) — se enviará con cada email
                    </p>
                  </div>
                )}

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-800">
                    <strong>Nota:</strong> Los contactos que no existan se crearán automáticamente.
                    Emails duplicados o sin datos requeridos serán ignorados.
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
                  disabled={importing || getValidEmailCount() === 0}
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
                      Crear Campaña ({getValidEmailCount()} emails)
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
