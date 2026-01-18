// src/pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Building2,
  Mail,
  TrendingUp,
  Flame,
  Snowflake,
  Clock,
  ArrowRight,
  Sparkles,
  Calendar,
  Target,
  Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, color, bgColor, subtext, trend }) => (
  <div className="card p-5 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <div className="flex items-baseline gap-2 mt-1">
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {trend && (
            <span className={`text-xs font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend > 0 ? '+' : ''}{trend}%
            </span>
          )}
        </div>
        {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
      </div>
      <div className={`p-3 rounded-xl ${bgColor}`}>
        <Icon size={24} className={color} />
      </div>
    </div>
  </div>
);

// Recent Contact Row
const RecentContactRow = ({ contact }) => (
  <Link
    to={`/contacts/${contact.id}`}
    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors group"
  >
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-gradient-to-br from-[#A349A4] to-[#7B2D7D] rounded-xl flex items-center justify-center text-white font-semibold text-sm shadow-sm">
        {contact.first_name[0]}{contact.last_name[0]}
      </div>
      <div>
        <p className="font-medium text-gray-900">
          {contact.first_name} {contact.last_name}
        </p>
        <p className="text-sm text-gray-500">{contact.institution?.name || 'Sin institución'}</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <InterestBadge level={contact.interest_level} />
      <ArrowRight size={16} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  </Link>
);

// Interest Badge
const InterestBadge = ({ level }) => {
  const config = {
    cold: { label: 'Frío', bg: 'bg-slate-100', text: 'text-slate-600' },
    warm: { label: 'Tibio', bg: 'bg-amber-100', text: 'text-amber-700' },
    hot: { label: 'Caliente', bg: 'bg-orange-100', text: 'text-orange-700' },
    customer: { label: 'Cliente', bg: 'bg-green-100', text: 'text-green-700' },
  };
  const { label, bg, text } = config[level] || config.cold;
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
};

// Quick Action Button
const QuickAction = ({ icon: Icon, label, description, onClick, color }) => (
  <button
    onClick={onClick}
    className="flex items-start gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-[#A349A4]/30 hover:shadow-md transition-all text-left group"
  >
    <div className={`p-2 rounded-lg ${color}`}>
      <Icon size={20} className="text-white" />
    </div>
    <div>
      <p className="font-medium text-gray-900 group-hover:text-[#A349A4] transition-colors">{label}</p>
      <p className="text-xs text-gray-500 mt-0.5">{description}</p>
    </div>
  </button>
);

export const Dashboard = () => {
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
      // Get contacts count by interest level
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, interest_level');

      const { count: institutionsCount } = await supabase
        .from('institutions')
        .select('id', { count: 'exact' });

      const { count: emailsCount } = await supabase
        .from('email_drafts')
        .select('id', { count: 'exact' })
        .eq('status', 'sent');

      // Recent contacts with institution
      const { data: recent } = await supabase
        .from('contacts')
        .select(`
          id, first_name, last_name, interest_level,
          institution:institutions(name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      // Contacts that need follow-up (no interaction in 14+ days)
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const { data: pending } = await supabase
        .from('contacts')
        .select(`
          id, first_name, last_name, last_interaction_at, interest_level,
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
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#A349A4] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-500">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Resumen de tu actividad comercial</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">
            {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Contactos"
          value={stats.totalContacts}
          color="text-[#A349A4]"
          bgColor="bg-[#A349A4]/10"
        />
        <StatCard
          icon={Flame}
          label="Leads Calientes"
          value={stats.hotLeads}
          color="text-orange-600"
          bgColor="bg-orange-100"
          subtext="Listos para cerrar"
        />
        <StatCard
          icon={Building2}
          label="Instituciones"
          value={stats.institutions}
          color="text-blue-600"
          bgColor="bg-blue-100"
        />
        <StatCard
          icon={Mail}
          label="Emails Enviados"
          value={stats.emailsSent}
          color="text-green-600"
          bgColor="bg-green-100"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Acciones Rápidas</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickAction
            icon={Users}
            label="Nuevo Contacto"
            description="Agregar un lead al CRM"
            color="bg-[#A349A4]"
            onClick={() => window.location.href = '/contacts?new=true'}
          />
          <QuickAction
            icon={Sparkles}
            label="Generar Emails"
            description="Crear follow-ups con IA"
            color="bg-gradient-to-br from-[#A349A4] to-[#7B2D7D]"
            onClick={() => window.location.href = '/contacts'}
          />
          <QuickAction
            icon={Building2}
            label="Nueva Institución"
            description="Registrar hospital o laboratorio"
            color="bg-blue-600"
            onClick={() => window.location.href = '/institutions?new=true'}
          />
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Contacts */}
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-[#A349A4]" />
              <h2 className="font-semibold text-gray-900">Contactos Recientes</h2>
            </div>
            <Link to="/contacts" className="text-sm text-[#A349A4] hover:text-[#7B2D7D] font-medium">
              Ver todos →
            </Link>
          </div>
          <div className="p-2">
            {recentContacts.length > 0 ? (
              recentContacts.map(contact => (
                <RecentContactRow key={contact.id} contact={contact} />
              ))
            ) : (
              <div className="text-center py-8">
                <Users size={40} className="mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500">No hay contactos aún</p>
                <Link to="/contacts" className="text-sm text-[#A349A4] hover:underline mt-1 inline-block">
                  Agregar primer contacto
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Pending Follow-ups */}
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-amber-50/50">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-amber-600" />
              <h2 className="font-semibold text-gray-900">Pendientes de Follow-up</h2>
            </div>
            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
              {pendingFollowups.length} pendientes
            </span>
          </div>
          <div className="p-2">
            {pendingFollowups.length > 0 ? (
              pendingFollowups.map(contact => (
                <Link
                  key={contact.id}
                  to={`/contacts/${contact.id}`}
                  className="flex items-center justify-between p-3 hover:bg-amber-50 rounded-xl transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center font-semibold text-sm">
                      {contact.first_name[0]}{contact.last_name[0]}
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
                  <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#A349A4] to-[#7B2D7D] text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                    <Sparkles size={12} />
                    Generar Email
                  </button>
                </Link>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Target size={24} className="text-green-600" />
                </div>
                <p className="text-gray-900 font-medium">¡Todo al día!</p>
                <p className="text-sm text-gray-500">No hay follow-ups pendientes</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interest Level Breakdown */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Pipeline de Leads</h2>
        <div className="flex gap-4">
          <div className="flex-1 p-4 bg-orange-50 rounded-xl border border-orange-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-orange-700">Calientes</span>
              <Flame size={18} className="text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-orange-700">{stats.hotLeads}</p>
          </div>
          <div className="flex-1 p-4 bg-amber-50 rounded-xl border border-amber-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-amber-700">Tibios</span>
              <Zap size={18} className="text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-700">{stats.warmLeads}</p>
          </div>
          <div className="flex-1 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">Fríos</span>
              <Snowflake size={18} className="text-slate-500" />
            </div>
            <p className="text-2xl font-bold text-slate-700">{stats.coldLeads}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
