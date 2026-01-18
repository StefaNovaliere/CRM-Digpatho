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
  Sparkles
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, color, subtext }) => (
  <div className="card p-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
  </div>
);

// Recent Contact Row
const RecentContactRow = ({ contact }) => (
  <Link
    to={`/contacts/${contact.id}`}
    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors group"
  >
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
        {contact.first_name[0]}{contact.last_name[0]}
      </div>
      <div>
        <p className="font-medium text-gray-900">
          {contact.first_name} {contact.last_name}
        </p>
        <p className="text-sm text-gray-500">{contact.institution?.name || 'Sin institución'}</p>
      </div>
    </div>
    <ArrowRight size={16} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
  </Link>
);

export const Dashboard = () => {
  const [stats, setStats] = useState({
    totalContacts: 0,
    hotLeads: 0,
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
          id, first_name, last_name, last_interaction_at,
          institution:institutions(name)
        `)
        .not('interest_level', 'in', '("cold","churned")')
        .or(`last_interaction_at.lt.${twoWeeksAgo.toISOString()},last_interaction_at.is.null`)
        .limit(5);

      setStats({
        totalContacts: contacts?.length || 0,
        hotLeads: contacts?.filter(c => c.interest_level === 'hot').length || 0,
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
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Resumen de tu actividad comercial</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Contactos"
          value={stats.totalContacts}
          color="bg-blue-600"
        />
        <StatCard
          icon={Flame}
          label="Leads Calientes"
          value={stats.hotLeads}
          color="bg-orange-500"
          subtext="Listos para cerrar"
        />
        <StatCard
          icon={Building2}
          label="Instituciones"
          value={stats.institutions}
          color="bg-violet-600"
        />
        <StatCard
          icon={Mail}
          label="Emails Enviados"
          value={stats.emailsSent}
          color="bg-green-600"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Contacts */}
        <div className="card">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Contactos Recientes</h2>
            <Link to="/contacts" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Ver todos
            </Link>
          </div>
          <div className="p-2">
            {recentContacts.length > 0 ? (
              recentContacts.map(contact => (
                <RecentContactRow key={contact.id} contact={contact} />
              ))
            ) : (
              <p className="text-center text-gray-400 py-8">No hay contactos aún</p>
            )}
          </div>
        </div>

        {/* Pending Follow-ups */}
        <div className="card">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-amber-500" />
              <h2 className="font-semibold text-gray-900">Pendientes de Follow-up</h2>
            </div>
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
              {pendingFollowups.length}
            </span>
          </div>
          <div className="p-2">
            {pendingFollowups.length > 0 ? (
              pendingFollowups.map(contact => (
                <Link
                  key={contact.id}
                  to={`/contacts/${contact.id}`}
                  className="flex items-center justify-between p-3 hover:bg-amber-50 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center font-semibold text-sm">
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
                  <button className="flex items-center gap-1 px-3 py-1.5 bg-violet-100 text-violet-700 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                    <Sparkles size={12} />
                    Generar Email
                  </button>
                </Link>
              ))
            ) : (
              <p className="text-center text-gray-400 py-8">
                ¡Todo al día! No hay follow-ups pendientes
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
