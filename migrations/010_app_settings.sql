-- ============================================================================
-- 010_app_settings.sql
-- ============================================================================
-- Configuración de la app que hoy vive hardcodeada en el código o, peor, en
-- estados de React que no persisten en ningún lado (src/pages/Settings.jsx
-- tenía un handleSave que era literalmente un setTimeout).
--
-- Ejecutar en Supabase SQL Editor. Es idempotente.
--
-- POR QUÉ CLAVE-VALOR Y NO COLUMNAS
-- Las opciones son pocas, heterogéneas y van a cambiar (metas por rol, días de
-- seguimiento, y lo que venga). Una tabla con una columna por opción obligaría
-- a una migración por cada ajuste. Con jsonb, agregar una opción es un INSERT.
--
-- QUÉ NO VA ACÁ
-- Secretos. Las API keys y webhooks siguen en variables de entorno de Vercel:
-- la anon key viaja en el bundle del navegador, así que cualquier cosa en esta
-- tabla es legible por cualquier usuario autenticado.
-- ============================================================================


CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Convención del repo: todo compartido entre usuarios autenticados.
-- Idealmente sólo un admin escribiría, pero el proyecto todavía no tiene
-- modelo de permisos — ver el riesgo de RLS en el plan.
DROP POLICY IF EXISTS "Team can read app settings" ON app_settings;
CREATE POLICY "Team can read app settings"
  ON app_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Team can write app settings" ON app_settings;
CREATE POLICY "Team can write app settings"
  ON app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ============================================================
-- Valores por defecto
-- ============================================================
-- Los de daily_goals salen del Manual de Rutinas Comerciales. Estaban fijos en
-- constants.js (DEFAULT_DAILY_GOALS); desde acá se pueden ajustar sin deploy.
--
-- ON CONFLICT DO NOTHING para no pisar lo que el equipo ya haya configurado
-- si esta migración se corre dos veces.

INSERT INTO app_settings (key, value) VALUES
  ('daily_goals', '{
     "telefonista": {
       "contactos_trabajados": 28,
       "primeros_contactos": 9,
       "traspasos": 4
     },
     "vendedor": {
       "seguimientos": 12,
       "reuniones": 3
     }
   }'::jsonb),

  -- Días sin interacción para considerar un contacto "pendiente de
  -- seguimiento". Estaba hardcodeado en Dashboard.jsx:354, duplicando
  -- APP_CONFIG.followUpDays de constants.js, que no lo importaba nadie.
  ('followup_days', '14'::jsonb),

  -- Días en la misma etapa para considerarlo estancado (reporte mensual).
  ('stalled_days', '30'::jsonb)
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- Verificación
-- ============================================================

SELECT key, value, updated_at FROM app_settings ORDER BY key;

-- Estado del equipo: quién tiene rol y equipo asignados. Al correr esto por
-- primera vez van a estar todos en NULL — se configuran desde la pantalla de
-- Configuración del CRM.
SELECT COALESCE(crm_role, '(sin rol)') AS rol,
       COALESCE(team, '(sin equipo)')  AS equipo,
       count(*)                         AS usuarios
FROM user_profiles
GROUP BY crm_role, team
ORDER BY usuarios DESC;
