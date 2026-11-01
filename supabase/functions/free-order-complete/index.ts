// free-order-complete (hardened) — Starbucks modeli: hedefli sponsor kupon = QR yetkisi.
// Siparişi ödeme ALMADAN, SUNUCU taraflı güvenli tamamlar. Guard'lar:
//  1) verify_jwt + sipariş çağırana ait
//  2) sipariş pending_payment, paid değil
//  3) kupon SUNUCUDA valid (validate_coupon, kullanıcı JWT'siyle — hedef/tarih/limit enforce)
//  4) kupon %100 (percent, value>=100) — tam kapsayan
//  5) kupon KİŞİYE ÖZEL (global değil)
// Geçerse service-role ile paid+confirmed → Adisyo trigger düşer. Kart çekilmez.

import { createClient } from '@supabase/supabase-js'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'unauthorized' }, 401)

    let body: any = {}
    try { const t = await req.text(); if (t) body = JSON.parse(t) } catch { body = {} }
    const orderId = body.orderId ?? body.order_id
    if (!orderId) return json({ error: 'orderId_required' }, 400)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return json({ error: 'unauthorized', detail: authErr?.message }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE)

    const { data: order, error: oErr } = await admin.from('orders').select('*').eq('id', orderId).single()
    if (oErr || !order) return json({ error: 'order_not_found', detail: oErr?.message }, 404)
    if (order.user_id !== user.id) return json({ error: 'not_your_order' }, 403)
    if (order.payment_status === 'paid') return json({ ok: true, already_paid: true, order_code: order.order_code })
    if (order.status !== 'pending_payment') return json({ error: 'wrong_status', status: order.status }, 409)

    const code = order.coupon_code
    if (!code) return json({ error: 'no_coupon' }, 400)

    const subtotal = Number(order.subtotal_amount ?? order.total_price ?? 0)

    const { data: vres, error: vErr } = await userClient.rpc('validate_coupon', { p_code: code, p_cart_total: subtotal })
    if (vErr) return json({ error: 'validate_failed', detail: vErr.message }, 400)
    if (!vres?.valid) return json({ error: 'coupon_invalid', reason: vres?.reason }, 400)

    const isFull = vres.discount_type === 'percent' && Number(vres.discount_value) >= 100
    if (!isFull) return json({ error: 'free_requires_full_coupon' }, 400)

    const { data: camp } = await admin.from('campaigns')
      .select('id, user_id, user_email').eq('id', vres.campaign_id).single()
    const { count: targetCount } = await admin.from('campaign_targets')
      .select('id', { count: 'exact', head: true }).eq('campaign_id', vres.campaign_id)
    const isTargeted = !!(camp?.user_id || camp?.user_email || (targetCount ?? 0) > 0)
    if (!isTargeted) return json({ error: 'free_requires_targeted_coupon' }, 400)

    const { error: uErr } = await admin.from('orders').update({
      payment_status: 'paid',
      status: 'confirmed',
      payment_method: 'sponsor',
      payment_provider: 'sponsor',
      total_amount: 0,
      discount_amount: Number(vres.discount_amount ?? subtotal),
      coupon_id: vres.campaign_id ?? order.coupon_id,
      updated_at: new Date().toISOString(),
    }).eq('id', orderId)
    if (uErr) return json({ error: 'update_failed', detail: uErr.message }, 500)

    return json({ ok: true, order_id: orderId, order_code: order.order_code })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})
