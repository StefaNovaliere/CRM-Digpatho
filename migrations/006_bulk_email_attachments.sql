-- Migración: Agregar soporte de adjuntos y sender a campañas de email masivo
-- Ejecutar en Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- Agregar columna sender_id si no existe
DO $$ BEGIN
  ALTER TABLE bulk_email_campaigns ADD COLUMN sender_id uuid REFERENCES auth.users(id);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columnas de metadatos del adjunto
DO $$ BEGIN
  ALTER TABLE bulk_email_campaigns ADD COLUMN attachment_name text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE bulk_email_campaigns ADD COLUMN attachment_content_type text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE bulk_email_campaigns ADD COLUMN attachment_size integer;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Columna para guardar el adjunto en base64 (evita depender de Supabase Storage)
DO $$ BEGIN
  ALTER TABLE bulk_email_campaigns ADD COLUMN attachment_base64 text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Agregar columnas opcionales a bulk_email_queue
DO $$ BEGIN
  ALTER TABLE bulk_email_queue ADD COLUMN contact_id uuid;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE bulk_email_queue ADD COLUMN to_name text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE bulk_email_queue ADD COLUMN cc_emails text[];
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
