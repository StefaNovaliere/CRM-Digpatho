// src/pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  Building2,
  Mail,
  Flame,
  Clock,
  ArrowRight,
  Sparkles,
  Plus,
  Target,
  Calendar
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { PageContainer } from '../components/common/PageContainer';
import { StatusBadge } from '../components/common/StatusBadge';
import { PIPELINE_STAGES, PIPELINE_STAGE_ORDER } from '../config/constants';

// ========================================
// STAT CARD COMPONENT (ACTUALIZADO)
// ========================================
const StatCard = ({ icon: Icon, label, value, change, changeType, color, iconBg, onClick }) => (
  <div
    onClick={onClick}
    className={`card p-6 hover:shadow-card-hover transition-all duration-300 ${onClick ? 'cursor-pointer active:scale-95 ring-2 ring-transparent hover:ring-primary-100' : ''}`}
  >
    <div className="flex items-start justify-between">
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-gray-900">{value}</span>
          {change && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
              changeType === 'up' ? 'text-emerald-700 bg-emerald-100' : 'text-red-700 bg-red-100'
            }`}>
              {changeType === 'up' ? '+' : ''}{change}%
            </span>
          )}
        </div>
      </div>
      <div className={`p-3 rounded-xl ${iconBg}`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
    </div>
  </div>
);

// ========================================
// QUICK ACTION CARD
// ========================================
const QuickActionCard = ({ icon: Icon, title, description, onClick, gradient }) => (
  <button
    onClick={onClick}
    className="card p-5 text-left hover:shadow-card-hover transition-all duration-300 group"
  >
    <div className="flex items-start gap-4">
      <div className={`p-3 rounded-xl ${gradient}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
          {title}
        </h3>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
    </div>
  </button>
);

// ========================================
// CONTACT ROW
// ========================================
const ContactRow = ({ contact, showGenerateButton = false }) => {
  return (
    <Link
      to={`/contacts/${contact.id}`}
      className="flex items-center justify-between p-4 -mx-4 rounded-xl hover:bg-gray-50 transition-colors group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center w-10 h-10 text-sm font-semibold text-white rounded-xl avatar flex-shrink-0">
          {contact.first_name?.[0]}{contact.last_name?.[0]}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-gray-900 truncate">
            {contact.first_name} {contact.last_name}
          </p>
          <p className="text-sm text-gray-500 truncate">
            {contact.institution?.name || 'Sin institución'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={contact.stage} variant="stage" size="sm" />
        {showGenerateButton && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all bg-gradient-to-r from-primary-500 to-primary-700 shadow-sm">
            <Sparkles className="w-3 h-3" />
            Generar
          </span>
        )}
        <ArrowRight className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  );
};

// ========================================
// PENDING FOLLOWUP ROW
// ========================================
const PendingRow = ({ contact }) => (
  <Link
    to={`/contacts/${contact.id}`}
    className="flex items-center justify-between p-4 -mx-4 rounded-xl hover:bg-amber-50 transition-colors group"
  >
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-10 h-10 text-sm font-semibold rounded-xl bg-amber-100 text-amber-700 flex-shrink-0">
        {contact.first_name?.[0]}{contact.last_name?.[0]}
      </div>
      <div>
        <p className="font-medium text-gray-900">
          {contact.first_name} {contact.last_name}
        </p>
        <p className="text-sm text-gray-500">
          {contact.last_interaction_at
            ? `Hace ${formatDistanceToNow(new Date(contact.last_interaction_at), { locale: es })}`
            : 'Sin interacciones'}
        </p>
      </div>
    </div>
    <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all bg-gradient-to-r from-primary-500 to-primary-700">
      <Sparkles className="w-3 h-3" />
      Follow-up
    </span>
  </Link>
);

// ========================================
// MAIN DASHBOARD COMPONENT
// ========================================
export const Dashboard = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [stats, setStats] = useState({
    totalContacts: 0,
    byStage: {},
    highPriority: 0,
    institutions: 0,
    emailsSent: 0
  });
  const [recentContacts, setRecentContacts] = useState([]);
  const [pendingFollowups, setPendingFollowups] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [activity, setActivity] = useState({ interacciones: 0, correos: 0 });
  const [loading, setLoading] = useState(true);

  // Alcance y período. Antes el Dashboard era 100% global: dos vendedores
  // veían números idénticos y no había ninguna dimensión temporal.
  const [scope, setScope] = useState('all');   // mine | team | all
  const [period, setPeriod] = useState('week'); // today | week | month
  const [teamIds, setTeamIds] = useState(null);

  // Nuevo estado para el modal de historial de emails

  // "Mi equipo" se deriva de quién comparte mi team, no se guarda en contacts.
  useEffect(() => {
    if (scope !== 'team' || !profile?.team) { setTeamIds(null); return; }
    let cancelado = false;
    supabase
      .from('user_profiles').select('id').eq('team', profile.team)
      .then(({ data }) => { if (!cancelado) setTeamIds((data || []).map(u => u.id)); });
    return () => { cancelado = true; };
  }, [scope, profile?.team]);

  useEffect(() => {
    let mounted = true;

    const loadDashboardData = async () => {
      try {
        // Filtro de cartera, aplicado a cada consulta de contactos
        const conAlcance = (q) => {
          if (scope === 'mine' && user?.id) return q.eq('assigned_to', user.id);
          if (scope === 'team' && teamIds?.length) return q.in('assigned_to', teamIds);
          return q;
        };

        const desde = new Date();
        if (period === 'today') desde.setHours(0, 0, 0, 0);
        else if (period === 'week') desde.setDate(desde.getDate() - 7);
        else desde.setDate(desde.getDate() - 30);

        // Conteos EXACTOS con head:true. Antes se traían todas las filas y se
        // contaba el array, lo que además topa silenciosamente en las 1000
        // filas que devuelve Supabase por defecto.
        const stageKeys = ['new', 'contacted', 'qualified', 'customer', 'lost'];

        const [totalRes, prioridadRes, ...porEtapa] = await Promise.all([
          conAlcance(supabase.from('contacts').select('id', { count: 'exact', head: true })),
          conAlcance(supabase.from('contacts').select('id', { count: 'exact', head: true })
            .in('priority', ['alta', 'muy_alta'])),
          ...stageKeys.map(s =>
            conAlcance(supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('stage', s))
          ),
        ]);

        const contactsCount = totalRes.count || 0;
        const byStage = Object.fromEntries(
          stageKeys.map((s, i) => [s, porEtapa[i]?.count || 0])
        );
        const errContacts = totalRes.error;
        if (errContacts) throw errContacts;

        // Get institutions count
        const { count: institutionsCount, error: errInst } = await supabase
          .from('institutions')
          .select('id', { count: 'exact' });
        if (errInst) throw errInst;

        // Get sent emails count
        const { count: emailsCount, error: errEmails } = await supabase
          .from('email_drafts')
          .select('id', { count: 'exact' })
          .eq('status', 'sent');
        if (errEmails) throw errEmails;

        // Recent contacts
        const { data: recent, error: errRecent } = await supabase
          .from('contacts')
          .select(`
            id, first_name, last_name, stage,
            institution:institutions(name)
          `)
          .order('created_at', { ascending: false })
          .limit(5);
        if (errRecent) throw errRecent;

        // Seguimientos vencidos: ahora se usa next_followup_at, que es la
        // fecha que el equipo fija explícitamente en el registro rápido, en vez
        // de derivarla de "hace N días que no hay interacción".
        const hoy = new Date();
        hoy.setHours(23, 59, 59, 999);

        const filtroVencidos = (q) => conAlcance(q)
          .not('stage', 'in', '("lost","customer")')
          .not('next_followup_at', 'is', null)
          .lte('next_followup_at', hoy.toISOString());

        const [pendingRes, pendingCountRes, actividadRes, correosRes] = await Promise.all([
          filtroVencidos(
            supabase.from('contacts').select(`
              id, first_name, last_name, next_followup_at, priority,
              institution:institutions(name)
            `)
          ).order('next_followup_at', { ascending: true }).limit(5),

          // El conteo real. Antes la UI mostraba "N pendientes" usando el
          // largo de una lista capada en 5, así que nunca decía más de 5.
          filtroVencidos(supabase.from('contacts').select('id', { count: 'exact', head: true })),

          // Actividad del período, de interactions (la única fuente real)
          supabase.from('interactions')
            .select('id', { count: 'exact', head: true })
            .gte('occurred_at', desde.toISOString()),

          supabase.from('interactions')
            .select('id', { count: 'exact', head: true })
            .eq('type', 'email_sent')
            .gte('occurred_at', desde.toISOString()),
        ]);

        const pending = pendingRes.data;
        if (pendingRes.error) throw pendingRes.error;

        if (mounted) {
            setStats({
                totalContacts: contactsCount,
                byStage,
                highPriority: prioridadRes.count || 0,
                institutions: institutionsCount || 0,
                emailsSent: emailsCount || 0
            });

            setRecentContacts(recent || []);
            setPendingFollowups(pending || []);
            setPendingCount(pendingCountRes.count || 0);
            setActivity({
              interacciones: actividadRes.count || 0,
              correos: correosRes.count || 0,
            });
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDashboardData();

    return () => {
        mounted = false;
    };
  }, [scope, period, teamIds, user?.id, profile?.team]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-10 h-10 border-4 rounded-full border-primary-500 border-t-transparent animate-spin" />
        <p className="text-sm text-gray-500">Cargando dashboard...</p>
      </div>
    );
  }

  return (
    <PageContainer gap="lg">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Resumen de tu actividad comercial</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Calendar className="w-4 h-4" />
          {new Date().toLocaleDateString('es-AR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </div>
      </div>

      {/* Alcance y período. Antes todo era global y sin dimensión temporal:
          dos vendedores veían exactamente los mismos números. */}
      <div className="card p-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">Cartera:</span>
          {[
            { value: 'mine', label: 'Mía' },
            { value: 'team', label: profile?.team ? `Equipo ${profile.team}` : 'Mi equipo' },
            { value: 'all', label: 'Todos' },
          ].map(o => (
            <button
              key={o.value}
              onClick={() => setScope(o.value)}
              disabled={o.value === 'team' && !profile?.team}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                scope === o.value ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">Actividad:</span>
          {[
            { value: 'today', label: 'Hoy' },
            { value: 'week', label: '7 días' },
            { value: 'month', label: '30 días' },
          ].map(o => (
            <button
              key={o.value}
              onClick={() => setPeriod(o.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                period === o.value ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {o.label}
            </button>
          ))}
          <span className="text-sm text-gray-600 ml-1">
            <strong className="text-gray-900">{activity.interacciones}</strong> interacciones
            {' · '}
            <strong className="text-gray-900">{activity.correos}</strong> correos
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total Contactos"
          value={stats.totalContacts}
          color="text-primary-600"
          iconBg="bg-primary-100"
        />
        <StatCard
          icon={Flame}
          label="Prioridad alta"
          value={stats.highPriority}
          color="text-orange-600"
          iconBg="bg-orange-100"
        />
        <StatCard
          icon={Building2}
          label="Instituciones"
          value={stats.institutions}
          color="text-blue-600"
          iconBg="bg-blue-100"
        />
        {/* Lleva al detalle: quién mandó qué y cuándo */}
        <StatCard
          icon={Mail}
          label="Emails Enviados"
          value={stats.emailsSent}
          color="text-emerald-600"
          iconBg="bg-emerald-100"
          onClick={() => navigate('/seguimientos')}
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Acciones Rápidas</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <QuickActionCard
            icon={Plus}
            title="Nuevo Contacto"
            description="Agregar un lead al CRM"
            gradient="bg-gradient-to-br from-primary-500 to-primary-700"
            onClick={() => navigate('/contacts?new=true')}
          />
          <QuickActionCard
            icon={Sparkles}
            title="Generar Emails"
            description="Crear follow-ups con IA"
            gradient="bg-gradient-to-br from-violet-500 to-purple-700"
            onClick={() => navigate('/contacts')}
          />
          <QuickActionCard
            icon={Building2}
            title="Nueva Institución"
            description="Registrar hospital o lab"
            gradient="bg-gradient-to-br from-blue-500 to-blue-700"
            onClick={() => navigate('/institutions?new=true')}
          />
        </div>
      </div>

      {/* Two Column Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Contacts */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-600" />
              <h2 className="font-semibold text-gray-900">Contactos Recientes</h2>
            </div>
            <Link
              to="/contacts"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
            >
              Ver todos →
            </Link>
          </div>
          <div className="px-6 py-2 divide-y divide-gray-100">
            {recentContacts.length > 0 ? (
              recentContacts.map(contact => (
                <ContactRow key={contact.id} contact={contact} />
              ))
            ) : (
              <div className="py-8 text-center">
                <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-gray-500">No hay contactos aún</p>
                <Link
                  to="/contacts"
                  className="inline-block mt-2 text-sm font-medium text-primary-600 hover:underline"
                >
                  Agregar primer contacto
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Pending Follow-ups */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-amber-50/50">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <h2 className="font-semibold text-gray-900">Pendientes de Follow-up</h2>
            </div>
            <span className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-100 rounded-full">
              {pendingCount} pendiente{pendingCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="px-6 py-2 divide-y divide-gray-100">
            {pendingFollowups.length > 0 ? (
              pendingFollowups.map(contact => (
                <PendingRow key={contact.id} contact={contact} />
              ))
            ) : (
              <div className="py-8 text-center">
                <Target className="w-10 h-10 mx-auto mb-2 text-emerald-300" />
                <p className="font-medium text-gray-900">¡Todo al día!</p>
                <p className="text-sm text-gray-500">No hay follow-ups pendientes</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Embudo por etapa */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Embudo por etapa</h2>
          <Link to="/contacts" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            Ver contactos
          </Link>
        </div>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {PIPELINE_STAGE_ORDER.map(key => {
            const s = PIPELINE_STAGES[key];
            const count = stats.byStage[key] || 0;
            const pct = stats.totalContacts ? Math.round((count / stats.totalContacts) * 100) : 0;
            return (
              <Link
                key={key}
                to={`/contacts?stage=${key}`}
                className="p-4 border border-gray-200 rounded-xl hover:border-primary-300 hover:shadow-sm transition-all"
              >
                <span className="text-sm font-medium text-gray-600">{s.label}</span>
                <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
                <p className="text-xs text-gray-500">{pct}% del total</p>
              </Link>
            );
          })}
        </div>
      </div>
    </PageContainer>
  );
};

export default Dashboard;