// api/regenerate-draft.js
// Vercel Serverless Function — Regenerate a growth email draft personalized to a specific lead
// using Anthropic Claude. Keeps the vertical's objective (B2B, Pharma, Influencer, Events)
// but adapts the content to the individual lead's profile, description, and context.
// POST /api/regenerate-draft { draft_id: "uuid" }

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Vertical strategy context — same objectives as templates but for AI guidance
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Build the regeneration prompt
// ---------------------------------------------------------------------------
function buildRegenerationPrompt(lead, draft, vertical) {
  const strategy = VERTICAL_STRATEGIES[vertical] || VERTICAL_STRATEGIES.DIRECT_B2B;
  const description = lead.extra_data?.description || '';
  const descriptionCleaned = description.replace(/<\/?cite[^>]*>/gi, '');

  const languageMap = { en: 'English', es: 'Español', pt: 'Português' };
  const language = draft.language || 'es';
  const languageName = languageMap[language] || 'Español';

  return `Eres un asistente de comunicación comercial de Digpatho IA, una startup argentina de biotecnología especializada en patología digital con IA.

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
${descriptionCleaned ? `\n**Descripción enriquecida del lead (USAR PARA PERSONALIZAR):**\n${descriptionCleaned}` : ''}

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
}

// ---------------------------------------------------------------------------
// Call Anthropic API (with retry + exponential backoff)
// ---------------------------------------------------------------------------
const RETRY_DELAYS = [3000, 6000, 12000];

async function regenerateViaAI(apiKey, lead, draft, vertical) {
  const prompt = buildRegenerationPrompt(lead, draft, vertical);

  const requestBody = JSON.stringify({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 2000,
    messages: [
      { role: 'user', content: prompt },
    ],
  });

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  let lastError = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: requestBody,
      });

      if (response.ok) {
        const data = await response.json();
        return parseRegenerationResponse(data);
      }

      const text = await response.text();
      const isRetryable = response.status === 429 || response.status === 529;

      if (isRetryable && attempt < RETRY_DELAYS.length) {
        const retryAfterHeader = response.headers.get('retry-after');
        const delay = retryAfterHeader
          ? Math.min(parseInt(retryAfterHeader, 10) * 1000, 30000)
          : RETRY_DELAYS[attempt];

        console.log(`Anthropic ${response.status} for draft regeneration — retry ${attempt + 1}/${RETRY_DELAYS.length} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        lastError = { status: response.status, text: text.slice(0, 300) };
        continue;
      }

      if (response.status === 429) {
        return { error: 'rate_limit', apiError: text.slice(0, 300) };
      }
      if (response.status === 529) {
        return { error: 'api_overloaded', apiError: text.slice(0, 300) };
      }
      if (text.includes('credit balance')) {
        return { error: 'no_credits', apiError: text.slice(0, 300) };
      }
      return { error: `Anthropic API ${response.status}: ${text.slice(0, 300)}` };
    } catch (err) {
      if (attempt < RETRY_DELAYS.length) {
        console.log(`Network error for draft regeneration — retry ${attempt + 1}/${RETRY_DELAYS.length}`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
        lastError = { status: 0, text: err.message };
        continue;
      }
      return { error: err.message };
    }
  }

  return { error: 'rate_limit', apiError: lastError?.text || 'All retries exhausted' };
}

// ---------------------------------------------------------------------------
// Parse Claude's response — extract subject and body
// ---------------------------------------------------------------------------
function parseRegenerationResponse(apiResponse) {
  const textBlocks = (apiResponse.content || []).filter(b => b.type === 'text');
  if (textBlocks.length === 0) return { error: 'no_text_response' };

  const text = textBlocks.map(b => b.text).join('\n');

  const subjectMatch = text.match(/\*{0,2}\s*Asunto\s*:?\s*\*{0,2}\s*:?\s*(.+?)(?=\n|$)/i);
  const subject = subjectMatch ? subjectMatch[1].trim() : null;

  const bodyMatch = text.match(/\*{0,2}\s*Cuerpo\s*:?\s*\*{0,2}\s*:?\s*([\s\S]*?)$/i);
  const body = bodyMatch ? bodyMatch[1].trim() : null;

  if (!subject && !body) {
    // Fallback: try to use the whole response
    return {
      subject: null,
      body: text.trim(),
      warning: 'Could not parse structured response, returning raw text',
    };
  }

  return { subject, body };
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
    const anthropicKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return res.status(400).json({
        error: 'ANTHROPIC_API_KEY not configured.',
      });
    }

    const { draft_id } = req.body || {};
    if (!draft_id) {
      return res.status(400).json({ error: 'draft_id is required' });
    }

    const supabase = getSupabase();

    // Fetch draft with lead data
    const { data: draft, error: draftErr } = await supabase
      .from('growth_email_drafts')
      .select('*, lead:growth_leads(*)')
      .eq('id', draft_id)
      .single();

    if (draftErr) throw draftErr;
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    const lead = draft.lead;
    if (!lead) {
      return res.status(404).json({ error: 'Associated lead not found' });
    }

    // Call Claude to regenerate
    const result = await regenerateViaAI(anthropicKey, lead, draft, draft.vertical);

    if (result.error) {
      if (result.error === 'no_credits') {
        return res.status(402).json({
          error: 'no_credits',
          message: 'Tu cuenta de Anthropic no tiene créditos suficientes. Cargá créditos en https://console.anthropic.com/settings/billing',
          apiError: result.apiError || null,
        });
      }
      if (result.error === 'rate_limit' || result.error === 'api_overloaded') {
        return res.status(429).json({
          error: result.error,
          message: 'Límite de API alcanzado. Intentá de nuevo en unos minutos.',
          apiError: result.apiError || null,
        });
      }
      return res.status(500).json({ error: result.error });
    }

    return res.status(200).json({
      success: true,
      result: {
        subject: result.subject,
        body: result.body,
        warning: result.warning || null,
      },
    });
  } catch (err) {
    console.error('Draft regeneration error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
