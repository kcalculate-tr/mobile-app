import { createClient } from '@supabase/supabase-js'

// ── Paynkolay Ortak Odeme Sayfasi (hosted) init ─────────────────────────────
// Mobil yalnizca { orderId, amount } gonderir; KART/CVV mobilde toplanmaz (PCI
// Paynkolay tarafinda). Backend hazir bir auto-submit HTML form (formHtml)
// dondurur; mobil bunu WebView source={{ html }} ile yukler.
//
// GUVENLIK: PAYNKOLAY_SECRET_KEY ve sx ASLA response'a konmaz, ASLA loglanmaz.
// Hash backend'de hesaplanir.
//
// Iskelet referansi: payment-init (Tosla) — auth blogu, hash fonksiyonu, IP.
// Tosla'ya ozgu seyler (×100 kurus, threeDPayment) ALINMADI.

// Env (Supabase secrets) — mobile ASLA inmez.
// .trim(): `echo "val" | secrets set` trailing newline'i "E102 Gecersiz anahtar"
// (gecersiz sx) sebebi olabilir; defensive temizlik.
const rawSx = Deno.env.get('PAYNKOLAY_SX') ?? ''
const rawSecret = Deno.env.get('PAYNKOLAY_SECRET_KEY') ?? ''
const rawVpos = Deno.env.get('PAYNKOLAY_VPOS_URL') ?? ''
const SX = rawSx.trim()
const SECRET_KEY = rawSecret.trim()
const VPOS_URL = rawVpos.trim()
// Kart saklama yetkisi su an YOK -> default KAPALI. Yetki gelince 'true' yapilir
// (ileride settings.paynkolay_card_save_enabled'a tasinabilir).
const CARD_SAVE_ENABLED =
  (Deno.env.get('PAYNKOLAY_CARD_SAVE') ?? 'false').toLowerCase() === 'true'

// Resmi ornek formdaki ek zorunlu alanlar (hash'e DAHIL DEGIL, sadece form alani).
const CURRENCY_CODE = '949' // TRY
// agentCode SADECE sub-merchant hesaplari icindir. KCAL tek merchant -> YOK.
// '1236' (resmi ornek degeri) KALDIRILDI: prod'da yanlis merchant'a yonlenme riski.
// Secret set EDILMEMISSE alan forma HIC eklenmez (asagidaki fields blogu).
const AGENT_CODE = (Deno.env.get('PAYNKOLAY_AGENT_CODE') ?? '').trim()

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// ── Hash: parts.join('|') -> UTF-8 -> SHA-512 (binary) -> base64
// Paynkolay PHP ornegi NET (pipe AYIRICI, notasyon degil):
//   $hashstr = $sx."|".$clientRefCode."|".$amount."|".$successUrl."|".$failUrl
//              ."|".$rnd."|".$customerKey."|".$merchantSecretKey;
//   base64_encode(hash("sha512", mb_convert_encoding($hashstr,'UTF-8'), true))
// Asagidaki uygulama bunu birebir karsilar:
//   TextEncoder (UTF-8 byte) -> crypto.subtle.digest('SHA-512') (binary digest,
//   hex DEGIL) -> btoa (base64).
async function generatePaynkolayHash(parts: string[]): Promise<string> {
  const hashString = parts.join('|')
  const data = new TextEncoder().encode(hashString) // UTF-8 byte
  const hashBuffer = await crypto.subtle.digest('SHA-512', data) // binary digest
  const bytes = new Uint8Array(hashBuffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin) // base64
}

// Telefonu Paynkolay customerKey formatina normalize et:
// bosluk/parantez/tire/+90/90 onekini temizle -> 10 haneli 5XXXXXXXXX.
// NOT: Paynkolay'in kabul ettigi kesin format ilk testte netlesecek (90... gerekirse
//      burasi tek noktadan ayarlanir).
function normalizePhone(raw: unknown): string {
  let s = String(raw ?? '').replace(/[\s()\-]/g, '')
  if (s.startsWith('+90')) s = s.slice(3)
  else if (s.startsWith('90') && s.length === 12) s = s.slice(2)
  if (s.startsWith('0')) s = s.slice(1)
  return s // beklenen: 5XXXXXXXXX (10 hane)
}

// amount -> ondalik TL string ("150.00"). KURUS DEGIL (×100 YOK).
function toDecimalTL(value: number): string {
  return Number(value || 0).toFixed(2)
}

// Paynkolay rnd = tarih formati "dd.MM.yyyy HH:mm:ss" (resmi ornek; random DEGIL).
// GMT+3 (Turkiye). AYNI deger hem form alaninda hem hash'te kullanilir.
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

// HTML kacis (form value injection guvenligi).
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Paynkolay VPOS'a otomatik POST eden gizli form (Tosla ProcessCardForm deseni gibi).
function buildAutoSubmitForm(actionUrl: string, fields: Record<string, string>): string {
  const inputs = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}" />`)
    .join('\n      ')
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body onload="document.forms[0].submit()">
    <form method="POST" action="${escapeHtml(actionUrl)}">
      ${inputs}
    </form>
  </body>
</html>`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!SX || !SECRET_KEY || !VPOS_URL) {
      return jsonResponse({ error: 'Paynkolay yapilandirmasi eksik' }, 500)
    }

    // ── Auth: gercek Supabase session zorunlu (verify_jwt=true zaten dogrular;
    //    user_id'yi almak + order sahipligi icin getUser cagrilir).
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
    const authedClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user }, error: authError } = await authedClient.auth.getUser()
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    let body: any = {}
    try {
      const text = await req.text()
      if (text) body = JSON.parse(text)
    } catch { body = {} }

    const { orderId } = body ?? {}
    if (!orderId) {
      return jsonResponse({ error: 'orderId zorunlu' }, 400)
    }

    // ── Order'i service-role ile cek; tutari ve telefonu DB'den al (mobile'a guvenme).
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, user_id, total_price, total_amount, phone, merchant_oid, items, subtotal_amount, delivery_fee, discount_amount, macro_discount_amount, coupon_id, coupon_code')
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr || !order) {
      return jsonResponse({ error: 'Siparis bulunamadi' }, 404)
    }
    // Baska kullanicinin siparisi icin odeme baslatilamaz.
    if (order.user_id && order.user_id !== user.id) {
      return jsonResponse({ error: 'Unauthorized' }, 403)
    }

    let amountNum = Number(order.total_price ?? order.total_amount ?? 0)
    if (!amountNum || amountNum <= 0) {
      return jsonResponse({ error: 'Siparis tutari gecersiz' }, 400)
    }

    // ── A-BACKSTOP: charge'dan ONCE tutari GUNCEL products.price'tan yeniden hesapla.
    // Sadece BAZ fiyat duzeltilir; gramaj/opsiyon modifier'lari order item'indan
    // (selected_options price_modifier + legacy_selected_options.extraPrice) AYNEN korunur.
    // -> idempotent + fiyat formulunu yeniden replike etme riski YOK. Bayat sepetten
    // gelen eski fiyat (stale-cache) burada duzeltilir; Paynkolay tutari DB'den okur.
    // Hata olursa stored total'a duser -> odeme akisi BOZULMAZ.
    const recomputeUpdate: Record<string, unknown> = {}
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

        let changed = false
        const newItems = items.map((it) => {
          const p = pmap.get(parseInt(String(it?.id), 10))
          if (!p) return it // urun bulunamadi -> dokunma (defansif)
          const baseServer = effPrice(p.price, p.discount_type, p.discount_value)
          const tplMod = Array.isArray(it?.selected_options)
            ? it.selected_options.reduce((s: number, o: any) => s + (Number(o?.price_modifier) || 0), 0)
            : 0
          const extra = Number(it?.legacy_selected_options?.extraPrice) || 0
          const correctUnit = round2(baseServer + tplMod + extra)
          const qty = Number(it?.quantity) || 1
          if (round2(Number(it?.unit_price)) !== correctUnit) changed = true
          return { ...it, unit_price: correctUnit, total_price: round2(correctUnit * qty) }
        })

        const newSubtotal = round2(newItems.reduce((s, it) => s + (Number(it?.total_price) || 0), 0))

        // macro: profiles.privileged_until > now -> %20, degilse 0 (server-truth)
        let macroDiscount = 0
        const { data: prof } = await admin
          .from('profiles').select('privileged_until').eq('id', order.user_id).maybeSingle()
        const pu = prof?.privileged_until ? new Date(prof.privileged_until) : null
        if (pu && pu.getTime() > Date.now()) macroDiscount = round2(newSubtotal * 0.20)

        // kupon: campaigns'tan yeniden hesapla; bulunamaz/pasifse stored discount KORUNUR (defansif)
        let discount = Number(order.discount_amount) || 0
        if (order.coupon_id || order.coupon_code) {
          const campQuery = admin
            .from('campaigns')
            .select('discount_type, discount_value, min_cart_total, max_discount, is_active')
          const { data: camp } = order.coupon_id
            ? await campQuery.eq('id', order.coupon_id).maybeSingle()
            : await campQuery.eq('code', order.coupon_code).maybeSingle()
          if (camp && camp.is_active !== false) {
            const minCart = Number(camp.min_cart_total) || 0
            if (newSubtotal >= minCart) {
              const v = Number(camp.discount_value) || 0
              let d = (camp.discount_type === 'percent' || camp.discount_type === 'percentage')
                ? Math.floor(newSubtotal * (v / 100))
                : Math.min(v, newSubtotal)
              const maxD = Number(camp.max_discount) || 0
              if (maxD > 0) d = Math.min(d, maxD)
              discount = round2(d)
            } else {
              discount = 0 // sepet min altina dustu
            }
          }
        }

        const deliveryFee = Number(order.delivery_fee) || 0
        const newTotal = round2(Math.max(0, newSubtotal + deliveryFee - discount - macroDiscount))

        if (newTotal > 0) {
          if (changed || round2(amountNum) !== newTotal) {
            console.log('[paynkolay-init] price recompute', { orderId: order.id, oldTotal: amountNum, newTotal })
          }
          amountNum = newTotal
          recomputeUpdate.items = newItems
          recomputeUpdate.subtotal_amount = newSubtotal
          recomputeUpdate.discount_amount = discount
          recomputeUpdate.macro_discount_amount = macroDiscount
          recomputeUpdate.total_amount = newTotal
          recomputeUpdate.total_price = newTotal
        }
      }
    } catch (e) {
      console.error('[paynkolay-init] recompute failed, stored total kullanilacak:', (e as Error).message)
    }

    const amount = toDecimalTL(amountNum) // "150.00" (recompute sonrasi guncel tutar)

    // ── Telefon (customerKey kaynagi): profiles.phone, fallback orders.phone.
    let phone = ''
    const { data: profile } = await admin
      .from('profiles')
      .select('phone')
      .eq('id', user.id)
      .maybeSingle()
    phone = normalizePhone(profile?.phone ?? order.phone ?? '')

    // ── clientRefCode: orderId'yi gomer (callback'te map icin) + benzersizlik.
    const clientRefCode = `KCAL${order.id}T${Date.now()}`

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    // Query key 'pk' (result DEGIL): mobil WebView 'result=' query'sini "donus" sayip
    // callback URL'ine navigasyonu kesiyordu -> callback hic kosmuyordu. 'pk' ile
    // callback URL'i mobilin yakalama desenine takilmaz; callback calisir, ardindan
    // eatkcal.com/payment/success'e redirect eder, mobil ASIL donusu orada yakalar.
    // Callback bu query'yi OKUMAZ; basari/fail RESPONSE_CODE==='2' ile belirlenir.
    const successUrl = `${supabaseUrl}/functions/v1/paynkolay-callback?pk=success`
    const failUrl = `${supabaseUrl}/functions/v1/paynkolay-callback?pk=fail`
    const rnd = getRnd() // "dd.MM.yyyy HH:mm:ss" — hem form hem hash AYNI deger
    const cardHolderIP = clientIpFromRequest(req)

    // ── Kart saklama feature-flag: KAPALIYKEN customerKey BOS, csCustomerKey/csAutoSave YOK.
    //    Hash formulunde customerKey bos string olarak yer alir.
    const useCardSave = CARD_SAVE_ENABLED && phone.length > 0
    const customerKey = useCardSave ? phone : ''

    // ── Request hash (secret ASLA response'a girmez).
    // PHP/Python 8-parca varyant (baseline). "Gecersiz anahtar" sx kaynakli
    // gorundu -> once env trim ile cozulup cozulmedigine bakilacak.
    const hashDataV2 = await generatePaynkolayHash([
      SX,
      clientRefCode,
      amount,
      successUrl,
      failUrl,
      rnd,
      customerKey, // flag kapaliysa ''
      SECRET_KEY,
    ])

    // ── VPOS'a gidecek form alanlari (resmi ornek formla hizalandi).
    //    currencyCode/instalments: sadece form alani — HASH'E DAHIL DEGIL.
    const fields: Record<string, string> = {
      sx: SX,
      clientRefCode,
      amount,
      currencyCode: CURRENCY_CODE,
      successUrl,
      failUrl,
      rnd,
      use3D: 'true',
      transactionType: 'sales',
      instalments: '',
      cardHolderIP,
      hashDataV2,
    }
    // agentCode: yalnizca sub-merchant secret'i tanimliysa gonderilir.
    // KCAL tek merchant -> secret yok -> alan forma hic eklenmez.
    if (AGENT_CODE) {
      fields.agentCode = AGENT_CODE
    }
    if (useCardSave) {
      fields.csCustomerKey = customerKey
      fields.csAutoSave = 'true'
    }

    const formHtml = buildAutoSubmitForm(VPOS_URL, fields)

    // ── merchant_oid: callback artik orderId'yi clientRefCode'dan parse ediyor;
    //    lookup buna BAGIMLI DEGIL. Yine de ILK ref'i audit icin sakla: sadece
    //    null ise yaz, sonraki denemelerde KORU (eski overwrite bug'inin temizligi
    //    — her init merchant_oid'i ezip eski callback'leri eslesmez yapiyordu).
    const orderUpdate: Record<string, unknown> = {
      payment_provider: 'paynkolay',
      updated_at: new Date().toISOString(),
      // A-backstop: yeniden hesaplanan tutar/kalemler (bossa varsa). Bos ise no-op.
      ...recomputeUpdate,
    }
    if (!order.merchant_oid) {
      orderUpdate.merchant_oid = clientRefCode
    }
    const { error: updErr } = await admin
      .from('orders')
      .update(orderUpdate)
      .eq('id', order.id)
    if (updErr) {
      console.error('[paynkolay-init] order update failed:', updErr.message)
    }

    // GUVENLI LOG: secret/sx DEGERI yok. sxLen tam sx kontrolu icin (~250 beklenir;
    // 26 ise secret kisaltilmis demektir). Deger sizmaz, sadece uzunluk.
    console.log('[paynkolay-init]', {
      orderId: order.id,
      clientRefCode,
      amount,
      cardSave: useCardSave,
      sxLen: SX.length,
    })

    return jsonResponse({ success: true, formHtml })
  } catch (err) {
    console.error('[paynkolay-init] error:', String(err))
    return jsonResponse({ error: 'Odeme baslatilamadi' }, 500)
  }
})
