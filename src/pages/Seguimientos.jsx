// src/pages/Seguimientos.jsx
//
// La "base de datos de follow up": qué se hizo, quién lo hizo y cuándo, y en
// qué estado quedó cada contacto. Todo se puede filtrar por persona y bajar a
// una planilla.
//
// Las dos pestañas miran lo mismo desde dos lados:
//   Actividad ..... una fila por cosa que pasó  -> "quién mandó qué, cuándo"
//   Seguimientos .. una fila por contacto       -> "cómo venimos"
//
// Las consultas están en src/lib/seguimientos.js para que la pantalla y la
// exportación no puedan desincronizarse.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  ListChecks,
  Loader2,
  Mail,
  Users,
} from 'lucide-react';

import { PageContainer } from '../components/common/PageContainer';
import { StatusBadge } from '../components/common/StatusBadge';
import { INTERACTION_TYPES, PIPELINE_STAGES } from '../config/constants';
import {
  FILTROS_SEGUIMIENTO,
  MAX_FILAS,
  PERIODOS,
  rangoDePeriodo,
  traerActividad,
  traerSeguimientos,
  traerSeguimientosCompleto,
  traerUsuarios,
} from '../lib/seguimientos';
import { exportarXlsx, fechaHoraTexto, fechaTexto, sufijoFecha } from '../utils/exportXlsx';

const POR_PAGINA = 50;

const pill = (active) =>
  `px-3 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
    active ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
  }`;

// Fecha relativa corta. Se prefiere sobre la fecha absoluta en pantalla porque
// lo que importa al mirar la lista es "hace cuánto", no el día exacto.
const haceCuanto = (valor) => {
  if (!valor) return '—';
  const ms = Date.now() - new Date(valor).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `hace ${dias} d`;
  const meses = Math.floor(dias / 30);
  return `hace ${meses} mes${meses !== 1 ? 'es' : ''}`;
};

export const Seguimientos = () => {
  const navigate = useNavigate();

  const [pestania, setPestania] = useState('actividad');

  // Filtros compartidos por las dos pestañas
  const [periodo, setPeriodo] = useState('mes');
  const [desdeManual, setDesdeManual] = useState('');
  const [hastaManual, setHastaManual] = useState('');
  const [personaId, setPersonaId] = useState('all');
  const [tipo, setTipo] = useState('all');
  const [etapa, setEtapa] = useState('all');
  const [seguimiento, setSeguimiento] = useState('all');

  const [usuarios, setUsuarios] = useState([]);
  const [actividad, setActividad] = useState([]);
  const [seguimientos, setSeguimientos] = useState([]);
  const [totalSeguimientos, setTotalSeguimientos] = useState(0);
  const [pagina, setPagina] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [truncado, setTruncado] = useState(false);
  const [error, setError] = useState(null);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    traerUsuarios().then(setUsuarios).catch(() => setUsuarios([]));
  }, []);

  // Cualquier cambio de filtro vuelve a la primera página.
  useEffect(() => {
    setPagina(0);
  }, [periodo, desdeManual, hastaManual, personaId, tipo, etapa, seguimiento, pestania]);

  const rango = useMemo(
    () => rangoDePeriodo(periodo, desdeManual, hastaManual),
    [periodo, desdeManual, hastaManual]
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      if (pestania === 'actividad') {
        const res = await traerActividad({
          desde: rango.desde,
          hasta: rango.hasta,
          personaId,
          tipo,
        });
        setActividad(res.filas);
        setTruncado(res.truncado);
      } else {
        const res = await traerSeguimientos({
          personaId,
          etapa,
          seguimiento,
          pagina,
          porPagina: POR_PAGINA,
          usuarios,
        });
        setSeguimientos(res.filas);
        setTotalSeguimientos(res.total);
        setTruncado(false);
      }
    } catch (err) {
      console.error('Error cargando seguimientos:', err);
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [pestania, rango.desde, rango.hasta, personaId, tipo, etapa, seguimiento, pagina, usuarios]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // La pestaña Actividad se pagina en memoria: la unión de dos tablas con
  // deduplicación no se puede paginar del lado del servidor sin traer las dos
  // completas igual.
  const actividadPagina = useMemo(
    () => actividad.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA),
    [actividad, pagina]
  );

  const total = pestania === 'actividad' ? actividad.length : totalSeguimientos;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const nombreDePersona = () => {
    if (personaId === 'all') return 'todos';
    if (personaId === 'none') return 'sin asignar';
    const u = usuarios.find(x => x.id === personaId);
    return (u?.full_name || u?.email || 'persona').replace(/\s+/g, '_').toLowerCase();
  };

  // ==========================================================================
  // Exportación
  // ==========================================================================
  //
  // Baja SIEMPRE las dos hojas y SIEMPRE todas las filas que matchean los
  // filtros, no sólo la página que se está viendo.
  const exportar = async () => {
    setExportando(true);
    setError(null);
    try {
      const [act, seg] = await Promise.all([
        traerActividad({ desde: rango.desde, hasta: rango.hasta, personaId, tipo }),
        traerSeguimientosCompleto({ personaId, etapa, seguimiento, usuarios }),
      ]);

      const filasActividad = act.filas.map(f => ({
        'Fecha': fechaHoraTexto(f.fecha),
        'Quién': f.quien,
        'Tipo': f.tipoLabel,
        'Dirección': f.direccion,
        'Contacto': f.contacto,
        'Email': f.email,
        'Institución': f.institucion,
        'Asunto': f.asunto,
        'Campaña': f.campania,
      }));

      const filasSeguimiento = seg.filas.map(f => ({
        'Contacto': f.contacto,
        'Email': f.email,
        'Teléfono': f.telefono,
        'Cargo': f.cargo,
        'Institución': f.institucion,
        'Ciudad': f.ciudad,
        'Especialidad': f.especialidad,
        'Sociedad': f.sociedad,
        'KOL': f.esKol,
        'Etapa': PIPELINE_STAGES[f.etapa]?.label || f.etapa,
        'Prioridad': f.prioridad,
        'Responsable': f.responsable,
        'Último contacto': fechaTexto(f.ultimoContacto),
        'Próximo seguimiento': fechaTexto(f.proximoSeguimiento),
        'Días de atraso': f.diasDeAtraso ?? '',
        'Interacciones': f.interacciones,
      }));

      exportarXlsx(`seguimientos_${nombreDePersona()}_${sufijoFecha()}.xlsx`, [
        { nombre: 'Actividad', filas: filasActividad },
        { nombre: 'Seguimientos', filas: filasSeguimiento },
      ]);
    } catch (err) {
      console.error('Error exportando:', err);
      setError(`No se pudo exportar: ${err.message}`);
    } finally {
      setExportando(false);
    }
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <PageContainer>
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Seguimientos</h1>
          <p className="text-gray-500 mt-1">
            Qué se hizo, quién lo hizo y cómo quedó cada contacto.
          </p>
        </div>

        <button
          onClick={exportar}
          disabled={exportando}
          className="btn-primary flex items-center gap-2 self-start disabled:opacity-60"
        >
          {exportando ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
          {exportando ? 'Preparando...' : 'Exportar planilla'}
        </button>
      </div>

      {/* Pestañas */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setPestania('actividad')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            pestania === 'actividad'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Activity size={16} />
          Actividad
        </button>
        <button
          onClick={() => setPestania('seguimientos')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            pestania === 'seguimientos'
              ? 'border-primary-600 text-primary-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ListChecks size={16} />
          Estado de seguimiento
        </button>
      </div>

      {/* Filtros */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-400 flex-shrink-0" />
            <span className="text-sm text-gray-500">Persona:</span>
            <select
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
              className="input py-1.5 text-sm w-auto min-w-[180px]"
            >
              <option value="all">Todas</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.email}
                  {u.team ? ` — ${u.team}` : ''}
                </option>
              ))}
              <option value="none">
                {pestania === 'actividad' ? 'Sin registrar' : 'Sin asignar'}
              </option>
            </select>
          </div>

          {pestania === 'actividad' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Tipo:</span>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="input py-1.5 text-sm w-auto"
              >
                <option value="all">Todos</option>
                {Object.values(INTERACTION_TYPES).map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          )}

          {pestania === 'seguimientos' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Etapa:</span>
              <select
                value={etapa}
                onChange={(e) => setEtapa(e.target.value)}
                className="input py-1.5 text-sm w-auto"
              >
                <option value="all">Todas</option>
                {Object.values(PIPELINE_STAGES).map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Período (Actividad) o vencimiento (Seguimientos) */}
        {pestania === 'actividad' ? (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
            <span className="text-sm text-gray-500 pl-[26px]">Período:</span>
            <div className="flex gap-1 flex-wrap">
              {PERIODOS.map(p => (
                <button key={p.value} onClick={() => setPeriodo(p.value)} className={pill(periodo === p.value)}>
                  {p.label}
                </button>
              ))}
            </div>

            {periodo === 'rango' && (
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="date"
                  value={desdeManual}
                  onChange={(e) => setDesdeManual(e.target.value)}
                  className="input py-1.5 text-sm w-auto"
                />
                <span className="text-sm text-gray-400">a</span>
                <input
                  type="date"
                  value={hastaManual}
                  onChange={(e) => setHastaManual(e.target.value)}
                  className="input py-1.5 text-sm w-auto"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
            <span className="text-sm text-gray-500 pl-[26px]">Seguimiento:</span>
            <div className="flex gap-1 flex-wrap">
              {FILTROS_SEGUIMIENTO.map(f => (
                <button key={f.value} onClick={() => setSeguimiento(f.value)} className={pill(seguimiento === f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <span className="text-sm text-gray-500">
            <strong>{total}</strong>{' '}
            {pestania === 'actividad'
              ? `registro${total !== 1 ? 's' : ''} de actividad`
              : `contacto${total !== 1 ? 's' : ''}`}
          </span>
          {totalPaginas > 1 && (
            <span className="text-sm text-gray-500">Página {pagina + 1} de {totalPaginas}</span>
          )}
        </div>
      </div>

      {truncado && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>
            Se alcanzó el tope de {MAX_FILAS.toLocaleString('es-AR')} filas. Acotá el período
            para ver el total completo — la planilla exportada tiene el mismo límite.
          </span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabla */}
      <div className="card overflow-hidden">
        {cargando ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : total === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
              {pestania === 'actividad' ? <Mail size={22} className="text-gray-400" /> : <Users size={22} className="text-gray-400" />}
            </div>
            <p className="text-gray-600 font-medium">
              {pestania === 'actividad' ? 'No hay actividad en este período' : 'Ningún contacto coincide'}
            </p>
            <p className="text-sm text-gray-500 mt-1 max-w-md mx-auto">
              {pestania === 'actividad'
                ? 'Probá con un período más amplio. El historial arranca cuando se empezó a registrar cada envío, así que lo anterior a eso no figura.'
                : 'Probá sacando algún filtro.'}
            </p>
          </div>
        ) : pestania === 'actividad' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Cuándo</th>
                  <th className="text-left font-medium px-4 py-3">Quién</th>
                  <th className="text-left font-medium px-4 py-3">Tipo</th>
                  <th className="text-left font-medium px-4 py-3">Contacto</th>
                  <th className="text-left font-medium px-4 py-3">Asunto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {actividadPagina.map(f => (
                  <tr
                    key={f.id}
                    className={`hover:bg-gray-50 transition-colors ${f.contactoId ? 'cursor-pointer' : ''}`}
                    onClick={() => f.contactoId && navigate(`/contacts/${f.contactoId}`)}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-gray-900">{fechaHoraTexto(f.fecha)}</div>
                      <div className="text-xs text-gray-400">{haceCuanto(f.fecha)}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{f.quien}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-gray-700">{f.tipoLabel}</span>
                      {f.direccion === 'Entrante' && (
                        <span className="ml-1.5 text-xs text-green-600">↓</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{f.contacto || f.email || '—'}</div>
                      <div className="text-xs text-gray-400">
                        {f.institucion || f.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-md">
                      <div className="text-gray-700 truncate">{f.asunto || '—'}</div>
                      {f.campania && (
                        <div className="text-xs text-primary-600 truncate">Campaña: {f.campania}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Contacto</th>
                  <th className="text-left font-medium px-4 py-3">Responsable</th>
                  <th className="text-left font-medium px-4 py-3">Etapa</th>
                  <th className="text-left font-medium px-4 py-3">Prioridad</th>
                  <th className="text-left font-medium px-4 py-3">Último contacto</th>
                  <th className="text-left font-medium px-4 py-3">Próximo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {seguimientos.map(f => (
                  <tr
                    key={f.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/contacts/${f.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="text-gray-900 font-medium">{f.contacto || f.email}</div>
                      <div className="text-xs text-gray-400">{f.institucion || f.email}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={f.responsableId ? 'text-gray-700' : 'text-gray-400 italic'}>
                        {f.responsable}
                      </span>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={f.etapa} variant="stage" size="sm" /></td>
                    <td className="px-4 py-3"><StatusBadge status={f.prioridad} variant="priority" size="sm" /></td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {f.ultimoContacto ? haceCuanto(f.ultimoContacto) : <span className="text-gray-400">nunca</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {f.proximoSeguimiento ? (
                        <span className={f.diasDeAtraso !== null ? 'text-red-600 font-medium' : 'text-gray-600'}>
                          {fechaTexto(f.proximoSeguimiento)}
                          {f.diasDeAtraso !== null && (
                            <span className="text-xs"> · {f.diasDeAtraso}d de atraso</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">sin fecha</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPagina(p => Math.max(0, p - 1))}
            disabled={pagina === 0}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-gray-500 px-2">
            {pagina + 1} / {totalPaginas}
          </span>
          <button
            onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))}
            disabled={pagina >= totalPaginas - 1}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </PageContainer>
  );
};

export default Seguimientos;
