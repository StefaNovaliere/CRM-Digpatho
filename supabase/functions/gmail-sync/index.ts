// supabase/functions/gmail-sync/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// SECURITY: Restrict CORS to your domain. Set ALLOWED_ORIGINS in Supabase secrets.
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '*').split(',').map((s: string) => s.trim());
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigins[0] || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Iniciar Supabase Admin (Service Role) para saltarse las restricciones RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Obtener usuarios con token de Google
    const { data: users, error: usersError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, google_refresh_token')
      .not('google_refresh_token', 'is', null)

    if (usersError) throw usersError

    console.log(`Procesando ${users.length} usuarios...`)

    for (const user of users) {
      if (!user.google_refresh_token) continue

      // 3. Obtener NUEVO Access Token usando el Refresh Token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
          refresh_token: user.google_refresh_token,
          grant_type: 'refresh_token',
        }),
      })

      const tokenData = await tokenResponse.json()
      if (!tokenData.access_token) {
        console.error(`Error refrescando token para usuario ${user.id}`, tokenData)
        continue
      }
      const accessToken = tokenData.access_token

      // 4. Buscar hilos activos en la DB para este usuario
      // (Buscamos interacciones creadas por este usuario que tengan thread_id)
      const { data: threads } = await supabaseAdmin
        .from('interactions')
        .select('thread_id, contact_id')
        .eq('created_by', user.id)
        .not('thread_id', 'is', null)
        // Optimización: Podríamos limitar a hilos de los últimos 30 días

      if (!threads || threads.length === 0) continue

      // Filtrar únicos
      const uniqueThreads = [...new Map(threads.map(item => [item['thread_id'], item])).values()];

      console.log(`Usuario ${user.id}: Revisando ${uniqueThreads.length} hilos...`)

      // 5. Consultar Gmail
      for (const thread of uniqueThreads) {
        const gmailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${thread.thread_id}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )

        if (!gmailResponse.ok) continue
        const threadData = await gmailResponse.json()

        if (threadData.messages) {
          for (const msg of threadData.messages) {
            // Verificar si ya existe en DB
            const { data: existing } = await supabaseAdmin
              .from('interactions')
              .select('id')
              .eq('gmail_id', msg.id)
              .maybeSingle()

            if (!existing) {
              // ES NUEVO!
              const isInbound = !msg.labelIds.includes('SENT')

              if (isInbound) {
                console.log(`Nuevo mensaje encontrado en hilo ${thread.thread_id}`)

                // Parsear datos
                const snippet = msg.snippet
                const dateHeader = msg.payload.headers.find((h: any) => h.name === 'Date')
                const msgDate = dateHeader ? new Date(dateHeader.value) : new Date()

                // Obtener nombre del contacto para la notificación
                const { data: contact } = await supabaseAdmin
                    .from('contacts').select('first_name, last_name').eq('id', thread.contact_id).single()
                const contactName = contact ? `${contact.first_name} ${contact.last_name}` : 'Alguien'

                // A) Insertar Interacción
                const { error: insertError } = await supabaseAdmin.from('interactions').insert({
                  contact_id: thread.contact_id,
                  type: 'email_reply',
                  subject: 'Respuesta recibida (Auto-Sync)',
                  content: snippet,
                  direction: 'inbound',
                  occurred_at: msgDate.toISOString(),
                  created_by: user.id,
                  thread_id: thread.thread_id,
                  gmail_id: msg.id
                })

                // B) Insertar Notificación
                if (!insertError) {
                  await supabaseAdmin.from('notifications').insert({
                    user_id: user.id,
                    type: 'email_reply',
                    title: `Respuesta de ${contactName}`,
                    message: snippet ? snippet.substring(0, 80) + '...' : 'Nuevo correo recibido',
                    link: `/contacts/${thread.contact_id}`,
                    is_read: false
                  })
                }
              }
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})