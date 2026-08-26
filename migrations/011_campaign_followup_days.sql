-- ============================================================================
-- 011_campaign_followup_days.sql
-- ============================================================================
-- Días de seguimiento configurables por campaña de envío masivo.
--
-- Al terminar cada envío, el contacto queda con `next_followup_at` a N días,
-- así aparece solo en "Mi día" del remitente. N se define por campaña porque
-- no todas tienen el mismo ritmo: una invitación a un congreso que es en dos
-- semanas no se sigue igual que una propuesta comercial.
--
-- Ejecutar en Supabase SQL Editor. Es idempotente.
--
-- NULL o 0 significan "no fijar fecha de seguimiento".
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE bulk_email_campaigns ADD COLUMN followup_days integer DEFAULT 7;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Las campañas que ya existen quedan en 7 para que el comportamiento sea
-- consistente si se reintenta alguna vieja.
UPDATE bulk_email_campaigns SET followup_days = 7 WHERE followup_days IS NULL;


-- ============================================================
-- Verificación
-- ============================================================

SELECT id, name, status, followup_days
FROM bulk_email_campaigns
ORDER BY created_at DESC
LIMIT 10;
