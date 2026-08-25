// src/components/contacts/QuickLogModal.jsx
//
// Diálogo de registro rápido: lo que el equipo abre después de CADA contacto.
// Implementa la fase de "Cierre" del Manual de Rutinas Comerciales en un solo
// paso, porque si son tres pantallas separadas nadie las completa.
//
// Hace tres cosas de una:
//   1. Registra el resultado en `interactions` (con created_by, sin el cual
//      ninguna métrica por persona es computable)
//   2. Si cambió la etapa, la actualiza y deja rastro en contact_stage_changes
//   3. Fija el próximo seguimiento — OBLIGATORIO salvo que se pause o descarte
//
// Ese "obligatorio" es lo que hace cumplible la regla semanal del manual:
// "ningún contacto tocado esta semana sin Next follow-up".

import { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Video,
  Send,
  FileText,
  Sparkles,
  Linkedin,
  Calendar,
  Check,
  Loader2,
  AlertCircle,
  PauseCircle,
  XCircle,
  UserCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { notifyHandoff } from '../../lib/chatNotify';
import { PIPELINE_STAGES, PRIORITY_LEVELS } from '../../config/constants';

// Sólo los tipos que el enum interaction_type de Postgres acepta.
// OJO: no hay tipo 'whatsapp'. Un mensaje de WhatsApp se registra como 'note'
// hasta que se amplíe el enum en una migración.
const RESULT_TYPES = [
  { value: 'call', label: 'Llamada', icon: Phone, color: 'bg-amber-100 text-amber-600' },
  { value: 'meeting', label: 'Reunión', icon: Video, color: 'bg-violet-100 text-violet-600' },
  { value: 'email_sent', label: 'Email', icon: Send, color: 'bg-blue-100 text-blue-600' },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'bg-sky-100 text-sky-600' },
  { value: 'demo', label: 'Demo', icon: Sparkles, color: 'bg-pink-100 text-pink-600' },
  { value: 'note', label: 'Nota', icon: FileText, color: 'bg-gray-100 text-gray-600' },
];

// Atajos para no obligar a abrir el calendario en el caso común.
const DATE_PRESETS = [
  { label: 'Mañana', days: 1 },
  { label: 'En 3 días', days: 3 },
  { label: 'En 1 semana', days: 7 },
  { label: 'En 2 semanas', days: 14 },
  { label: 'En 1 mes', days: 30 },
];

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0); // 9am: arranque de la jornada según el manual
  return d;
}

function toDateInput(date) {
  // El input type="date" necesita YYYY-MM-DD en hora LOCAL, no UTC:
  // toISOString() correría la fecha para husos negativos como el nuestro.
  const off = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - off).toISOString().slice(0, 10);
}

export const QuickLogModal = ({ contact, onClose, onLogged }) => {
  const { user } = useAuth();

  const [resultType, setResultType] = useState('call');
  const [notes, setNotes] = useState('');
  const [newStage, setNewStage] = useState(contact?.stage || 'new');
  const [newPriority, setNewPriority] = useState(contact?.priority || 'media');
  const [followupDate, setFollowupDate] = useState(toDateInput(addDays(3)));
  // 'schedule' fija fecha · 'pause' la deja en null · 'discard' además marca perdido
  const [outcome, setOutcome] = useState('schedule');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Traspaso a vendedor
  const [vendedores, setVendedores] = useState([]);
  const [handoffTo, setHandoffTo] = useState('');

  // La lista de vendedores se carga una sola vez al abrir el modal. Va arriba
  // del early return para no cambiar la cantidad de hooks entre renders.
  useEffect(() => {
    let cancelado = false;
    supabase
      .from('user_profiles')
      .select('id, full_name, email, crm_role')
      .eq('crm_role', 'vendedor')
      .then(({ data }) => {
        if (!cancelado) setVendedores(data || []);
      });
    return () => { cancelado = true; };
  }, []);

  if (!contact) return null;

  const stageChanged = newStage !== (contact.stage || 'new');
  const fullName = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();

  const handlePreset = (days) => {
    setOutcome('schedule');
    setFollowupDate(toDateInput(addDays(days)));
  };

  const handleSave = async () => {
    // La regla del manual, aplicada acá: no se sale sin definir el próximo paso.
    if (outcome === 'schedule' && !followupDate) {
      setError('Definí la fecha del próximo seguimiento, o marcá "Pausar" / "Descartar".');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // 1. La interacción. created_by es lo que permite contar por persona.
      const { error: interactionError } = await supabase.from('interactions').insert({
        contact_id: contact.id,
        type: resultType,
        direction: 'outbound',
        subject: `${RESULT_TYPES.find(t => t.value === resultType)?.label || 'Contacto'} — ${fullName}`,
        // Las objeciones y el detalle van acá, fechados y atribuidos, en vez de
        // pisar el campo de notas del contacto.
        content: notes || null,
        occurred_at: new Date().toISOString(),
        created_by: user?.id || null,
      });
      if (interactionError) throw interactionError;

      // 2. Cambio de etapa: primero el rastro, después el estado actual.
      const finalStage = outcome === 'discard' ? 'lost' : newStage;
      const stageReallyChanged = finalStage !== (contact.stage || 'new');

      if (stageReallyChanged) {
        const { error: stageError } = await supabase.from('contact_stage_changes').insert({
          contact_id: contact.id,
          from_stage: contact.stage || 'new',
          to_stage: finalStage,
          changed_by: user?.id || null,
          note: notes || null,
        });
        // Un fallo acá no debe impedir guardar el resto: perder el historial es
        // malo, pero perder el registro del contacto es peor.
        if (stageError) console.error('No se pudo registrar el cambio de etapa:', stageError);
      }

      // 3. El contacto: etapa, prioridad y próximo seguimiento.
      const updates = {
        stage: finalStage,
        priority: newPriority,
        next_followup_at: outcome === 'schedule'
          ? new Date(`${followupDate}T09:00:00`).toISOString()
          : null,
      };
      if (stageReallyChanged) updates.stage_changed_at = new Date().toISOString();
      if (handoffTo) updates.assigned_to = handoffTo;

      const { error: contactError } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', contact.id);
      if (contactError) throw contactError;

      // 4. Traspaso: el manual pide avisarle al vendedor EL MISMO DÍA.
      if (handoffTo) {
        const vendedor = vendedores.find(v => v.id === handoffTo);
        const nombreVendedor = vendedor?.full_name || vendedor?.email || 'un vendedor';

        // La campanita del CRM. La tabla notifications ya soportaba esto sin
        // cambios de esquema: sólo faltaba quién la escribiera.
        const { error: notifError } = await supabase.from('notifications').insert({
          user_id: handoffTo,
          type: 'handoff',
          title: `Traspaso: ${fullName}`,
          message: `${user?.email || 'Un telefonista'} te asignó este contacto${
            notes ? `. ${notes.slice(0, 60)}` : ''
          }`,
          link: `/contacts/${contact.id}`,
          is_read: false,
        });
        if (notifError) console.error('No se pudo crear la notificación del traspaso:', notifError);

        notifyHandoff({
          senderName: user?.email || 'Alguien',
          contactName: fullName,
          institutionName: contact.institution?.name || null,
          assigneeName: nombreVendedor,
          priority: PRIORITY_LEVELS[newPriority]?.label,
          contactId: contact.id,
        });
      }

      onLogged?.();
      onClose();
    } catch (err) {
      console.error('Error en el registro rápido:', err);
      setError(err.message || 'No se pudo guardar el registro.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg animate-scale-in">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{fullName}</h2>
              <p className="text-sm text-gray-500 truncate">
                {contact.institution?.name || contact.specialty || 'Registrar resultado'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg flex-shrink-0"
            >
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

            {/* 1. Qué pasó */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ¿Qué hiciste?
              </label>
              <div className="grid grid-cols-3 gap-2">
                {RESULT_TYPES.map(type => {
                  const Icon = type.icon;
                  const selected = resultType === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setResultType(type.value)}
                      className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 ${
                        selected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg ${type.color}`}>
                        <Icon size={16} />
                      </div>
                      <span className="text-xs font-medium text-gray-700">{type.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Notas y objeciones */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas <span className="font-normal text-gray-400">(objeciones, próximos pasos)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="input resize-none"
                placeholder="Ej: pidió mandar la propuesta por escrito. Objeción: ya trabajan con otro proveedor."
              />
            </div>

            {/* 3. Etapa y prioridad */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Etapa</label>
                <select
                  value={newStage}
                  onChange={(e) => setNewStage(e.target.value)}
                  className="input"
                  disabled={outcome === 'discard'}
                >
                  {Object.values(PIPELINE_STAGES).map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {stageChanged && outcome !== 'discard' && (
                  <p className="text-xs text-primary-600 mt-1">
                    Cambia desde &laquo;{PIPELINE_STAGES[contact.stage || 'new']?.label}&raquo;
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="input"
                >
                  {Object.values(PRIORITY_LEVELS).map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. Traspaso — sólo aparece si hay vendedores configurados */}
            {vendedores.length > 0 && outcome !== 'discard' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <UserCheck size={14} className="inline mr-1 -mt-0.5" />
                  Pasar a vendedor <span className="font-normal text-gray-400">(opcional)</span>
                </label>
                <select
                  value={handoffTo}
                  onChange={(e) => setHandoffTo(e.target.value)}
                  className="input"
                >
                  <option value="">No traspasar</option>
                  {vendedores.map(v => (
                    <option key={v.id} value={v.id}>{v.full_name || v.email}</option>
                  ))}
                </select>
                {handoffTo && (
                  <p className="text-xs text-violet-600 mt-1">
                    Le llega la notificación en el momento, y el aviso al espacio de Chat.
                  </p>
                )}
              </div>
            )}

            {/* 5. Próximo paso — el que no se puede saltear */}
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Próximo seguimiento
              </label>

              <div className="flex flex-wrap gap-2 mb-3">
                {DATE_PRESETS.map(preset => {
                  const value = toDateInput(addDays(preset.days));
                  const active = outcome === 'schedule' && followupDate === value;
                  return (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => handlePreset(preset.days)}
                      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                        active ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-gray-400 flex-shrink-0" />
                <input
                  type="date"
                  value={followupDate}
                  min={toDateInput(new Date())}
                  onChange={(e) => { setOutcome('schedule'); setFollowupDate(e.target.value); }}
                  className="input py-2"
                  disabled={outcome !== 'schedule'}
                />
              </div>

              {/* Las dos salidas válidas sin fecha */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setOutcome(outcome === 'pause' ? 'schedule' : 'pause')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${
                    outcome === 'pause'
                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <PauseCircle size={15} />
                  Pausar
                </button>
                <button
                  type="button"
                  onClick={() => setOutcome(outcome === 'discard' ? 'schedule' : 'discard')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg border-2 transition-colors ${
                    outcome === 'discard'
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  <XCircle size={15} />
                  Descartar
                </button>
              </div>

              {outcome === 'pause' && (
                <p className="text-xs text-amber-700 mt-2">
                  Queda sin fecha de seguimiento y no va a aparecer en &laquo;Mi día&raquo;.
                </p>
              )}
              {outcome === 'discard' && (
                <p className="text-xs text-red-700 mt-2">
                  Pasa a &laquo;Perdido&raquo; y sale del circuito.
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
            <button onClick={onClose} className="btn-ghost text-sm" disabled={saving}>
              Cancelar
            </button>
            <button onClick={handleSave} className="btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Registrar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickLogModal;
