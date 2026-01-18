// src/components/layout/MainLayout.jsx
import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  Settings,
  Sparkles,
  Search,
  Bell,
  HelpCircle,
  Microscope,
  X,
  ChevronDown
} from 'lucide-react';

export const MainLayout = ({ children }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/contacts?search=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
    }
  };

  const navItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/contacts', icon: Users, label: 'Contactos' },
    { to: '/institutions', icon: Building2, label: 'Instituciones' },
  ];

  const secondaryNavItems = [
    { to: '/settings', icon: Settings, label: 'Configuración' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* ============ SIDEBAR ============ */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed h-full z-20">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-100">
          <div className="w-10 h-10 bg-gradient-to-br from-[#A349A4] to-[#7B2D7D] rounded-xl flex items-center justify-center shadow-lg shadow-[#A349A4]/25">
            <Microscope size={22} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 leading-tight text-lg tracking-tight">Digpatho</h1>
            <p className="text-[10px] text-[#A349A4] font-semibold uppercase tracking-wider">CRM Inteligente</p>
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
            Menú Principal
          </p>
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-[#A349A4]/15 to-[#A349A4]/5 text-[#A349A4] shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`
                }
              >
                <item.icon size={20} />
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Divider */}
          <div className="my-6 border-t border-gray-100" />

          {/* Secondary Navigation */}
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 px-3">
            Sistema
          </p>
          <div className="space-y-1">
            {secondaryNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-[#A349A4]/15 to-[#A349A4]/5 text-[#A349A4]'
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
        <div className="mx-4 mb-4 p-4 bg-gradient-to-br from-[#A349A4]/10 via-[#A349A4]/5 to-transparent rounded-2xl border border-[#A349A4]/20">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-gradient-to-br from-[#A349A4] to-[#7B2D7D] rounded-lg flex items-center justify-center shadow-sm">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-[#7B2D7D]">IA Integrada</span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Genera emails personalizados automáticamente usando inteligencia artificial.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
          <p className="text-[11px] text-gray-400 text-center">
            Digpatho CRM v1.0 • Modo Local
          </p>
        </div>
      </aside>

      {/* ============ MAIN CONTENT ============ */}
      <div className="flex-1 ml-64">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10">
          {/* Search */}
          <form onSubmit={handleSearch} className="relative w-96">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar contactos, instituciones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:border-[#A349A4] focus:ring-2 focus:ring-[#A349A4]/20 outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </form>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Help */}
            <button
              className="p-2.5 text-gray-500 hover:text-[#A349A4] hover:bg-[#A349A4]/10 rounded-xl transition-all"
              title="Ayuda"
            >
              <HelpCircle size={20} />
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2.5 text-gray-500 hover:text-[#A349A4] hover:bg-[#A349A4]/10 rounded-xl transition-all relative"
                title="Notificaciones"
              >
                <Bell size={20} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-[#A349A4] rounded-full ring-2 ring-white" />
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 z-20 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50">
                      <h3 className="font-semibold text-gray-900">Notificaciones</h3>
                    </div>
                    <div className="p-6 text-center">
                      <Bell size={32} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500">No tienes notificaciones nuevas</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Divider */}
            <div className="w-px h-8 bg-gray-200 mx-2" />

            {/* User Avatar */}
            <button className="flex items-center gap-2 p-1.5 hover:bg-gray-100 rounded-xl transition-all">
              <div className="w-9 h-9 bg-gradient-to-br from-[#A349A4] to-[#7B2D7D] rounded-xl flex items-center justify-center text-white font-semibold text-sm shadow-md">
                D
              </div>
              <ChevronDown size={16} className="text-gray-400" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
