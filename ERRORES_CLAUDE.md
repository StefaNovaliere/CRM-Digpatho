# Registro de Errores de Claude

Este documento registra los errores cometidos por Claude durante el desarrollo, principalmente por falta de precaucion.
El objetivo es revisar este archivo antes de cada tarea nueva para evitar repetir los mismos errores.

---

## Error #1 — Filtro de status demasiado restrictivo en listado de campanas

**Fecha:** 2026-02-22
**Archivo:** `src/components/growth/DraftReviewModal.jsx`
**Descripcion del error:**
Al implementar el selector de campanas en el modal de aprobacion de borradores, se agrego un filtro `.in('status', ['draft', 'ready', 'paused'])` en la query de Supabase. Esto hacia que solo se mostraran campanas con esos 3 estados, cuando en realidad deberian mostrarse TODAS las campanas existentes (igual que en la pagina de Envio Masivo).

**Causa raiz:**
Falta de verificacion cruzada: no se comparo la query del modal con la query de la pagina principal (`BulkEmail.jsx`) que carga todas las campanas sin filtro de status. Se asumio incorrectamente que solo las campanas en ciertos estados eran relevantes.

**Leccion aprendida:**
- Antes de filtrar datos en un componente, verificar como se cargan esos mismos datos en las otras vistas de la aplicacion.
- Si el usuario dice "deberian aparecer todas", significa SIN filtros restrictivos.
- Siempre comparar queries entre componentes que acceden a la misma tabla para asegurar consistencia.

**Fix aplicado:**
Se removio el filtro `.in('status', [...])` de la funcion `loadCampaigns` en `DraftReviewModal.jsx`, y se agrego el label de status en el dropdown para que el usuario vea el estado de cada campana.

---

## Checklist de precaucion para futuras tareas

- [ ] Leer TODO el codigo relevante antes de hacer cambios
- [ ] Comparar queries/filtros entre componentes que acceden a los mismos datos
- [ ] No asumir que ciertos filtros son necesarios sin validar con el usuario
- [ ] Verificar que las vistas sean consistentes entre si (misma data = mismos resultados)
- [ ] Probar mentalmente el flujo completo del usuario antes de dar por terminado
