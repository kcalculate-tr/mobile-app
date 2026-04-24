import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') ?? null

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Category = 'transactional' | 'marketing' | 'reminder' | 'behavioral'

type SendInput =
  | {
      mode: 'by_template'
      user_ids: string[]
      template_key: string
      vars?: Record<string, string>
      data?: Record<string, unknown>
    }
  | {
      mode: 'by_template_single'
      user_id: string
      template_key: string
      vars?: Record<string, string>
      data?: Record<string, unknown>
    }
  | {
      mode: 'by_content'
      user_ids: string[]
      title: string
      body: string
      deep_link?: string
      category: Category
      data?: Record<string, unknown>
    }

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  try {
    const input: SendInput = await req.json()

    let templateKey: string | null = null
    let title = ''
    let body = ''
    let deepLink: string | undefined
    let category: Category
    let userIds: string[] = []

    if (input.mode === 'by_template' || input.mode === 'by_template_single') {
      const { data: template, error } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('key', input.template_key)
        .eq('is_active', true)
        .single()

      if (error || !template) {
        return new Response(
          JSON.stringify({ error: `Template not found: ${input.template_key}` }),
          { status: 404, headers: { ...corsHeaders, 'content-type': 'application/json' } }
        )
      }

      templateKey = template.key
      title = renderTemplate(template.title_template, input.vars ?? {})
      body = renderTemplate(template.body_template, input.vars ?? {})
      deepLink = template.deep_link ?? undefined
      category = template.category as Category
      userIds = input.mode === 'by_template_single' ? [input.user_id] : input.user_ids
    } else {
      title = input.title
      body = input.body
      deepLink = input.deep_link
      category = input.category
      userIds = input.user_ids
    }

    const results = {
      sent: 0,
      skipped: 0,
      failed: 0,
      details: [] as Array<Record<string, unknown>>,
    }

    const categoryEnabledKey = `${category}_enabled`

    for (const userId of userIds) {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single()

      const categoryEnabled = prefs ? Boolean((prefs as Record<string, unknown>)[categoryEnabledKey]) : true

      if (!categoryEnabled) {
        await supabase.from('notification_sends').insert({
          user_id: userId,
          template_key: templateKey,
          category,
          title,
          body,
          deep_link: deepLink ?? null,
          data: input.data ?? null,
          status: 'skipped',
          error_message: `${category} disabled by user`,
        })
        results.skipped++
        continue
      }

      if (templateKey) {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
        const { count } = await supabase
          .from('notification_sends')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('template_key', templateKey)
          .in('status', ['sent', 'delivered'])
          .gte('created_at', fiveMinAgo)

        if ((count ?? 0) > 0) {
          results.skipped++
          continue
        }
      }

      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('id, expo_push_token')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (!tokens || tokens.length === 0) {
        await supabase.from('notification_sends').insert({
          user_id: userId,
          template_key: templateKey,
          category,
          title,
          body,
          deep_link: deepLink ?? null,
          data: input.data ?? null,
          status: 'skipped',
          error_message: 'no active tokens',
        })
        results.skipped++
        continue
      }

      for (const tok of tokens) {
        const { data: sendRow } = await supabase
          .from('notification_sends')
          .insert({
            user_id: userId,
            template_key: templateKey,
            category,
            title,
            body,
            deep_link: deepLink ?? null,
            data: input.data ?? null,
            status: 'queued',
          })
          .select('id')
          .single()

        const sendId = sendRow?.id

        try {
          const expoBody = {
            to: tok.expo_push_token,
            title,
            body,
            sound: 'default',
            data: {
              ...(input.data ?? {}),
              ...(deepLink ? { deep_link: deepLink } : {}),
              ...(sendId ? { send_id: sendId } : {}),
            },
            priority: category === 'transactional' ? 'high' : 'normal',
          }

          const headers: Record<string, string> = {
            'content-type': 'application/json',
            accept: 'application/json',
            'accept-encoding': 'gzip, deflate',
          }
          if (EXPO_ACCESS_TOKEN) {
            headers['Authorization'] = `Bearer ${EXPO_ACCESS_TOKEN}`
          }

          const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers,
            body: JSON.stringify(expoBody),
          })

          const expoData = await expoRes.json()
          const ticket = Array.isArray(expoData?.data) ? expoData.data[0] : expoData?.data

          if (ticket?.status === 'ok') {
            await supabase
              .from('notification_sends')
              .update({ status: 'sent', sent_at: new Date().toISOString() })
              .eq('id', sendId)
            results.sent++
          } else {
            const err =
              ticket?.message ??
              expoData?.errors?.[0]?.message ??
              'Unknown Expo error'

            await supabase
              .from('notification_sends')
              .update({
                status: 'failed',
                error_message: err,
                sent_at: new Date().toISOString(),
              })
              .eq('id', sendId)

            if (ticket?.details?.error === 'DeviceNotRegistered') {
              await supabase
                .from('push_tokens')
                .update({ is_active: false })
                .eq('id', tok.id)
            }

            results.failed++
            results.details.push({ user_id: userId, error: err })
          }
        } catch (e) {
          const msg = (e as Error)?.message ?? String(e)
          await supabase
            .from('notification_sends')
            .update({
              status: 'failed',
              error_message: msg,
              sent_at: new Date().toISOString(),
            })
            .eq('id', sendId)
          results.failed++
          results.details.push({ user_id: userId, error: msg })
        }
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e)
    console.error('[send-notification] error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }
})
