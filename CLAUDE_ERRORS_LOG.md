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

---

*Ultima actualizacion: 2026-02-23*
