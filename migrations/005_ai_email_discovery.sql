-- 005_ai_email_discovery.sql
-- Adds email discovery metadata columns to growth_leads.
-- Tracks how each email was found (AI web search, Google snippet, manual)
-- and the source URL / confidence level for AI-discovered emails.
--
-- IMPORTANT: Run ONLY this file. Do NOT re-run migrations 001-004.

-- Add columns (IF NOT EXISTS = safe to re-run)
ALTER TABLE growth_leads
  ADD COLUMN IF NOT EXISTS email_discovery_method TEXT;

ALTER TABLE growth_leads
  ADD COLUMN IF NOT EXISTS email_source_url TEXT;

ALTER TABLE growth_leads
  ADD COLUMN IF NOT EXISTS email_confidence TEXT;
