import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PAYTR_TOKEN_URL = 'https://www.paytr.com/odeme/api/get-token'
const PAYTR_IFRAME_BASE = 'https://www.paytr.com/odeme/guvenli'

const MERCHANT_ID = Deno.env.get('PAYTR_MERCHANT_ID') ?? ''
const MERCHANT_KEY = Deno.env.get('PAYTR_MERCHANT_KEY') ?? ''
const MERCHANT_SALT = Deno.env.get('PAYTR_MERCHANT_SALT') ?? ''
const TEST_MODE = Deno.env.get('PAYTR_TEST_MODE') ?? '1'

const MERCHANT_OK_URL = 'https://eatkcal.com/payment/success'
const MERCHANT_FAIL_URL = 'https://eatkcal.com/payment/fail'

const NO_INSTALLMENT = '0'
const MAX_INSTALLMENT = '0'
const CURRENCY = 'TL'
const DEBUG_ON = '1'
const TIMEOUT_LIMIT = '30'

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

// btoa() Latin1 dışı karakterlerde InvalidCharacterError fırlatır;
// JSON.stringify Türkçe karakter içerebilir → UTF-8 byte üzerinden encode.
function base64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function priceToString(value: number): string {
  return Number(value || 0).toFixed(2)
}

function sanitizeBasketName(raw: unknown, fallback: string): string {
  const s = typeof raw === 'string' ? raw : String(raw ?? '')
  const cleaned = s.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (!cleaned) return fallback
  return cleaned.length > 60 ? cleaned.slice(0, 60) : cleaned
}

function buildMacroBasket(quantity: number, totalPrice: number): string {
  const name = sanitizeBasketName(`Macro Paketi (${quantity}x)`, 'Macro Paketi')
  const arr = [[name, priceToString(totalPrice), 1]]
  return base64Utf8(JSON.stringify(arr))
}

function parseOrderItems(rawItems: unknown): Array<{ name: string; quantity: number; unit_price: number }> {
  let items: any = rawItems
  if (typeof rawItems === 'string') {
    try { items = JSON.parse(rawItems) } catch { items = [] }
  }
  if (!Array.isArray(items)) return []
  return items.map((it) => ({
    name: sanitizeBasketName(it?.name ?? it?.product_name, 'Ürün'),
    quantity: Math.max(1, Number(it?.quantity ?? 1)),
    unit_price: Number(it?.unit_price ?? it?.price ?? 0),
  }))
}

function buildOrderBasket(items: Array<{ name: string; quantity: number; unit_price: number }>, fallbackTotal: number): string {
  let arr: Array<[string, string, number]>
  if (!items.length) {
    arr = [['Sipariş', priceToString(fallbackTotal), 1]]
  } else {
    arr = items.map((it) => [it.name, priceToString(it.unit_price), it.quantity])
  }
  return base64Utf8(JSON.stringify(arr))
}

function clientIpFromRequest(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') ?? ''
  const first = xff.split(',')[0]?.trim()
  if (first) return first
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? '0.0.0.0'
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

    const {
      orderId,
      userEmail,
      userIp: userIpInput,
      userAddress,
      userPhone,
      userName,
    } = body ?? {}

    if (!orderId || !userEmail || !userAddress || !userPhone || !userName) {
      return jsonResponse({
        error: 'orderId, userEmail, userAddress, userPhone, userName zorunlu',
      }, 400)
    }

    const orderIdNum = parseInt(String(orderId), 10)
    if (!orderIdNum || isNaN(orderIdNum)) {
      return jsonResponse({ error: 'orderId geçersiz' }, 400)
    }

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, total_price, type, macro_quantity, items')
      .eq('id', orderIdNum)
      .maybeSingle()

    if (orderErr || !order) {
      return jsonResponse({ error: 'Sipariş bulunamadı', detail: orderErr?.message }, 404)
    }

    const totalPrice = Number(order.total_price ?? 0)
    if (!totalPrice || totalPrice <= 0) {
      return jsonResponse({ error: 'Sipariş tutarı geçersiz' }, 400)
    }

    const paymentAmount = Math.round(totalPrice * 100)

    const userBasket = order.type === 'macro_purchase'
      ? buildMacroBasket(Number(order.macro_quantity ?? 1), totalPrice)
      : buildOrderBasket(parseOrderItems(order.items), totalPrice)

    const merchantOid = `KCAL${orderIdNum}T${Date.now()}`
    const userIp = (typeof userIpInput === 'string' && userIpInput.trim())
      ? userIpInput.trim()
      : clientIpFromRequest(req)

    const hashStr =
      MERCHANT_ID +
      userIp +
      merchantOid +
      String(userEmail) +
      String(paymentAmount) +
      userBasket +
      NO_INSTALLMENT +
      MAX_INSTALLMENT +
      CURRENCY +
      String(TEST_MODE)

    const paytrToken = await hmacSha256Base64(hashStr + MERCHANT_SALT, MERCHANT_KEY)

    const form = new URLSearchParams()
    form.set('merchant_id', MERCHANT_ID)
    form.set('user_ip', userIp)
    form.set('merchant_oid', merchantOid)
    form.set('email', String(userEmail))
    form.set('payment_amount', String(paymentAmount))
    form.set('paytr_token', paytrToken)
    form.set('user_basket', userBasket)
    form.set('debug_on', DEBUG_ON)
    form.set('no_installment', NO_INSTALLMENT)
    form.set('max_installment', MAX_INSTALLMENT)
    form.set('user_name', String(userName))
    form.set('user_address', String(userAddress))
    form.set('user_phone', String(userPhone))
    form.set('merchant_ok_url', MERCHANT_OK_URL)
    form.set('merchant_fail_url', MERCHANT_FAIL_URL)
    form.set('timeout_limit', TIMEOUT_LIMIT)
    form.set('currency', CURRENCY)
    form.set('test_mode', String(TEST_MODE))

    const paytrRes = await fetch(PAYTR_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })

    const paytrText = await paytrRes.text()
    let paytrJson: any
    try { paytrJson = JSON.parse(paytrText) } catch { paytrJson = { raw: paytrText } }

    if (paytrJson?.status !== 'success' || !paytrJson?.token) {
      console.error('[paytr-init] failed:', paytrJson)
      return jsonResponse({
        error: 'PayTR token alınamadı',
        reason: paytrJson?.reason ?? paytrJson?.err_msg ?? 'unknown',
        detail: paytrJson,
      }, 502)
    }

    const { error: updErr } = await supabase
      .from('orders')
      .update({
        payment_provider: 'paytr_iframe',
        merchant_oid: merchantOid,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderIdNum)

    if (updErr) {
      console.error('[paytr-init] order update failed:', updErr)
    }

    return jsonResponse({
      success: true,
      token: paytrJson.token,
      iframeUrl: `${PAYTR_IFRAME_BASE}/${paytrJson.token}`,
      merchantOid,
    })
  } catch (err) {
    console.error('[paytr-init] error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
