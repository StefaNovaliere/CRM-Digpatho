// api/growth-pipeline.js
// Vercel Serverless Function — Growth System Pipeline
// Runs search (via SerpAPI) + lead insertion + draft generation per vertical.
// POST /api/growth-pipeline { vertical: "DIRECT_B2B", mode: "search"|"draft"|"full" }

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Supabase client (uses service key to bypass RLS)
// ---------------------------------------------------------------------------
function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Vertical Configs — search queries, templates, etc.
// ---------------------------------------------------------------------------
const VERTICAL_CONFIGS = {
  DIRECT_B2B: {
    display_name: 'Direct B2B — Reference Centers & Labs',
    search_queries: [
      'site:linkedin.com/in "Medical Director" OR "Chief of Pathology" OR "Laboratory Director" pathology Argentina OR Brazil',
      'site:linkedin.com/in "Director Médico" OR "Jefe de Patología" patología oncología Argentina OR Brasil',
      'site:linkedin.com/in "Head of Pathology" OR "Lab Director" diagnostic laboratory "South Africa" OR Nigeria',
    ],
    email_tone: 'Operational, ROI-driven.',
    email_cta: '15-minute demo call',
  },
  PHARMA: {
    display_name: 'Pharma Partnerships — CDx & Clinical Trials',
    search_queries: [
      'site:linkedin.com/in "Business Development" OR "Oncology Lead" OR "Clinical Trial Manager" AstraZeneca OR "Daiichi Sankyo" HER2 OR "digital pathology"',
      'site:linkedin.com/in "R&D Director" OR "Biomarker" OR "Head of Companion Diagnostics" pharma oncology "companion diagnostic" OR CDx',
      'site:linkedin.com/in "Medical Science Liaison" OR "Clinical Operations" oncology pharma "digital pathology" OR "AI diagnostics"',
    ],
    email_tone: 'Scientific-strategic.',
    email_cta: '30-minute technical briefing',
  },
  INFLUENCER: {
    display_name: 'Influencers & Thought Leadership',
    search_queries: [
      'site:linkedin.com/in "Editor" OR "Founder" OR "Author" "digital pathology" OR "AI in healthcare" OR "computational pathology"',
      'site:linkedin.com/in "thought leader" OR "keynote speaker" OR "blogger" pathology AI oncology diagnostics',
      'site:linkedin.com/in "podcast host" OR "content creator" "digital health" OR "health tech" OR "medtech" pathology',
    ],
    email_tone: 'Collaborative, peer-to-peer.',
    email_cta: 'Content collaboration call',
  },
  EVENTS: {
    display_name: 'Events & Conferences',
    search_queries: [
      'site:linkedin.com/in "Speaker" OR "Organizer" OR "Chair" "pathology congress" OR "oncology symposium" OR "USCAP" 2025 OR 2026',
      'site:linkedin.com/in "Program Director" OR "Scientific Committee" "digital pathology" OR "pathology conference"',
      'site:linkedin.com/in "Speaker" OR "Panelist" "FIFARMA" OR "digital pathology congress" OR "European Congress of Pathology"',
    ],
    email_tone: 'Direct, concise, 5-7 lines max.',
    email_cta: '15-minute meeting at [EVENT]',
  },
};

// ---------------------------------------------------------------------------
// Email Templates — vertical x language (subset — most important ones)
// ---------------------------------------------------------------------------
const EMAIL_TEMPLATES = {
  DIRECT_B2B: {
    en: [
      {
        subject: 'Reducing diagnostic turnaround at {company}',
        body: 'Dear {name},\n\nThe global shortage of pathologists — estimated at 40,000 worldwide — continues to strain diagnostic labs. With caseloads growing and turnaround expectations tightening, the throughput challenge is real.\n\nAt Digpatho, we\'ve developed an AI-powered cell analysis platform that processes microscopic images 5-10x faster than manual microscopy, achieving 95% diagnostic accuracy. Our SaaS model means no upfront investment in scanners or IT infrastructure — it works on any device, even without high-speed internet.\n\nWe\'re running active pilots at reference centers including Instituto Oulton (Argentina) and University College Hospital (Nigeria), delivering $1,300 USD in savings per case and a 28% reduction in diagnostic turnaround time.\n\nI\'d welcome 15 minutes to show you how this could work for {company}. Would you be open to a brief demo?\n\nBest regards,\n[SENDER_NAME]\nDigpatho IA',
      },
    ],
    es: [
      {
        subject: 'Reducir el tiempo diagnóstico un 28% en {company}',
        body: 'Estimado/a {name},\n\nLa escasez global de patólogos — estimada en 40,000 a nivel mundial — sigue presionando a laboratorios diagnósticos. Con volúmenes crecientes y expectativas de turnaround cada vez más exigentes, el desafío de productividad es real.\n\nEn Digpatho desarrollamos una plataforma de análisis celular con IA que procesa imágenes microscópicas 5-10x más rápido que la microscopía manual, con 95% de precisión diagnóstica. Nuestro modelo SaaS elimina la inversión inicial de $50K-$300K en escáneres e infraestructura IT.\n\nTenemos pilotos activos en centros de referencia como Instituto Oulton (Córdoba) y Hospital de Ezeiza, con resultados medibles: ahorro de $1,300 USD por caso y reducción del 28% en tiempo diagnóstico.\n\nMe encantaría dedicarle 15 minutos para una demo adaptada al flujo de trabajo de {company}. ¿Le funcionaría la próxima semana?\n\nCordialmente,\n[SENDER_NAME]\nDigpatho IA',
      },
    ],
  },
  PHARMA: {
    en: [
      {
        subject: 'HER2-low quantification — eliminating IHC scoring subjectivity',
        body: 'Dear {name},\n\nThe DESTINY-Breast06 results have expanded the clinical relevance of HER2-low (IHC 1+ and 2+/ISH-) classification, opening ADC therapies like Enhertu to a broader patient population. However, manual IHC scoring at these low detection thresholds remains notoriously subjective — a critical gap when therapies cost $10,000+/month per patient.\n\nAt Digpatho, we\'ve developed AI-powered quantification that provides objective, reproducible HER2-low scoring across sites. Our platform standardizes biomarker assessment (Ki-67, HER2) for multi-site clinical trials, with real-time pre-screening of H&E and IHC slides.\n\nWhat makes our position unique: we operate validated pilots across Latin America and Africa — territories where PathAI and Paige have no presence.\n\nI\'d welcome a 30-minute technical briefing to discuss how this aligns with {company}\'s CDx or clinical trial strategy. Would that be of interest?\n\nBest regards,\n[SENDER_NAME]\nDigpatho IA',
      },
    ],
    es: [
      {
        subject: 'Cuantificación HER2-low — eliminando la subjetividad del scoring IHC',
        body: 'Estimado/a {name},\n\nLos resultados de DESTINY-Breast06 han expandido la relevancia clínica de la clasificación HER2-low (IHC 1+ y 2+/ISH-), abriendo terapias ADC como Enhertu a una población más amplia de pacientes.\n\nEn Digpatho, desarrollamos cuantificación con IA que proporciona scoring HER2-low objetivo y reproducible entre sitios. Nuestra plataforma estandariza la evaluación de biomarcadores (Ki-67, HER2) para ensayos clínicos multi-sitio.\n\nNuestra posición única: operamos pilotos validados en América Latina y África — territorios donde PathAI y Paige no tienen presencia.\n\nMe encantaría coordinar un briefing técnico de 30 minutos para discutir cómo esto se alinea con la estrategia de CDx de {company}. ¿Le interesaría?\n\nCordialmente,\n[SENDER_NAME]\nDigpatho IA',
      },
    ],
  },
  INFLUENCER: {
    en: [
      {
        subject: 'Content collaboration — AI pathology in the Global South',
        body: 'Dear {name},\n\nI\'ve been following your work in the digital pathology space and wanted to reach out about a potential content collaboration.\n\nWe\'re working on AI-powered cell analysis for pathology labs across Latin America and Africa — a story that doesn\'t get enough coverage. We have active pilots at University College Hospital (Nigeria) and Wits University (South Africa) with preliminary clinical impact data we\'d be happy to share.\n\nWould you be interested in any of these angles?\n- Guest post on \'AI pathology adoption in the Global South\'\n- Case study with clinical validation data from our African pilots\n- The \'leapfrogging\' story: Africa going from glass slides directly to AI-powered telepathology\n\nHappy to jump on a call to discuss what would work best for your audience.\n\nBest,\n[SENDER_NAME]\nDigpatho IA',
      },
    ],
    es: [
      {
        subject: 'Colaboración de contenido — IA en patología del Global South',
        body: 'Estimado/a {name},\n\nHe seguido su trabajo en el espacio de patología digital y quería contactarle sobre una posible colaboración de contenido.\n\nEstamos trabajando con análisis celular con IA en laboratorios de patología en América Latina y África — una historia que no recibe suficiente cobertura.\n\n¿Le interesaría alguno de estos ángulos?\n- Guest post sobre \'Adopción de IA en patología del Global South\'\n- Caso de estudio con datos de validación clínica de nuestros pilotos en África\n- La narrativa del \'leapfrogging\': África saltando de portaobjetos a telepatología con IA\n\nCon gusto agendamos una llamada para ver qué funciona mejor para su audiencia.\n\nSaludos,\n[SENDER_NAME]\nDigpatho IA',
      },
    ],
  },
  EVENTS: {
    en: [
      {
        subject: '[EVENT] — 15-minute meeting request',
        body: 'Dear {name},\n\nI\'ll be attending [EVENT] and noticed your involvement. I\'d love to schedule a brief 15-minute meeting — we can demonstrate our AI cell analysis platform (95% diagnostic accuracy) live on the spot.\n\nWould [DATE/TIME] work for you?\n\nBest regards,\n[SENDER_NAME] — Digpatho IA',
      },
    ],
    es: [
      {
        subject: '[EVENT] — solicitud de reunión de 15 minutos',
        body: 'Estimado/a {name},\n\nEstaré en [EVENT] y noté su participación. Me encantaría agendar una reunión de 15 minutos — podemos hacer una demo en vivo de nuestra plataforma de análisis celular con IA (95% de precisión).\n\n¿Le funcionaría [FECHA/HORA]?\n\nCordialmente,\n[SENDER_NAME] — Digpatho IA',
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// Helpers (ported from Python)
// ---------------------------------------------------------------------------
function parseLinkedInUrl(url) {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/);
  return match ? match[1].replace(/\/$/, '') : null;
}

function parseLinkedInTitle(title) {
  if (!title) return { name: null, jobTitle: null, company: null };
  title = title.replace(/\s*[|–—]\s*LinkedIn\s*$/i, '');
  const parts = title.split(/\s*[-–—]\s*/).map(p => p.trim()).filter(Boolean);
  return {
    name: parts[0] || null,
    jobTitle: parts[1] || null,
    company: parts[2] || null,
  };
}

function inferNameFromSlug(slug) {
  const parts = slug.split('-');
  const nameParts = parts.filter(p => !/^[0-9a-f]{5,}$/.test(p) && !/^\d+$/.test(p));
  return nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') || slug;
}

function extractEmailsFromText(text) {
  if (!text) return [];
  const pattern = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const emails = text.match(pattern) || [];
  const blockedDomains = new Set(['example.com', 'email.com', 'test.com', 'sentry.io', 'linkedin.com']);
  const blockedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'];
  return [...new Set(
    emails
      .map(e => e.toLowerCase())
      .filter(e => {
        const domain = e.split('@')[1] || '';
        if (blockedDomains.has(domain)) return false;
        if (blockedExtensions.some(ext => e.endsWith(ext))) return false;
        return true;
      })
  )];
}

function inferGeoFromQuery(query) {
  const geoMap = {
    Argentina: 'Argentina', Brazil: 'Brazil', Brasil: 'Brazil',
    'South Africa': 'South Africa', Nigeria: 'Nigeria',
    Paraguay: 'Paraguay', Uruguay: 'Uruguay', Bolivia: 'Bolivia', Peru: 'Peru',
  };
  const lower = query.toLowerCase();
  for (const [keyword, geo] of Object.entries(geoMap)) {
    if (lower.includes(keyword.toLowerCase())) return geo;
  }
  return null;
}

function determineLanguage(geo) {
  if (!geo) return 'en';
  const lower = geo.toLowerCase();
  if (lower.includes('brazil') || lower.includes('brasil')) return 'pt';
  const esCountries = ['argentina', 'paraguay', 'uruguay', 'bolivia', 'peru', 'mexico', 'colombia', 'chile'];
  if (esCountries.some(c => lower.includes(c))) return 'es';
  return 'en';
}

function splitName(fullName) {
  if (!fullName) return { firstName: null, lastName: null };
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] || null, lastName: parts.slice(1).join(' ') || null };
}

function fillTemplate(template, lead) {
  const name = lead.full_name || '[NOMBRE]';
  const company = lead.company || '[EMPRESA]';
  const jobTitle = lead.job_title || '[CARGO]';
  return {
    subject: template.subject.replace(/\{name\}/g, name).replace(/\{company\}/g, company).replace(/\{job_title\}/g, jobTitle).replace(/\{event\}/g, '[EVENT]'),
    body: template.body.replace(/\{name\}/g, name).replace(/\{company\}/g, company).replace(/\{job_title\}/g, jobTitle).replace(/\{event\}/g, '[EVENT]'),
  };
}

// ---------------------------------------------------------------------------
// Agent 1: Search via SerpAPI
// ---------------------------------------------------------------------------
async function searchVertical(vertical) {
  const serpApiKey = process.env.SERPAPI_KEY;
  if (!serpApiKey) {
    throw new Error('SERPAPI_KEY not configured. Set it in Vercel Environment Variables to enable Google search.');
  }

  const config = VERTICAL_CONFIGS[vertical];
  if (!config) throw new Error(`Unknown vertical: ${vertical}`);

  const allLeads = [];

  for (const query of config.search_queries) {
    try {
      const params = new URLSearchParams({
        q: query,
        api_key: serpApiKey,
        engine: 'google',
        num: '10',
      });

      const response = await fetch(`https://serpapi.com/search.json?${params}`);
      if (!response.ok) {
        const text = await response.text();
        console.error(`SerpAPI error for query: ${text}`);
        continue;
      }

      const data = await response.json();
      const organicResults = data.organic_results || [];

      for (const result of organicResults) {
        const url = result.link || '';
        if (!url.includes('linkedin.com/in/')) continue;

        const slug = parseLinkedInUrl(url);
        if (!slug) continue;

        const { name, jobTitle, company } = parseLinkedInTitle(result.title || '');
        const geo = inferGeoFromQuery(query);
        const snippet = result.snippet || result.description || '';
        const foundEmails = extractEmailsFromText(`${result.title || ''} ${snippet}`);

        allLeads.push({
          full_name: name || inferNameFromSlug(slug),
          job_title: jobTitle,
          company: company,
          email: foundEmails.length > 0 ? foundEmails[0] : null,
          linkedin_url: `https://www.linkedin.com/in/${slug}`,
          vertical,
          source_query: query,
          geo,
        });
      }
    } catch (err) {
      console.error(`Search error for query "${query.slice(0, 60)}...":`, err.message);
    }
  }

  return allLeads;
}

// ---------------------------------------------------------------------------
// Agent 2: Lead Manager — dedup + insert
// ---------------------------------------------------------------------------
async function processLeads(supabase, rawLeads) {
  const inserted = [];
  let duplicates = 0;
  let errors = 0;

  for (const lead of rawLeads) {
    const linkedinUrl = (lead.linkedin_url || '').trim();
    if (!linkedinUrl || !linkedinUrl.includes('linkedin.com/in/')) {
      errors++;
      continue;
    }

    // Dedup check
    const { data: existing } = await supabase
      .from('growth_leads')
      .select('id')
      .eq('linkedin_url', linkedinUrl)
      .limit(1);

    if (existing && existing.length > 0) {
      duplicates++;
      continue;
    }

    const { firstName, lastName } = splitName(lead.full_name);
    const record = {
      full_name: lead.full_name,
      first_name: firstName,
      last_name: lastName,
      job_title: lead.job_title,
      company: lead.company,
      email: lead.email || null,
      linkedin_url: linkedinUrl,
      vertical: lead.vertical,
      source_query: lead.source_query,
      geo: lead.geo,
      status: 'new',
      extra_data: {},
    };

    const { data, error } = await supabase
      .from('growth_leads')
      .insert(record)
      .select()
      .single();

    if (error) {
      if (error.message?.includes('duplicate') || error.code === '23505') {
        duplicates++;
      } else {
        errors++;
        console.error('Insert error:', error.message);
      }
    } else if (data) {
      inserted.push(data);
    }
  }

  return { inserted, duplicates, errors };
}

// ---------------------------------------------------------------------------
// Agent 3: Draft Generator — template-based
// ---------------------------------------------------------------------------
async function generateDrafts(supabase, leads, vertical) {
  const created = [];
  let errors = 0;

  for (const lead of leads) {
    const v = vertical || lead.vertical || 'DIRECT_B2B';
    const lang = determineLanguage(lead.geo);

    const templates = EMAIL_TEMPLATES[v];
    if (!templates) { errors++; continue; }

    const langTemplates = templates[lang] || templates['en'];
    if (!langTemplates || langTemplates.length === 0) { errors++; continue; }

    const template = langTemplates[Math.floor(Math.random() * langTemplates.length)];
    const { subject, body } = fillTemplate(template, lead);

    const config = VERTICAL_CONFIGS[v];
    const draftRecord = {
      lead_id: lead.id,
      subject,
      body,
      vertical: v,
      language: lang,
      status: 'draft_pending_review',
      generation_context: {
        lead_name: lead.full_name,
        lead_company: lead.company,
        lead_job_title: lead.job_title,
        lead_email: lead.email,
        lead_linkedin: lead.linkedin_url,
        lead_geo: lead.geo,
        vertical_config: config?.display_name,
        tone: config?.email_tone,
        cta: config?.email_cta,
        generated_at: new Date().toISOString(),
      },
    };

    const { data, error } = await supabase
      .from('growth_email_drafts')
      .insert(draftRecord)
      .select()
      .single();

    if (error) {
      errors++;
      console.error('Draft insert error:', error.message);
    } else if (data) {
      created.push(data);
      // Update lead status
      await supabase
        .from('growth_leads')
        .update({ status: 'draft_generated', updated_at: new Date().toISOString() })
        .eq('id', lead.id);
    }
  }

  return { created, errors };
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { vertical, mode = 'full' } = req.body || {};

    if (!vertical || !VERTICAL_CONFIGS[vertical]) {
      return res.status(400).json({
        error: `Invalid vertical. Must be one of: ${Object.keys(VERTICAL_CONFIGS).join(', ')}`,
      });
    }

    if (!['search', 'draft', 'full'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode. Must be: search, draft, or full' });
    }

    const supabase = getSupabase();
    const results = {
      vertical,
      mode,
      leads_found: 0,
      leads_inserted: 0,
      duplicates: 0,
      drafts_created: 0,
      errors: 0,
    };

    // --- SEARCH PHASE ---
    if (mode === 'search' || mode === 'full') {
      const rawLeads = await searchVertical(vertical);
      results.leads_found = rawLeads.length;

      const { inserted, duplicates, errors } = await processLeads(supabase, rawLeads);
      results.leads_inserted = inserted.length;
      results.duplicates = duplicates;
      results.errors += errors;
    }

    // --- DRAFT PHASE ---
    if (mode === 'draft' || mode === 'full') {
      // Get leads with status='new' (no draft yet)
      let query = supabase
        .from('growth_leads')
        .select('*')
        .eq('status', 'new')
        .eq('vertical', vertical)
        .order('created_at', { ascending: false });

      const { data: leadsForDrafts, error: fetchErr } = await query;
      if (fetchErr) {
        console.error('Error fetching leads for drafts:', fetchErr.message);
        results.errors++;
      } else if (leadsForDrafts && leadsForDrafts.length > 0) {
        const { created, errors } = await generateDrafts(supabase, leadsForDrafts, vertical);
        results.drafts_created = created.length;
        results.errors += errors;
      }
    }

    return res.status(200).json({ success: true, results });
  } catch (err) {
    console.error('Pipeline error:', err);
    return res.status(500).json({
      error: err.message || 'Internal server error',
      hint: err.message?.includes('SERPAPI_KEY')
        ? 'Configure SERPAPI_KEY in Vercel Environment Variables to enable Google search. You can still use mode="draft" to generate drafts for existing leads.'
        : undefined,
    });
  }
}
