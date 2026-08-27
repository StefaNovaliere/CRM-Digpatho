// src/lib/seguimientos.js
//
// Consultas de la "base de datos de follow up". Viven acá y no dentro de la
// página porque la PANTALLA y la EXPORTACIÓN tienen que devolver exactamente
// lo mismo: si la planilla se armara con otra consulta, tarde o temprano diría
// algo distinto de lo que se ve en pantalla y nadie sabría cuál creer.
//
// No hay tabla nueva: todo esto ya se estaba guardando.
//   - interactions ......... cada correo, llamada, reunión y nota, con
//                            created_by / occurred_at / type / subject.
//   - bulk_email_queue ..... los envíos masivos, incluso a destinatarios que
//                            no son contactos (ver la nota de la unión).
//   - contacts ............. el estado actual de cada seguimiento.

import { supabase } from './supabase';
import { INTERACTION_TYPES } from '../config/constants';

// PostgREST devuelve como mucho 1000 filas por request. Para traer todo hay que
// pedir de a tandas.
const TANDA = 1000;

// Techo de seguridad. Con el filtro de período puesto no se llega ni cerca,
// pero sin tope una consulta mal filtrada podría intentar bajar años enteros.
export const MAX_FILAS = 10000;

// ============================================================================
// Períodos
// ============================================================================

export const PERIODOS = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Esta semana' },
  { value: 'mes', label: 'Este mes' },
  { value: 'todo', label: 'Todo' },
  { value: 'rango', label: 'Personalizado' },
];

const inicioDelDia = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const finDelDia = (d) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

/**
 * Traduce el período elegido a un rango concreto.
 * La semana arranca el LUNES, que es como trabaja el equipo (la reunión de
 * cierre es los lunes), no el domingo que es el default de JavaScript.
 */
export function rangoDePeriodo(periodo, desdeManual, hastaManual) {
  const hoy = new Date();

  if (periodo === 'hoy') {
    return { desde: inicioDelDia(hoy), hasta: finDelDia(hoy) };
  }

  if (periodo === 'semana') {
    const diaSemana = (hoy.getDay() + 6) % 7; // lunes = 0
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - diaSemana);
    return { desde: inicioDelDia(lunes), hasta: finDelDia(hoy) };
  }

  if (periodo === 'mes') {
    const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return { desde: inicioDelDia(primero), hasta: finDelDia(hoy) };
  }

  if (periodo === 'rango') {
    return {
      desde: desdeManual ? inicioDelDia(new Date(desdeManual)) : null,
      hasta: hastaManual ? finDelDia(new Date(hastaManual)) : null,
    };
  }

  return { desde: null, hasta: null }; // 'todo'
}

// ============================================================================
// Utilidades
// ============================================================================

const nombreDeContacto = (c) => {
  if (!c) return '';
  return `${c.first_name || ''} ${c.last_name || ''}`.trim();
};

/**
 * Trae TODAS las filas de una consulta, de a tandas de 1000.
 * `armarQuery` recibe el offset y devuelve la query ya con .range() aplicado.
 */
async function traerTodo(armarQuery) {
  const filas = [];
  let truncado = false;

  for (let offset = 0; offset < MAX_FILAS; offset += TANDA) {
    const { data, error } = await armarQuery(offset, TANDA);
    if (error) throw error;

    filas.push(...(data || []));

    if (!data || data.length < TANDA) return { filas, truncado };
    if (filas.length >= MAX_FILAS) truncado = true;
  }

  return { filas, truncado };
}

/**
 * Mapa id -> perfil. `interactions.created_by` referencia a auth.users, no a
 * user_profiles, así que PostgREST no puede resolverlo con un embed: hay que
 * traerlos aparte. Es el mismo patrón que usa la lista de campañas.
 */
export async function traerUsuarios() {
  const { data } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, team, crm_role')
    .order('full_name');
  return data || [];
}

const nombreDeUsuario = (usuariosPorId, id) => {
  if (!id) return 'Sin registrar';
  const u = usuariosPorId[id];
  if (!u) return 'Usuario desconocido';
  return u.full_name || u.email || 'Usuario sin nombre';
};

// ============================================================================
// Pestaña "Actividad": una fila por cosa que pasó
// ============================================================================

/**
 * Une dos fuentes y deduplica por `gmail_id`:
 *
 *   1. `interactions` — todo lo registrado a mano y los correos con contacto.
 *   2. `bulk_email_queue` — los envíos masivos. Hace falta porque el sender
 *      sólo escribe en `interactions` cuando encontró el contacto: un masivo a
 *      una dirección que no está en la base no deja ninguna interacción, y sin
 *      esta segunda fuente ese correo no figuraría en ningún lado.
 *
 * Las dos escriben el mismo `gmail_id`, que es lo que permite unirlas sin
 * contar dos veces el mismo correo.
 *
 * Además corrige la atribución: en una campaña, `interactions.created_by` es
 * quien apretó "enviar", pero el correo sale de la cuenta de Gmail de
 * `campaign.sender_id`. La planilla tiene que decir quién lo mandó de verdad.
 */
export async function traerActividad({ desde, hasta, personaId = 'all', tipo = 'all' } = {}) {
  const usuarios = await traerUsuarios();
  const usuariosPorId = Object.fromEntries(usuarios.map(u => [u.id, u]));

  // --- 1. Interacciones -----------------------------------------------------
  const interRes = await traerTodo((offset, tanda) => {
    let q = supabase
      .from('interactions')
      .select('id, type, direction, subject, occurred_at, created_by, gmail_id, contact_id')
      .order('occurred_at', { ascending: false })
      .range(offset, offset + tanda - 1);

    if (desde) q = q.gte('occurred_at', desde.toISOString());
    if (hasta) q = q.lte('occurred_at', hasta.toISOString());
    if (tipo !== 'all') q = q.eq('type', tipo);
    return q;
  });

  // --- 2. Envíos masivos ----------------------------------------------------
  // Sólo si el filtro de tipo los incluye: son todos correos enviados.
  let colaFilas = [];
  let colaTruncada = false;

  if (tipo === 'all' || tipo === 'email_sent') {
    const colaRes = await traerTodo((offset, tanda) => {
      let q = supabase
        .from('bulk_email_queue')
        .select('id, gmail_id, to_email, to_name, subject, sent_at, contact_id, campaign_id')
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .range(offset, offset + tanda - 1);

      if (desde) q = q.gte('sent_at', desde.toISOString());
      if (hasta) q = q.lte('sent_at', hasta.toISOString());
      return q;
    });
    colaFilas = colaRes.filas;
    colaTruncada = colaRes.truncado;
  }

  // --- 2b. Los contactos de esas filas --------------------------------------
  // Se resuelven en una consulta aparte en vez de con un embed sobre
  // `interactions`: así la pantalla no depende de que exista la foreign key,
  // y es el mismo patrón que ya se usa para los usuarios.
  const contactoIds = [...new Set([
    ...interRes.filas.map(f => f.contact_id),
    ...colaFilas.map(f => f.contact_id),
  ].filter(Boolean))];

  const contactosPorId = {};
  for (let i = 0; i < contactoIds.length; i += 200) {
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, institution:institutions(name)')
      .in('id', contactoIds.slice(i, i + 200));
    for (const c of data || []) contactosPorId[c.id] = c;
  }

  // --- 3. Campañas de esas filas -------------------------------------------
  const campaniaIds = [...new Set(colaFilas.map(f => f.campaign_id).filter(Boolean))];
  let campaniasPorId = {};

  if (campaniaIds.length > 0) {
    const { data: camps } = await supabase
      .from('bulk_email_campaigns')
      .select('id, name, sender_id, created_by')
      .in('id', campaniaIds);
    campaniasPorId = Object.fromEntries((camps || []).map(c => [c.id, c]));
  }

  // --- 4. Unir y deduplicar -------------------------------------------------
  const colaPorGmailId = {};
  for (const f of colaFilas) {
    if (f.gmail_id) colaPorGmailId[f.gmail_id] = f;
  }

  const gmailIdsUsados = new Set();
  const filas = [];

  for (const it of interRes.filas) {
    if (it.gmail_id) gmailIdsUsados.add(it.gmail_id);

    const deCampania = it.gmail_id ? colaPorGmailId[it.gmail_id] : null;
    const campania = deCampania ? campaniasPorId[deCampania.campaign_id] : null;
    const contacto = it.contact_id ? contactosPorId[it.contact_id] : null;

    // Si vino de una campaña, el remitente real manda sobre created_by.
    const quienId = campania?.sender_id || it.created_by;

    filas.push({
      id: `i-${it.id}`,
      fecha: it.occurred_at,
      quienId,
      quien: nombreDeUsuario(usuariosPorId, quienId),
      tipo: it.type,
      tipoLabel: INTERACTION_TYPES[it.type]?.label || it.type,
      direccion: it.direction === 'inbound' ? 'Entrante' : 'Saliente',
      contactoId: it.contact_id || null,
      contacto: nombreDeContacto(contacto),
      email: contacto?.email || deCampania?.to_email || '',
      institucion: contacto?.institution?.name || '',
      asunto: it.subject || '',
      campania: campania?.name || '',
    });
  }

  // Los masivos que no dejaron interacción: destinatarios que no son contactos.
  for (const f of colaFilas) {
    if (f.gmail_id && gmailIdsUsados.has(f.gmail_id)) continue;

    const campania = campaniasPorId[f.campaign_id];
    const quienId = campania?.sender_id || campania?.created_by || null;

    filas.push({
      id: `q-${f.id}`,
      fecha: f.sent_at,
      quienId,
      quien: nombreDeUsuario(usuariosPorId, quienId),
      tipo: 'email_sent',
      tipoLabel: INTERACTION_TYPES.email_sent.label,
      direccion: 'Saliente',
      contactoId: f.contact_id || null,
      contacto: nombreDeContacto(contactosPorId[f.contact_id]) || f.to_name || '',
      email: f.to_email || '',
      institucion: contactosPorId[f.contact_id]?.institution?.name || '',
      asunto: f.subject || '',
      campania: campania?.name || '',
    });
  }

  // --- 5. Filtro por persona ------------------------------------------------
  // Va acá y no en la consulta a propósito: recién después de corregir la
  // atribución de las campañas se sabe de quién es cada fila.
  const filtradas = personaId === 'all'
    ? filas
    : filas.filter(f => (personaId === 'none' ? !f.quienId : f.quienId === personaId));

  filtradas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  return {
    filas: filtradas,
    truncado: interRes.truncado || colaTruncada,
    usuarios,
  };
}

// ============================================================================
// Pestaña "Seguimientos": una fila por contacto, con su situación actual
// ============================================================================

export const FILTROS_SEGUIMIENTO = [
  { value: 'all', label: 'Todos' },
  { value: 'overdue', label: 'Vencidos' },
  { value: 'week', label: 'Esta semana' },
  { value: 'scheduled', label: 'Agendados' },
  { value: 'none', label: 'Sin fecha' },
];

const aplicarFiltrosDeSeguimiento = (query, { personaId, etapa, seguimiento }) => {
  let q = query;

  if (personaId === 'none') q = q.is('assigned_to', null);
  else if (personaId && personaId !== 'all') q = q.eq('assigned_to', personaId);

  if (etapa && etapa !== 'all') q = q.eq('stage', etapa);

  const ahora = new Date();
  if (seguimiento === 'overdue') {
    q = q.lte('next_followup_at', ahora.toISOString());
  } else if (seguimiento === 'week') {
    const enUnaSemana = new Date(ahora);
    enUnaSemana.setDate(enUnaSemana.getDate() + 7);
    q = q.gte('next_followup_at', ahora.toISOString()).lte('next_followup_at', enUnaSemana.toISOString());
  } else if (seguimiento === 'scheduled') {
    q = q.not('next_followup_at', 'is', null);
  } else if (seguimiento === 'none') {
    q = q.is('next_followup_at', null);
  }

  return q;
};

const COLUMNAS_CONTACTO = `
  id, first_name, last_name, email, phone, job_title, specialty, society, is_kol,
  stage, priority, assigned_to, next_followup_at, last_interaction_at,
  interaction_count, stage_changed_at, created_at,
  institution:institutions (name, city)
`;

const armarFilaDeSeguimiento = (c, usuariosPorId) => {
  const proximo = c.next_followup_at ? new Date(c.next_followup_at) : null;
  const diasDeAtraso = proximo && proximo < new Date()
    ? Math.floor((Date.now() - proximo.getTime()) / 86400000)
    : null;

  return {
    id: c.id,
    contacto: nombreDeContacto(c),
    email: c.email || '',
    telefono: c.phone || '',
    cargo: c.job_title || '',
    institucion: c.institution?.name || '',
    ciudad: c.institution?.city || '',
    especialidad: c.specialty || '',
    sociedad: c.society || '',
    esKol: c.is_kol ? 'Sí' : 'No',
    etapa: c.stage || 'new',
    prioridad: c.priority || 'media',
    responsableId: c.assigned_to || null,
    responsable: c.assigned_to ? nombreDeUsuario(usuariosPorId, c.assigned_to) : 'Sin asignar',
    ultimoContacto: c.last_interaction_at,
    proximoSeguimiento: c.next_followup_at,
    diasDeAtraso,
    interacciones: c.interaction_count || 0,
  };
};

/**
 * Una página de la pestaña Seguimientos. Server-side: acá sí se puede filtrar
 * todo en la consulta, así que no hace falta bajar la tabla entera.
 */
export async function traerSeguimientos({
  personaId = 'all', etapa = 'all', seguimiento = 'all',
  pagina = 0, porPagina = 50, usuarios = null,
} = {}) {
  const lista = usuarios?.length ? usuarios : await traerUsuarios();
  const usuariosPorId = Object.fromEntries(lista.map(u => [u.id, u]));

  const desde = pagina * porPagina;
  const query = aplicarFiltrosDeSeguimiento(
    supabase.from('contacts').select(COLUMNAS_CONTACTO, { count: 'exact' }),
    { personaId, etapa, seguimiento }
  )
    // Los vencidos hace más tiempo primero; los que no tienen fecha, al final.
    .order('next_followup_at', { ascending: true, nullsFirst: false })
    .range(desde, desde + porPagina - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    filas: (data || []).map(c => armarFilaDeSeguimiento(c, usuariosPorId)),
    total: count || 0,
    usuarios: lista,
  };
}

/** Lo mismo pero completo, para la exportación. */
export async function traerSeguimientosCompleto({ personaId = 'all', etapa = 'all', seguimiento = 'all', usuarios = null } = {}) {
  const lista = usuarios?.length ? usuarios : await traerUsuarios();
  const usuariosPorId = Object.fromEntries(lista.map(u => [u.id, u]));

  const { filas, truncado } = await traerTodo((offset, tanda) =>
    aplicarFiltrosDeSeguimiento(
      supabase.from('contacts').select(COLUMNAS_CONTACTO),
      { personaId, etapa, seguimiento }
    )
      .order('next_followup_at', { ascending: true, nullsFirst: false })
      .range(offset, offset + tanda - 1)
  );

  return {
    filas: filas.map(c => armarFilaDeSeguimiento(c, usuariosPorId)),
    truncado,
  };
}
