-- ============================================================
-- Growth System — Add DELETE policy for growth_leads
-- ============================================================
-- Allows authenticated users to delete leads from the UI.
-- Run this if leads can't be deleted (RLS policy missing).
-- ============================================================

CREATE POLICY "Authenticated users can delete growth_leads"
    ON growth_leads FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete growth_email_drafts"
    ON growth_email_drafts FOR DELETE TO authenticated USING (true);
