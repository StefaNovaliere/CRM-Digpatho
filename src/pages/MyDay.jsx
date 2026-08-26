// src/pages/MyDay.jsx
//
// La pantalla donde el equipo trabaja las 8 horas. Implementa la fase de
// "Apertura" del Manual de Rutinas Comerciales tal cual está escrita:
// "Filtra Stage='New' con seguimiento vencido y arma la lista del día
// (25-30 contactos)".
//
// Tres colas, en orden de prioridad de atención:
//   1. Traspasos recibidos — lo que un telefonista calificó y me pasó
//   2. Vencidos — next_followup_at <= hoy, por prioridad y antigüedad
//   3. Sin contactar — stage='new', para completar hasta la meta del día
//
// Todas las consultas van al servidor con .limit(). No se repite el patrón de
// Contacts.jsx, que traía los 619 contactos y todas las interacciones en
// memoria para filtrar después.

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Sun,
  AlertTriangle,
  UserPlus,
  Inbox,
  Phone,
  Mail,
  MessageCircle,
  Building2,
  Stethoscope,
  RefreshCw,
  CheckCircle2,
  Star,
  ChevronRight,
  Settings2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { PageContainer } from '../components/common/PageContainer';
import { StatusBadge } from '../components/common/StatusBadge';
import { QuickLogModal } from '../components/contacts/QuickLogModal';
import { PRIORITY_LEVELS, DEFAULT_DAILY_GOALS } from '../config/constants';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Tope de la lista diaria. El manual pide 25-30 contactos trabajados.
const DAILY_TARGET = 30;

const SELECT = `
  id, first_name, last_name, email, phone, stage, priority, specialty,
  next_followup_at, assigned_to, is_kol,
  institution:institutions(name)
`;

// Postgres ordena texto alfabéticamente, así que 'muy_alta' iría después de
// 'media'. Se reordena en JS con el peso definido en constants.
function byPriorityThenAge(a, b) {
  const pa = PRIORITY_LEVELS[a.priority]?.weight ?? 0;
  const pb = PRIORITY_LEVELS[b.priority]?.weight ?? 0;
  if (pa !== pb) return pb - pa;
  // A igual prioridad, primero lo que lleva más tiempo esperando.
  return new Date(a.next_followup_at || 0) - new Date(b.next_followup_at || 0);
}

function diasVencido(fecha) {
  if (!fecha) return 0;
  const ms = Date.now() - new Date(fecha).getTime();
  return Math.floor(ms / 86400000);
}

// Estado vacío que explica POR QUÉ está vacío.
//
// Una pantalla en blanco es ambigua: el usuario no sabe si no tiene trabajo o
// si el sistema falló. Y es un caso frecuente — apenas termina una campaña,
// todos los contactos quedan agendados a 7 días y las tres colas quedan
// vacías. Ese silencio es justo el momento en que se pierde la confianza en
// una herramienta nueva.
const EstadoVacio = ({ motivo, proximaFecha, scope, onVerTodos }) => {
  const contenido = {
    sin_rol: {
      icono: Settings2,
      color: 'text-amber-500',
      titulo: 'Falta configurar tu rol',
      texto: 'Sin un rol comercial asignado no se puede armar tu lista del día ni medir tus metas.',
      accion: (
        <Link to="/settings" className="btn-primary">
          Ir a Configuración
        </Link>
      ),
    },
    sin_cartera: {
      icono: Inbox,
      color: 'text-gray-400',
      titulo: scope === 'mine' ? 'No tenés contactos asignados' : 'No hay contactos en este alcance',
      texto: scope === 'mine'
        ? 'Tu lista del día sale de los contactos que tenés a cargo. Pedí que te asignen cartera, o asignátela desde Contactos con la selección múltiple.'
        : 'Probá con otro alcance o revisá los filtros.',
      accion: (
        <div className="flex items-center justify-center gap-2">
          {scope === 'mine' && (
            <button onClick={onVerTodos} className="btn-secondary">
              Ver los de todos
            </button>
          )}
          <Link to="/contacts" className="btn-primary">
            Ir a Contactos
          </Link>
        </div>
      ),
    },
    al_dia_con_fecha: {
      icono: CheckCircle2,
      color: 'text-green-500',
      titulo: 'Estás al día',
      texto: `No hay nada vencido para hoy. Tu próximo seguimiento agendado es el ${
        proximaFecha ? format(new Date(proximaFecha), "d 'de' MMMM", { locale: es }) : 'próximo día hábil'
      }.`,
      accion: (
        <Link to="/contacts" className="btn-secondary">
          Ver mis contactos
        </Link>
      ),
    },
    al_dia: {
      icono: CheckCircle2,
      color: 'text-green-500',
      titulo: 'Estás al día',
      texto: 'No hay seguimientos vencidos ni contactos nuevos esperando en tu cartera.',
      accion: (
        <Link to="/contacts" className="btn-secondary">
          Ver mis contactos
        </Link>
      ),
    },
  }[motivo] || {};

  const Icono = contenido.icono || CheckCircle2;

  return (
    <div className="card p-12 text-center">
      <Icono className={`w-12 h-12 mx-auto mb-4 ${contenido.color || 'text-gray-300'}`} />
      <h3 className="text-lg font-medium text-gray-900 mb-2">{contenido.titulo}</h3>
      <p className="text-sm text-gray-500 max-w-md mx-auto mb-5">{contenido.texto}</p>
      {contenido.accion}
    </div>
  );
};

export const MyDay = () => {
  const { user, profile } = useAuth();

  const [scope, setScope] = useState('mine'); // mine | team | all
  // Para explicar POR QUÉ la pantalla está vacía, que es distinto según
  // si no hay cartera o si simplemente no vence nada hoy.
  const [carteraSize, setCarteraSize] = useState(null);
  const [proximaFecha, setProximaFecha] = useState(null);
  const [teamIds, setTeamIds] = useState(null);
  const [overdue, setOverdue] = useState([]);
  const [uncontacted, setUncontacted] = useState([]);
  const [handoffs, setHandoffs] = useState([]);
  const [doneToday, setDoneToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(null); // contacto abierto en el modal

  const crmRole = profile?.crm_role || null;
  const goals = DEFAULT_DAILY_GOALS[crmRole] || null;
  const goalTarget = goals?.contactos_trabajados || goals?.seguimientos || DAILY_TARGET;

  // "Mi equipo" se deriva: los usuarios cuyo team coincide con el mío. No se
  // guarda en contacts, así que un cambio de equipo es editar una sola fila.
  useEffect(() => {
    if (scope !== 'team' || !profile?.team) { setTeamIds(null); return; }
    let cancelled = false;
    supabase
      .from('user_profiles')
      .select('id')
      .eq('team', profile.team)
      .then(({ data }) => {
        if (!cancelled) setTeamIds((data || []).map(u => u.id));
      });
    return () => { cancelled = true; };
  }, [scope, profile?.team]);

  // Aplica el filtro de cartera a cualquiera de las consultas.
  const applyScope = useCallback((query) => {
    if (scope === 'mine') return query.eq('assigned_to', user?.id);
    if (scope === 'team' && teamIds?.length) return query.in('assigned_to', teamIds);
    return query; // 'all', o 'team' sin equipo configurado
  }, [scope, teamIds, user?.id]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    if (scope === 'team' && teamIds === null && profile?.team) return; // esperando ids

    setLoading(true);
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999); // "vence hoy" cuenta como vencido
    const inicioDelDia = new Date();
    inicioDelDia.setHours(0, 0, 0, 0);

    try {
      const [vencidosRes, nuevosRes, traspasosRes, hechasRes, carteraRes, proximaRes] = await Promise.all([
        // 1. Vencidos: con fecha puesta y ya cumplida
        applyScope(
          supabase.from('contacts').select(SELECT)
            .not('next_followup_at', 'is', null)
            .lte('next_followup_at', hoy.toISOString())
            .not('stage', 'in', '("customer","lost")')
        ).limit(100),

        // 2. Sin contactar, sin fecha agendada
        applyScope(
          supabase.from('contacts').select(SELECT)
            .eq('stage', 'new')
            .is('next_followup_at', null)
        ).limit(60),

        // 3. Traspasos: asignados a mí y todavía sin trabajar
        supabase.from('contacts').select(SELECT)
          .eq('assigned_to', user.id)
          .eq('stage', 'contacted')
          .in('priority', ['muy_alta', 'alta'])
          .is('next_followup_at', null)
          .limit(20),

        // 4. Cuánto llevo hecho hoy — de interactions, no de contacts
        supabase.from('interactions')
          .select('id', { count: 'exact', head: true })
          .eq('created_by', user.id)
          .gte('occurred_at', inicioDelDia.toISOString()),

        // 5. Tamaño de la cartera en este alcance. Sirve para distinguir
        // "no tengo contactos" de "los tengo pero no vencen hoy", que son
        // situaciones muy distintas y la pantalla no las diferenciaba.
        applyScope(supabase.from('contacts').select('id', { count: 'exact', head: true })),

        // 6. El próximo seguimiento agendado. Es lo que permite decir
        // "estás al día, tu próximo contacto es el X" en vez de un vacío mudo.
        applyScope(
          supabase.from('contacts').select('next_followup_at')
            .not('next_followup_at', 'is', null)
            .gt('next_followup_at', hoy.toISOString())
            .not('stage', 'in', '("customer","lost")')
        ).order('next_followup_at', { ascending: true }).limit(1),
      ]);

      const vencidos = (vencidosRes.data || []).sort(byPriorityThenAge);
      const traspasoIds = new Set((traspasosRes.data || []).map(c => c.id));

      setHandoffs(traspasosRes.data || []);
      // Un traspaso no debe aparecer también en vencidos.
      setOverdue(vencidos.filter(c => !traspasoIds.has(c.id)));
      setUncontacted((nuevosRes.data || []).sort(byPriorityThenAge));
      setDoneToday(hechasRes.count || 0);
      setCarteraSize(carteraRes.count || 0);
      setProximaFecha(proximaRes.data?.[0]?.next_followup_at || null);
    } catch (err) {
      console.error('Error cargando Mi día:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, scope, teamIds, profile?.team, applyScope]);

  useEffect(() => { load(); }, [load]);

  const totalPendiente = handoffs.length + overdue.length;
  // La cola 3 sólo completa hasta la meta: no tiene sentido mostrar 171
  // contactos nuevos si el objetivo del día son 30.
  const cupoLibre = Math.max(0, goalTarget - totalPendiente);

  // Las tres colas vacías a la vez es un caso frecuente y legítimo —justo
  // después de una campaña, por ejemplo, cuando todo quedó agendado a futuro—
  // pero una pantalla en blanco no lo comunica. Se distingue el motivo para
  // que nadie tenga que adivinar si no hay trabajo o si algo se rompió.
  const todoVacio = handoffs.length === 0 && overdue.length === 0 && uncontacted.length === 0;
  const motivoVacio =
    !crmRole ? 'sin_rol'
    : carteraSize === 0 ? 'sin_cartera'
    : proximaFecha ? 'al_dia_con_fecha'
    : 'al_dia';
  const nuevosVisibles = uncontacted.slice(0, cupoLibre);
  const progreso = goalTarget ? Math.min(100, Math.round((doneToday / goalTarget) * 100)) : 0;

  return (
    <PageContainer gap="lg">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sun className="w-6 h-6 text-amber-500" />
            Mi día
          </h1>
          <p className="text-gray-500 mt-1 capitalize">
            {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Progreso del día */}
          <div className="text-right">
            <p className="text-sm text-gray-500">Contactos trabajados hoy</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-28 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all"
                  style={{ width: `${progreso}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {doneToday}<span className="text-gray-400 font-normal">/{goalTarget}</span>
              </span>
            </div>
          </div>

          <button
            onClick={load}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Actualizar"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Selector de cartera */}
      <div className="card p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500 mr-1">Ver:</span>
          {[
            { value: 'mine', label: 'Mis contactos' },
            { value: 'team', label: profile?.team ? `Equipo ${profile.team}` : 'Mi equipo' },
            { value: 'all', label: 'Todos' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setScope(opt.value)}
              disabled={opt.value === 'team' && !profile?.team}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                scope === opt.value ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
          {!profile?.team && (
            <span className="text-xs text-gray-400 ml-1">
              (configurá tu equipo en Configuración para ver la cartera del equipo)
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card p-12 text-center">
          <RefreshCw className="w-8 h-8 text-gray-300 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Armando tu lista del día...</p>
        </div>
      ) : todoVacio ? (
        <EstadoVacio
          motivo={motivoVacio}
          proximaFecha={proximaFecha}
          scope={scope}
          onVerTodos={() => setScope('all')}
        />
      ) : (
        <div className="space-y-6">
          <Cola
            titulo="Traspasos recibidos"
            descripcion="Calificados por un telefonista. El manual pide contactarlos el mismo día."
            icono={UserPlus}
            color="violet"
            contactos={handoffs}
            onLog={setLogging}
            vacio="No tenés traspasos pendientes."
          />

          <Cola
            titulo="Seguimientos vencidos"
            descripcion="Ordenados por prioridad y después por antigüedad."
            icono={AlertTriangle}
            color="amber"
            contactos={overdue}
            onLog={setLogging}
            vacio="Ningún seguimiento vencido. Al día."
          />

          <Cola
            titulo="Sin contactar"
            descripcion={
              cupoLibre > 0
                ? `Para completar la meta del día. Hay ${uncontacted.length} sin contactar en total.`
                : 'Ya tenés la meta cubierta con lo vencido. Estos quedan para después.'
            }
            icono={Inbox}
            color="slate"
            contactos={nuevosVisibles}
            onLog={setLogging}
            vacio="No quedan contactos sin trabajar en esta cartera."
          />
        </div>
      )}

      {logging && (
        <QuickLogModal
          contact={logging}
          onClose={() => setLogging(null)}
          onLogged={load}
        />
      )}
    </PageContainer>
  );
};

// ---------------------------------------------------------------------------

const COLORS = {
  violet: 'bg-violet-100 text-violet-600',
  amber: 'bg-amber-100 text-amber-600',
  slate: 'bg-slate-100 text-slate-600',
};

const Cola = ({ titulo, descripcion, icono: Icono, color, contactos, onLog, vacio }) => (
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
    <div className="px-5 py-4 border-b border-gray-100 flex items-start gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${COLORS[color]}`}>
        <Icono size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="font-semibold text-gray-900">
          {titulo}
          <span className="ml-2 text-sm font-normal text-gray-400">{contactos.length}</span>
        </h2>
        <p className="text-sm text-gray-500">{descripcion}</p>
      </div>
    </div>

    {contactos.length === 0 ? (
      <div className="px-5 py-8 text-center">
        <CheckCircle2 className="w-8 h-8 text-gray-200 mx-auto mb-2" />
        <p className="text-sm text-gray-400">{vacio}</p>
      </div>
    ) : (
      <div className="divide-y divide-gray-100">
        {contactos.map(c => (
          <FilaContacto key={c.id} contacto={c} onLog={onLog} />
        ))}
      </div>
    )}
  </div>
);

const FilaContacto = ({ contacto: c, onLog }) => {
  const nombre = `${c.first_name || ''} ${c.last_name || ''}`.trim();
  const vencido = diasVencido(c.next_followup_at);

  return (
    <div className="px-5 py-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/contacts/${c.id}`}
              className="font-medium text-gray-900 hover:text-primary-600 truncate"
            >
              {nombre}
            </Link>
            {c.is_kol && (
              <span title="KOL" className="text-amber-500"><Star size={13} fill="currentColor" /></span>
            )}
            <StatusBadge status={c.stage} variant="stage" size="sm" />
            <StatusBadge status={c.priority} variant="priority" size="sm" />
            {vencido > 0 && (
              <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                vencido hace {vencido}d
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            {c.institution?.name && (
              <span className="flex items-center gap-1 truncate">
                <Building2 size={12} />{c.institution.name}
              </span>
            )}
            {c.specialty && (
              <span className="flex items-center gap-1">
                <Stethoscope size={12} />{c.specialty}
              </span>
            )}
            {!c.phone && !c.email && (
              <span className="text-red-500 font-medium">Sin canal de contacto</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Acciones directas según los canales que tenga cargados */}
          {c.phone && (
            <>
              <a
                href={`tel:${c.phone}`}
                className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                title={`Llamar a ${c.phone}`}
              >
                <Phone size={16} />
              </a>
              <a
                href={`https://wa.me/${c.phone.replace(/[^\d]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Abrir en WhatsApp"
              >
                <MessageCircle size={16} />
              </a>
            </>
          )}
          {c.email && (
            <a
              href={`mailto:${c.email}`}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title={c.email}
            >
              <Mail size={16} />
            </a>
          )}

          <button
            onClick={() => onLog(c)}
            className="ml-1 flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
          >
            Registrar
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MyDay;
