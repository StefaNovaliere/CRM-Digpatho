-- ============================================================================
-- 012_attachments_bucket.sql
-- ============================================================================
-- Bucket de Storage para los adjuntos de las campañas de envío masivo.
--
-- POR QUÉ:
-- Hasta ahora los adjuntos se guardaban en base64 DENTRO de la fila de la
-- campaña (columnas attachment_base64 / attachments). Con 3 archivos de varios
-- MB el INSERT supera el statement_timeout de Postgres y la creación de la
-- campaña falla con:
--   57014 - canceling statement due to statement timeout
--
-- A partir de esta migración los archivos van a Storage y la fila guarda sólo
-- las rutas: { name, content_type, size, path }. La fila pasa de megabytes a
-- bytes.
--
-- Las campañas viejas siguen funcionando: el sender lee base64 si está, y
-- descarga de Storage si en su lugar hay un `path`. No hay que migrar nada.
--
-- Ejecutar en Supabase SQL Editor (https://supabase.com/dashboard -> SQL Editor).
-- Es idempotente.
-- ============================================================================


-- ============================================================
-- 1. El bucket
-- ============================================================
-- Privado: los adjuntos son material comercial, no deben quedar accesibles por
-- URL pública. El acceso va siempre por la anon key con sesión iniciada.
--
-- file_size_limit: 25 MB, el mismo tope que aplica la UI (límite de Gmail).

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('attachments', 'attachments', false, 26214400)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 26214400;


-- ============================================================
-- 2. Políticas de acceso
-- ============================================================
-- storage.objects SIEMPRE tiene RLS activo (a diferencia de `contacts`), así
-- que sin estas políticas la subida falla con "new row violates row-level
-- security policy".
--
-- Cualquier usuario autenticado del CRM puede subir, leer y borrar adjuntos:
-- es el mismo alcance que ya tienen sobre las campañas.

DROP POLICY IF EXISTS "attachments_insert_authenticated" ON storage.objects;
CREATE POLICY "attachments_insert_authenticated"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS "attachments_select_authenticated" ON storage.objects;
CREATE POLICY "attachments_select_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'attachments');

DROP POLICY IF EXISTS "attachments_update_authenticated" ON storage.objects;
CREATE POLICY "attachments_update_authenticated"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'attachments')
  WITH CHECK (bucket_id = 'attachments');

DROP POLICY IF EXISTS "attachments_delete_authenticated" ON storage.objects;
CREATE POLICY "attachments_delete_authenticated"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'attachments');


-- ============================================================
-- 3. Columnas de resumen
-- ============================================================
-- `attachment_path` se lee en BulkEmailSender.jsx pero nunca se creó.
-- Se agrega para que el camino de retrocompatibilidad no rompa.

DO $$ BEGIN
  ALTER TABLE bulk_email_campaigns ADD COLUMN attachment_path text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- `attachment_count` existe para que la LISTA de campañas pueda mostrar
-- "3 adjuntos" sin tener que traerse la columna `attachments` entera --que en
-- las campañas viejas trae el base64 completo-- en cada carga de la pantalla.

DO $$ BEGIN
  ALTER TABLE bulk_email_campaigns ADD COLUMN attachment_count integer;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Backfill para las campañas que ya existen. jsonb_array_length no lee el
-- contenido de cada elemento, así que no trae los blobs.
UPDATE bulk_email_campaigns
SET attachment_count = jsonb_array_length(attachments)
WHERE attachment_count IS NULL
  AND attachments IS NOT NULL
  AND jsonb_typeof(attachments) = 'array';

UPDATE bulk_email_campaigns
SET attachment_count = 1
WHERE attachment_count IS NULL
  AND attachment_name IS NOT NULL;


-- ============================================================
-- Verificación
-- ============================================================

-- El bucket existe y es privado
SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id = 'attachments';

-- Las 4 políticas quedaron creadas
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE 'attachments_%'
ORDER BY policyname;

-- Cuánto pesan hoy los adjuntos guardados en la fila (deberían dejar de crecer)
SELECT id, name, created_at,
       length(attachment_base64) AS legacy_base64_chars,
       length(attachments::text) AS attachments_json_chars
FROM bulk_email_campaigns
ORDER BY created_at DESC
LIMIT 10;
