// src/components/common/StatusBadge.jsx
//
// Badge de estado único para toda la app. Antes había tres copias del mismo
// componente (BulkEmail.jsx, BulkEmailQueueModal.jsx, BulkEmailSearch.jsx)
// que renderizaban igual pero cubrían vocabularios de estado distintos.
//
// Uso:
//   <StatusBadge status={campaign.status} variant="campaign" />
//   <StatusBadge status={item.status}     variant="queue" />
//   <StatusBadge status={r.status}        variant="search" />
//   <StatusBadge status={c.stage}         variant="stage" />
//   <StatusBadge status={c.priority}      variant="priority" />

import {
  Clock,
  CheckCircle,
  RefreshCw,
  Pause,
  XCircle,
  X,
  AlertCircle,
  Circle,
  Star,
} from 'lucide-react';

// Estados de una campaña de envío masivo
export const CAMPAIGN_STATUS = {
  draft:     { label: 'Borrador',     color: 'bg-gray-100 text-gray-700',   icon: Clock },
  ready:     { label: 'Listo',        color: 'bg-blue-100 text-blue-700',   icon: CheckCircle },
  sending:   { label: 'Enviando...',  color: 'bg-amber-100 text-amber-700', icon: RefreshCw, spin: true },
  completed: { label: 'Completado',   color: 'bg-green-100 text-green-700', icon: CheckCircle },
  paused:    { label: 'Pausado',      color: 'bg-orange-100 text-orange-700', icon: Pause },
  failed:    { label: 'Error',        color: 'bg-red-100 text-red-700',     icon: XCircle },
};

// Estados de un email dentro de la cola de una campaña
export const QUEUE_STATUS = {
  pending: { label: 'Pendiente', color: 'bg-gray-100 text-gray-700',   icon: Clock },
  sending: { label: 'Enviando',  color: 'bg-amber-100 text-amber-700', icon: RefreshCw, spin: true },
  sent:    { label: 'Enviado',   color: 'bg-green-100 text-green-700', icon: CheckCircle },
  failed:  { label: 'Error',     color: 'bg-red-100 text-red-700',     icon: XCircle },
  skipped: { label: 'Omitido',   color: 'bg-gray-100 text-gray-500',   icon: X },
};

// Resultados de la búsqueda masiva de emails
export const SEARCH_STATUS = {
  found:     { label: 'Encontrado',    color: 'bg-green-100 text-green-700', icon: CheckCircle },
  not_found: { label: 'No encontrado', color: 'bg-gray-100 text-gray-500',   icon: XCircle },
  error:     { label: 'Error',         color: 'bg-red-100 text-red-700',     icon: AlertCircle },
};

// Etapa del pipeline comercial (migración 009)
export const STAGE_STATUS = {
  new:       { label: 'Nuevo',         color: 'bg-slate-100 text-slate-700',   icon: Circle },
  contacted: { label: 'Contactado',    color: 'bg-blue-100 text-blue-700',     icon: CheckCircle },
  qualified: { label: 'Calificado',    color: 'bg-violet-100 text-violet-700', icon: Star },
  customer:  { label: 'Cliente activo', color: 'bg-green-100 text-green-700',  icon: CheckCircle },
  lost:      { label: 'Perdido',       color: 'bg-red-100 text-red-700',       icon: XCircle },
};

// Prioridad comercial (migración 009)
export const PRIORITY_STATUS = {
  muy_alta: { label: 'Muy alta', color: 'bg-red-100 text-red-700' },
  alta:     { label: 'Alta',     color: 'bg-orange-100 text-orange-700' },
  media:    { label: 'Media',    color: 'bg-amber-100 text-amber-700' },
  baja:     { label: 'Baja',     color: 'bg-slate-100 text-slate-600' },
};

const VARIANTS = {
  campaign: CAMPAIGN_STATUS,
  queue: QUEUE_STATUS,
  search: SEARCH_STATUS,
  stage: STAGE_STATUS,
  priority: PRIORITY_STATUS,
};

const SIZES = {
  sm: 'px-2 py-0.5 text-[11px] gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
};

export const StatusBadge = ({ status, variant = 'campaign', size = 'md', className = '' }) => {
  const config = VARIANTS[variant] || CAMPAIGN_STATUS;

  // Si el estado no está en el mapa, se muestra el valor crudo en vez de
  // ocultarlo: así un valor inesperado se ve en la UI y no pasa desapercibido.
  const entry = config[status] || {
    label: status || '—',
    color: 'bg-gray-100 text-gray-500',
    icon: AlertCircle,
  };

  const { label, color, icon: Icon, spin } = entry;
  const iconSize = size === 'sm' ? 11 : 12;

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full whitespace-nowrap ${SIZES[size]} ${color} ${className}`}
    >
      {Icon && <Icon size={iconSize} className={spin ? 'animate-spin' : ''} />}
      {label}
    </span>
  );
};

export default StatusBadge;
