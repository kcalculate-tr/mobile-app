// revenuecat-webhook — RevenueCat abonelik olayları → public.user_entitlements (G22-S1 md.3).
// YALNIZ DOSYA: deploy edilmez, anahtar koda yazılmaz.
//
// Kimlik: RevenueCat Dashboard › Integrations › Webhooks › "Authorization header value"
// alanına girilen değer = REVENUECAT_WEBHOOK_SECRET (Supabase secret). Uyuşmazsa 401.
// JWT doğrulaması YOK (çağıran RevenueCat) → deploy: `--no-verify-jwt`.
//
// Gövde: { api_version, event: { type, app_user_id, product_id, entitlement_ids,
//   expiration_at_ms, period_type, store, environment, id, event_timestamp_ms, … } }
// G58-S2 md.4: personel/manuel hak (store='manual', süresi geçmemiş) hiçbir olayla ezilmez (mapping);
// İzmir teklifi (Fresh yıllık + offer=izmir_fresh) → 2 ücretsiz öğün kuponu (grant_free_meals, idempotent),
// iade/iptalde kullanılmamış kuponlar void (void_free_meals).
// Eşleme saf modülde (mapping.ts). Yanıt her zaman 200 (yok sayılan olay dahil) —
// RevenueCat 2xx dışını yeniden dener; yalnız yetki 401 ve sunucu hatası 500 döner.
import { createClient } from '@supabase/supabase-js'
import {
  IZMIR_OFFER,
  authorized,
  izmirOfferDecision,
  isFreshYearly,
  mapRevenueCatEvent,
  offerAttribute,
  resolveUserId,
  type EntitlementRow,
  type RevenueCatEvent,
} from './mapping.ts'

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

  // 1) Yetki (önce; teklif kuponu hatası yetkiyi ASLA engellemez).
  const res = mapRevenueCatEvent(ev, current)
  let upsertFailed = false
  if (res.action === 'upsert') {
    const { error: upErr } = await admin
      .from('user_entitlements')
      .upsert({ user_id: res.userId, ...res.row, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    // Kullanıcı silinmişse (FK) yeniden deneme anlamsız → 200 + not.
    if (upErr && upErr.code === '23503') return json({ ok: true, ignored: 'unknown_user' })
    if (upErr) upsertFailed = true
  }

  // 2) İzmir teklifi kuponları — idempotent (aynı olay yeniden gelirse grant_free_meals 'duplicate').
  //    Yeniden denemede yetki 'duplicate_event' ile atlansa bile bu adım yine çalışır.
  let offer: string | undefined
  let offerFailed = false
  try {
    let offerRecorded = false
    if (userId && isFreshYearly(ev.product_id) && String(ev.type ?? '').toUpperCase() === 'INITIAL_PURCHASE' && offerAttribute(ev) !== IZMIR_OFFER) {
      // Attribute yoksa: satın almadan önceki 7 gün içinde sunucuya yazılmış teklif kaydı.
      const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
      const { data: intent } = await admin
        .from('subscription_offer_intents')
        .select('id')
        .eq('user_id', userId)
        .eq('offer', IZMIR_OFFER)
        .gte('created_at', since)
        .limit(1)
      offerRecorded = Array.isArray(intent) && intent.length > 0
    }
    const d = izmirOfferDecision(ev, { offerRecorded })
    if (d.action === 'grant') {
      const { data: g, error: gErr } = await admin.rpc('grant_free_meals', { p_user: d.userId, p_source: 'izmir_fresh', p_ref: d.ref, p_count: d.count })
      if (gErr) offerFailed = true
      else {
        const r = (g ?? {}) as { duplicate?: boolean; already?: boolean }
        offer = r.duplicate ? 'duplicate' : r.already ? 'already' : 'granted'
      }
    } else if (d.action === 'void') {
      const { error: vErr } = await admin.rpc('void_free_meals', { p_user: d.userId, p_source: 'izmir_fresh', p_reason: d.reason })
      if (vErr) offerFailed = true
      else offer = 'voided'
    }
  } catch {
    offerFailed = true
  }

  // Kişisel veri günlüğe yazılmaz: yalnız olay tipi + sonuç + ortam.
  console.log('[revenuecat-webhook]', { type: ev.type, env: ev.environment, result: res.action, reason: res.action === 'ignore' ? res.reason : undefined, offer, offerFailed, upsertFailed })
  // Sunucu hatası → 500: RevenueCat yeniden dener (yetki tekrarı last_event_id ile, kupon grant ile idempotent).
  if (upsertFailed || offerFailed) return json({ error: 'server' }, 500)
  if (res.action === 'ignore') return json({ ok: true, ignored: res.reason, offer })
  return json({ ok: true, tier: res.row.tier, offer })
})
