// src/components/layout/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  Settings,
  LogOut,
  Sparkles,
  Mail,
  Send
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

export const Sidebar = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const mainNav = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/contacts', icon: Users, label: 'Contactos' },
    { to: '/institutions', icon: Building2, label: 'Instituciones' },
    { to: '/bulk-email', icon: Send, label: 'Envío Masivo', isNew: true },
  ];

  const secondaryNav = [
    { to: '/settings', icon: Settings, label: 'Configuración' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-100">
        <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/20">
          <Sparkles size={20} className="text-white" />
        </div>
        <div>
          <h1 className="font-bold text-gray-900 leading-tight">Digpatho</h1>
          <p className="text-[10px] text-gray-500 uppercase tracking-wider">CRM INTELIGENTE</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-4">
        <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Menú Principal
        </p>
        <div className="space-y-1">
          {mainNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <item.icon size={20} />
              {item.label}
              {item.isNew && (
                <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded">
                  NUEVO
                </span>
              )}
            </NavLink>
          ))}
        </div>

        {/* Divider */}
        <div className="my-6 border-t border-gray-100" />

        {/* Secondary Navigation */}
        <p className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Sistema
        </p>
        <div className="space-y-1">
          {secondaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <item.icon size={20} />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* AI Feature Banner */}
      <div className="mx-4 mb-4 p-4 bg-gradient-to-br from-violet-50 to-blue-50 rounded-xl border border-violet-100">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={16} className="text-violet-600" />
          <span className="text-sm font-semibold text-violet-900">IA Integrada</span>
        </div>
        <p className="text-xs text-violet-700">
          Genera emails personalizados automáticamente con Claude AI.
        </p>
      </div>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors w-full"
        >
          <LogOut size={20} />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;