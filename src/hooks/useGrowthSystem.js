// src/hooks/useGrowthSystem.js
// Hook para acceder a las tablas growth_leads y growth_email_drafts
// generadas por el pipeline Python ai_growth_system.py

import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useGrowthSystem = () => {
  const [leads, setLeads] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pipelineRunning, setPipelineRunning] = useState(null); // vertical key or null
  const [pipelineResult, setPipelineResult] = useState(null);
  const [stats, setStats] = useState({
    totalLeads: 0,
    newLeads: 0,
    withDrafts: 0,
    promoted: 0,
    pendingDrafts: 0,
    approvedDrafts: 0,
    byVertical: {}
  });

  // ========================================
  // LEADS
  // ========================================
  const loadLeads = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('growth_leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.vertical && filters.vertical !== 'all') {
        query = query.eq('vertical', filters.vertical);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.search) {
        query = query.or(
          `full_name.ilike.%${filters.search}%,company.ilike.%${filters.search}%,job_title.ilike.%${filters.search}%`
        );
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setLeads(data || []);
      return data || [];
    } catch (err) {
      console.error('Error loading growth leads:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      // Leads stats
      const { data: allLeads, error: leadsErr } = await supabase
        .from('growth_leads')
        .select('id, vertical, status');
      if (leadsErr) throw leadsErr;

      // Drafts stats
      const { data: allDrafts, error: draftsErr } = await supabase
        .from('growth_email_drafts')
        .select('id, vertical, status');
      if (draftsErr) throw draftsErr;

      const leads = allLeads || [];
      const drafts = allDrafts || [];

      const byVertical = {};
      leads.forEach(l => {
        if (!byVertical[l.vertical]) {
          byVertical[l.vertical] = { leads: 0, new: 0, promoted: 0 };
        }
        byVertical[l.vertical].leads++;
        if (l.status === 'new') byVertical[l.vertical].new++;
        if (l.status === 'promoted') byVertical[l.vertical].promoted++;
      });

      setStats({
        totalLeads: leads.length,
        newLeads: leads.filter(l => l.status === 'new').length,
        withDrafts: leads.filter(l => l.status === 'draft_generated').length,
        promoted: leads.filter(l => l.status === 'promoted').length,
        pendingDrafts: drafts.filter(d => d.status === 'draft_pending_review').length,
        approvedDrafts: drafts.filter(d => d.status === 'approved').length,
        byVertical
      });
    } catch (err) {
      console.error('Error loading growth stats:', err);
    }
  }, []);

  // ========================================
  // DRAFTS
  // ========================================
  const loadDrafts = useCallback(async (filters = {}) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('growth_email_drafts')
        .select('*, lead:growth_leads(*)')
        .order('created_at', { ascending: false });

      if (filters.vertical && filters.vertical !== 'all') {
        query = query.eq('vertical', filters.vertical);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setDrafts(data || []);
      return data || [];
    } catch (err) {
      console.error('Error loading growth drafts:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const updateDraftStatus = useCallback(async (draftId, status, reviewerNotes = null) => {
    try {
      const updates = {
        status,
        reviewed_at: new Date().toISOString()
      };
      if (reviewerNotes !== null) {
        updates.reviewer_notes = reviewerNotes;
      }

      const { error: updateErr } = await supabase
        .from('growth_email_drafts')
        .update(updates)
        .eq('id', draftId);

      if (updateErr) throw updateErr;

      // Update local state
      setDrafts(prev => prev.map(d =>
        d.id === draftId ? { ...d, ...updates } : d
      ));
      return true;
    } catch (err) {
      console.error('Error updating draft:', err);
      setError(err.message);
      return false;
    }
  }, []);

  // ========================================
  // LEAD ACTIONS
  // ========================================
  const updateLeadStatus = useCallback(async (leadId, status) => {
    try {
      const { error: updateErr } = await supabase
        .from('growth_leads')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (updateErr) throw updateErr;

      setLeads(prev => prev.map(l =>
        l.id === leadId ? { ...l, status } : l
      ));
      return true;
    } catch (err) {
      console.error('Error updating lead:', err);
      setError(err.message);
      return false;
    }
  }, []);

  // Promover lead a la tabla contacts del CRM
  const promoteLeadToContact = useCallback(async (lead) => {
    try {
      // Create or find institution from company name
      let institutionId = null;
      if (lead.company) {
        const { data: existingInst } = await supabase
          .from('institutions')
          .select('id')
          .ilike('name', lead.company.trim())
          .maybeSingle();

        if (existingInst) {
          institutionId = existingInst.id;
        } else {
          const { data: newInst } = await supabase
            .from('institutions')
            .insert({ name: lead.company.trim() })
            .select()
            .single();
          institutionId = newInst?.id || null;
        }
      }

      const contactData = {
        first_name: lead.first_name || lead.full_name?.split(' ')[0] || '',
        last_name: lead.last_name || lead.full_name?.split(' ').slice(1).join(' ') || '',
        email: lead.email || null,
        job_title: lead.job_title || '',
        linkedin_url: lead.linkedin_url || null,
        country: lead.geo || null,
        institution_id: institutionId,
        interest_level: 'cold',
        role: 'other',
        source: `growth_system_${lead.vertical}`,
        ai_context: [
          `Vertical: ${lead.vertical}`,
          lead.company ? `Empresa: ${lead.company}` : null,
          lead.email ? `Email: ${lead.email}` : null,
          lead.geo ? `Geo: ${lead.geo}` : null,
          `LinkedIn: ${lead.linkedin_url}`,
          `Descubierto por Growth System el ${new Date(lead.created_at).toLocaleDateString()}`
        ].filter(Boolean).join('\n'),
      };

      const { data, error: insertErr } = await supabase
        .from('contacts')
        .insert(contactData)
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Mark lead as promoted
      await updateLeadStatus(lead.id, 'promoted');
      return data;
    } catch (err) {
      console.error('Error promoting lead:', err);
      setError(err.message);
      return null;
    }
  }, [updateLeadStatus]);

  const updateLead = useCallback(async (leadId, updates) => {
    try {
      const { error: updateErr } = await supabase
        .from('growth_leads')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (updateErr) throw updateErr;

      setLeads(prev => prev.map(l =>
        l.id === leadId ? { ...l, ...updates } : l
      ));
      return true;
    } catch (err) {
      console.error('Error updating lead:', err);
      setError(err.message);
      return false;
    }
  }, []);

  const ignoreLead = useCallback(async (leadId) => {
    return updateLeadStatus(leadId, 'ignored');
  }, [updateLeadStatus]);

  // Send approved drafts to a bulk email campaign
  const sendApprovedToCampaign = useCallback(async (approvedDrafts, campaignName) => {
    try {
      // 1. Create the campaign
      const { data: campaign, error: campErr } = await supabase
        .from('bulk_email_campaigns')
        .insert({
          name: campaignName,
          status: 'ready',
          total_emails: approvedDrafts.length,
          sent_count: 0,
          failed_count: 0,
        })
        .select()
        .single();

      if (campErr) throw campErr;

      // 2. Build queue items from approved drafts
      const queueItems = [];
      for (const draft of approvedDrafts) {
        const lead = draft.lead || {};
        if (!lead.email) continue; // Skip leads without email

        // Check if contact exists, create if not
        let contactId = null;
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('email', lead.email)
          .maybeSingle();

        contactId = existingContact?.id;

        if (!contactId && lead.full_name) {
          const firstName = lead.first_name || lead.full_name?.split(' ')[0] || '';
          const lastName = lead.last_name || lead.full_name?.split(' ').slice(1).join(' ') || '';
          const { data: newContact } = await supabase
            .from('contacts')
            .insert({
              first_name: firstName,
              last_name: lastName,
              email: lead.email,
              job_title: lead.job_title || null,
              linkedin_url: lead.linkedin_url || null,
              interest_level: 'cold',
              source: `growth_system_${lead.vertical || 'unknown'}`,
            })
            .select()
            .single();
          contactId = newContact?.id;
        }

        queueItems.push({
          campaign_id: campaign.id,
          contact_id: contactId,
          to_email: lead.email,
          to_name: lead.full_name || '',
          subject: draft.subject,
          body: draft.body,
          status: 'pending',
        });
      }

      if (queueItems.length === 0) {
        // No emails to send — delete empty campaign
        await supabase.from('bulk_email_campaigns').delete().eq('id', campaign.id);
        return { error: 'Ningún borrador aprobado tiene un lead con email. Agregá emails a los leads primero.' };
      }

      // 3. Insert queue items
      const { error: queueErr } = await supabase
        .from('bulk_email_queue')
        .insert(queueItems);

      if (queueErr) throw queueErr;

      // 4. Update campaign total
      await supabase
        .from('bulk_email_campaigns')
        .update({ total_emails: queueItems.length })
        .eq('id', campaign.id);

      // 5. Mark drafts as 'sent' status
      for (const draft of approvedDrafts) {
        if (draft.lead?.email) {
          await supabase
            .from('growth_email_drafts')
            .update({ status: 'sent' })
            .eq('id', draft.id);
        }
      }

      return { campaign, queued: queueItems.length };
    } catch (err) {
      console.error('Error creating campaign from drafts:', err);
      setError(err.message);
      return { error: err.message };
    }
  }, []);

  // ========================================
  // PIPELINE EXECUTION
  // ========================================
  const runPipeline = useCallback(async (vertical, mode = 'full') => {
    setPipelineRunning(vertical);
    setPipelineResult(null);
    setError(null);
    try {
      const response = await fetch('/api/growth-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vertical, mode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error ejecutando pipeline');
      }

      setPipelineResult(data.results);
      return data.results;
    } catch (err) {
      console.error('Pipeline error:', err);
      setError(err.message);
      return null;
    } finally {
      setPipelineRunning(null);
    }
  }, []);

  return {
    leads,
    drafts,
    stats,
    loading,
    error,
    loadLeads,
    loadDrafts,
    loadStats,
    updateDraftStatus,
    updateLeadStatus,
    updateLead,
    promoteLeadToContact,
    ignoreLead,
    sendApprovedToCampaign,
    runPipeline,
    pipelineRunning,
    pipelineResult,
    setPipelineResult,
  };
};

export default useGrowthSystem;
