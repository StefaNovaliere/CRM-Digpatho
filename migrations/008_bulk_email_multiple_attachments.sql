-- 008_bulk_email_multiple_attachments.sql
-- Permite adjuntar MÁS DE UN archivo a una campaña de envío masivo.
--
-- Antes: un solo adjunto en columnas attachment_name / attachment_base64 / etc.
-- Después: columna JSONB `attachments` con un array de
--   [{ name, content_type, size, base64 }, ...].
--
-- Las columnas viejas (attachment_*) se mantienen por retrocompatibilidad:
-- el sender lee `attachments` si existe, y si no, cae al adjunto único legacy.
-- Ejecutar en Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor).

DO $$ BEGIN
  ALTER TABLE bulk_email_campaigns ADD COLUMN attachments jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
