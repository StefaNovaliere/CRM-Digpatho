// src/components/layout/Header.jsx
import { useState, useEffect, useRef } from 'react';
import { Search, Bell, Settings, LogOut, ChevronDown, Mail, Check, Loader2, Bug } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export const Header = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef(null);

  // --- DEBUGGING MANUAL ---
  const runDebug = async () => {
    console.group("🔍 DIAGNÓSTICO DE NOTIFICACIONES");
    console.log("1. Usuario actual ID:", user?.id);
    console.log("2. Usuario Email:", user?.email);

    if (!user?.id) {
        console.error("❌ ERROR: No hay usuario autenticado en el Header.");
        console.groupEnd();
        return;
    }

    // Consulta directa sin filtros primero
    const { data, error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' });

    if (error) {
        console.error("❌ ERROR DE SUPABASE:", error);
    } else {
        console.log("3. Respuesta de DB (Total filas encontradas):", count);
        console.log("4. Datos crudos:", data);

        // Verificar si los IDs coinciden
        const misNotificaciones = data.filter(n => n.user_id === user.id);
        console.log(`5. Filas que coinciden con mi ID (${user.id}):`, misNotificaciones.length);

        if (data.length > 0 && misNotificaciones.length === 0) {
            console.warn("⚠️ ALERTA: Hay notificaciones en la tabla, pero tienen otro user_id.");
            console.log("ID en la tabla:", data[0].user_id);
            console.log("ID de mi sesión:", user.id);
        }
    }
    console.groupEnd();
    alert("Revisa la consola (F12) para ver el diagnóstico.");
  };

  // --- CARGA DE DATOS ---
  useEffect(() => {
    if (!user?.id) return;

    const fetchNotifications = async () => {
      // Intentamos cargar
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id) // <--- Aquí puede estar el filtro bloqueante
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.is_read).length);
      } else if (error) {
        console.error("Error fetching header notifications:", error);
      }
    };

    fetchNotifications();

    // Suscripción
    const subscription = supabase
      .channel('header_live_updates')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications'
      },
        (payload) => {
          console.log("⚡ REALTIME EVENT:", payload);
          // Solo agregar si es para mí
          if (payload.new.user_id === user.id) {
              setNotifications(prev => [payload.new, ...prev]);
              setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, [user?.id]);

  // --- INTERACCIÓN ---
  const markAsRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
  };

  const handleLogoutAction = async () => {
    await signOut();
    navigate('/login');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/contacts?search=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10">
      <form onSubmit={handleSearch} className="relative w-96">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar contactos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-blue-500 outline-none transition-colors"
        />
      </form>

      <div className="flex items-center gap-3">

        {/* BOTÓN DEBUG TEMPORAL */}
        <button onClick={runDebug} className="bg-red-100 text-red-600 px-3 py-1 rounded text-xs font-bold flex items-center gap-1">
            <Bug size={12}/> DEBUG
        </button>

        {/* NOTIFICACIONES */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors relative"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-20 animate-scale-in">
              <div className="px-4 py-3 border-b border-gray-100 flex justify-between bg-gray-50">
                <h3 className="font-semibold text-gray-900 text-sm">Notificaciones ({notifications.length})</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    <Check size={12} /> Marcar todo
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">Sin notificaciones nuevas</p>
                    <p className="text-xs text-gray-400 mt-2">ID: {user?.id?.slice(0,8)}...</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {notifications.map((notif) => (
                      <div key={notif.id} className={`p-4 hover:bg-gray-50 transition-colors ${!notif.is_read ? 'bg-blue-50/30' : ''}`}>
                        <div className="flex gap-3">
                          <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${notif.type === 'email_reply' ? 'bg-green-100 text-green-600' : 'bg-gray-100'}`}>
                            {notif.type === 'email_reply' ? <Mail size={14} /> : <Bell size={14} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between">
                              <p className={`text-sm font-medium truncate ${!notif.is_read ? 'text-gray-900' : 'text-gray-600'}`}>{notif.title}</p>
                              <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">{formatDistanceToNow(new Date(notif.created_at), { locale: es, addSuffix: true })}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                            {notif.link && (
                              <Link to={notif.link} onClick={() => { setShowNotifications(false); markAsRead(notif.id); }} className="text-xs font-medium text-blue-600 hover:text-blue-700 mt-2 inline-block">Ver detalle</Link>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* USUARIO */}
        <div className="relative">
          <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded-lg">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">{user?.email?.[0]?.toUpperCase()}</div>
            <ChevronDown size={16} className="text-gray-400" />
          </button>
          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-20">
                <div className="px-4 py-3 border-b border-gray-100"><p className="text-sm font-medium truncate">{user?.email}</p></div>
                <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"><Settings size={16} /> Configuración</button>
                <button onClick={handleLogoutAction} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50"><LogOut size={16} /> Cerrar Sesión</button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;