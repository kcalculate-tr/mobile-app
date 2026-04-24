import { createClient, SupabaseClient } from '@supabase/supabase-js'

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
  | {
      mode: 'by_campaign'
      campaign_id: string
    }
  | {
      mode: 'dispatch_scheduled'
    }

type SendContent = {
  templateKey: string | null
  title: string
  body: string
  deepLink: string | null
  category: Category
  data: Record<string, unknown> | null
}

type SendResults = {
  sent: number
  skipped: number
  failed: number
  details: Array<Record<string, unknown>>
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

// ── Shared send loop: preferences + idempotency + token fetch + Expo push ──
async function sendToUsers(
  supabase: SupabaseClient,
  userIds: string[],
  content: SendContent,
): Promise<SendResults> {
  const results: SendResults = { sent: 0, skipped: 0, failed: 0, details: [] }
  const categoryEnabledKey = `${content.category}_enabled`

  for (const userId of userIds) {
    const { data: prefs } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    const categoryEnabled = prefs
      ? Boolean((prefs as Record<string, unknown>)[categoryEnabledKey])
      : true

    if (!categoryEnabled) {
      await supabase.from('notification_sends').insert({
        user_id: userId,
        template_key: content.templateKey,
        category: content.category,
        title: content.title,
        body: content.body,
        deep_link: content.deepLink,
        data: content.data,
        status: 'skipped',
        error_message: `${content.category} disabled by user`,
      })
      results.skipped++
      continue
    }

    // Idempotency (yalnız template bazlı gönderimler için)
    if (content.templateKey) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('notification_sends')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('template_key', content.templateKey)
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
        template_key: content.templateKey,
        category: content.category,
        title: content.title,
        body: content.body,
        deep_link: content.deepLink,
        data: content.data,
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
          template_key: content.templateKey,
          category: content.category,
          title: content.title,
          body: content.body,
          deep_link: content.deepLink,
          data: content.data,
          status: 'queued',
        })
        .select('id')
        .single()

      const sendId = sendRow?.id

      try {
        const expoBody = {
          to: tok.expo_push_token,
          title: content.title,
          body: content.body,
          sound: 'default',
          data: {
            ...(content.data ?? {}),
            ...(content.deepLink ? { deep_link: content.deepLink } : {}),
            ...(sendId ? { send_id: sendId } : {}),
          },
          priority: content.category === 'transactional' ? 'high' : 'normal',
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
            await supabase.from('push_tokens').update({ is_active: false }).eq('id', tok.id)
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

  return results
}

// ── Main handler ────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  try {
    const input: SendInput = await req.json()

    // ── mode: dispatch_scheduled ─────────────────────────────────────────
    // pg_cron dispatcher çağırır. Her scheduled_at<=now() kampanya için
    // fire-and-forget by_campaign tetikler.
    if (input.mode === 'dispatch_scheduled') {
      const { data: due, error } = await supabase
        .from('notification_campaigns')
        .select('id')
        .eq('status', 'scheduled')
        .lte('scheduled_at', new Date().toISOString())

      if (error) return jsonResponse({ error: error.message }, 500)

      const ids = (due ?? []).map((c) => c.id)
      for (const id of ids) {
        // Fire-and-forget: her birini kendi invocation'ında çalıştır (timeout ayrışması)
        fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ mode: 'by_campaign', campaign_id: id }),
        }).catch((e) => console.error('[dispatch] fire-fail', id, e))
      }

      return jsonResponse({ dispatched: ids.length, campaign_ids: ids })
    }

    // ── mode: by_campaign ────────────────────────────────────────────────
    if (input.mode === 'by_campaign') {
      const { data: campaign, error: campErr } = await supabase
        .from('notification_campaigns')
        .select('*')
        .eq('id', input.campaign_id)
        .single()

      if (campErr || !campaign) {
        return jsonResponse({ error: `Campaign not found: ${input.campaign_id}` }, 404)
      }

      // Zaten işlendi / tamamlandı ise tekrar çalıştırma
      if (['sent', 'sending', 'cancelled'].includes(campaign.status)) {
        return jsonResponse({
          skipped: true,
          reason: `campaign already ${campaign.status}`,
          campaign_id: campaign.id,
        })
      }

      // Mark as sending
      await supabase
        .from('notification_campaigns')
        .update({ status: 'sending' })
        .eq('id', campaign.id)

      try {
        // Audience fetch via RPC
        const { data: audience, error: audErr } = await supabase.rpc(
          'get_campaign_audience',
          { p_target_type: campaign.target_type },
        )

        if (audErr) throw audErr

        const userIds = (audience ?? [])
          .map((r: { user_id: string }) => r.user_id)
          .filter(Boolean) as string[]

        const results = await sendToUsers(supabase, userIds, {
          templateKey: null,
          title: campaign.title,
          body: campaign.body,
          deepLink: campaign.deep_link ?? null,
          category: 'marketing',
          data: { campaign_id: campaign.id },
        })

        await supabase
          .from('notification_campaigns')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            target_count: userIds.length,
            sent_count: results.sent,
            failed_count: results.failed,
          })
          .eq('id', campaign.id)

        return jsonResponse({
          campaign_id: campaign.id,
          target_count: userIds.length,
          ...results,
        })
      } catch (e) {
        const msg = (e as Error)?.message ?? String(e)
        await supabase
          .from('notification_campaigns')
          .update({ status: 'failed' })
          .eq('id', campaign.id)
        return jsonResponse({ error: msg, campaign_id: campaign.id }, 500)
      }
    }

    // ── mode: by_template / by_template_single / by_content ──────────────
    let templateKey: string | null = null
    let title = ''
    let body = ''
    let deepLink: string | null = null
    let category: Category
    let userIds: string[] = []
    let extraData: Record<string, unknown> | null = null

    if (input.mode === 'by_template' || input.mode === 'by_template_single') {
      const { data: template, error } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('key', input.template_key)
        .eq('is_active', true)
        .single()

      if (error || !template) {
        return jsonResponse({ error: `Template not found: ${input.template_key}` }, 404)
      }

      templateKey = template.key
      title = renderTemplate(template.title_template, input.vars ?? {})
      body = renderTemplate(template.body_template, input.vars ?? {})
      deepLink = template.deep_link ?? null
      category = template.category as Category
      userIds = input.mode === 'by_template_single' ? [input.user_id] : input.user_ids
      extraData = input.data ?? null
    } else if (input.mode === 'by_content') {
      title = input.title
      body = input.body
      deepLink = input.deep_link ?? null
      category = input.category
      userIds = input.user_ids
      extraData = input.data ?? null
    } else {
      return jsonResponse({ error: `Unknown mode: ${(input as { mode: string }).mode}` }, 400)
    }

    const results = await sendToUsers(supabase, userIds, {
      templateKey,
      title,
      body,
      deepLink,
      category,
      data: extraData,
    })

    return jsonResponse(results)
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e)
    console.error('[send-notification] error:', msg)
    return jsonResponse({ error: msg }, 500)
  }
})
