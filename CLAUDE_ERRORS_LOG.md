# Registro de Errores de Claude - CRM Digpatho

> Este archivo documenta errores encontrados y patrones a evitar para que Claude
> no los repita en futuras sesiones. Leer antes de hacer cambios en el proyecto.

---

## Error #1: Columnas inexistentes en `select()` de Supabase (2026-02-23)

**Archivo afectado:** `src/components/growth/DraftReviewModal.jsx`

**Descripcion del bug:** Al aprobar un borrador y mostrar el paso de seleccion de campana,
el listado de campanas existentes no aparecia. El dropdown quedaba vacio.

**Causa raiz:** La funcion `loadCampaigns()` usaba un `select()` explicito con columnas
que posiblemente no existen en la tabla:
```javascript
// MAL - puede fallar si sent_count no existe como columna real
.select('id, name, status, total_emails, sent_count')
```

PostgREST (Supabase) retorna un error HTTP cuando se solicita una columna inexistente,
y el codigo tragaba el error silenciosamente:
```javascript
// El error se perdia completamente - campaigns quedaba como []
if (!error) {
  setCampaigns(data || []);
}
```

**Evidencia adicional:**
- En `BulkEmailSender.jsx`, al enviar emails nunca se actualiza `sent_count` en la tabla
  `bulk_email_campaigns`. Solo se actualizan `status`, `started_at`, `completed_at`.
- En `BulkEmail.jsx`, se usa `select('*')` que funciona correctamente.
- No hay migracion SQL que cree `sent_count` como columna.

**Fix aplicado:**
1. Cambiar `select('id, name, status, total_emails, sent_count')` a `select('*')`
2. Agregar `console.error` para loguear errores en vez de tragarlos
3. Usar fallback `|| 0` al mostrar `sent_count` en el dropdown

**Leccion aprendida:**
- SIEMPRE usar `select('*')` cuando no se tiene certeza de que columnas existen en la tabla,
  o al menos verificar el schema de la base de datos antes de hacer selects explicitos.
- NUNCA tragar errores silenciosamente. Siempre logear con `console.error`.
- Verificar consistencia entre como se escriben y leen los datos (si nadie escribe `sent_count`,
  probablemente no existe o siempre es null).

---

## Error #2: Filtro de status excluia campanas completadas (2026-02-23)

**Archivo afectado:** `src/components/growth/DraftReviewModal.jsx`

**Descripcion del bug:** Aun despues de arreglar el `select()`, el dropdown de campanas
seguia vacio. El usuario tenia campanas, pero todas con status `completed`.

**Causa raiz:** La query filtraba solo campanas con status `draft`, `ready` o `paused`:
```javascript
// MAL - excluye 'completed', 'sending', 'failed'
.in('status', ['draft', 'ready', 'paused'])
```

En la pagina de Envio Masivo (`BulkEmail.jsx`), la query NO tiene filtro de status
y muestra todas las campanas. El DraftReviewModal deberia hacer lo mismo.

**Fix aplicado:** Eliminar el filtro `.in('status', [...])` para traer todas las campanas,
igual que hace `BulkEmail.jsx`.

**Error de Claude en el diagnostico anterior:** En el Error #1, diagnostique que el
problema era el `select()` con columnas inexistentes. Esto PUEDE haber sido un problema
adicional, pero la causa visible del bug era el filtro de status. Deberia haber verificado
los datos reales (viendo los screenshots o preguntando que status tenian las campanas)
antes de concluir el diagnostico.

**Leccion aprendida:**
- ANTES de aplicar un fix, verificar que resuelve el problema real. No asumir la causa
  sin evidencia directa.
- Comparar siempre con el componente que SI funciona (en este caso `BulkEmail.jsx`)
  y replicar exactamente su comportamiento.
- Cuando se corrige un bug, verificar trazando el flujo completo paso a paso,
  no solo la linea que se cambio.
- Si hay screenshots disponibles, MIRARLOS primero para entender el estado real de los datos.

---

## Patrones generales a evitar

### 1. Selects explicitos sin verificar el schema
```javascript
// PELIGROSO: si alguna columna no existe, toda la query falla
.select('col1, col2, col3')

// SEGURO: trae todo lo que exista
.select('*')
```

### 2. Errores silenciosos en queries de Supabase
```javascript
// MAL: el error se pierde
if (!error) { setData(data); }

// BIEN: el error se loguea y se muestra al usuario
if (error) {
  console.error('Error en query:', error);
  setErrorMsg('Descripcion amigable del error');
} else {
  setData(data || []);
}
```

### 3. Asumir que un campo existe porque el frontend lo lee
Solo porque `BulkEmail.jsx` accede a `campaign.sent_count` no significa que la columna exista.
Con `select('*')`, acceder a una propiedad inexistente en JS da `undefined`, no un error.
Pero con `select('col')`, pedir una columna inexistente a PostgREST SI da error.

### 4. Filtros restrictivos que excluyen datos validos
Cuando un componente debe listar datos que el usuario espera ver, comparar con el
componente que SI funciona. Si `BulkEmail.jsx` muestra todas las campanas sin filtro,
el dropdown de DraftReviewModal no deberia filtrar por status.
```javascript
// MAL: asume que solo importan ciertos estados
.in('status', ['draft', 'ready', 'paused'])

// BIEN: muestra todo como lo hace la pagina principal
// (sin filtro de status)
```

### 5. Diagnosticar sin verificar - el "fix-and-pray"
Antes de commitear un fix, SIEMPRE trazar el flujo completo:
1. Que datos existen en la DB? (mirar screenshots, preguntar al usuario)
2. Que query se ejecuta? (leer la query exacta)
3. Que devuelve la query? (simular con los datos reales)
4. Que muestra el UI con esos datos? (leer el render)
5. Coincide con lo que el usuario espera? (comparar con la pagina que funciona)

---

*Ultima actualizacion: 2026-02-23*
