-- _diagnostico_consolidado.sql
-- NO es una migración: no modifica nada.
--
-- Devuelve TODO el diagnóstico en una sola tabla (bloque | metrica | valor),
-- así se corre de una y se exporta un único CSV.
-- Reemplaza a _diagnostico_previo.sql, que había que correr bloque por bloque.
--
-- Ejecutar en Supabase SQL Editor y exportar el resultado.

SELECT bloque, metrica, valor
FROM (

  -- ============================================================
  -- 1. Esquema real de las tablas clave
  -- ============================================================
  -- Ninguna de estas tablas se crea en migrations/, así que el esquema sólo
  -- vive en la base. Esto lo settlea de una vez.
  SELECT 1 AS orden, '1_columnas' AS bloque,
         (table_name || '.' || column_name) AS metrica,
         (data_type
           || CASE WHEN udt_name NOT IN ('text','int4','bool','uuid','timestamptz','jsonb','varchar')
                   THEN ' [' || udt_name || ']' ELSE '' END
           || CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END) AS valor
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name IN ('contacts','interactions','user_profiles','notifications')

  UNION ALL
  -- ============================================================
  -- 2. Tipos ENUM y sus valores
  -- ============================================================
  -- Importa para la 009: un enum se amplía con ALTER TYPE y no se puede
  -- reducir. Los campos nuevos van a ser TEXT + CHECK justamente por esto.
  SELECT 2, '2_enums',
         t.typname::text,
         string_agg(e.enumlabel, ' | ' ORDER BY e.enumsortorder)
  FROM pg_type t
  JOIN pg_enum e ON e.enumtypid = t.oid
  GROUP BY t.typname

  UNION ALL
  -- ============================================================
  -- 3. Triggers sobre contacts / interactions
  -- ============================================================
  -- El código LEE last_interaction_at e interaction_count pero NO los escribe
  -- nunca. Si acá no aparece ningún trigger, esos campos están congelados y
  -- el panel de "Seguimientos pendientes" viene roto desde siempre.
  SELECT 3, '3_triggers', tgname::text, tgrelid::regclass::text
  FROM pg_trigger
  WHERE NOT tgisinternal
    AND tgrelid::regclass::text IN ('interactions','contacts')

  UNION ALL
  SELECT 3, '3_triggers', '(ninguno)', 'NO HAY TRIGGERS -> hay que crearlo en la 009'
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE NOT tgisinternal AND tgrelid::regclass::text IN ('interactions','contacts')
  )

  UNION ALL
  -- ============================================================
  -- 4. Estado de los campos denormalizados
  -- ============================================================
  SELECT 4, '4_denormalizado', 'contactos_totales', count(*)::text FROM contacts
  UNION ALL
  SELECT 4, '4_denormalizado', 'sin_last_interaction_at',
         count(*) FILTER (WHERE last_interaction_at IS NULL)::text FROM contacts
  UNION ALL
  SELECT 4, '4_denormalizado', 'last_interaction_at_mas_reciente',
         COALESCE(max(last_interaction_at)::text, '(ninguna)') FROM contacts
  UNION ALL
  SELECT 4, '4_denormalizado', 'contactos_con_interaccion_real',
         count(DISTINCT contact_id)::text FROM interactions
  UNION ALL
  SELECT 4, '4_denormalizado', 'interacciones_totales', count(*)::text FROM interactions
  UNION ALL
  SELECT 4, '4_denormalizado', 'interaccion_real_mas_reciente',
         COALESCE(max(occurred_at)::text, '(ninguna)') FROM interactions

  UNION ALL
  -- ============================================================
  -- 5. Diagnóstico real de la base (sobre la base viva, no el Excel)
  -- ============================================================
  SELECT 5, '5_base', 'total', count(*)::text FROM contacts
  UNION ALL
  SELECT 5, '5_base', 'sin_ningun_canal',
         count(*) FILTER (WHERE email IS NULL AND phone IS NULL AND linkedin_url IS NULL)::text
  FROM contacts
  UNION ALL
  SELECT 5, '5_base', 'sin_email', count(*) FILTER (WHERE email IS NULL)::text FROM contacts
  UNION ALL
  SELECT 5, '5_base', 'sin_telefono', count(*) FILTER (WHERE phone IS NULL)::text FROM contacts
  UNION ALL
  SELECT 5, '5_base', 'sin_institucion', count(*) FILTER (WHERE institution_id IS NULL)::text FROM contacts
  UNION ALL
  SELECT 5, '5_base', 'sin_notas',
         count(*) FILTER (WHERE ai_context IS NULL OR ai_context = '')::text FROM contacts

  UNION ALL
  -- ============================================================
  -- 6. Distribución de interest_level (el eje que se jubila)
  -- ============================================================
  -- interest_level es un ENUM: hay que castear a text para el COALESCE.
  SELECT 6, '6_interest_level',
         COALESCE(interest_level::text, '(null)'),
         count(*)::text || ' (' || round(100.0 * count(*) / sum(count(*)) OVER (), 1)::text || '%)'
  FROM contacts
  GROUP BY interest_level

  UNION ALL
  -- ============================================================
  -- 7. Prioridades recuperables desde las notas (para la 010)
  -- ============================================================
  -- El manual dice que ya están escritas a mano dentro de ai_context.
  -- Si estos números son bajos, el backfill no vale la pena.
  SELECT 7, '7_prioridades_en_notas', 'muy_alta',
         count(*) FILTER (WHERE ai_context ~* 'MUY[ _-]?ALTA')::text FROM contacts
  UNION ALL
  SELECT 7, '7_prioridades_en_notas', 'alta_sin_muy',
         count(*) FILTER (WHERE ai_context ~* 'ALTA' AND ai_context !~* 'MUY[ _-]?ALTA')::text FROM contacts
  UNION ALL
  SELECT 7, '7_prioridades_en_notas', 'media',
         count(*) FILTER (WHERE ai_context ~* 'MEDIA')::text FROM contacts
  UNION ALL
  SELECT 7, '7_prioridades_en_notas', 'baja',
         count(*) FILTER (WHERE ai_context ~* 'BAJA')::text FROM contacts
  UNION ALL
  SELECT 7, '7_prioridades_en_notas', 'con_notas_pero_sin_prioridad',
         count(*) FILTER (WHERE ai_context IS NOT NULL AND ai_context <> ''
                            AND ai_context !~* '(MUY[ _-]?ALTA|ALTA|MEDIA|BAJA)')::text FROM contacts

  UNION ALL
  -- ============================================================
  -- 8. RLS: ¿se leen datos de otros usuarios?
  -- ============================================================
  -- Necesario para el filtro por cartera y el historial de equipo.
  SELECT 8, '8_rls', tablename::text,
         CASE WHEN rowsecurity THEN 'RLS ACTIVO' ELSE 'RLS desactivado' END
  FROM pg_tables
  WHERE tablename IN ('contacts','interactions','user_profiles','notifications',
                      'bulk_email_queue','bulk_email_campaigns')

  UNION ALL
  SELECT 8, '8_rls_policies', (tablename || ' [' || cmd || ']'),
         (policyname || ' -> ' || COALESCE(qual, 'sin condicion'))
  FROM pg_policies
  WHERE tablename IN ('contacts','interactions','user_profiles','notifications')

  UNION ALL
  -- ============================================================
  -- 9. Fechas: ¿timestamptz o timestamp sin zona?
  -- ============================================================
  -- Si alguna es 'timestamp without time zone', las horas salen corridas:
  -- el código escribe UTC con .toISOString() y el navegador lo lee como local.
  SELECT 9, '9_fechas', (table_name || '.' || column_name), data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND data_type LIKE 'timestamp%'
    AND table_name IN ('contacts','interactions','bulk_email_queue','bulk_email_campaigns')

) AS diagnostico
ORDER BY orden, bloque, metrica;
