// src/components/contacts/BulkActionsBar.jsx
//
// Barra de acciones en lote para la lista de contactos. Resuelve la "Etapa 0"
// del manual de rutinas (repartir cartera, fijar prioridades) sin tener que
// abrir los contactos de a uno.

import { useState } from 'react';
import { X, UserCheck, Flag, GitBranch, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { PIPELINE_STAGES, PRIORITY_LEVELS } from '../../config/constants';

export const BulkActionsBar = ({ selectedIds, users, onDone, onClear }) => {
  const [action, setAction] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const count = selectedIds.length;

  const ACTIONS = {
    assign:   { label: 'Asignar a', icon: UserCheck, column: 'assigned_to' },
    stage:    { label: 'Cambiar etapa', icon: GitBranch, column: 'stage' },
    priority: { label: 'Fijar prioridad', icon: Flag, column: 'priority' },
  };

  const options = {
    assign: [
      { value: '__none__', label: 'Sin asignar' },
      ...users.map(u => ({ value: u.id, label: u.full_name || u.email })),
    ],
    stage: Object.values(PIPELINE_STAGES).map(s => ({ value: s.value, label: s.label })),
    priority: Object.values(PRIORITY_LEVELS).map(p => ({ value: p.value, label: p.label })),
  };

  const handleApply = async () => {
    if (!action || !value) return;
    setSaving(true);
    setError(null);

    const column = ACTIONS[action].column;
    const payload = { [column]: value === '__none__' ? null : value };

    // Al cambiar de etapa registramos el historial: es la única fuente para
    // "conversión por etapa" y "estancados N días" del cierre mensual.
    if (action === 'stage') {
      payload.stage_changed_at = new Date().toISOString();
    }

    const { error: updErr } = await supabase
      .from('contacts')
      .update(payload)
      .in('id', selectedIds);

    if (updErr) {
      setError(updErr.message);
      setSaving(false);
      return;
    }

    if (action === 'stage') {
      const { data: { user } } = await supabase.auth.getUser();
      const rows = selectedIds.map(id => ({
        contact_id: id,
        to_stage: value,
        changed_by: user?.id || null,
        note: 'Cambio en lote desde Contactos',
      }));
      // Si falla el historial no revertimos el cambio de etapa: es un registro
      // complementario, no la fuente de verdad.
      const { error: histErr } = await supabase.from('contact_stage_changes').insert(rows);
      if (histErr) console.warn('No se pudo registrar el historial de etapas:', histErr.message);
    }

    setSaving(false);
    setAction('');
    setValue('');
    onDone();
  };

  if (count === 0) return null;

  return (
    <div className="card p-4 border-primary-200 bg-primary-50/40">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-gray-900">
          {count} contacto{count !== 1 ? 's' : ''} seleccionado{count !== 1 ? 's' : ''}
        </span>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <select
            value={action}
            onChange={(e) => { setAction(e.target.value); setValue(''); }}
            className="input py-2 w-auto min-w-[160px]"
          >
            <option value="">Elegir acción…</option>
            {Object.entries(ACTIONS).map(([key, a]) => (
              <option key={key} value={key}>{a.label}</option>
            ))}
          </select>

          {action && (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="input py-2 w-auto min-w-[180px]"
            >
              <option value="">Elegir valor…</option>
              {options[action].map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}

          {action && value && (
            <button onClick={handleApply} disabled={saving} className="btn-primary py-2">
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              Aplicar
            </button>
          )}
        </div>

        <button
          onClick={onClear}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-lg transition-colors"
          title="Deseleccionar todo"
        >
          <X size={16} />
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 mt-2">Error al aplicar: {error}</p>
      )}
    </div>
  );
};

export default BulkActionsBar;
