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

  const updateDraftContent = useCallback(async (draftId, fields) => {
    try {
      const allowedFields = ['subject', 'body'];
      const updates = { updated_at: new Date().toISOString() };
      for (const key of allowedFields) {
        if (fields[key] !== undefined) {
          updates[key] = fields[key];
        }
      }

      const { error: updateErr } = await supabase
        .from('growth_email_drafts')
        .update(updates)
        .eq('id', draftId);

      if (updateErr) throw updateErr;

      setDrafts(prev => prev.map(d =>
        d.id === draftId ? { ...d, ...updates } : d
      ));
      return true;
    } catch (err) {
      console.error('Error updating draft content:', err);
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
      const { data, error: deleteErr } = await supabase
        .from('growth_leads')
        .delete()
        .eq('id', leadId)
        .select();

      if (deleteErr) throw deleteErr;

      if (!data || data.length === 0) {
        throw new Error('No se pudo eliminar el lead. Verifique permisos de base de datos.');
      }

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

        // Handle non-JSON responses (Vercel errors, timeouts, HTML error pages)
        const responseText = await response.text();
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (_) {
          throw new Error(`API error (${response.status}): ${responseText.slice(0, 150)}`);
        }

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

        // Check if rate limited — only stop if most of the batch was rate limited
        const rateLimitedDetails = results.details?.filter(d => d.status === 'rate_limited') || [];
        if (rateLimitedDetails.length > 0) {
          const rateLimitDetail = rateLimitedDetails[0];
          aggregated.rateLimitError = rateLimitDetail.apiError || null;

          // Only stop all batches if the majority of this batch was rate limited
          if (rateLimitedDetails.length >= batch.length) {
            aggregated.rateLimitedRemaining = leadIds.length - (i + batch.length);
            break;
          }
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
  // LEAD DESCRIPTION ENRICHMENT (Anthropic AI + web_search)
  // ========================================
  const enrichLeadDescription = useCallback(async (leadId) => {
    try {
      const response = await fetch('/api/lead-enrich-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      });

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (_) {
        throw new Error(`Error del servidor (${response.status}): ${responseText.slice(0, 150)}`);
      }

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Error enriqueciendo descripción');
      }

      if (data.success && data.result?.description) {
        // Update local leads state with new description
        setLeads(prev => prev.map(l =>
          l.id === leadId
            ? {
                ...l,
                extra_data: {
                  ...(l.extra_data || {}),
                  description: data.result.description,
                  description_sources: data.result.sources || [],
                  description_enriched_at: new Date().toISOString(),
                  description_confidence: data.result.confidence || 'medium',
                  description_original: l.extra_data?.description || null,
                },
              }
            : l
        ));
      }

      return data;
    } catch (err) {
      console.error('Error enriching lead description:', err);
      throw err;
    }
  }, []);

  // ========================================
  // DRAFT REGENERATION (Anthropic AI — personalized to lead, client-side)
  // ========================================
  const regenerateDraft = useCallback(async (draft) => {
    const lead = draft?.lead || {};
    const vertical = draft?.vertical || 'DIRECT_B2B';

    const VERTICAL_STRATEGIES = {
      DIRECT_B2B: {
        objective: 'Vender el servicio SaaS de Digpatho a laboratorios y centros de referencia. El lead es un potencial comprador directo.',
        tone: 'Operacional, enfocado en ROI y resultados medibles.',
        cta: 'Agendar una demo de 15 minutos.',
        key_points: [
          'Escasez global de patólogos (40,000 estimados)',
          'Plataforma de análisis celular con IA: 5-10x más rápido que microscopía manual, 95% precisión',
          'Modelo SaaS sin inversión inicial en escáneres ($50K-$300K ahorrados)',
          'Pilotos activos en Instituto Oulton (Argentina) y UCH (Nigeria)',
          'Ahorro de $1,300 USD por caso, 28% reducción en turnaround',
        ],
      },
      PHARMA: {
        objective: 'Establecer partnerships con empresas pharma para companion diagnostics (CDx) y ensayos clínicos. El lead trabaja en pharma o CROs.',
        tone: 'Científico-estratégico. Hablar de data, validación, y estrategia clínica.',
        cta: 'Coordinar un briefing técnico de 30 minutos.',
        key_points: [
          'DESTINY-Breast06 expandió la relevancia de HER2-low (IHC 1+ y 2+/ISH-)',
          'Cuantificación objetiva y reproducible de HER2-low entre sitios',
          'Estandarización de biomarcadores (Ki-67, HER2) para ensayos multi-sitio',
          'Pre-screening en tiempo real de H&E e IHC',
          'Presencia validada en LATAM y África — donde PathAI y Paige no operan',
        ],
      },
      INFLUENCER: {
        objective: 'Colaborar con thought leaders, periodistas, editores y creadores de contenido para amplificar la visibilidad de Digpatho.',
        tone: 'Colaborativo, peer-to-peer. No es venta, es propuesta de contenido conjunto.',
        cta: 'Agendar una llamada para explorar colaboración de contenido.',
        key_points: [
          'IA en patología del Global South — historia poco cubierta',
          'Pilotos en UCH (Nigeria) y Wits University (Sudáfrica) con datos de impacto clínico',
          'Ángulos posibles: guest posts, casos de estudio, narrativa de leapfrogging',
          'África saltando de portaobjetos a telepatología con IA',
        ],
      },
      EVENTS: {
        objective: 'Conseguir reuniones presenciales en conferencias y eventos del sector.',
        tone: 'Directo, conciso, máximo 5-7 líneas. Al grano.',
        cta: 'Reunión de 15 minutos durante el evento.',
        key_points: [
          'Demo en vivo de la plataforma (95% precisión diagnóstica)',
          'Mantener el email extremadamente breve',
        ],
      },
    };

    const strategy = VERTICAL_STRATEGIES[vertical] || VERTICAL_STRATEGIES.DIRECT_B2B;
    const description = (lead.extra_data?.description || '').replace(/<\/?cite[^>]*>/gi, '');
    const languageMap = { en: 'English', es: 'Español', pt: 'Português' };
    const language = draft.language || 'es';
    const languageName = languageMap[language] || 'Español';

    const prompt = `Eres un asistente de comunicación comercial de Digpatho IA, una startup argentina de biotecnología especializada en patología digital con IA.

## CONTEXTO DE LA EMPRESA
- **Digpatho IA**: Startup argentina de patología digital.
- **Trayectoria**: Herramientas para automatizar biomarcadores en cáncer de mama (HER2, Ki67, RE, RP).
- **Propuesta de valor**: Reducir variabilidad inter-observador y ahorrar tiempo en conteo celular.
- **Diferenciadores**: Tecnología validada en LATAM y África, reportes automáticos, modelo SaaS accesible.

## OBJETIVO DEL EMAIL (VERTICAL: ${vertical})
${strategy.objective}

**Tono requerido:** ${strategy.tone}
**Call-to-action:** ${strategy.cta}

**Puntos clave a considerar (usar los más relevantes para este lead):**
${strategy.key_points.map(p => `- ${p}`).join('\n')}

## DATOS DEL LEAD (PERSONALIZAR EL EMAIL A ESTA PERSONA)
- **Nombre completo:** ${lead.full_name || '[Sin nombre]'}
- **Cargo:** ${lead.job_title || '[Sin cargo]'}
- **Empresa/Institución:** ${lead.company || '[Sin empresa]'}
- **Geografía:** ${lead.geo || 'No especificada'}
- **Email:** ${lead.email || 'No disponible'}
- **LinkedIn:** ${lead.linkedin_url || 'No disponible'}
${description ? `\n**Descripción enriquecida del lead (USAR PARA PERSONALIZAR):**\n${description}` : ''}

## BORRADOR ORIGINAL (REFERENCIA)
El siguiente es el borrador genérico original. Tu tarea es regenerarlo personalizado a este lead específico:

**Asunto original:** ${draft.subject}
**Cuerpo original:**
${draft.body}

## INSTRUCCIONES
1. **Mantener el OBJETIVO del vertical**: El propósito del email debe seguir siendo ${strategy.objective.toLowerCase().slice(0, 80)}...
2. **Personalizar profundamente**: Usa los datos del lead (nombre, cargo, empresa, descripción enriquecida) para hacer referencias específicas a su trabajo, su institución, o su área de expertise.
3. **Si hay descripción enriquecida**: Úsala para encontrar puntos de conexión reales — publicaciones, roles, áreas de interés, logros — y mencionarlos en el email.
4. **Si NO hay descripción**: Personaliza usando los datos básicos (nombre, cargo, empresa, geo) de forma inteligente.
5. **No inventar**: No atribuyas publicaciones, logros o datos que no estén en la información proporcionada.
6. **Idioma**: Escribir en **${languageName}**.
7. **Formato**: Usar el mismo nivel de formalidad que el borrador original.

## FORMATO DE RESPUESTA
Responde EXACTAMENTE en este formato:

**Asunto:** [Línea de asunto personalizada]

**Cuerpo:**
[Contenido del email personalizado]`;

    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('VITE_ANTHROPIC_API_KEY no está configurada.');
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        let errMsg = 'Error regenerando borrador';
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error?.message || errMsg;
        } catch (_) { /* use default */ }
        throw new Error(errMsg);
      }

      const data = await response.json();
      const textBlocks = (data.content || []).filter(b => b.type === 'text');
      if (textBlocks.length === 0) throw new Error('No se recibió respuesta del modelo.');

      const text = textBlocks.map(b => b.text).join('\n');
      const subjectMatch = text.match(/\*{0,2}\s*Asunto\s*:?\s*\*{0,2}\s*:?\s*(.+?)(?=\n|$)/i);
      const bodyMatch = text.match(/\*{0,2}\s*Cuerpo\s*:?\s*\*{0,2}\s*:?\s*([\s\S]*?)$/i);

      return {
        success: true,
        result: {
          subject: subjectMatch ? subjectMatch[1].trim() : null,
          body: bodyMatch ? bodyMatch[1].trim() : text.trim(),
        },
      };
    } catch (err) {
      console.error('Error regenerating draft:', err);
      throw err;
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
    updateDraftContent,
    updateLeadStatus,
    updateLead,
    promoteLeadToContact,
    ignoreLead,
    loadCustomQueries,
    addCustomQuery,
    updateCustomQuery,
    deleteCustomQuery,
    discoverLeadEmails,
    enrichLeadDescription,
    regenerateDraft,
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
