// src/config/constants.js

// Niveles de interés
export const INTEREST_LEVELS = {
  cold: {
    value: 'cold',
    label: 'Frío',
    emoji: '❄️',
    color: 'slate',
    description: 'Sin interés demostrado'
  },
  warm: {
    value: 'warm',
    label: 'Tibio',
    emoji: '🌤️',
    color: 'amber',
    description: 'Algo de interés'
  },
  hot: {
    value: 'hot',
    label: 'Caliente',
    emoji: '🔥',
    color: 'orange',
    description: 'Muy interesado, listo para cerrar'
  },
  customer: {
    value: 'customer',
    label: 'Cliente',
    emoji: '✅',
    color: 'green',
    description: 'Ya es cliente'
  },
  churned: {
    value: 'churned',
    label: 'Ex-cliente',
    emoji: '⚠️',
    color: 'red',
    description: 'Dejó de ser cliente'
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
  default: 'claude-sonnet-4-20250514',
  fast: 'claude-3-haiku-20240307'
};

// Tipos de email que se pueden generar
export const EMAIL_TYPES = [
  { value: 'follow-up', label: 'Follow-up', description: 'Seguimiento después de una interacción' },
  { value: 'first-contact', label: 'Primer Contacto', description: 'Primera vez que contactamos' },
  { value: 'post-meeting', label: 'Post-Reunión', description: 'Después de una reunión o demo' },
  { value: 're-engagement', label: 'Re-engagement', description: 'Retomar contacto después de tiempo' }
];

export default {
  INTEREST_LEVELS,
  CONTACT_ROLES,
  INTERACTION_TYPES,
  DRAFT_STATUSES,
  INSTITUTION_TYPES,
  COUNTRIES,
  APP_CONFIG,
  AI_MODELS,
  EMAIL_TYPES
};