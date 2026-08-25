// src/config/aiPrompts.js
// System Prompts para el Agente de Email de Digpatho IA

// Etiquetas del pipeline para los prompts. Se duplican en vez de importarse
// de constants.js porque api/generate-email.js —que arma el mismo prompt del
// lado del servidor— no puede importar desde src/.
const STAGE_LABELS = {
  new: 'Nuevo (sin contactar)',
  contacted: 'Contactado',
  qualified: 'Calificado (mostró interés)',
  customer: 'Cliente activo',
  lost: 'Perdido',
};

const PRIORITY_LABELS = {
  muy_alta: 'Muy alta',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
};

// ========================================
// PROYECTOS / MODELOS DISPONIBLES
// ========================================
export const PROJECT_OPTIONS = [
  {
    value: 'breast_her2',
    label: 'Mama - HER2/Ki67',
    icon: '🎀',
    description: 'Biomarcadores en cáncer de mama',
    isDefault: true
  },
  {
    value: 'prostate_gleason',
    label: 'Próstata - Gleason',
    icon: '🔬',
    description: 'Graduación automática Gleason/ISUP'
  },
  {
    value: 'clinical_validation',
    label: 'Validación Clínica',
    icon: '✅',
    description: 'Participar en validación de herramientas'
  },
  {
    value: 'academic_collaboration',
    label: 'Colaboración Académica',
    icon: '🎓',
    description: 'Investigación y publicaciones conjuntas'
  },
  {
    value: 'custom',
    label: 'Personalizado',
    icon: '✏️',
    description: 'Definir objetivo manualmente'
  }
];

// ========================================
// CONTEXTO POR PROYECTO
// ========================================
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

// ========================================
// SYSTEM PROMPT BASE
// ========================================
export const EMAIL_AGENT_SYSTEM_PROMPT = `Eres un asistente de comunicación comercial especializado para Digpatho IA, una startup de biotecnología argentina.

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

// ========================================
// FUNCIÓN PARA CONSTRUIR SYSTEM PROMPT CON PROYECTO
// ========================================
export const buildSystemPromptWithProject = (project, customContext = '') => {
  const projectConfig = PROJECT_CONTEXTS[project] || PROJECT_CONTEXTS.breast_her2;

  let projectSection = `
## 🎯 PROYECTO/OBJETIVO ACTUAL: ${projectConfig.name}

**Foco del email:** ${projectConfig.focus}
**Problema a resolver:** ${projectConfig.problem}
**Solución que ofrecemos:** ${projectConfig.solution}

${projectConfig.intro ? `**Introducción sugerida:** ${projectConfig.intro}` : ''}

${projectConfig.restrictions}`;

  // Si es proyecto custom, agregar el contexto personalizado
  if (project === 'custom' && customContext) {
    projectSection += `

## OBJETIVO PERSONALIZADO DEL USUARIO:
${customContext}`;
  }

  return `${EMAIL_AGENT_SYSTEM_PROMPT}

${projectSection}`;
};

// ========================================
// FUNCIÓN PARA CONSTRUIR USER PROMPT
// ========================================
export const buildEmailGenerationPrompt = (contact, lastInteractions, emailType = 'follow-up', project = 'breast_her2') => {
  const interactionsText = lastInteractions.length > 0
    ? lastInteractions.map(i => `- ${i.type} (${new Date(i.occurred_at).toLocaleDateString()}): ${i.subject || i.content?.substring(0, 100) || 'Sin detalle'}`).join('\n')
    : 'No hay interacciones previas registradas.';

  const projectConfig = PROJECT_CONTEXTS[project] || PROJECT_CONTEXTS.breast_her2;

  // Detectar si el contacto es relevante para el proyecto
  let audienceNote = '';
  if (project === 'breast_her2') {
    const isBreastExpert = contact.ai_context?.toLowerCase().includes('mama') ||
                          contact.job_title?.toLowerCase().includes('mama') ||
                          ['pathologist', 'lab_manager'].includes(contact.role);
    if (!isBreastExpert) {
      audienceNote = `\n⚠️ NOTA: Este contacto puede no ser especialista en mama. Considera preguntar quién maneja estos casos en su institución.`;
    }
  } else if (project === 'prostate_gleason') {
    const isProstateExpert = contact.ai_context?.toLowerCase().includes('próstata') ||
                            contact.ai_context?.toLowerCase().includes('gleason') ||
                            contact.ai_context?.toLowerCase().includes('urolog') ||
                            contact.job_title?.toLowerCase().includes('urolog');
    if (isProstateExpert) {
      audienceNote = `\n✅ EXCELENTE: Este contacto parece tener experiencia en uropatología. Enfócate en el proyecto Gleason.`;
    }
  }

  return `## CONTEXTO DEL CONTACTO

**Nombre:** ${contact.first_name} ${contact.last_name}
**Cargo:** ${contact.job_title || 'No especificado'}
**Institución:** ${contact.institution?.name || 'No especificada'}
**Rol en CRM:** ${formatRole(contact.role)}
**Etapa comercial:** ${STAGE_LABELS[contact.stage] || 'Nuevo'}
**Prioridad:** ${PRIORITY_LABELS[contact.priority] || 'Media'}${contact.specialty ? `\n**Especialidad:** ${contact.specialty}` : ''}${contact.is_kol ? '\n**Es KOL (líder de opinión)**' : ''}

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
};

// ========================================
// HELPERS
// ========================================
const formatRole = (role) => {
  const roles = {
    'pathologist': 'Patólogo/a',
    'researcher': 'Investigador/a',
    'hospital_director': 'Director/a de Hospital',
    'lab_manager': 'Gerente de Laboratorio',
    'procurement': 'Compras/Adquisiciones',
    'pharma_executive': 'Ejecutivo Pharma',
    'medical_affairs': 'Medical Affairs',
    'other': 'Otro'
  };
  return roles[role] || role;
};

export default {
  EMAIL_AGENT_SYSTEM_PROMPT,
  PROJECT_OPTIONS,
  buildSystemPromptWithProject,
  buildEmailGenerationPrompt
};