// src/config/constants.js
//
// Fuente única de los enums del CRM. Importar SIEMPRE desde acá: hasta la
// migración 009 cada componente hardcodeaba su propia copia (ContactForm,
// ContactCard, ContactDetail, Contacts, ImportContactsModal...), y eso las
// desincronizaba entre sí.
//
// NOTA: los niveles de interés (frío/tibio/caliente) se jubilaron en la 009.
// Los reemplazan PIPELINE_STAGES (dónde está en el proceso) y PRIORITY_LEVELS
// (cuánto nos importa), que son ejes distintos. La columna interest_level
// sigue en la base, sin uso, por si hay que volver atrás.

// ============================
// Pipeline comercial
// ============================

// Etapa: en qué punto de NUESTRO proceso está el contacto.
export const PIPELINE_STAGES = {
  new: {
    value: 'new',
    label: 'Nuevo',
    color: 'slate',
    description: 'Sin contactar todavía'
  },
  contacted: {
    value: 'contacted',
    label: 'Contactado',
    color: 'blue',
    description: 'Ya hubo un primer contacto'
  },
  qualified: {
    value: 'qualified',
    label: 'Calificado',
    color: 'violet',
    description: 'Mostró interés concreto'
  },
  customer: {
    value: 'customer',
    label: 'Cliente activo',
    color: 'green',
    description: 'Ya es cliente'
  },
  lost: {
    value: 'lost',
    label: 'Perdido',
    color: 'red',
    description: 'Descartado o sin interés'
  }
};

// Orden del embudo, para gráficos y reportes de conversión.
export const PIPELINE_STAGE_ORDER = ['new', 'contacted', 'qualified', 'customer', 'lost'];

// Prioridad: cuánto nos importa este contacto. Independiente de la etapa.
export const PRIORITY_LEVELS = {
  muy_alta: { value: 'muy_alta', label: 'Muy alta', color: 'red', weight: 4 },
  alta:     { value: 'alta',     label: 'Alta',     color: 'orange', weight: 3 },
  media:    { value: 'media',    label: 'Media',    color: 'amber', weight: 2 },
  baja:     { value: 'baja',     label: 'Baja',     color: 'slate', weight: 1 }
};

// Especialidades médicas. Lista sugerida para el selector; el campo es texto
// libre en la base, así que se puede cargar cualquier otra.
export const SPECIALTIES = [
  'Anatomía Patológica',
  'Oncología',
  'Mastología',
  'Gineco-oncología',
  'Urología',
  'Hematología',
  'Cirugía',
  'Radiología',
  'Otra'
];

// Sociedades científicas. También texto libre en la base.
export const SOCIETIES = [
  'SPMCBA',
  'SAM',
  'AAOC',
  'SAPYCC',
  'SAU',
  'Otra'
];

// Rol de la persona dentro del equipo comercial (user_profiles.crm_role).
// No es un control de permisos: define qué rutina y qué metas le corresponden.
export const CRM_ROLES = {
  telefonista: {
    value: 'telefonista',
    label: 'Telefonista',
    description: 'Primer contacto, calificación y enriquecimiento de datos'
  },
  vendedor: {
    value: 'vendedor',
    label: 'Vendedor',
    description: 'Seguimiento profundo, reuniones y cierre'
  },
  admin: {
    value: 'admin',
    label: 'Administrador',
    description: 'Configura equipos, metas y asignación de cartera'
  }
};

// Metas diarias por rol (valores por defecto del Manual de Rutinas
// Comerciales). Son el fallback: si hay valores cargados en Settings, mandan
// esos.
export const DEFAULT_DAILY_GOALS = {
  telefonista: {
    contactos_trabajados: 28,
    primeros_contactos: 9,
    traspasos: 4
  },
  vendedor: {
    seguimientos: 12,
    reuniones: 3
  }
};

// Roles de contacto
export const CONTACT_ROLES = {
  pathologist: { value: 'pathologist', label: 'Patólogo/a' },
  researcher: { value: 'researcher', label: 'Investigador/a' },
  hospital_director: { value: 'hospital_director', label: 'Director/a de Hospital' },
  lab_manager: { value: 'lab_manager', label: 'Gerente de Laboratorio' },
  procurement: { value: 'procurement', label: 'Compras/Adquisiciones' },
  other: { value: 'other', label: 'Otro' }
};

// Tipos de interacción
export const INTERACTION_TYPES = {
  email_sent: {
    value: 'email_sent',
    label: 'Email Enviado',
    icon: 'Send',
    color: 'blue'
  },
  email_received: {
    value: 'email_received',
    label: 'Email Recibido',
    icon: 'Mail',
    color: 'green'
  },
  meeting: {
    value: 'meeting',
    label: 'Reunión',
    icon: 'Video',
    color: 'violet'
  },
  call: {
    value: 'call',
    label: 'Llamada',
    icon: 'Phone',
    color: 'amber'
  },
  demo: {
    value: 'demo',
    label: 'Demostración',
    icon: 'Sparkles',
    color: 'pink'
  },
  note: {
    value: 'note',
    label: 'Nota Interna',
    icon: 'FileText',
    color: 'gray'
  },
  linkedin: {
    value: 'linkedin',
    label: 'LinkedIn',
    icon: 'Linkedin',
    color: 'sky'
  },
  conference: {
    value: 'conference',
    label: 'Conferencia',
    icon: 'Calendar',
    color: 'indigo'
  }
};

// Estados de borrador de email
export const DRAFT_STATUSES = {
  generated: { value: 'generated', label: 'Generado', color: 'violet' },
  edited: { value: 'edited', label: 'Editado', color: 'amber' },
  approved: { value: 'approved', label: 'Aprobado', color: 'green' },
  sent: { value: 'sent', label: 'Enviado', color: 'blue' },
  discarded: { value: 'discarded', label: 'Descartado', color: 'gray' }
};

// Tipos de institución
export const INSTITUTION_TYPES = [
  'Hospital',
  'Clínica',
  'Laboratorio',
  'Universidad',
  'Instituto de Investigación',
  'Centro Médico',
  'Sanatorio',
  'Otro'
];

// Países de LATAM (para el selector)
export const COUNTRIES = [
  'Argentina',
  'Brasil',
  'Chile',
  'Colombia',
  'México',
  'Perú',
  'Uruguay',
  'Ecuador',
  'Venezuela',
  'Paraguay',
  'Bolivia',
  'Costa Rica',
  'Panamá',
  'Guatemala',
  'Otros'
];

// Configuración de la app
export const APP_CONFIG = {
  name: 'Digpatho CRM',
  company: 'Digpatho IA',
  defaultLanguage: 'es',
  defaultCountry: 'Argentina',
  maxEmailLength: 2000,
  maxContextLength: 500,
  followUpDays: 14 // Días para marcar como pendiente de follow-up
};

// Modelos de IA disponibles
export const AI_MODELS = {
  default: 'claude-sonnet-4-5-20250929',
  fast: 'claude-haiku-4-5-20251001'
};

// Tipos de email que se pueden generar
export const EMAIL_TYPES = [
  { value: 'follow-up', label: 'Follow-up', description: 'Seguimiento después de una interacción' },
  { value: 'first-contact', label: 'Primer Contacto', description: 'Primera vez que contactamos' },
  { value: 'post-meeting', label: 'Post-Reunión', description: 'Después de una reunión o demo' },
  { value: 're-engagement', label: 'Re-engagement', description: 'Retomar contacto después de tiempo' }
];

// ============================
// Growth System — Verticales GTM (Bull's-eye Framework)
// ============================
export const GROWTH_VERTICALS = {
  DIRECT_B2B: {
    value: 'DIRECT_B2B',
    label: 'B2B Directo',
    description: 'Laboratorios y centros de referencia',
    color: 'blue',
  },
  PHARMA: {
    value: 'PHARMA',
    label: 'Pharma',
    description: 'CDx y ensayos clínicos',
    color: 'violet',
  },
  INFLUENCER: {
    value: 'INFLUENCER',
    label: 'Influencers',
    description: 'Thought leadership y contenido',
    color: 'amber',
  },
  EVENTS: {
    value: 'EVENTS',
    label: 'Eventos',
    description: 'Conferencias y trade shows',
    color: 'emerald',
  }
};

// Estados de leads del Growth System
export const GROWTH_LEAD_STATUSES = {
  new: { value: 'new', label: 'Nuevo', color: 'blue' },
  draft_generated: { value: 'draft_generated', label: 'Con borrador', color: 'violet' },
  promoted: { value: 'promoted', label: 'Promovido', color: 'green' },
  ignored: { value: 'ignored', label: 'Descartado', color: 'gray' }
};

// Estados de borradores del Growth System
export const GROWTH_DRAFT_STATUSES = {
  draft_pending_review: { value: 'draft_pending_review', label: 'Pendiente', color: 'amber' },
  approved: { value: 'approved', label: 'Aprobado', color: 'green' },
  rejected: { value: 'rejected', label: 'Rechazado', color: 'red' },
  sent: { value: 'sent', label: 'Enviado', color: 'blue' }
};

export default {
  INTEREST_LEVELS,
  CONTACT_ROLES,
  INTERACTION_TYPES,
  DRAFT_STATUSES,
  INSTITUTION_TYPES,
  COUNTRIES,
  APP_CONFIG,
  AI_MODELS,
  EMAIL_TYPES,
  GROWTH_VERTICALS,
  GROWTH_LEAD_STATUSES,
  GROWTH_DRAFT_STATUSES
};