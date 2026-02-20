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
  const [enrichmentRunning, setEnrichmentRunning] = useState(false);
  const [enrichmentResult, setEnrichmentResult] = useState(null);
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
        .neq('status', 'ignored') // hide legacy ignored leads
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

      const drafts = allDrafts || [];
      // Exclude ignored leads from all counts (legacy data)
      const leads = (allLeads || []).filter(l => l.status !== 'ignored');

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

      // Remove from list if ignored or promoted, otherwise update status
      if (status === 'ignored' || status === 'promoted') {
        setLeads(prev => prev.filter(l => l.id !== leadId));
      } else {
        setLeads(prev => prev.map(l =>
          l.id === leadId ? { ...l, status } : l
        ));
      }
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
      const contactData = {
        first_name: lead.first_name || lead.full_name?.split(' ')[0] || '',
        last_name: lead.last_name || lead.full_name?.split(' ').slice(1).join(' ') || '',
        email: lead.email || '',
        job_title: lead.job_title || '',
        interest_level: 'cold',
        role: 'other',
        source: `growth_system_${lead.vertical}`,
        ai_context: [
          `Vertical: ${lead.vertical}`,
          lead.company ? `Empresa: ${lead.company}` : null,
          lead.email ? `Email: ${lead.email}` : null,
          lead.geo ? `Geo: ${lead.geo}` : null,
          `LinkedIn: ${lead.linkedin_url}`,
          lead.extra_data?.description ? `Descripción: ${lead.extra_data.description}` : null,
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

  // Delete lead permanently from the database
  const ignoreLead = useCallback(async (leadId) => {
    try {
      const { error: deleteErr } = await supabase
        .from('growth_leads')
        .delete()
        .eq('id', leadId);

      if (deleteErr) throw deleteErr;

      setLeads(prev => prev.filter(l => l.id !== leadId));
      return true;
    } catch (err) {
      console.error('Error deleting lead:', err);
      setError(err.message);
      return false;
    }
  }, []);

  // Update lead fields (for editing in detail modal)
  const updateLead = useCallback(async (leadId, fields) => {
    try {
      const allowedFields = ['full_name', 'first_name', 'last_name', 'job_title', 'company', 'email', 'geo', 'extra_data'];
      const updates = { updated_at: new Date().toISOString() };
      for (const key of allowedFields) {
        if (fields[key] !== undefined) {
          updates[key] = fields[key];
        }
      }

      const { error: updateErr } = await supabase
        .from('growth_leads')
        .update(updates)
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

  // ========================================
  // CUSTOM SEARCH QUERIES
  // ========================================
  const loadCustomQueries = useCallback(async (vertical) => {
    try {
      let query = supabase
        .from('growth_search_queries')
        .select('*')
        .order('created_at', { ascending: false });

      if (vertical) {
        query = query.eq('vertical', vertical);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      return data || [];
    } catch (err) {
      console.error('Error loading custom queries:', err);
      return [];
    }
  }, []);

  const addCustomQuery = useCallback(async (vertical, queryText) => {
    try {
      const { data, error: insertError } = await supabase
        .from('growth_search_queries')
        .insert({ vertical, query: queryText, enabled: true })
        .select()
        .single();

      if (insertError) throw insertError;
      return data;
    } catch (err) {
      console.error('Error adding custom query:', err);
      setError(err.message);
      return null;
    }
  }, []);

  const updateCustomQuery = useCallback(async (queryId, updates) => {
    try {
      const { error: updateErr } = await supabase
        .from('growth_search_queries')
        .update(updates)
        .eq('id', queryId);

      if (updateErr) throw updateErr;
      return true;
    } catch (err) {
      console.error('Error updating custom query:', err);
      setError(err.message);
      return false;
    }
  }, []);

  const deleteCustomQuery = useCallback(async (queryId) => {
    try {
      const { error: deleteErr } = await supabase
        .from('growth_search_queries')
        .delete()
        .eq('id', queryId);

      if (deleteErr) throw deleteErr;
      return true;
    } catch (err) {
      console.error('Error deleting custom query:', err);
      setError(err.message);
      return false;
    }
  }, []);

  // ========================================
  // EMAIL DISCOVERY (Anthropic AI + web_search)
  // ========================================
  const discoverLeadEmails = useCallback(async (leadIds) => {
    setEnrichmentRunning(true);
    setEnrichmentResult(null);
    setError(null);

    const BATCH_SIZE = 5; // AI discovery is slower — 5 leads per API call
    const aggregated = {
      total: leadIds.length,
      found: 0,
      not_found: 0,
      errors: 0,
      already_had_email: 0,
      details: [],
      totalSubmitted: leadIds.length,
    };

    try {
      for (let i = 0; i < leadIds.length; i += BATCH_SIZE) {
        const batch = leadIds.slice(i, i + BATCH_SIZE);

        // Show progress during multi-batch processing
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(leadIds.length / BATCH_SIZE);
        if (leadIds.length > BATCH_SIZE) {
          setEnrichmentResult({
            ...aggregated,
            processing: true,
            batchProgress: `AI Discovery: lote ${batchNum} de ${totalBatches}...`,
          });
        } else {
          setEnrichmentResult({
            ...aggregated,
            processing: true,
            batchProgress: 'AI buscando emails en la web...',
          });
        }

        const response = await fetch('/api/email-discovery-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_ids: batch }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Error en AI email discovery');
        }

        const results = data.results;
        aggregated.found += results.found || 0;
        aggregated.not_found += results.not_found || 0;
        aggregated.errors += results.errors || 0;
        aggregated.already_had_email += results.already_had_email || 0;
        if (results.details) {
          aggregated.details.push(...results.details);
        }

        // Update local leads progressively with found emails from this batch
        if (results.details) {
          const foundEmails = {};
          for (const detail of results.details) {
            if (detail.status === 'found' && detail.email) {
              foundEmails[detail.lead_id] = detail.email;
            }
          }
          if (Object.keys(foundEmails).length > 0) {
            setLeads(prev => prev.map(l =>
              foundEmails[l.id] ? { ...l, email: foundEmails[l.id] } : l
            ));
          }
        }

        // Check if rate limited — stop processing further batches
        const rateLimited = results.details?.some(d => d.status === 'rate_limited');
        if (rateLimited) {
          aggregated.rateLimitedRemaining = leadIds.length - (i + batch.length);
          break;
        }
      }

      aggregated.processing = false;
      setEnrichmentResult(aggregated);
      return aggregated;
    } catch (err) {
      console.error('Error in AI email discovery:', err);
      setError(err.message);
      setEnrichmentResult({ error: err.message });
      return null;
    } finally {
      setEnrichmentRunning(false);
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
    loadCustomQueries,
    addCustomQuery,
    updateCustomQuery,
    deleteCustomQuery,
    discoverLeadEmails,
    enrichmentRunning,
    enrichmentResult,
    setEnrichmentResult,
    runPipeline,
    pipelineRunning,
    pipelineResult,
    setPipelineResult,
  };
};

export default useGrowthSystem;
