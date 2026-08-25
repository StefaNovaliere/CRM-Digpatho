// src/pages/Settings.jsx
//
// Configuración real. La versión anterior era una maqueta: el handleSave era
// un `setTimeout(800)` con el comentario "En producción guardarías en
// Supabase", los toggles no controlaban nada, y el texto seguía diciendo
// "Modo local • RLS desactivado" de una época anterior a que hubiera login.
//
// Tres bloques, todos persistidos:
//   1. Equipo — rol comercial y equipo de cada usuario (user_profiles)
//   2. Metas diarias por rol (app_settings)
//   3. Seguimiento — días para vencido y para estancado (app_settings)
//
// El bloque de equipo es el que resuelve la rotación del área comercial:
// cambiar a alguien de equipo es editar una fila, no reasignar sus contactos.

import { useState, useEffect } from 'react';
import {
  Users,
  Target,
  Clock,
  Save,
  Check,
  Loader2,
  AlertTriangle,
  Info,
  PenLine,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useAppSettings } from '../hooks/useAppSettings';
import { PageContainer } from '../components/common/PageContainer';
import { CRM_ROLES } from '../config/constants';

// Etiquetas de cada indicador. Las claves coinciden con las de app_settings.
const GOAL_LABELS = {
  telefonista: {
    contactos_trabajados: 'Contactos trabajados',
    primeros_contactos: 'Primeros contactos logrados',
    traspasos: 'Traspasos calificados',
  },
  vendedor: {
    seguimientos: 'Seguimientos realizados',
    reuniones: 'Reuniones o visitas',
  },
};

export const Settings = () => {
  const { user, profile, refreshProfile } = useAuth();
  const { settings, loading, saving, error, tableMissing, saveSetting } = useAppSettings();

  const [usuarios, setUsuarios] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true);
  const [guardadoOk, setGuardadoOk] = useState(null); // clave del bloque guardado
  const [metas, setMetas] = useState(null);
  const [dias, setDias] = useState({ followup: 14, stalled: 30 });
  const [firma, setFirma] = useState('');

  // Sincronizar el formulario cuando llegan los valores de la DB
  useEffect(() => {
    if (loading) return;
    setMetas(settings.daily_goals);
    setDias({
      followup: Number(settings.followup_days) || 14,
      stalled: Number(settings.stalled_days) || 30,
    });
  }, [loading, settings]);

  useEffect(() => {
    setFirma(profile?.email_signature || '');
  }, [profile?.email_signature]);

  const cargarUsuarios = async () => {
    setCargandoUsuarios(true);
    const { data } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, crm_role, team, last_login_at')
      .order('last_login_at', { ascending: false, nullsFirst: false });
    setUsuarios(data || []);
    setCargandoUsuarios(false);
  };

  useEffect(() => { cargarUsuarios(); }, []);

  const avisarGuardado = (clave) => {
    setGuardadoOk(clave);
    setTimeout(() => setGuardadoOk(null), 2500);
  };

  // Se guarda al instante al cambiar el select: son campos de un solo valor y
  // un botón "Guardar" por fila sería un clic de más por cada cambio.
  const actualizarUsuario = async (id, campo, valor) => {
    setUsuarios(prev => prev.map(u => (u.id === id ? { ...u, [campo]: valor || null } : u)));

    const { error: err } = await supabase
      .from('user_profiles')
      .update({ [campo]: valor || null })
      .eq('id', id);

    if (err) {
      console.error(`Error actualizando ${campo}:`, err);
      cargarUsuarios(); // revertir el optimismo
      return;
    }
    // Si me cambié a mí mismo, refrescar el perfil de la sesión: "Mi día" lo usa
    if (id === user?.id && refreshProfile) refreshProfile();
    avisarGuardado('equipo');
  };

  const guardarMetas = async () => {
    if (await saveSetting('daily_goals', metas)) avisarGuardado('metas');
  };

  const guardarDias = async () => {
    const ok1 = await saveSetting('followup_days', dias.followup);
    const ok2 = await saveSetting('stalled_days', dias.stalled);
    if (ok1 && ok2) avisarGuardado('dias');
  };

  const guardarFirma = async () => {
    const { error: err } = await supabase
      .from('user_profiles')
      .update({ email_signature: firma || null })
      .eq('id', user.id);
    if (!err) {
      if (refreshProfile) refreshProfile();
      avisarGuardado('firma');
    }
  };

  const equiposExistentes = [...new Set(usuarios.map(u => u.team).filter(Boolean))].sort();

  return (
    <PageContainer width="narrow">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 mt-1">
          Equipo, metas y reglas de seguimiento del sistema comercial
        </p>
      </div>

      {tableMissing && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>Falta correr la migración 010.</strong> Las metas y los días de
            seguimiento se muestran con los valores por defecto, pero no se van a
            poder guardar hasta que exista la tabla <code>app_settings</code>.
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ---------- Equipo ---------- */}
      <div className="card overflow-hidden">
        <Encabezado
          icono={Users}
          color="violet"
          titulo="Equipo comercial"
          descripcion="El rol define qué rutina y qué metas le corresponden a cada uno."
          guardado={guardadoOk === 'equipo'}
        />

        <div className="p-5">
          <div className="flex items-start gap-2 p-3 mb-4 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800">
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              El equipo se guarda en la <strong>persona</strong>, no en cada contacto.
              Si alguien cambia de equipo, sus contactos lo siguen sin reasignar nada.
              Es texto libre: escribí el nombre que quieras.
            </div>
          </div>

          {cargandoUsuarios ? (
            <div className="py-8 text-center">
              <Loader2 className="w-6 h-6 text-gray-300 animate-spin mx-auto" />
            </div>
          ) : (
            <div className="space-y-2">
              {usuarios.map(u => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {u.full_name || 'Sin nombre'}
                      {u.id === user?.id && (
                        <span className="ml-2 text-xs font-normal text-primary-600">(vos)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>

                  <select
                    value={u.crm_role || ''}
                    onChange={(e) => actualizarUsuario(u.id, 'crm_role', e.target.value)}
                    className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="">Sin rol</option>
                    {Object.values(CRM_ROLES).map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={u.team || ''}
                    onChange={(e) => setUsuarios(prev =>
                      prev.map(x => (x.id === u.id ? { ...x, team: e.target.value } : x))
                    )}
                    onBlur={(e) => actualizarUsuario(u.id, 'team', e.target.value.trim())}
                    placeholder="Equipo"
                    list="equipos-existentes"
                    className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg bg-white w-32"
                  />
                </div>
              ))}
              <datalist id="equipos-existentes">
                {equiposExistentes.map(t => <option key={t} value={t} />)}
              </datalist>
            </div>
          )}
        </div>
      </div>

      {/* ---------- Metas ---------- */}
      <div className="card overflow-hidden">
        <Encabezado
          icono={Target}
          color="green"
          titulo="Metas diarias"
          descripcion="Valores de referencia del Manual de Rutinas Comerciales. Se muestran como progreso en «Mi día»."
          guardado={guardadoOk === 'metas'}
        />

        <div className="p-5 space-y-5">
          {loading || !metas ? (
            <div className="py-6 text-center">
              <Loader2 className="w-6 h-6 text-gray-300 animate-spin mx-auto" />
            </div>
          ) : (
            <>
              {Object.entries(GOAL_LABELS).map(([rol, indicadores]) => (
                <div key={rol}>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    {CRM_ROLES[rol]?.label || rol}
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(indicadores).map(([clave, etiqueta]) => (
                      <div key={clave} className="flex items-center justify-between gap-4">
                        <label className="text-sm text-gray-600">{etiqueta}</label>
                        <input
                          type="number"
                          min="0"
                          value={metas?.[rol]?.[clave] ?? 0}
                          onChange={(e) => setMetas(prev => ({
                            ...prev,
                            [rol]: { ...prev[rol], [clave]: Number(e.target.value) },
                          }))}
                          className="w-20 px-3 py-1.5 text-sm text-right border border-gray-300 rounded-lg"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="pt-2">
                <button onClick={guardarMetas} disabled={saving || tableMissing} className="btn-primary">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Guardar metas
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---------- Seguimiento ---------- */}
      <div className="card overflow-hidden">
        <Encabezado
          icono={Clock}
          color="amber"
          titulo="Reglas de seguimiento"
          descripcion="Cuándo se considera que un contacto quedó pendiente o estancado."
          guardado={guardadoOk === 'dias'}
        />

        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Días para pendiente</label>
              <p className="text-xs text-gray-500">Sin interacción durante este tiempo</p>
            </div>
            <input
              type="number"
              min="1"
              value={dias.followup}
              onChange={(e) => setDias(p => ({ ...p, followup: Number(e.target.value) }))}
              className="w-20 px-3 py-1.5 text-sm text-right border border-gray-300 rounded-lg"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Días para estancado</label>
              <p className="text-xs text-gray-500">En la misma etapa, para el reporte mensual</p>
            </div>
            <input
              type="number"
              min="1"
              value={dias.stalled}
              onChange={(e) => setDias(p => ({ ...p, stalled: Number(e.target.value) }))}
              className="w-20 px-3 py-1.5 text-sm text-right border border-gray-300 rounded-lg"
            />
          </div>

          <button onClick={guardarDias} disabled={saving || tableMissing} className="btn-primary">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Guardar
          </button>
        </div>
      </div>

      {/* ---------- Firma ---------- */}
      <div className="card overflow-hidden">
        <Encabezado
          icono={PenLine}
          color="blue"
          titulo="Mi firma de email"
          descripcion="Se agrega automáticamente al final de los correos que enviás."
          guardado={guardadoOk === 'firma'}
        />

        <div className="p-5 space-y-3">
          <textarea
            value={firma}
            onChange={(e) => setFirma(e.target.value)}
            rows={4}
            className="input resize-none font-mono text-sm"
            placeholder={'Juan Pérez\nDigpatho IA\n+54 351 ...'}
          />
          <button onClick={guardarFirma} className="btn-primary">
            <Save size={16} />
            Guardar firma
          </button>
        </div>
      </div>
    </PageContainer>
  );
};

// ---------------------------------------------------------------------------

const COLORS = {
  violet: 'bg-violet-100 text-violet-600',
  green: 'bg-green-100 text-green-600',
  amber: 'bg-amber-100 text-amber-600',
  blue: 'bg-blue-100 text-blue-600',
};

const Encabezado = ({ icono: Icono, color, titulo, descripcion, guardado }) => (
  <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${COLORS[color]}`}>
      <Icono size={18} />
    </div>
    <div className="flex-1 min-w-0">
      <h2 className="font-semibold text-gray-900">{titulo}</h2>
      <p className="text-sm text-gray-500">{descripcion}</p>
    </div>
    {guardado && (
      <span className="flex items-center gap-1 text-sm text-green-600 font-medium flex-shrink-0">
        <Check size={15} />
        Guardado
      </span>
    )}
  </div>
);

export default Settings;
