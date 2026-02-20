-- ============================================================
-- Growth System — Custom Search Queries
-- ============================================================
-- Allows adding custom search queries per vertical from the UI.
-- These are combined with the hardcoded queries in the pipeline.
-- ============================================================

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

-- RLS
ALTER TABLE growth_search_queries ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to make this script safe to re-run
DROP POLICY IF EXISTS "Authenticated users can read growth_search_queries" ON growth_search_queries;
DROP POLICY IF EXISTS "Authenticated users can insert growth_search_queries" ON growth_search_queries;
DROP POLICY IF EXISTS "Authenticated users can update growth_search_queries" ON growth_search_queries;
DROP POLICY IF EXISTS "Authenticated users can delete growth_search_queries" ON growth_search_queries;

CREATE POLICY "Authenticated users can read growth_search_queries"
    ON growth_search_queries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert growth_search_queries"
    ON growth_search_queries FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update growth_search_queries"
    ON growth_search_queries FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete growth_search_queries"
    ON growth_search_queries FOR DELETE TO authenticated USING (true);
