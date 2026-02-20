// api/generate-email.js
// Vercel Serverless Function — Generate a personalized email for a contact
// using Anthropic Claude. Keeps the API key server-side.
// POST /api/generate-email { contactId, emailType, config }

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Project contexts (mirrored from src/config/aiPrompts.js)
// ---------------------------------------------------------------------------
const PROJECT_CONTEXTS = {
  breast_her2: {
    name: 'Biomarcadores en Cáncer de Mama',
    focus: 'HER2, Ki67, RE y RP en inmunohistoquímica',
    problem: 'el tedioso proceso de conteo manual de células en casos de cáncer de mama, con alta variabilidad inter-observador',
    solution: 'automatizar el conteo de biomarcadores (HER2, Ki67, RE, RP) para reducir subjetividad y ahorrar tiempo',
    restrictions: `
RESTRICCIONES CRÍTICAS PARA ESTE PROYECTO:
- Solo hablamos de cáncer de MAMA y biomarcadores IHC (HER2, Ki67, RE, RP)
- NO realizamos diagnóstico primario sobre H&E
- NO analizamos márgenes quirúrgicos
- NO trabajamos con otros órganos (próstata, pulmón, piel, etc.)
- Si el contacto no es especialista en mama, ofrecer derivar a quien corresponda`
  },
  prostate_gleason: {
    name: 'Graduación Automática de Cáncer de Próstata (Gleason/ISUP)',
    focus: 'Score de Gleason y clasificación ISUP',
    problem: 'la variabilidad inter-observador en la asignación del Score de Gleason, uno de los mayores retos en uropatología',
    solution: 'desarrollar una IA para graduación automática que sirva como estándar de referencia y apoyo educativo',
    intro: 'Si bien comenzamos desarrollando herramientas para automatizar biomarcadores en mama, hoy estamos enfocados en',
    restrictions: `
CONTEXTO IMPORTANTE:
- Digpatho tiene experiencia previa en mama (HER2, Ki67) - mencionar brevemente como credencial
- El enfoque ACTUAL es próstata/Gleason
- Buscamos colaboradores para VALIDAR y CO-DESARROLLAR, no vender un producto terminado
- Enfatizar: reducir subjetividad, apoyo educativo, estándar de referencia
- Ideal para uropatólogos, coordinadores de clubes de patología urológica, hospitales con alto volumen de biopsias prostáticas`
  },
  clinical_validation: {
    name: 'Validación Clínica de Herramientas de IA',
    focus: 'validación y feedback de modelos de IA en patología',
    problem: 'la necesidad de validar herramientas de IA con criterio experto antes de su implementación clínica',
    solution: 'colaborar con expertos para validar nuestros modelos y asegurar que aporten valor real a la práctica diaria',
    restrictions: `
ENFOQUE DE ESTE EMAIL:
- No estamos vendiendo, estamos buscando VALIDADORES expertos
- Queremos feedback honesto y criterio clínico
- Ofrecemos acceso temprano a herramientas a cambio de su expertise
- Mencionar que sus aportes serán reconocidos/acreditados`
  },
  academic_collaboration: {
    name: 'Colaboración Académica e Investigación',
    focus: 'investigación conjunta y publicaciones en patología digital',
    problem: 'la brecha entre el desarrollo tecnológico y la validación científica rigurosa',
    solution: 'establecer colaboraciones académicas para investigación conjunta y publicaciones',
    restrictions: `
ENFOQUE ACADÉMICO:
- Proponer investigación conjunta, no venta de productos
- Mencionar posibilidad de co-autoría en publicaciones
- Interés en datasets, ground truth, metodología
- Ideal para investigadores, profesores universitarios, centros académicos`
  },
  custom: {
    name: 'Objetivo Personalizado',
    focus: 'definido por el usuario',
    problem: 'definido por el usuario',
    solution: 'definido por el usuario',
    restrictions: `
INSTRUCCIONES:
- El usuario proporcionará el objetivo específico en el campo de contexto personalizado
- Adaptar el email al objetivo indicado
- Mantener el tono profesional de Digpatho`
  }
};

// ---------------------------------------------------------------------------
// System prompt builder (mirrored from src/config/aiPrompts.js)
// ---------------------------------------------------------------------------
const EMAIL_AGENT_SYSTEM_PROMPT = `Eres un asistente de comunicación comercial especializado para Digpatho IA, una startup de biotecnología argentina.

## CONTEXTO DE LA EMPRESA
- **Digpatho IA**: Startup argentina de biotecnología especializada en patología digital.
- **Trayectoria**: Comenzamos desarrollando herramientas para automatizar biomarcadores en cáncer de mama (HER2, Ki67, RE, RP).
- **Propuesta de valor**: Reducir la variabilidad inter-observador y ahorrar tiempo en tareas repetitivas de conteo.
- **Diferenciadores**: Tecnología validada en LATAM, reportes automáticos, integración simple.

## TONO Y ESTILO
1. **Científico y Preciso**: No uses hipérboles ni promesas exageradas.
2. **Empático**: Entiende la carga de trabajo del patólogo.
3. **Latinoamericano**: Español neutro/rioplatense según contexto.
4. **Profesional**: "Estimado Dr./Dra." - Respetuoso pero no excesivamente formal.

## ESTRUCTURA RECOMENDADA DE EMAILS
1. **Saludo**: Formal, personalizado.
2. **Conexión**: Referencia específica a su rol, publicaciones, institución o trayectoria.
3. **Credencial breve**: Mencionar Digpatho y experiencia previa (1-2 líneas).
4. **El problema real**: Que resuene con SU especialidad.
5. **La propuesta**: Clara, sin ser "vendedor".
6. **Cierre**: Invitación concreta (reunión, demo, llamada).

## FORMATO DE RESPUESTA
Genera el email en el siguiente formato:

**Asunto:** [Línea de asunto concisa y atractiva]

**Cuerpo:**
[Contenido del email]

**Notas internas:** [Explica tu estrategia y por qué enfocaste el email así]`;

function buildSystemPromptWithProject(project, customContext = '') {
  const projectConfig = PROJECT_CONTEXTS[project] || PROJECT_CONTEXTS.breast_her2;

  let projectSection = `
## PROYECTO/OBJETIVO ACTUAL: ${projectConfig.name}

**Foco del email:** ${projectConfig.focus}
**Problema a resolver:** ${projectConfig.problem}
**Solución que ofrecemos:** ${projectConfig.solution}

${projectConfig.intro ? `**Introducción sugerida:** ${projectConfig.intro}` : ''}

${projectConfig.restrictions}`;

  if (project === 'custom' && customContext) {
    projectSection += `

## OBJETIVO PERSONALIZADO DEL USUARIO:
${customContext}`;
  }

  return `${EMAIL_AGENT_SYSTEM_PROMPT}

${projectSection}`;
}

// ---------------------------------------------------------------------------
// User prompt builder (mirrored from src/config/aiPrompts.js)
// ---------------------------------------------------------------------------
const ROLE_MAP = {
  'pathologist': 'Patólogo/a',
  'researcher': 'Investigador/a',
  'hospital_director': 'Director/a de Hospital',
  'lab_manager': 'Gerente de Laboratorio',
  'procurement': 'Compras/Adquisiciones',
  'pharma_executive': 'Ejecutivo Pharma',
  'medical_affairs': 'Medical Affairs',
  'other': 'Otro'
};

function buildEmailGenerationPrompt(contact, lastInteractions, emailType, project) {
  const interactionsText = lastInteractions.length > 0
    ? lastInteractions.map(i => `- ${i.type} (${new Date(i.occurred_at).toLocaleDateString()}): ${i.subject || (i.content ? i.content.substring(0, 100) : '') || 'Sin detalle'}`).join('\n')
    : 'No hay interacciones previas registradas.';

  const projectConfig = PROJECT_CONTEXTS[project] || PROJECT_CONTEXTS.breast_her2;

  let audienceNote = '';
  if (project === 'breast_her2') {
    const ctx = (contact.ai_context || '').toLowerCase();
    const title = (contact.job_title || '').toLowerCase();
    const isBreastExpert = ctx.includes('mama') || title.includes('mama') || ['pathologist', 'lab_manager'].includes(contact.role);
    if (!isBreastExpert) {
      audienceNote = `\nNOTA: Este contacto puede no ser especialista en mama. Considera preguntar quién maneja estos casos en su institución.`;
    }
  } else if (project === 'prostate_gleason') {
    const ctx = (contact.ai_context || '').toLowerCase();
    const isProstateExpert = ctx.includes('próstata') || ctx.includes('gleason') || ctx.includes('urolog') || (contact.job_title || '').toLowerCase().includes('urolog');
    if (isProstateExpert) {
      audienceNote = `\nEXCELENTE: Este contacto parece tener experiencia en uropatología. Enfócate en el proyecto Gleason.`;
    }
  }

  return `## CONTEXTO DEL CONTACTO

**Nombre:** ${contact.first_name} ${contact.last_name}
**Cargo:** ${contact.job_title || 'No especificado'}
**Institución:** ${contact.institution?.name || 'No especificada'}
**Rol en CRM:** ${ROLE_MAP[contact.role] || contact.role}
**Nivel de interés:** ${contact.interest_level}

**Contexto adicional (importante para personalizar):**
${contact.ai_context || 'No hay contexto adicional.'}
${audienceNote}

## HISTORIAL DE INTERACCIONES
${interactionsText}

## TAREA
Genera un email de tipo **${emailType}** enfocado en el proyecto: **${projectConfig.name}**.

Recuerda:
- Personalizar según el contexto del contacto
- Mantener coherencia con el proyecto seleccionado
- No inventar funcionalidades que no existen`;
}

// ---------------------------------------------------------------------------
// Tone & language helpers
// ---------------------------------------------------------------------------
const TONE_ADJUSTMENTS = {
  professional: `
AJUSTE DE TONO: PROFESIONAL
- Mantén un lenguaje formal y respetuoso.
- Enfócate en la eficiencia y resultados clínicos.
- Evita excesiva familiaridad.`,
  empathetic: `
AJUSTE DE TONO: EMPÁTICO
- Usa un lenguaje cálido y comprensivo.
- Muestra preocupación genuina por la carga de trabajo del patólogo.
- Prioriza construir rapport humano antes de hablar de negocios.`,
  direct: `
AJUSTE DE TONO: DIRECTO
- Ve directo al grano.
- Usa oraciones cortas y párrafos breves.
- Elimina introducciones largas o adornos innecesarios.`
};

function buildCombinedSystemPrompt(basePrompt, tone, language) {
  const languageInstructions = {
    es: 'IDIOMA: Escribe SIEMPRE en ESPAÑOL (neutro o rioplatense según contexto).',
    en: 'LANGUAGE: Write ALWAYS in ENGLISH.',
    pt: 'IDIOMA: Escreva SEMPRE em PORTUGUÊS.'
  };

  return `${basePrompt}

---
${languageInstructions[language] || languageInstructions.es}

${TONE_ADJUSTMENTS[tone] || TONE_ADJUSTMENTS.professional}

IMPORTANTE: Recuerda seguir estrictamente el formato de respuesta con **Asunto**, **Cuerpo** y **Notas internas**.`;
}

// ---------------------------------------------------------------------------
// Parse Claude's response
// ---------------------------------------------------------------------------
function parseEmailResponse(text) {
  const result = { subject: '', body: '', notes: '' };

  const subjectMatch = text.match(/\*{0,2}\s*Asunto\s*:?\s*\*{0,2}\s*:?\s*(.+?)(?=\n|$)/i);
  if (subjectMatch) result.subject = subjectMatch[1].trim();

  const bodyMatch = text.match(/\*{0,2}\s*Cuerpo\s*:?\s*\*{0,2}\s*:?\s*([\s\S]*?)(?=\*{0,2}\s*Notas internas|$)/i);
  if (bodyMatch) {
    result.body = bodyMatch[1].trim();
  } else {
    result.body = text.replace(/\*{0,2}\s*Asunto\s*:?\s*\*{0,2}\s*:?.*\n?/i, '').trim();
  }

  const notesMatch = text.match(/\*{0,2}\s*Notas internas\s*:?\s*\*{0,2}\s*:?\s*([\s\S]*?)$/i);
  if (notesMatch) result.notes = notesMatch[1].trim();

  return result;
}

// ---------------------------------------------------------------------------
// Call Anthropic API (with retry + exponential backoff)
// ---------------------------------------------------------------------------
const RETRY_DELAYS = [3000, 6000, 12000];

async function callAnthropic(apiKey, systemPrompt, userPrompt) {
  const requestBody = JSON.stringify({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
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
        const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
        return { text };
      }

      const errText = await response.text();
      const isRetryable = response.status === 429 || response.status === 529;

      if (isRetryable && attempt < RETRY_DELAYS.length) {
        const retryAfterHeader = response.headers.get('retry-after');
        const delay = retryAfterHeader
          ? Math.min(parseInt(retryAfterHeader, 10) * 1000, 30000)
          : RETRY_DELAYS[attempt];
        console.log(`Anthropic ${response.status} — retry ${attempt + 1}/${RETRY_DELAYS.length} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        lastError = { status: response.status, text: errText.slice(0, 300) };
        continue;
      }

      if (response.status === 429) return { error: 'rate_limit', apiError: errText.slice(0, 300) };
      if (response.status === 529) return { error: 'api_overloaded', apiError: errText.slice(0, 300) };
      return { error: `Anthropic API ${response.status}: ${errText.slice(0, 300)}` };
    } catch (err) {
      if (attempt < RETRY_DELAYS.length) {
        console.log(`Network error — retry ${attempt + 1}/${RETRY_DELAYS.length}`);
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
      return res.status(400).json({ error: 'ANTHROPIC_API_KEY not configured.' });
    }

    const { contactId, emailType = 'follow-up', config = {} } = req.body || {};
    if (!contactId) {
      return res.status(400).json({ error: 'contactId is required' });
    }

    const { tone = 'professional', language = 'es', project = 'breast_her2', customContext = '' } = config;

    const supabase = getSupabase();

    // 1. Fetch contact with institution
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*, institution:institutions(*)')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // 2. Fetch last interactions
    const { data: interactions } = await supabase
      .from('interactions')
      .select('*')
      .eq('contact_id', contactId)
      .order('occurred_at', { ascending: false })
      .limit(5);

    // 3. Build prompts
    const baseSystemPrompt = buildSystemPromptWithProject(project, customContext);
    const systemPrompt = buildCombinedSystemPrompt(baseSystemPrompt, tone, language);
    const userPrompt = buildEmailGenerationPrompt(contact, interactions || [], emailType, project);

    // 4. Call Claude
    const result = await callAnthropic(anthropicKey, systemPrompt, userPrompt);

    if (result.error) {
      if (result.error === 'rate_limit' || result.error === 'api_overloaded') {
        return res.status(429).json({
          error: result.error,
          message: 'Límite de API alcanzado. Intentá de nuevo en unos minutos.',
          apiError: result.apiError || null,
        });
      }
      return res.status(500).json({ error: result.error });
    }

    // 5. Parse the response
    const parsed = parseEmailResponse(result.text);

    // 6. Save draft to Supabase
    const { data: draft, error: draftError } = await supabase
      .from('email_drafts')
      .insert({
        contact_id: contactId,
        subject: parsed.subject,
        body: parsed.body,
        status: 'generated',
        generation_context: {
          email_type: emailType,
          tone,
          language,
          project,
          custom_context: customContext || null,
          contact_snapshot: {
            name: `${contact.first_name} ${contact.last_name}`,
            institution: contact.institution?.name
          }
        },
        ai_model: 'claude-sonnet-4-5-20250929'
      })
      .select()
      .single();

    if (draftError) console.error('Error saving draft:', draftError);

    return res.status(200).json({
      success: true,
      result: {
        id: draft?.id,
        subject: parsed.subject,
        body: parsed.body,
        notes: parsed.notes,
        contact: {
          id: contact.id,
          first_name: contact.first_name,
          last_name: contact.last_name,
          job_title: contact.job_title,
          institution: contact.institution,
        },
        config: { tone, language, emailType, project },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Email generation error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
