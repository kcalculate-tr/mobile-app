import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ── Paynkolay "Saklı Kart" yönetimi (sync/pay/delete/set_default) ──────────
// Kart Saklama dokümanı (Postman collection "Kart Saklama" klasörü) referans:
//   - Kayıtlı Kartları Listele: POST {VPOS_URL}/Payment/CardStorageCardList
//       hash: sx | customerKey | secret
//   - Kayıtlı Kartı Sil:        POST {VPOS_URL}/Payment/CardStorageCardDelete
//       hash: sx | customerKey | tranId | token | secret
//   - Saklı Kart ile Ödeme Al:  POST {VPOS_URL}/v1/Payment
//       hash: sx | clientRefCode | amount | successUrl | failUrl | rnd | csCustomerKey | secret
//       (BU alan adı csCustomerKey — paynkolay-payment-init'teki hosted akışın
//        "customerKey" düzeltmesinden AYRI/BAĞIMSIZ; farklı bir endpoint/ürün.)
//
// JWT ZORUNLU (verify_jwt=true, config.toml). Kullanıcı SADECE kendi kartını
// görebilir/kullanabilir/silebilir — her sorguda user_id = auth.uid() teyidi var.
//
// GÜVENLİK: token / card_token / secret / kart numarası LOGLANMAZ. Client'a da
// (sync/list yanıtlarında) token dönülmez — yalnızca last4/brand/bank/is_default.

const SX = (Deno.env.get('PAYNKOLAY_SX') ?? '').trim() // "Saklı Kart ile Ödeme" (v1/Payment) — normal satışla aynı sx
// PAYNKOLAY_CARD_SX: Kart Saklama API ailesi (List/Delete) için AYRI sx olabilir
// (reporting/cancel'da da ayrı sx var — bkz. PAYNKOLAY_REPORT_SX/PAYNKOLAY_CANCEL_SX).
// Bu secret HENÜZ TANIMLI DEĞİL — test öncesi `supabase secrets set PAYNKOLAY_CARD_SX=...`.
const CARD_SX = (Deno.env.get('PAYNKOLAY_CARD_SX') ?? '').trim()
const SECRET_KEY = (Deno.env.get('PAYNKOLAY_SECRET_KEY') ?? '').trim()
const VPOS_URL = (Deno.env.get('PAYNKOLAY_VPOS_URL') ?? '').trim() // ".../Vpos"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const LIST_URL = VPOS_URL ? `${VPOS_URL}/Payment/CardStorageCardList` : ''
const DELETE_URL = VPOS_URL ? `${VPOS_URL}/Payment/CardStorageCardDelete` : ''
const PAY_URL = VPOS_URL ? `${VPOS_URL}/v1/Payment` : ''
const CALLBACK_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/paynkolay-callback` : ''

const CURRENCY_CODE = '949' // TRY — payment-init ile aynı
const THREE_D_AMOUNT_THRESHOLD = 1000 // TL — üstünde her zaman 3D

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// ── Hash: parts.join('|') -> UTF-8 -> SHA-512 (binary) -> base64 (diğer paynkolay-* ile AYNI).
async function generatePaynkolayHash(parts: string[]): Promise<string> {
  const hashString = parts.join('|')
  const data = new TextEncoder().encode(hashString)
  const hashBuffer = await crypto.subtle.digest('SHA-512', data)
  const bytes = new Uint8Array(hashBuffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

// Paynkolay rnd = "dd.MM.yyyy HH:mm:ss" (payment-init ile AYNI, GMT+3).
function getRnd(): string {
  const now = new Date()
  const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(tr.getUTCDate())}.${pad(tr.getUTCMonth() + 1)}.${tr.getUTCFullYear()} ` +
    `${pad(tr.getUTCHours())}:${pad(tr.getUTCMinutes())}:${pad(tr.getUTCSeconds())}`
}

function clientIpFromRequest(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') ?? ''
  const first = xff.split(',')[0]?.trim()
  if (first) return first
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-real-ip') ?? '0.0.0.0'
}

// amount -> ondalik TL string ("150.00"). payment-init ile AYNI.
function toDecimalTL(value: number): string {
  return Number(value || 0).toFixed(2)
}

// Callback'in toTrxDate'i ile AYNI (relayToCallback icin degil, referans icin).
function toTrxDate(raw: string): string {
  const datePart = String(raw ?? '').trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart.replace(/-/g, '.')
  const now = new Date()
  const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${tr.getUTCFullYear()}.${pad(tr.getUTCMonth() + 1)}.${pad(tr.getUTCDate())}`
}

// Birden fazla olasi alan adindan ilk dolu degeri al (paynkolay-callback'teki pick ile AYNI desen).
function pick(data: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = data?.[k]
    if (v !== undefined && v !== null && String(v) !== '') return String(v)
  }
  return ''
}

type OrderRow = {
  id: number
  user_id: string | null
  total_price: number | null
  total_amount: number | null
  phone: string | null
  merchant_oid: string | null
  items: unknown
  subtotal_amount: number | null
  delivery_fee: number | null
  discount_amount: number | null
  macro_discount_amount: number | null
  coupon_id: unknown
  coupon_code: string | null
  type: string | null
  macro_quantity: number | null
  status: string | null
  payment_status: string | null
}

// ── Tutarı sunucuda yeniden hesapla — paynkolay-payment-init'teki mantığın
//    BİREBİR YANSIMASI (bilerek kopya: bu repoda her provider/endpoint kendi
//    recompute kopyasını taşır — bkz. payment-verify/paytr-payment-init/
//    paynkolay-payment-init, aynı desen). payment-init değişirse burası da
//    elle güncellenmeli.
async function recomputeOrderAmount(
  admin: SupabaseClient,
  authedClient: SupabaseClient,
  order: OrderRow,
): Promise<number> {
  let amountNum = Number(order.total_price ?? order.total_amount ?? 0)

  if (order.type === 'macro_purchase') {
    const qty = Number(order.macro_quantity) || 0
    if (qty <= 0) return amountNum
    const { data: settingsRow } = await admin
      .from('settings')
      .select('macro_price')
      .eq('id', 1)
      .maybeSingle()
    const macroPrice = Number(settingsRow?.macro_price) || 1500
    const expected = Math.round(qty * macroPrice * 100) / 100
    amountNum = expected
    await admin.from('orders').update({ total_price: expected, total_amount: expected }).eq('id', order.id)
    return amountNum
  }

  try {
    const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100
    const effPrice = (price: unknown, type: unknown, value: unknown) => {
      const base = Number(price) || 0
      const v = Number(value)
      if (!type || !Number.isFinite(v) || v <= 0) return base
      if (type === 'percent' || type === 'percentage') return Math.max(0, base * (1 - v / 100))
      if (type === 'fixed') return Math.max(0, base - v)
      return base
    }
    const items: any[] = Array.isArray(order.items) ? order.items : []
    if (items.length > 0) {
      const productIds = items
        .map((it) => parseInt(String(it?.id), 10))
        .filter((n) => Number.isFinite(n))
      const { data: prods } = await admin
        .from('products')
        .select('id, price, discount_type, discount_value')
        .in('id', productIds)
      const pmap = new Map<number, any>((prods ?? []).map((p: any) => [Number(p.id), p]))

      const newItems = items.map((it) => {
        const p = pmap.get(parseInt(String(it?.id), 10))
        if (!p) return it
        const baseServer = effPrice(p.price, p.discount_type, p.discount_value)
        const tplMod = Array.isArray(it?.selected_options)
          ? it.selected_options.reduce((s: number, o: any) => s + (Number(o?.price_modifier) || 0), 0)
          : 0
        const extra = Number(it?.legacy_selected_options?.extraPrice) || 0
        const correctUnit = round2(baseServer + tplMod + extra)
        const qty = Number(it?.quantity) || 1
        return { ...it, unit_price: correctUnit, total_price: round2(correctUnit * qty) }
      })

      const newSubtotal = round2(newItems.reduce((s, it) => s + (Number(it?.total_price) || 0), 0))

      let macroDiscount = 0
      const { data: prof } = await admin
        .from('profiles').select('privileged_until').eq('id', order.user_id).maybeSingle()
      const pu = prof?.privileged_until ? new Date(prof.privileged_until) : null
      if (pu && pu.getTime() > Date.now()) macroDiscount = round2(newSubtotal * 0.20)

      let discount = 0
      if (order.coupon_code) {
        const { data: cv } = await authedClient.rpc('validate_coupon', {
          p_code: order.coupon_code,
          p_cart_total: newSubtotal,
        })
        if (cv?.valid) discount = round2(Number(cv.discount_amount) || 0)
      }

      const deliveryFee = Number(order.delivery_fee) || 0
      const newTotal = round2(Math.max(0, newSubtotal + deliveryFee - discount - macroDiscount))

      if (newTotal > 0) {
        amountNum = newTotal
        await admin.from('orders').update({
          items: newItems,
          subtotal_amount: newSubtotal,
          discount_amount: discount,
          macro_discount_amount: macroDiscount,
          total_amount: newTotal,
          total_price: newTotal,
        }).eq('id', order.id)
      }
    }
  } catch (e) {
    console.error('[paynkolay-cards] recompute failed, stored total kullanilacak:', (e as Error).message)
  }

  return amountNum
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401)

    const authedClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authedClient.auth.getUser()
    if (authError || !user) return jsonResponse({ error: 'Unauthorized' }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    let body: any = {}
    try {
      const text = await req.text()
      if (text) body = JSON.parse(text)
    } catch { body = {} }

    const action = String(body?.action ?? '')

    if (action === 'sync') return await handleSync(admin, user.id)
    if (action === 'pay') return await handlePay(req, admin, authedClient, user.id, body)
    if (action === 'delete') return await handleDelete(admin, user.id, body)
    if (action === 'set_default') return await handleSetDefault(admin, user.id, body)

    return jsonResponse({ error: 'Gecersiz action (sync|pay|delete|set_default bekleniyor)' }, 400)
  } catch (err) {
    console.error('[paynkolay-cards] error:', String(err))
    return jsonResponse({ error: 'Islem tamamlanamadi' }, 500)
  }
})

async function fetchLocalCards(admin: SupabaseClient, userId: string) {
  const { data } = await admin
    .from('user_cards')
    .select('id, last4, brand, bank_name, is_default, created_at')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })
  return data ?? []
}

// ── sync: Paynkolay'daki kayıtlı kartları çek, DB'de eksik olanları ekle.
//    Yalnızca EKLEME yapar — DB'de olup Paynkolay yanıtında görünmeyen kartları
//    SİLMEZ (yanıt parse hatasında tüm kartları yanlışlıkla silme riskine karşı
//    bilerek tek-yönlü/ek-only; kullanıcı 'delete' action'ı ile açıkça siler).
async function handleSync(admin: SupabaseClient, userId: string): Promise<Response> {
  const { data: profile } = await admin
    .from('profiles')
    .select('payment_customer_key')
    .eq('id', userId)
    .maybeSingle()
  const customerKey = String(profile?.payment_customer_key ?? '')

  if (!customerKey || !CARD_SX || !SECRET_KEY || !LIST_URL) {
    const cards = await fetchLocalCards(admin, userId)
    return jsonResponse({ success: true, cards, synced: false })
  }

  let listJson: any = null
  try {
    const hash = await generatePaynkolayHash([CARD_SX, customerKey, SECRET_KEY])
    const form = new FormData()
    form.set('sx', CARD_SX)
    form.set('customerKey', customerKey)
    form.set('hashDatav2', hash)
    const res = await fetch(LIST_URL, { method: 'POST', body: form })
    const raw = await res.text()
    if (res.ok) {
      try { listJson = JSON.parse(raw) } catch { listJson = null }
    } else {
      console.error('[paynkolay-cards] sync HTTP', res.status)
    }
  } catch (e) {
    console.error('[paynkolay-cards] sync fetch error:', e)
  }

  const remoteList: any[] = Array.isArray(listJson?.List) ? listJson.List
    : Array.isArray(listJson?.list) ? listJson.list
    : Array.isArray(listJson) ? listJson
    : []

  if (remoteList.length > 0) {
    const { data: existingCards } = await admin.from('user_cards').select('id').eq('user_id', userId)
    const existingIds = (existingCards ?? []).map((c: { id: string }) => c.id)
    const { data: existingSecrets } = existingIds.length > 0
      ? await admin.from('user_card_secrets').select('card_id, card_token').in('card_id', existingIds)
      : { data: [] as { card_id: string; card_token: string }[] }
    const knownTokens = new Set((existingSecrets ?? []).map((s) => s.card_token))
    let hasAny = existingIds.length > 0

    for (const item of remoteList) {
      const token = pick(item, 'token', 'Token', 'CardToken', 'cardToken')
      if (!token || knownTokens.has(token)) continue

      const tranId = pick(item, 'tranId', 'TranId', 'csTranId')
      const maskedPan = pick(item, 'maskedPan', 'cardNo', 'CardNo', 'maskedCardNo')
      const brand = pick(item, 'cardBrand', 'brand', 'cardProgram')
      const bank = pick(item, 'bankName', 'bank', 'BankName')
      const last4 = maskedPan.replace(/\D/g, '').slice(-4)

      const { data: newCard, error: cardErr } = await admin
        .from('user_cards')
        .insert([{
          user_id: userId,
          paynkolay_customer_key: customerKey,
          last4: last4 || null,
          brand: brand || null,
          bank_name: bank || null,
          is_default: !hasAny,
        }])
        .select('id')
        .single()
      if (cardErr || !newCard) {
        console.error('[paynkolay-cards] sync insert user_cards failed:', cardErr)
        continue
      }
      const { error: secretErr } = await admin
        .from('user_card_secrets')
        .insert([{ card_id: newCard.id, card_token: token, cs_tran_id: tranId || null }])
      if (secretErr) {
        console.error('[paynkolay-cards] sync insert user_card_secrets failed:', secretErr)
        await admin.from('user_cards').delete().eq('id', newCard.id)
        continue
      }
      knownTokens.add(token)
      hasAny = true
    }
  }

  const cards = await fetchLocalCards(admin, userId)
  return jsonResponse({ success: true, cards, synced: listJson !== null })
}

async function handleSetDefault(admin: SupabaseClient, userId: string, body: any): Promise<Response> {
  const cardId = String(body?.cardId ?? '')
  if (!cardId) return jsonResponse({ error: 'cardId zorunlu' }, 400)

  const { data: card } = await admin.from('user_cards').select('id, user_id').eq('id', cardId).maybeSingle()
  if (!card || card.user_id !== userId) return jsonResponse({ error: 'Kart bulunamadi' }, 404)

  const { error: clearErr } = await admin.from('user_cards').update({ is_default: false }).eq('user_id', userId)
  if (clearErr) return jsonResponse({ error: 'Guncelleme basarisiz' }, 500)
  const { error: setErr } = await admin.from('user_cards').update({ is_default: true }).eq('id', cardId)
  if (setErr) return jsonResponse({ error: 'Guncelleme basarisiz' }, 500)

  return jsonResponse({ success: true })
}

async function handleDelete(admin: SupabaseClient, userId: string, body: any): Promise<Response> {
  const cardId = String(body?.cardId ?? '')
  if (!cardId) return jsonResponse({ error: 'cardId zorunlu' }, 400)

  const { data: card } = await admin
    .from('user_cards')
    .select('id, user_id, paynkolay_customer_key, is_default')
    .eq('id', cardId)
    .maybeSingle()
  if (!card || card.user_id !== userId) return jsonResponse({ error: 'Kart bulunamadi' }, 404)

  const { data: secret } = await admin
    .from('user_card_secrets')
    .select('card_token, cs_tran_id')
    .eq('card_id', cardId)
    .maybeSingle()

  if (CARD_SX && SECRET_KEY && DELETE_URL && secret?.card_token) {
    const customerKey = String(card.paynkolay_customer_key ?? '')
    const tranId = String(secret.cs_tran_id ?? '')
    const token = String(secret.card_token ?? '')
    try {
      const hash = await generatePaynkolayHash([CARD_SX, customerKey, tranId, token, SECRET_KEY])
      const form = new FormData()
      form.set('sx', CARD_SX)
      form.set('customerKey', customerKey)
      form.set('tranId', tranId)
      form.set('token', token)
      form.set('hashDatav2', hash)
      const res = await fetch(DELETE_URL, { method: 'POST', body: form })
      // NOT: CardStorageCardDelete'in kesin basari/response-code semasi resmi
      // dokumanda yok — sadece HTTP 200'e bakiliyor. Ilk gercek testte
      // (kullanici tarafindan) yanit gozlenip bu kontrol siki hale getirilmeli.
      if (!res.ok) {
        console.error('[paynkolay-cards] delete HTTP', res.status)
        return jsonResponse({ error: 'Kart Paynkolay tarafinda silinemedi' }, 502)
      }
    } catch (e) {
      console.error('[paynkolay-cards] delete fetch error:', e)
      return jsonResponse({ error: 'Paynkolay kart silme servisine erisilemedi' }, 502)
    }
  }

  const { error: delErr } = await admin.from('user_cards').delete().eq('id', cardId)
  if (delErr) {
    console.error('[paynkolay-cards] local delete failed:', delErr)
    return jsonResponse({ error: 'Kart silinemedi' }, 500)
  }

  if (card.is_default) {
    const { data: next } = await admin
      .from('user_cards')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (next) {
      await admin.from('user_cards').update({ is_default: true }).eq('id', next.id)
    }
  }

  return jsonResponse({ success: true })
}

// ── pay: Saklı kart ile ödeme al. Tutar sunucuda hesaplanır (client'tan gelen
//    tutara guvenilmez). 1.000 TL ustu veya yeni cihaz -> 3D.
async function handlePay(
  req: Request,
  admin: SupabaseClient,
  authedClient: SupabaseClient,
  userId: string,
  body: any,
): Promise<Response> {
  if (!SX || !SECRET_KEY || !PAY_URL) {
    return jsonResponse({ error: 'Paynkolay kart-odeme yapilandirmasi eksik' }, 500)
  }

  const orderId = body?.orderId ? Number(body.orderId) : NaN
  const cardId = String(body?.cardId ?? '')
  const deviceId = String(body?.deviceId ?? '').trim()
  if (!orderId || Number.isNaN(orderId)) return jsonResponse({ error: 'orderId zorunlu' }, 400)
  if (!cardId) return jsonResponse({ error: 'cardId zorunlu' }, 400)

  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('id, user_id, total_price, total_amount, phone, merchant_oid, items, subtotal_amount, delivery_fee, discount_amount, macro_discount_amount, coupon_id, coupon_code, type, macro_quantity, status, payment_status')
    .eq('id', orderId)
    .maybeSingle()
  if (orderErr || !order) return jsonResponse({ error: 'Siparis bulunamadi' }, 404)
  if (order.user_id && order.user_id !== userId) return jsonResponse({ error: 'Unauthorized' }, 403)

  // Idempotency: zaten odenmis siparis tekrar tahsil edilmez (callback ile AYNI kural).
  if (order.payment_status === 'paid') {
    return jsonResponse({ success: true, alreadyPaid: true })
  }

  // Kart: SADECE kendi karti kullanabilir.
  const { data: card } = await admin
    .from('user_cards')
    .select('id, user_id, paynkolay_customer_key')
    .eq('id', cardId)
    .maybeSingle()
  if (!card || card.user_id !== userId) return jsonResponse({ error: 'Kart bulunamadi' }, 404)

  const { data: secret } = await admin
    .from('user_card_secrets')
    .select('card_token, cs_tran_id')
    .eq('card_id', cardId)
    .maybeSingle()
  if (!secret?.card_token && !secret?.cs_tran_id) {
    return jsonResponse({ error: 'Kart bilgisi eksik — yeniden ekleyin' }, 400)
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('payment_customer_key')
    .eq('id', userId)
    .maybeSingle()
  const customerKey = String(profile?.payment_customer_key ?? card.paynkolay_customer_key ?? '')
  if (!customerKey) return jsonResponse({ error: 'Musteri anahtari bulunamadi' }, 400)

  const amountNum = await recomputeOrderAmount(admin, authedClient, order as OrderRow)
  if (!amountNum || amountNum <= 0) return jsonResponse({ error: 'Siparis tutari gecersiz' }, 400)
  const amount = toDecimalTL(amountNum)

  // Yeni cihaz kontrolü — deviceId yoksa/DB'de yoksa "yeni" say (guvenli varsayilan).
  let isNewDevice = true
  if (deviceId) {
    const { data: known } = await admin
      .from('user_known_devices')
      .select('device_id')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .maybeSingle()
    isNewDevice = !known
  }
  const use3D = amountNum > THREE_D_AMOUNT_THRESHOLD || isNewDevice

  // KCAL{orderId}T... prefix'i callback'in regex'i (/^KCAL(\d+)T/) ile uyumlu
  // kalsin diye korunuyor; CARD son eki sadece ayirt edici/teshis amacli.
  const clientRefCode = `KCAL${order.id}T${Date.now()}CARD`
  const successUrl = `${CALLBACK_URL}?pk=success`
  const failUrl = `${CALLBACK_URL}?pk=fail`
  const rnd = getRnd()
  const cardHolderIP = clientIpFromRequest(req)

  const hashDatav2 = await generatePaynkolayHash([
    SX, clientRefCode, amount, successUrl, failUrl, rnd, customerKey, SECRET_KEY,
  ])

  const form = new FormData()
  form.set('sx', SX)
  form.set('clientRefCode', clientRefCode)
  form.set('successUrl', successUrl)
  form.set('failUrl', failUrl)
  form.set('amount', amount)
  form.set('installmentNo', '')
  form.set('use3D', use3D ? 'true' : 'false')
  form.set('transactionType', 'SALES')
  form.set('rnd', rnd)
  form.set('hashDatav2', hashDatav2)
  form.set('environment', 'API')
  form.set('currencyNumber', CURRENCY_CODE)
  form.set('csCustomerKey', customerKey)
  if (secret.cs_tran_id) form.set('csTranId', String(secret.cs_tran_id))
  if (secret.card_token) form.set('csToken', String(secret.card_token))
  form.set('cardHolderIP', cardHolderIP)

  let httpOk = false
  let httpStatus = 0
  let raw = ''
  try {
    const res = await fetch(PAY_URL, { method: 'POST', body: form })
    httpOk = res.ok
    httpStatus = res.status
    raw = await res.text()
  } catch (e) {
    console.error('[paynkolay-cards] pay fetch error:', e)
    return jsonResponse({ error: 'Paynkolay odeme servisine erisilemedi' }, 502)
  }

  if (!httpOk) {
    console.error('[paynkolay-cards] pay HTTP', httpStatus)
    return jsonResponse({ error: 'Paynkolay odeme servisi hata dondu', httpStatus }, 502)
  }

  console.log('[paynkolay-cards] pay', { orderId: order.id, amount, use3D, isNewDevice })

  // ── 3D: yanit bankaya yonlendiren HTML sayfasi — mobil WebView'de render
  //    edilir. Sonuc PaynKolay tarafindan successUrl/failUrl'e (paynkolay-callback)
  //    POST edilir; tamamlama (macro purchase dahil) ORADA, tek kaynaktan olur.
  if (use3D) {
    return jsonResponse({ success: true, requires3D: true, formHtml: raw })
  }

  // ── Non-3D: yanit senkron (JSON/duz metin) gelir. Alan adlari resmi dokumanda
  //    tam netlestirilmedi -> pick() ile cok-varyant toleransli parse.
  let providerJson: Record<string, unknown> | null = null
  try { providerJson = JSON.parse(raw) } catch { providerJson = null }
  const flat: Record<string, unknown> = providerJson ?? {}
  if (!providerJson) {
    // JSON degilse "KEY: value" / "KEY=value" satirlarini best-effort parse et.
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*([A-Za-z0-9_]+)\s*[:=]\s*(.*)$/.exec(line)
      if (m) flat[m[1]] = m[2].trim()
    }
  }

  const responseCode = pick(flat, 'RESPONSE_CODE', 'responseCode')
  const authCode = pick(flat, 'AUTH_CODE', 'authCode').trim()
  const referenceCode = pick(flat, 'REFERENCE_CODE', 'referenceCode')
  const merchantNo = pick(flat, 'MERCHANT_NO', 'merchantNo')
  const rndOut = pick(flat, 'RND', 'rnd') || rnd
  const installment = pick(flat, 'INSTALLMENT', 'installment') || '1'
  const authorizationAmount = pick(flat, 'AUTHORIZATION_AMOUNT', 'authorizationAmount') || amount
  const timestamp = pick(flat, 'TIMESTAMP', 'timestamp') || new Date().toISOString()
  const responseMessage = pick(flat, 'RESPONSE_DATA', 'RESPONSE_MESSAGE', 'responseMessage')

  // Basari kurali (resmi "Ödeme Sonucu" dokumanindaki TEK kural): RESPONSE_CODE
  // === '2' VE AUTH_CODE bos/0/00 degil. (paynkolay-callback'te bu AUTH_CODE
  // kontrolu yok — burada dokuman netligiyle dogru uygulaniyor.)
  const isSuccess = responseCode === '2' && !['', '0', '00'].includes(authCode)

  if (!isSuccess) {
    try {
      await admin.from('failed_payments').insert([{
        user_id: userId,
        error_message: responseMessage || `Saklı kart odemesi basarisiz (RESPONSE_CODE=${responseCode || 'bilinmiyor'})`,
        amount: 0,
        payment_method: 'kredi-karti-saklı',
        order_data: { orderId: order.id, clientRefCode, responseCode, authCode, raw: flat },
        created_at: new Date().toISOString(),
      }])
    } catch (e) {
      console.error('[paynkolay-cards] failed_payments insert error:', e)
    }
    return jsonResponse({ success: false, error: responseMessage || 'Odeme basarisiz' }, 402)
  }

  // ── Basarili non-3D sonucu paynkolay-callback'e RÖLE et: order tamamlama
  //    (macro purchase dahil) TEK kaynaktan (callback) yürür, burada kopyalanmaz.
  //    Hash'i SECRET_KEY ile biz de hesaplayabiliyoruz (callback'in beklediği ile
  //    AYNI formül) -> callback'in kendi hash dogrulamasini gecer.
  const relayHash = await generatePaynkolayHash([
    merchantNo, referenceCode, authCode, responseCode, 'false', rndOut,
    installment, authorizationAmount, CURRENCY_CODE, SECRET_KEY,
  ])
  const relayForm = new FormData()
  relayForm.set('MERCHANT_NO', merchantNo)
  relayForm.set('REFERENCE_CODE', referenceCode)
  relayForm.set('AUTH_CODE', authCode)
  relayForm.set('RESPONSE_CODE', responseCode)
  relayForm.set('USE_3D', 'false')
  relayForm.set('RND', rndOut)
  relayForm.set('INSTALLMENT', installment)
  relayForm.set('AUTHORIZATION_AMOUNT', authorizationAmount)
  relayForm.set('CURRENCY_CODE', CURRENCY_CODE)
  relayForm.set('hashDataV2', relayHash)
  relayForm.set('clientRefCode', clientRefCode)
  relayForm.set('TIMESTAMP', String(timestamp))
  relayForm.set('RESPONSE_MESSAGE', responseMessage)

  try {
    const relayRes = await fetch(CALLBACK_URL, { method: 'POST', body: relayForm })
    if (!relayRes.ok) {
      console.error('[paynkolay-cards] callback relay HTTP', relayRes.status)
      return jsonResponse({ error: 'Odeme onaylandi ama siparis tamamlanamadi — destek ile iletisime gecin' }, 502)
    }
  } catch (e) {
    console.error('[paynkolay-cards] callback relay error:', e)
    return jsonResponse({ error: 'Odeme onaylandi ama siparis tamamlanamadi — destek ile iletisime gecin' }, 502)
  }

  // Basarili odeme + yeni cihazsa artik "bilinen" isaretle (upsert, best-effort).
  if (deviceId) {
    try {
      await admin.from('user_known_devices').upsert(
        { user_id: userId, device_id: deviceId },
        { onConflict: 'user_id,device_id', ignoreDuplicates: true },
      )
    } catch (e) {
      console.error('[paynkolay-cards] user_known_devices upsert error:', e)
    }
  }

  return jsonResponse({ success: true, requires3D: false })
}
