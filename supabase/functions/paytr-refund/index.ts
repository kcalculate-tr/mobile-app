import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PAYTR_REFUND_URL = 'https://www.paytr.com/odeme/iade'

const MERCHANT_ID = Deno.env.get('PAYTR_MERCHANT_ID') ?? ''
const MERCHANT_KEY = Deno.env.get('PAYTR_MERCHANT_KEY') ?? ''
const MERCHANT_SALT = Deno.env.get('PAYTR_MERCHANT_SALT') ?? ''

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function hmacSha256Base64(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  const bytes = new Uint8Array(sig)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!MERCHANT_ID || !MERCHANT_KEY || !MERCHANT_SALT) {
      return jsonResponse({ error: 'PayTR credentials missing' }, 500)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    let body: any = {}
    try {
      const text = await req.text()
      if (text) body = JSON.parse(text)
    } catch { body = {} }

    const { orderId, returnAmount } = body ?? {}
    const orderIdNum = orderId ? parseInt(String(orderId), 10) : NaN
    if (!orderIdNum || isNaN(orderIdNum)) {
      return jsonResponse({ error: 'orderId zorunlu' }, 400)
    }

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, merchant_oid, total_price, payment_total_amount, type, status')
      .eq('id', orderIdNum)
      .maybeSingle()

    if (orderErr || !order) {
      return jsonResponse({ error: 'Sipariş bulunamadı', detail: orderErr?.message }, 404)
    }
    if (!order.merchant_oid) {
      return jsonResponse({ error: 'Sipariş PayTR ile alınmamış (merchant_oid yok)' }, 400)
    }

    const paidAmount = Number(order.payment_total_amount ?? order.total_price ?? 0)
    if (!paidAmount || paidAmount <= 0) {
      return jsonResponse({ error: 'İade için geçerli bir tutar bulunamadı' }, 400)
    }

    const refundAmountNumeric = returnAmount != null ? Number(returnAmount) : paidAmount
    if (!refundAmountNumeric || refundAmountNumeric <= 0 || refundAmountNumeric > paidAmount) {
      return jsonResponse({ error: 'returnAmount geçersiz' }, 400)
    }
    const returnAmountStr = refundAmountNumeric.toFixed(2)

    const hashStr = MERCHANT_ID + order.merchant_oid + returnAmountStr + MERCHANT_SALT
    const paytrToken = await hmacSha256Base64(hashStr, MERCHANT_KEY)

    const form = new URLSearchParams()
    form.set('merchant_id', MERCHANT_ID)
    form.set('merchant_oid', String(order.merchant_oid))
    form.set('return_amount', returnAmountStr)
    form.set('paytr_token', paytrToken)

    const paytrRes = await fetch(PAYTR_REFUND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })

    const paytrText = await paytrRes.text()
    let paytrJson: any
    try { paytrJson = JSON.parse(paytrText) } catch { paytrJson = { raw: paytrText } }

    if (paytrJson?.status !== 'success') {
      console.error('[paytr-refund] failed:', paytrJson)
      return jsonResponse({
        success: false,
        error: 'İade başarısız',
        reason: paytrJson?.err_msg ?? paytrJson?.reason ?? 'unknown',
        detail: paytrJson,
      }, 502)
    }

    const refundedAt = new Date().toISOString()
    const { error: updErr } = await supabase
      .from('orders')
      .update({
        status: 'refunded',
        refund_amount: refundAmountNumeric,
        refunded_at: refundedAt,
        updated_at: refundedAt,
      })
      .eq('id', order.id)

    if (updErr) {
      console.error('[paytr-refund] order update failed', order.id, updErr)
    }

    if (order.type === 'macro_purchase') {
      const { data: orderUser } = await supabase
        .from('orders')
        .select('user_id, macro_quantity')
        .eq('id', order.id)
        .maybeSingle()

      if (orderUser?.user_id) {
        await supabase.from('macro_transactions').insert({
          user_id: orderUser.user_id,
          type: 'refund',
          amount: -Number(orderUser.macro_quantity ?? 0),
          price_paid: -refundAmountNumeric,
          order_id: typeof order.id === 'number' ? order.id : Number(order.id),
          note: `İade: ${returnAmountStr} TL`,
        })
      }
    }

    return jsonResponse({
      success: true,
      merchantOid: order.merchant_oid,
      refundAmount: refundAmountNumeric,
      refundedAt,
    })
  } catch (err) {
    console.error('[paytr-refund] error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
