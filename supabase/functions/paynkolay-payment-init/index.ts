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
// agentCode merchant hesabina ozgu. Test icin resmi ornekteki '1236' fallback;
// production'da PAYNKOLAY_AGENT_CODE secret'i ile gercek deger verilmeli.
const AGENT_CODE = Deno.env.get('PAYNKOLAY_AGENT_CODE') ?? '1236'

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
      .select('id, user_id, total_price, total_amount, phone')
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr || !order) {
      return jsonResponse({ error: 'Siparis bulunamadi' }, 404)
    }
    // Baska kullanicinin siparisi icin odeme baslatilamaz.
    if (order.user_id && order.user_id !== user.id) {
      return jsonResponse({ error: 'Unauthorized' }, 403)
    }

    const amountNum = Number(order.total_price ?? order.total_amount ?? 0)
    if (!amountNum || amountNum <= 0) {
      return jsonResponse({ error: 'Siparis tutari gecersiz' }, 400)
    }
    const amount = toDecimalTL(amountNum) // "150.00"

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
    const successUrl = `${supabaseUrl}/functions/v1/paynkolay-callback?result=success`
    const failUrl = `${supabaseUrl}/functions/v1/paynkolay-callback?result=fail`
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
    //    currencyCode/agentCode/instalments: sadece form alani — HASH'E DAHIL DEGIL.
    const fields: Record<string, string> = {
      sx: SX,
      clientRefCode,
      amount,
      currencyCode: CURRENCY_CODE,
      successUrl,
      failUrl,
      rnd,
      agentCode: AGENT_CODE,
      use3D: 'true',
      transactionType: 'sales',
      instalments: '',
      cardHolderIP,
      hashDataV2,
    }
    if (useCardSave) {
      fields.csCustomerKey = customerKey
      fields.csAutoSave = 'true'
    }

    const formHtml = buildAutoSubmitForm(VPOS_URL, fields)

    // ── merchant_oid = clientRefCode (callback'te lookup icin).
    const { error: updErr } = await admin
      .from('orders')
      .update({
        payment_provider: 'paynkolay',
        merchant_oid: clientRefCode,
        updated_at: new Date().toISOString(),
      })
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
