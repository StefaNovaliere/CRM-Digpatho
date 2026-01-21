// src/components/layout/MainLayout.jsx
import { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  Settings,
  Sparkles,
  Search,
  Bell,
  Menu,
  X,
  ChevronDown,
  Microscope,
  HelpCircle,
  LogOut,
  User,
  Check,
  Mail,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export const MainLayout = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  // Estados de UI
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Estados de Datos (Notificaciones)
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef(null);

  // ==========================================
  // 1. LÓGICA DE NOTIFICACIONES (Supabase)
  // ==========================================
  useEffect(() => {
    if (!user?.id) return;

    // Cargar notificaciones iniciales
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      }
    };
    fetchNotifications();

    // Suscripción Real-time
    const subscription = supabase
      .channel('main_layout_notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      },
        (payload) => {
          // Nueva notificación recibida en vivo
          setNotifications(prev => [payload.new, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user?.id]);

  // Cerrar notificaciones al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Acciones de notificaciones
  const markAsRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
  };

  // ==========================================
  // 2. LÓGICA DE NAVEGACIÓN
  // ==========================================
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/contacts?search=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  const navigation = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/contacts', icon: Users, label: 'Contactos' },
    { to: '/institutions', icon: Building2, label: 'Instituciones' },
  ];

  const secondaryNav = [
    { to: '/settings', icon: Settings, label: 'Configuración' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ===================== SIDEBAR ===================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center gap-3 h-16 px-6 border-b border-gray-100">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-500/25">
              <Microscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">Digpatho</h1>
              <p className="text-[10px] font-semibold text-primary-600 uppercase tracking-wider">CRM Inteligente</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto scrollbar-thin">
            <div>
              <p className="px-3 mb-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Menú Principal
              </p>
              <div className="space-y-1">
                {navigation.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>

            <div>
              <p className="px-3 mb-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Sistema
              </p>
              <div className="space-y-1">
                {secondaryNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
                    }
                  >
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          </nav>

          {/* AI Banner */}
          <div className="p-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-primary-500/10 via-primary-500/5 to-transparent border border-primary-500/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-semibold text-primary-700">IA Integrada</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Genera emails personalizados automáticamente con Claude AI.
              </p>
            </div>
          </div>

          {/* User Info */}
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-9 h-9 rounded-xl object-cover"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm font-semibold">
                  {getInitials()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {profile?.full_name || 'Usuario'}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ===================== MAIN CONTENT ===================== */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-20 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200">
          <div className="flex items-center justify-between h-full px-6">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 -ml-2 text-gray-500 rounded-lg lg:hidden hover:bg-gray-100"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Search */}
            <form onSubmit={handleSearch} className="relative flex-1 max-w-md mx-4 lg:mx-0">
              <Search className="absolute w-4 h-4 text-gray-400 -translate-y-1/2 left-3 top-1/2" />
              <input

                className="w-full py-2.5 pl-10 pr-4 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
              />
            </form>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* Help */}
              <button className="p-2.5 text-gray-500 rounded-xl hover:bg-gray-100 hover:text-primary-600 transition-colors">
                <HelpCircle className="w-5 h-5" />
              </button>

              {/* ==================== NOTIFICATIONS DROPDOWN ==================== */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2.5 text-gray-500 rounded-xl hover:bg-gray-100 hover:text-primary-600 transition-colors"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute w-2.5 h-2.5 rounded-full top-2 right-2 bg-red-500 ring-2 ring-white animate-pulse" />
                  )}
                </button>

                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
                    <div className="absolute right-0 z-20 w-80 sm:w-96 mt-2 overflow-hidden bg-white border border-gray-200 rounded-2xl shadow-xl animate-scale-in origin-top-right">
                      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 text-sm">Notificaciones</h3>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
                          >
                            <Check size={12} /> Marcar todo
                          </button>
                        )}
                      </div>

                      <div className="max-h-[400px] overflow-y-auto">
                        {!user ? (
                          <div className="p-8 text-center text-gray-400">
                             <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                             Cargando...
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="p-8 text-center text-gray-500">
                            <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">Sin notificaciones nuevas</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-50">
                            {notifications.map((notif) => (
                              <div
                                key={notif.id}
                                className={`p-4 hover:bg-gray-50 transition-colors ${!notif.is_read ? 'bg-primary-50/20' : ''}`}
                              >
                                <div className="flex gap-3">
                                  <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    notif.type === 'email_reply' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-500'
                                  }`}>
                                    {notif.type === 'email_reply' ? <Mail size={14} /> : <Bell size={14} />}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                      <p className={`text-sm font-medium truncate ${!notif.is_read ? 'text-gray-900' : 'text-gray-600'}`}>
                                        {notif.title}
                                      </p>
                                      <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2 flex-shrink-0">
                                        {formatDistanceToNow(new Date(notif.created_at), { locale: es, addSuffix: true })}
                                      </span>
                                    </div>

                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                      {notif.message}
                                    </p>

                                    <div className="flex items-center gap-3 mt-2">
                                      {notif.link && (
                                        <Link
                                          to={notif.link}
                                          onClick={() => {
                                            setShowNotifications(false);
                                            markAsRead(notif.id);
                                          }}
                                          className="text-xs font-medium text-primary-600 hover:text-primary-700"
                                        >
                                          Ver detalle
                                        </Link>
                                      )}
                                      {!notif.is_read && (
                                        <button
                                          onClick={() => markAsRead(notif.id)}
                                          className="text-xs text-gray-400 hover:text-gray-600"
                                        >
                                          Marcar leído
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Divider */}
              <div className="w-px h-8 mx-2 bg-gray-200" />

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name}
                      className="w-9 h-9 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-9 h-9 text-sm font-semibold text-white rounded-xl avatar">
                      {getInitials()}
                    </div>
                  )}
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {/* User Dropdown */}
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 z-20 w-64 mt-2 overflow-hidden bg-white border border-gray-200 rounded-2xl shadow-soft animate-slide-down">
                      {/* User Info */}
                      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                        <p className="font-medium text-gray-900">{profile?.full_name || 'Usuario'}</p>
                        <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                      </div>

                      {/* Menu Items */}
                      <div className="p-2">
                        <NavLink
                          to="/settings"
                          onClick={() => setShowUserMenu(false)}
                          className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <User className="w-4 h-4" />
                          Mi Perfil
                        </NavLink>
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Cerrar Sesión
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default MainLayout;