-- ============================================================
-- Migration 002: Add email column to growth_leads
-- ============================================================
-- Run this in Supabase SQL Editor if you already have the
-- growth_leads table from migration 001.
--
-- This adds email discovery capability to the growth system.
-- Emails are found via Google Dorking during lead discovery
-- and stored directly on the lead record.
-- ============================================================

-- Add email column (nullable — not all leads will have emails)
ALTER TABLE growth_leads ADD COLUMN IF NOT EXISTS email TEXT;

-- Partial index for non-null emails (fast lookups)
CREATE INDEX IF NOT EXISTS idx_growth_leads_email
    ON growth_leads(email) WHERE email IS NOT NULL;
