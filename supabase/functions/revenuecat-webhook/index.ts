// revenuecat-webhook — RevenueCat abonelik olayları → public.user_entitlements (G22-S1 md.3).
// YALNIZ DOSYA: deploy edilmez, anahtar koda yazılmaz.
//
// Kimlik: RevenueCat Dashboard › Integrations › Webhooks › "Authorization header value"
// alanına girilen değer = REVENUECAT_WEBHOOK_SECRET (Supabase secret). Uyuşmazsa 401.
// JWT doğrulaması YOK (çağıran RevenueCat) → deploy: `--no-verify-jwt`.
//
// Gövde: { api_version, event: { type, app_user_id, product_id, entitlement_ids,
//   expiration_at_ms, period_type, store, environment, id, event_timestamp_ms, … } }
// Eşleme saf modülde (mapping.ts). Yanıt her zaman 200 (yok sayılan olay dahil) —
// RevenueCat 2xx dışını yeniden dener; yalnız yetki 401 ve sunucu hatası 500 döner.
import { createClient } from '@supabase/supabase-js'
import { authorized, mapRevenueCatEvent, resolveUserId, type EntitlementRow, type RevenueCatEvent } from './mapping.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET') ?? ''

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  if (!WEBHOOK_SECRET) return json({ error: 'config' }, 500)
  if (!authorized(req.headers.get('Authorization'), WEBHOOK_SECRET)) return json({ error: 'unauthorized' }, 401)

  let body: { event?: RevenueCatEvent }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  const ev = body?.event
  if (!ev || typeof ev !== 'object') return json({ error: 'bad_request' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const userId = resolveUserId(ev)

  let current: EntitlementRow | null = null
  if (userId) {
    const { data, error } = await admin
      .from('user_entitlements')
      .select('tier, product_id, expires_at, trial, store, will_renew, last_event_id, last_event_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) return json({ error: 'server' }, 500)
    current = (data as EntitlementRow | null) ?? null
  }

  const res = mapRevenueCatEvent(ev, current)
  // Kişisel veri günlüğe yazılmaz: yalnız olay tipi + sonuç + ortam.
  console.log('[revenuecat-webhook]', { type: ev.type, env: ev.environment, result: res.action, reason: res.action === 'ignore' ? res.reason : undefined })
  if (res.action === 'ignore') return json({ ok: true, ignored: res.reason })

  const { error: upErr } = await admin
    .from('user_entitlements')
    .upsert({ user_id: res.userId, ...res.row, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (upErr) {
    // Kullanıcı silinmişse (FK) yeniden deneme anlamsız → 200 + not.
    if (upErr.code === '23503') return json({ ok: true, ignored: 'unknown_user' })
    return json({ error: 'server' }, 500)
  }
  return json({ ok: true, tier: res.row.tier })
})
