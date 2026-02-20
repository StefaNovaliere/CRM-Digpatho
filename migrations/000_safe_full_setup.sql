-- ============================================================
-- Digpatho AI Growth System — SAFE Full Setup (Idempotent)
-- ============================================================
-- This script is SAFE to run multiple times. It will:
--   1. Create tables if they don't exist
--   2. Drop and re-create all RLS policies (no duplicates)
--   3. Add columns from migrations 002-005 if missing
--
-- Run this ONCE in Supabase SQL Editor to set up everything.
-- ============================================================

-- =========================
-- Table: growth_leads
-- =========================
CREATE TABLE IF NOT EXISTS growth_leads (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name       TEXT,
    first_name      TEXT,
    last_name       TEXT,
    job_title       TEXT,
    company         TEXT,
    email           TEXT,
    linkedin_url    TEXT UNIQUE NOT NULL,
    vertical        TEXT NOT NULL
                        CHECK (vertical IN ('DIRECT_B2B', 'PHARMA', 'INFLUENCER', 'EVENTS')),
    source_query    TEXT,
    geo             TEXT,
    status          TEXT DEFAULT 'new'
                        CHECK (status IN ('new', 'draft_generated', 'promoted', 'ignored')),
    extra_data      JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_leads_linkedin_url
    ON growth_leads(linkedin_url);
CREATE INDEX IF NOT EXISTS idx_growth_leads_vertical
    ON growth_leads(vertical);
CREATE INDEX IF NOT EXISTS idx_growth_leads_status
    ON growth_leads(status);
CREATE INDEX IF NOT EXISTS idx_growth_leads_email
    ON growth_leads(email) WHERE email IS NOT NULL;

-- =========================
-- Table: growth_email_drafts
-- =========================
CREATE TABLE IF NOT EXISTS growth_email_drafts (
    id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id             UUID NOT NULL REFERENCES growth_leads(id) ON DELETE CASCADE,
    subject             TEXT NOT NULL,
    body                TEXT NOT NULL,
    vertical            TEXT NOT NULL
                            CHECK (vertical IN ('DIRECT_B2B', 'PHARMA', 'INFLUENCER', 'EVENTS')),
    language            TEXT DEFAULT 'en'
                            CHECK (language IN ('en', 'es', 'pt')),
    status              TEXT DEFAULT 'draft_pending_review'
                            CHECK (status IN ('draft_pending_review', 'approved', 'rejected', 'sent')),
    generation_context  JSONB DEFAULT '{}',
    reviewer_notes      TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_growth_drafts_status
    ON growth_email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_growth_drafts_lead_id
    ON growth_email_drafts(lead_id);
CREATE INDEX IF NOT EXISTS idx_growth_drafts_vertical
    ON growth_email_drafts(vertical);

-- =========================
-- Table: growth_search_queries
-- =========================
CREATE TABLE IF NOT EXISTS growth_search_queries (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    vertical    TEXT NOT NULL
                    CHECK (vertical IN ('DIRECT_B2B', 'PHARMA', 'INFLUENCER', 'EVENTS')),
    query       TEXT NOT NULL,
    enabled     BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_growth_search_queries_vertical
    ON growth_search_queries(vertical);

-- =========================
-- Columns from migration 005
-- =========================
ALTER TABLE growth_leads ADD COLUMN IF NOT EXISTS email_discovery_method TEXT;
ALTER TABLE growth_leads ADD COLUMN IF NOT EXISTS email_source_url TEXT;
ALTER TABLE growth_leads ADD COLUMN IF NOT EXISTS email_confidence TEXT;

-- =========================
-- Row Level Security (RLS)
-- =========================
-- Enable RLS on all tables
ALTER TABLE growth_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_email_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_search_queries ENABLE ROW LEVEL SECURITY;

-- DROP existing policies first (safe — IF EXISTS prevents errors)
-- growth_leads
DROP POLICY IF EXISTS "Authenticated users can read growth_leads" ON growth_leads;
DROP POLICY IF EXISTS "Authenticated users can insert growth_leads" ON growth_leads;
DROP POLICY IF EXISTS "Authenticated users can update growth_leads" ON growth_leads;
DROP POLICY IF EXISTS "Authenticated users can delete growth_leads" ON growth_leads;

-- growth_email_drafts
DROP POLICY IF EXISTS "Authenticated users can read growth_email_drafts" ON growth_email_drafts;
DROP POLICY IF EXISTS "Authenticated users can insert growth_email_drafts" ON growth_email_drafts;
DROP POLICY IF EXISTS "Authenticated users can update growth_email_drafts" ON growth_email_drafts;
DROP POLICY IF EXISTS "Authenticated users can delete growth_email_drafts" ON growth_email_drafts;

-- growth_search_queries
DROP POLICY IF EXISTS "Authenticated users can read growth_search_queries" ON growth_search_queries;
DROP POLICY IF EXISTS "Authenticated users can insert growth_search_queries" ON growth_search_queries;
DROP POLICY IF EXISTS "Authenticated users can update growth_search_queries" ON growth_search_queries;
DROP POLICY IF EXISTS "Authenticated users can delete growth_search_queries" ON growth_search_queries;

-- RE-CREATE all policies
-- growth_leads
CREATE POLICY "Authenticated users can read growth_leads"
    ON growth_leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert growth_leads"
    ON growth_leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update growth_leads"
    ON growth_leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete growth_leads"
    ON growth_leads FOR DELETE TO authenticated USING (true);

-- growth_email_drafts
CREATE POLICY "Authenticated users can read growth_email_drafts"
    ON growth_email_drafts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert growth_email_drafts"
    ON growth_email_drafts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update growth_email_drafts"
    ON growth_email_drafts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete growth_email_drafts"
    ON growth_email_drafts FOR DELETE TO authenticated USING (true);

-- growth_search_queries
CREATE POLICY "Authenticated users can read growth_search_queries"
    ON growth_search_queries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert growth_search_queries"
    ON growth_search_queries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update growth_search_queries"
    ON growth_search_queries FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete growth_search_queries"
    ON growth_search_queries FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Done! All tables, indexes, and RLS policies are configured.
-- ============================================================
