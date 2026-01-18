// src/pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  Building2,
  Mail,
  Flame,
  Snowflake,
  Clock,
  ArrowRight,
  Sparkles,
  Plus,
  TrendingUp,
  Zap,
  Target,
  Calendar
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// ========================================
// STAT CARD COMPONENT
// ========================================
const StatCard = ({ icon: Icon, label, value, change, changeType, color, iconBg }) => (
  <div className="card p-6 hover:shadow-card-hover transition-all duration-300">
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
  const interestConfig = {
    cold: { label: 'Frío', bg: 'bg-slate-100', text: 'text-slate-600' },
    warm: { label: 'Tibio', bg: 'bg-amber-100', text: 'text-amber-700' },
    hot: { label: 'Caliente', bg: 'bg-orange-100', text: 'text-orange-700' },
    customer: { label: 'Cliente', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  };
  const interest = interestConfig[contact.interest_level] || interestConfig.cold;

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
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${interest.bg} ${interest.text}`}>
          {interest.label}
        </span>
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
  const [stats, setStats] = useState({
    totalContacts: 0,
    hotLeads: 0,
    warmLeads: 0,
    coldLeads: 0,
    institutions: 0,
    emailsSent: 0
  });
  const [recentContacts, setRecentContacts] = useState([]);
  const [pendingFollowups, setPendingFollowups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Get contacts
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, interest_level');

      // Get institutions count
      const { count: institutionsCount } = await supabase
        .from('institutions')
        .select('id', { count: 'exact' });

      // Get sent emails count
      const { count: emailsCount } = await supabase
        .from('email_drafts')
        .select('id', { count: 'exact' })
        .eq('status', 'sent');

      // Recent contacts
      const { data: recent } = await supabase
        .from('contacts')
        .select(`
          id, first_name, last_name, interest_level,
          institution:institutions(name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      // Pending follow-ups (no interaction in 14+ days)
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const { data: pending } = await supabase
        .from('contacts')
        .select(`
          id, first_name, last_name, last_interaction_at,
          institution:institutions(name)
        `)
        .not('interest_level', 'in', '("cold","churned")')
        .or(`last_interaction_at.lt.${twoWeeksAgo.toISOString()},last_interaction_at.is.null`)
        .order('last_interaction_at', { ascending: true, nullsFirst: true })
        .limit(5);

      setStats({
        totalContacts: contacts?.length || 0,
        hotLeads: contacts?.filter(c => c.interest_level === 'hot').length || 0,
        warmLeads: contacts?.filter(c => c.interest_level === 'warm').length || 0,
        coldLeads: contacts?.filter(c => c.interest_level === 'cold').length || 0,
        institutions: institutionsCount || 0,
        emailsSent: emailsCount || 0
      });

      setRecentContacts(recent || []);
      setPendingFollowups(pending || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="w-10 h-10 border-4 rounded-full border-primary-500 border-t-transparent animate-spin" />
        <p className="text-sm text-gray-500">Cargando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
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
          label="Leads Calientes"
          value={stats.hotLeads}
          color="text-orange-600"
          iconBg="bg-orange-100"
          change={12}
          changeType="up"
        />
        <StatCard
          icon={Building2}
          label="Instituciones"
          value={stats.institutions}
          color="text-blue-600"
          iconBg="bg-blue-100"
        />
        <StatCard
          icon={Mail}
          label="Emails Enviados"
          value={stats.emailsSent}
          color="text-emerald-600"
          iconBg="bg-emerald-100"
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
              {pendingFollowups.length} pendientes
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

      {/* Pipeline Overview */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Pipeline de Leads</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="p-4 border border-orange-200 rounded-xl bg-orange-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-orange-700">Calientes</span>
              <Flame className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-orange-700">{stats.hotLeads}</p>
            <p className="text-xs text-orange-600">Listos para cerrar</p>
          </div>
          <div className="p-4 border border-amber-200 rounded-xl bg-amber-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-amber-700">Tibios</span>
              <Zap className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-700">{stats.warmLeads}</p>
            <p className="text-xs text-amber-600">En proceso</p>
          </div>
          <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Fríos</span>
              <Snowflake className="w-5 h-5 text-slate-500" />
            </div>
            <p className="text-2xl font-bold text-slate-700">{stats.coldLeads}</p>
            <p className="text-xs text-slate-600">Por nutrir</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
