-- 005_ai_email_discovery.sql
-- Adds email discovery metadata columns to growth_leads.
-- Tracks how each email was found (AI web search, Google snippet, manual)
-- and the source URL / confidence level for AI-discovered emails.

ALTER TABLE growth_leads
  ADD COLUMN IF NOT EXISTS email_discovery_method TEXT
  CHECK (email_discovery_method IN ('manual', 'ai_web_search', 'google_snippet'));

ALTER TABLE growth_leads
  ADD COLUMN IF NOT EXISTS email_source_url TEXT;

ALTER TABLE growth_leads
  ADD COLUMN IF NOT EXISTS email_confidence TEXT
  CHECK (email_confidence IN ('high', 'medium', 'low'));
