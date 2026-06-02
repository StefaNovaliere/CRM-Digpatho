-- 007_growth_leads_optional_linkedin.sql
-- Permite guardar leads sin LinkedIn URL (ej: contactos de la búsqueda masiva
-- por Excel que no tienen perfil de LinkedIn conocido).
--
-- Antes: linkedin_url TEXT UNIQUE NOT NULL
-- Después: linkedin_url TEXT (nullable), unique parcial WHERE NOT NULL.

-- 1. Quitar NOT NULL
ALTER TABLE growth_leads ALTER COLUMN linkedin_url DROP NOT NULL;

-- 2. Reemplazar el unique index total por uno parcial
--    (preserva deduplicación para leads que SÍ tienen LinkedIn)
DROP INDEX IF EXISTS idx_growth_leads_linkedin_url;
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_leads_linkedin_url
    ON growth_leads(linkedin_url) WHERE linkedin_url IS NOT NULL;
