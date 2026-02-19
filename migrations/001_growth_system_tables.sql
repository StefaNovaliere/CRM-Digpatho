-- ============================================================
-- Digpatho AI Growth System — Database Migration
-- ============================================================
-- Run this in Supabase SQL Editor before using ai_growth_system.py
--
-- Creates two new tables:
--   growth_leads        — Raw prospects from Google Dorking
--   growth_email_drafts — Email drafts for human review
--
-- These tables are SEPARATE from the existing contacts/email_drafts
-- tables to avoid polluting the qualified CRM pipeline with
-- unvalidated prospect data.
-- ============================================================

-- =========================
-- Table: growth_leads
-- =========================
-- Stores raw LinkedIn prospects discovered via Google Dorking.
-- Each lead is tagged with a GTM vertical (DIRECT_B2B, PHARMA,
-- INFLUENCER, EVENTS) from the Bull's-eye framework.

CREATE TABLE IF NOT EXISTS growth_leads (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name       TEXT,
    first_name      TEXT,
    last_name       TEXT,
    job_title       TEXT,
    company         TEXT,
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

-- Dedup index on LinkedIn URL
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_leads_linkedin_url
    ON growth_leads(linkedin_url);

-- Filter by vertical
CREATE INDEX IF NOT EXISTS idx_growth_leads_vertical
    ON growth_leads(vertical);

-- Filter by status (for finding new leads without drafts)
CREATE INDEX IF NOT EXISTS idx_growth_leads_status
    ON growth_leads(status);


-- =========================
-- Table: growth_email_drafts
-- =========================
-- Stores email drafts generated for growth leads.
-- Status starts as 'draft_pending_review' — NEVER sent automatically.
-- Human reviewer must approve before any email is sent.

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

-- Find unreviewed drafts
CREATE INDEX IF NOT EXISTS idx_growth_drafts_status
    ON growth_email_drafts(status);

-- Find drafts by lead
CREATE INDEX IF NOT EXISTS idx_growth_drafts_lead_id
    ON growth_email_drafts(lead_id);

-- Find drafts by vertical
CREATE INDEX IF NOT EXISTS idx_growth_drafts_vertical
    ON growth_email_drafts(vertical);


-- =========================
-- Row Level Security (RLS)
-- =========================
-- Enable RLS for multi-tenant safety.
-- The Python backend should use the Supabase SERVICE_ROLE key
-- which automatically bypasses RLS.

ALTER TABLE growth_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_email_drafts ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all growth data
CREATE POLICY "Authenticated users can read growth_leads"
    ON growth_leads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert growth_leads"
    ON growth_leads FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update growth_leads"
    ON growth_leads FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read growth_email_drafts"
    ON growth_email_drafts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert growth_email_drafts"
    ON growth_email_drafts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update growth_email_drafts"
    ON growth_email_drafts FOR UPDATE TO authenticated USING (true);
