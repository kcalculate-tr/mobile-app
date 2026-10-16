import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') ?? null

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
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

// Token'in role claim'i service_role mu?
//
// verify_jwt = true oldugu icin Supabase imzayi BU FONKSIYON CALISMADAN ONCE
// dogruluyor; dolayisiyla payload'daki role claim'ine guvenebiliriz. Imzayi
// burada tekrar dogrulamiyoruz, zaten dogrulanmis bir token'in iddiasini
// okuyoruz.
//
// 16.10.2026 — NEDEN GEREKLI: eski kapi token'i env'deki
// SUPABASE_SERVICE_ROLE_KEY ile string olarak karsilastiriyordu. Vault'taki
// legacy service role JWT'si ile env'deki deger ayni olmadigi an (anahtar
// rotasyonu ya da yeni format secret key) TUM ic cagrilar 401 oluyor.
// 07.10.2026'dan 16.10.2026'ya kadar tek bir push gitmedi; sebebi buydu:
// siparis durumu bildirimleri, davranissal push'lar ve kampanyalar dahil.
function serviceRoleTokenMu(jwt: string): boolean {
  const parcalar = jwt.split('.')
  if (parcalar.length !== 3) return false
  try {
    const govde = parcalar[1].replace(/-/g, '+').replace(/_/g, '/')
    const dolgu = govde + '='.repeat((4 - (govde.length % 4)) % 4)
    const payload = JSON.parse(atob(dolgu)) as { role?: string }
    return payload?.role === 'service_role'
  } catch {
    return false
  }
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

  // ── Yetki kapisi ──────────────────────────────────────────────────────
  // 08.10.2026: burada HICBIR kontrol yoktu ve verify_jwt = false idi.
  // URL'i bilen herkes tum kullanicilara istedigi basligi, metni ve
  // deep-link'i push'layabiliyordu.
  //
  // Iki mesru cagiran var:
  //   1. Ic cagrilar — pg_cron (push-campaign-dispatcher), DB trigger'lari
  //      (notify_order_status_change, trigger_behavioral_push) ve bu
  //      fonksiyonun kendi dispatch_scheduled -> by_campaign cagrisi.
  //      Hepsi service_role anahtarini Bearer olarak gonderiyor
  //      (cron/trigger'lar vault'tan, ic cagri env'den).
  //   2. Boss paneli — giris yapmis yoneticinin JWT'si (functions.invoke).
  //      admin_allowlist'te olmasi sart.
  // Mobil uygulama bu fonksiyonu hic cagirmiyor (grep: 0 sonuc).
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  // Env ile birebir esitlik HIZLI YOL olarak kaliyor (JWT olmayan yeni format
  // secret key'i de kapsar); asil olcut role claim'i.
  const icCagri =
    (SERVICE_ROLE_KEY.length > 0 && token === SERVICE_ROLE_KEY) ||
    serviceRoleTokenMu(token)

  if (!icCagri) {
    if (!token) return jsonResponse({ error: 'Oturum dogrulanamadi' }, 401)

    const authedClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
    const { data: { user }, error: authError } = await authedClient.auth.getUser()
    if (authError || !user) return jsonResponse({ error: 'Oturum dogrulanamadi' }, 401)

    // admin_allowlist teyidi (user_id, fallback email) — _shared/paynkolay-cards.ts
    // icindeki isAllowlistedAdmin ile AYNI desen. O modul odeme tarafina ait
    // oldugu icin buraya import etmiyoruz; dort satir yerinde duruyor.
    const byId = await supabase
      .from('admin_allowlist').select('id').eq('user_id', user.id).maybeSingle()
    let yetkili = Boolean(byId.data)
    if (!yetkili && user.email) {
      const byEmail = await supabase
        .from('admin_allowlist').select('id').eq('email', user.email).maybeSingle()
      yetkili = Boolean(byEmail.data)
    }
    if (!yetkili) return jsonResponse({ error: 'Yetkin yok — yonetici izni gerekli' }, 403)
  }

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
