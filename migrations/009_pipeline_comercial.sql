-- ============================================================================
-- 009_pipeline_comercial.sql
-- ============================================================================
-- Modelo de datos para las rutinas comerciales (etapa, prioridad, cartera,
-- próximo seguimiento) + arreglo de last_interaction_at.
--
-- Ejecutar en Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor).
-- Es idempotente: se puede correr más de una vez sin romper nada.
--
-- QUÉ HACE
--   1. Consulta de control sobre user_profiles.role (no modifica nada)
--   2. Columnas nuevas en contacts (TEXT + CHECK, no enums)
--   3. Columnas nuevas en user_profiles (team, crm_role)
--   4. Tabla contact_stage_changes (historial de etapas)
--   5. Trigger + backfill de last_interaction_at / interaction_count
--   6. Migración de interest_level → stage + priority
--   7. Verificación final
--
-- QUÉ NO HACE
--   - NO borra ni modifica interest_level: queda intacta, sin uso, por si hay
--     que volver atrás.
--   - NO agrega owner_id: contacts.assigned_to ya existe y estaba sin usar.
--   - NO agrega team a contacts: el equipo vive en la persona (user_profiles),
--     así un cambio de equipo es editar una fila y no reasignar cientos.
-- ============================================================================


-- ============================================================
-- 1. CONTROL: ¿qué tiene hoy user_profiles.role?
-- ============================================================
-- Existe como varchar pero el código no la lee en ningún lado. Miralo antes de
-- seguir: si está toda en NULL, más adelante se puede consolidar crm_role
-- dentro de role. Mientras tanto agregamos crm_role aparte, que es lo seguro.

SELECT COALESCE(role, '(null)') AS role_actual, count(*) AS usuarios
FROM user_profiles
GROUP BY role
ORDER BY usuarios DESC;


-- ============================================================
-- 2. CONTACTS — columnas del pipeline
-- ============================================================
-- Todas TEXT + CHECK y no enums: interest_level y contact_role son enums de
-- Postgres, y ampliarlos requiere ALTER TYPE mientras que reducirlos es casi
-- imposible. Con TEXT + CHECK se cambia el constraint y listo.

DO $$ BEGIN
  ALTER TABLE contacts ADD COLUMN stage text NOT NULL DEFAULT 'new';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE contacts ADD COLUMN priority text NOT NULL DEFAULT 'media';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE contacts ADD COLUMN next_followup_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE contacts ADD COLUMN stage_changed_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Especialidad médica. NO se reutiliza `department` (que existe sin uso):
-- un patólogo puede estar en el departamento de Laboratorio — no son lo mismo.
DO $$ BEGIN
  ALTER TABLE contacts ADD COLUMN specialty text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE contacts ADD COLUMN society text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE contacts ADD COLUMN is_kol boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;


-- Constraints de valores permitidos
DO $$ BEGIN
  ALTER TABLE contacts ADD CONSTRAINT contacts_stage_check
    CHECK (stage IN ('new', 'contacted', 'qualified', 'customer', 'lost'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE contacts ADD CONSTRAINT contacts_priority_check
    CHECK (priority IN ('muy_alta', 'alta', 'media', 'baja'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- Índices: los dos accesos de "Mi día"
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_followup
  ON contacts (assigned_to, next_followup_at);

CREATE INDEX IF NOT EXISTS idx_contacts_stage_followup
  ON contacts (stage, next_followup_at);

-- Parcial: la cola de vencidos sólo mira filas con fecha puesta
CREATE INDEX IF NOT EXISTS idx_contacts_followup_pendientes
  ON contacts (next_followup_at)
  WHERE next_followup_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_specialty
  ON contacts (specialty) WHERE specialty IS NOT NULL;


-- ============================================================
-- 3. USER_PROFILES — equipo y rol comercial
-- ============================================================
-- `team` es texto libre a propósito: los equipos se crean escribiendo un
-- nombre desde Settings, no eligiendo de una lista fija. El equipo de ventas
-- rota, y así cambiar a alguien de equipo es editar una sola fila.

DO $$ BEGIN
  ALTER TABLE user_profiles ADD COLUMN team text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Se agrega aparte de `role` (que ya existe y no sabemos qué contiene, ver
-- la consulta 1) para no pisar nada. Si `role` resulta estar vacía, se puede
-- consolidar en una migración posterior.
DO $$ BEGIN
  ALTER TABLE user_profiles ADD COLUMN crm_role text;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_crm_role_check
    CHECK (crm_role IS NULL OR crm_role IN ('vendedor', 'telefonista', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_user_profiles_team
  ON user_profiles (team) WHERE team IS NOT NULL;


-- ============================================================
-- 4. CONTACT_STAGE_CHANGES — historial de etapas
-- ============================================================
-- Única fuente para "conversión por etapa" y "estancados N días" del cierre
-- mensual. Arranca vacía: esas métricas recién tienen sentido después de un
-- mes de uso.

CREATE TABLE IF NOT EXISTS contact_stage_changes (
    id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    from_stage TEXT,
    to_stage   TEXT NOT NULL,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    note       TEXT
);

CREATE INDEX IF NOT EXISTS idx_stage_changes_contact
  ON contact_stage_changes (contact_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_stage_changes_fecha
  ON contact_stage_changes (changed_at DESC);

ALTER TABLE contact_stage_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team can view stage changes" ON contact_stage_changes;
CREATE POLICY "Team can view stage changes"
  ON contact_stage_changes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Team can insert stage changes" ON contact_stage_changes;
CREATE POLICY "Team can insert stage changes"
  ON contact_stage_changes FOR INSERT TO authenticated WITH CHECK (true);


-- ============================================================
-- 5. LAST_INTERACTION_AT — trigger + backfill
-- ============================================================
-- El código LEE contacts.last_interaction_at e interaction_count en 4 lugares
-- pero NO los escribe en ninguno, y no existía trigger: el diagnóstico mostró
-- 0 de 619 contactos con el campo poblado, pese a 536 interacciones reales.
-- Consecuencia: el panel de "Seguimientos pendientes" del Dashboard viene
-- mostrando los 619 contactos como vencidos desde siempre.
--
-- Se RECALCULA desde interactions en vez de incrementar un contador, así no se
-- desincroniza cuando se borra una interacción (useInteractions lo permite).

CREATE OR REPLACE FUNCTION fn_recalc_contact_interactions(p_contact uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_contact IS NULL THEN
    RETURN;
  END IF;

  UPDATE contacts c
  SET last_interaction_at = s.max_at,
      interaction_count   = COALESCE(s.cnt, 0)
  FROM (
    SELECT max(occurred_at) AS max_at,
           count(*)         AS cnt
    FROM interactions
    WHERE contact_id = p_contact
  ) s
  WHERE c.id = p_contact;
END;
$$;


CREATE OR REPLACE FUNCTION fn_interactions_touch_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM fn_recalc_contact_interactions(OLD.contact_id);
    RETURN OLD;
  END IF;

  PERFORM fn_recalc_contact_interactions(NEW.contact_id);

  -- Si en un UPDATE la interacción cambió de contacto, hay que recalcular
  -- también el contacto anterior.
  IF TG_OP = 'UPDATE' AND OLD.contact_id IS DISTINCT FROM NEW.contact_id THEN
    PERFORM fn_recalc_contact_interactions(OLD.contact_id);
  END IF;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS tr_interactions_touch_contact ON interactions;
CREATE TRIGGER tr_interactions_touch_contact
  AFTER INSERT OR UPDATE OR DELETE ON interactions
  FOR EACH ROW
  EXECUTE FUNCTION fn_interactions_touch_contact();


-- Backfill: poblar los ~448 contactos que ya tienen interacciones.
UPDATE contacts c
SET last_interaction_at = s.max_at,
    interaction_count   = s.cnt
FROM (
  SELECT contact_id,
         max(occurred_at) AS max_at,
         count(*)         AS cnt
  FROM interactions
  GROUP BY contact_id
) s
WHERE c.id = s.contact_id
  AND (c.last_interaction_at IS DISTINCT FROM s.max_at
    OR c.interaction_count   IS DISTINCT FROM s.cnt);

-- Los que no tienen ninguna interacción: contador en 0, no NULL.
UPDATE contacts c
SET interaction_count = 0
WHERE c.interaction_count IS NULL
  AND NOT EXISTS (SELECT 1 FROM interactions i WHERE i.contact_id = c.id);


-- ============================================================
-- 6. MIGRACIÓN interest_level → stage + priority
-- ============================================================
-- interest_level QUEDA INTACTA. Sólo se lee para derivar los campos nuevos.
--
-- Para la ETAPA no se usa la temperatura (sería adivinar: "caliente" no
-- significa que lo hayamos contactado), sino la ACTIVIDAD REAL registrada en
-- interactions. Para la PRIORIDAD sí se aprovecha, que es lo que la
-- temperatura efectivamente medía.
--
-- Idempotente: sólo toca filas con stage_changed_at IS NULL, o sea las que
-- nunca pasaron por esta migración.

UPDATE contacts c
SET stage = CASE
      WHEN c.interest_level = 'customer' THEN 'customer'
      WHEN c.interest_level = 'churned'  THEN 'lost'
      WHEN EXISTS (SELECT 1 FROM interactions i WHERE i.contact_id = c.id)
                                         THEN 'contacted'
      ELSE 'new'
    END,
    priority = CASE
      WHEN c.interest_level = 'customer' THEN 'alta'
      WHEN c.interest_level = 'churned'  THEN 'baja'
      WHEN c.interest_level = 'hot'      THEN 'alta'
      ELSE 'media'
    END,
    stage_changed_at = NOW()
WHERE c.stage_changed_at IS NULL;


-- ============================================================
-- 7. VERIFICACIÓN
-- ============================================================
-- Correr después y revisar los números.

-- Distribución nueva. Esperado: ~448 'contacted', ~171 'new'.
SELECT 'stage' AS campo, stage AS valor, count(*) AS cantidad
FROM contacts GROUP BY stage
UNION ALL
SELECT 'priority', priority, count(*)
FROM contacts GROUP BY priority
ORDER BY campo, cantidad DESC;

-- El backfill: last_interaction_at debe quedar poblado en ~448 contactos
-- (antes eran 0 de 619).
SELECT count(*)                                              AS total,
       count(*) FILTER (WHERE last_interaction_at IS NOT NULL) AS con_fecha,
       count(*) FILTER (WHERE interaction_count > 0)           AS con_contador,
       max(last_interaction_at)                                AS mas_reciente
FROM contacts;

-- Control de que interest_level sigue intacta.
SELECT COALESCE(interest_level::text, '(null)') AS interest_level, count(*)
FROM contacts GROUP BY interest_level ORDER BY count DESC;
