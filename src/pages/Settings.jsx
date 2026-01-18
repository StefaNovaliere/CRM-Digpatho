// src/pages/Settings.jsx
import { useState, useEffect } from 'react';
import { User, Key, Bell, Sparkles, Save, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const Settings = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    notifications_email: true,
    notifications_weekly_report: true,
    ai_tone: 'professional',
    ai_language: 'es'
  });

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
  };

  const handleSave = async () => {
    setLoading(true);
    // Aquí guardarías en una tabla de settings
    await new Promise(r => setTimeout(r, 500)); // Simulación
    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    if (error) {
      alert('Error al enviar email');
    } else {
      alert('Email de recuperación enviado');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 mt-1">Administra tu cuenta y preferencias</p>
      </div>

      {/* Cuenta */}
      <div className="card">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <User size={20} className="text-gray-400" />
            Cuenta
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="input bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <button
              onClick={handlePasswordReset}
              className="btn-secondary text-sm"
            >
              <Key size={16} />
              Enviar email para cambiar contraseña
            </button>
          </div>
        </div>
      </div>

      {/* Notificaciones */}
      <div className="card">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Bell size={20} className="text-gray-400" />
            Notificaciones
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Notificaciones por email</p>
              <p className="text-sm text-gray-500">Recibe alertas de nuevas interacciones</p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications_email}
              onChange={(e) => setSettings(s => ({ ...s, notifications_email: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>
          <label className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Reporte semanal</p>
              <p className="text-sm text-gray-500">Resumen de actividad cada lunes</p>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications_weekly_report}
              onChange={(e) => setSettings(s => ({ ...s, notifications_weekly_report: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
          </label>
        </div>
      </div>

      {/* Preferencias de IA */}
      <div className="card">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles size={20} className="text-violet-600" />
            Preferencias de IA
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tono de los emails generados
            </label>
            <select
              value={settings.ai_tone}
              onChange={(e) => setSettings(s => ({ ...s, ai_tone: e.target.value }))}
              className="input appearance-none"
            >
              <option value="professional">Profesional</option>
              <option value="friendly">Amigable</option>
              <option value="formal">Formal</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Idioma
            </label>
            <select
              value={settings.ai_language}
              onChange={(e) => setSettings(s => ({ ...s, ai_language: e.target.value }))}
              className="input appearance-none"
            >
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="pt">Português</option>
            </select>
          </div>
        </div>
      </div>

      {/* Guardar */}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
            <CheckCircle size={16} />
            Guardado
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save size={18} />
              Guardar Cambios
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Settings;
