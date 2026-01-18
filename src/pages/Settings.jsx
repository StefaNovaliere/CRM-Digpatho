// src/pages/Settings.jsx
import { useState } from 'react';
import {
  Bell,
  Sparkles,
  Save,
  CheckCircle,
  Database,
  Palette,
  Globe,
  Clock,
  Shield,
  Info
} from 'lucide-react';

export const Settings = () => {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    notifications_email: true,
    notifications_weekly_report: true,
    notifications_followup_reminder: true,
    ai_tone: 'professional',
    ai_language: 'es',
    ai_signature: 'Equipo Digpatho IA',
    followup_days: 14,
    timezone: 'America/Argentina/Buenos_Aires'
  });

  const handleSave = async () => {
    setLoading(true);
    // Simular guardado - en producción guardarías en Supabase
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 mt-1">Personaliza tu experiencia en Digpatho CRM</p>
      </div>

      {/* Preferencias de IA */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-[#A349A4]/5 to-transparent">
          <h2 className="font-semibold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#A349A4] to-[#7B2D7D] rounded-xl flex items-center justify-center shadow-sm">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <span>Preferencias de IA</span>
              <p className="text-sm font-normal text-gray-500">Configura cómo Claude genera tus emails</p>
            </div>
          </h2>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tono de comunicación
              </label>
              <select
                value={settings.ai_tone}
                onChange={(e) => setSettings(s => ({ ...s, ai_tone: e.target.value }))}
                className="input"
              >
                <option value="professional">🎯 Profesional</option>
                <option value="friendly">😊 Amigable</option>
                <option value="formal">📋 Formal</option>
                <option value="casual">💬 Casual</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Define el estilo de los emails generados
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Idioma principal
              </label>
              <select
                value={settings.ai_language}
                onChange={(e) => setSettings(s => ({ ...s, ai_language: e.target.value }))}
                className="input"
              >
                <option value="es">🇪🇸 Español</option>
                <option value="en">🇺🇸 English</option>
                <option value="pt">🇧🇷 Português</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Firma de emails
            </label>
            <input
              type="text"
              value={settings.ai_signature}
              onChange={(e) => setSettings(s => ({ ...s, ai_signature: e.target.value }))}
              className="input"
              placeholder="Tu nombre o firma"
            />
            <p className="text-xs text-gray-500 mt-1">
              Se incluirá al final de cada email generado
            </p>
          </div>
        </div>
      </div>

      {/* Notificaciones */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Bell size={20} className="text-amber-600" />
            </div>
            <div>
              <span>Notificaciones</span>
              <p className="text-sm font-normal text-gray-500">Gestiona tus alertas y recordatorios</p>
            </div>
          </h2>
        </div>
        <div className="p-5 space-y-4">
          <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock size={16} className="text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Recordatorios de Follow-up</p>
                <p className="text-sm text-gray-500">Alertas cuando un contacto necesite seguimiento</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications_followup_reminder}
              onChange={(e) => setSettings(s => ({ ...s, notifications_followup_reminder: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-300 text-[#A349A4] focus:ring-[#A349A4]"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <Bell size={16} className="text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Notificaciones por email</p>
                <p className="text-sm text-gray-500">Recibe alertas de nuevas interacciones</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications_email}
              onChange={(e) => setSettings(s => ({ ...s, notifications_email: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-300 text-[#A349A4] focus:ring-[#A349A4]"
            />
          </label>

          <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                <Globe size={16} className="text-violet-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Reporte semanal</p>
                <p className="text-sm text-gray-500">Resumen de actividad cada lunes</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.notifications_weekly_report}
              onChange={(e) => setSettings(s => ({ ...s, notifications_weekly_report: e.target.checked }))}
              className="w-5 h-5 rounded border-gray-300 text-[#A349A4] focus:ring-[#A349A4]"
            />
          </label>
        </div>
      </div>

      {/* Follow-up Settings */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Clock size={20} className="text-blue-600" />
            </div>
            <div>
              <span>Reglas de Follow-up</span>
              <p className="text-sm font-normal text-gray-500">Define cuándo marcar contactos como pendientes</p>
            </div>
          </h2>
        </div>
        <div className="p-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Días sin interacción para marcar como pendiente
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min="1"
                max="90"
                value={settings.followup_days}
                onChange={(e) => setSettings(s => ({ ...s, followup_days: parseInt(e.target.value) || 14 }))}
                className="input w-24"
              />
              <span className="text-gray-500">días</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Los contactos sin interacción por este período aparecerán en "Pendientes de Follow-up"
            </p>
          </div>
        </div>
      </div>

      {/* Base de Datos */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Database size={20} className="text-emerald-600" />
            </div>
            <div>
              <span>Base de Datos</span>
              <p className="text-sm font-normal text-gray-500">Estado de la conexión</p>
            </div>
          </h2>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
              <div>
                <p className="font-medium text-emerald-800">Conectado a Supabase</p>
                <p className="text-sm text-emerald-600">RLS desactivado • Modo local</p>
              </div>
            </div>
            <Shield size={20} className="text-emerald-500" />
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <div className="flex gap-3">
              <Info size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-blue-800 font-medium">Modo Local Activo</p>
                <p className="text-xs text-blue-600 mt-1">
                  Esta instancia está configurada para uso local sin autenticación.
                  Todos los datos son accesibles públicamente en esta base de datos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Guardar */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium animate-fade-in">
              <CheckCircle size={18} />
              Cambios guardados correctamente
            </span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="btn-primary px-6"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Guardando...
            </>
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
