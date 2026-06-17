// Paynkolay callback handler (successUrl/failUrl). Tosla = payment-verify,
// PayTR = paytr-callback (ayri endpoint'ler).
//
// EN KRITIK FARK (Tosla'da YOKTU): RESPONSE HASH DOGRULAMA.
// Paynkolay form-data POST atar; gelen verinin GERCEKTEN Paynkolay'dan geldigini
// hash ile dogrulariz. Hash tutmazsa order'a DOKUNULMAZ, sahte callback olarak
// reddedilir. Bu, saldirganin sahte "basarili odeme" callback'i gondermesini onler.
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const SECRET_KEY = Deno.env.get('PAYNKOLAY_SECRET_KEY') ?? ''
// Kart saklama yetkisi su an YOK -> default KAPALI. init ile ayni flag.
const CARD_SAVE_ENABLED =
  (Deno.env.get('PAYNKOLAY_CARD_SAVE') ?? 'false').toLowerCase() === 'true'

const FALLBACK_THRESHOLD = 15
const FALLBACK_MEMBERSHIP_DAYS = 30

// Mobil WebView'in onNavigationStateChange ile yakalayacagi son URL'ler.
// Mobil (Faz 2E) bu URL'lerde 'result=success' / 'result=fail' arayacak.
const SUCCESS_REDIRECT = 'https://eatkcal.com/payment/success?result=success'
const FAIL_REDIRECT = 'https://eatkcal.com/payment/fail?result=fail'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Hash: parts.join('|') -> UTF-8 -> SHA-512 (binary) -> base64 (init ile AYNI).
async function generatePaynkolayHash(parts: string[]): Promise<string> {
  const hashString = parts.join('|')
  const data = new TextEncoder().encode(hashString) // UTF-8 byte
  const hashBuffer = await crypto.subtle.digest('SHA-512', data) // binary digest
  const bytes = new Uint8Array(hashBuffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin) // base64
}

// SABIT-ZAMAN string karsilastirma (timing attack korumasi).
// Uzunluk farkliysa bile tum karakterleri gezer; erken cikmaz.
function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a)
  const bBytes = new TextEncoder().encode(b)
  // Uzunluk farki tek basina bilgi sizdirmasin diye sabit uzunlukta gez.
  const len = Math.max(aBytes.length, bBytes.length)
  let diff = aBytes.length ^ bBytes.length
  for (let i = 0; i < len; i++) {
    const x = i < aBytes.length ? aBytes[i] : 0
    const y = i < bBytes.length ? bBytes[i] : 0
    diff |= x ^ y
  }
  return diff === 0
}

// Telefon normalize (init ile ayni) — kart saklamada customerKey kaynagi.
function normalizePhone(raw: unknown): string {
  let s = String(raw ?? '').replace(/[\s()\-]/g, '')
  if (s.startsWith('+90')) s = s.slice(3)
  else if (s.startsWith('90') && s.length === 12) s = s.slice(2)
  if (s.startsWith('0')) s = s.slice(1)
  return s
}

// Birden fazla olasi alan adindan ilk dolu degeri al (UPPER + camelCase tolerans).
function pick(data: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = data[k]
    if (v !== undefined && v !== null && String(v) !== '') return String(v)
  }
  return ''
}

// Mobil WebView'in yakalayacagi son URL'e yonlendiren basit HTML.
function redirectHtml(url: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<meta http-equiv="refresh" content="0;url=${url}" /></head>
<body><script>location.replace(${JSON.stringify(url)});</script></body></html>`
}
function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // ── 1) Form-data (Paynkolay) / JSON parse (payment-verify deseni).
    let data: Record<string, unknown> = {}
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      try {
        const text = await req.text()
        if (text) data = JSON.parse(text)
      } catch { data = {} }
    } else {
      const formData = await req.formData()
      formData.forEach((value, key) => { data[key] = value })
    }

    // ── 2) Alanlari cek (UPPER_CASE + camelCase tolerans).
    const merchantNo = pick(data, 'MERCHANT_NO', 'merchantNo')
    const referenceCode = pick(data, 'REFERENCE_CODE', 'referenceCode')
    const authCode = pick(data, 'AUTH_CODE', 'authCode')
    const responseCode = pick(data, 'RESPONSE_CODE', 'responseCode')
    const use3D = pick(data, 'USE_3D', 'use3D')
    const rnd = pick(data, 'RND', 'rnd')
    const installment = pick(data, 'INSTALLMENT', 'installment')
    const authorizationAmount = pick(data, 'AUTHORIZATION_AMOUNT', 'authorizationAmount')
    const currencyCode = pick(data, 'CURRENCY_CODE', 'currencyCode')
    const incomingHash = pick(data, 'hashDataV2', 'HASHDATAV2', 'hashData')
    const clientRefCode = pick(data, 'clientRefCode', 'CLIENT_REFERENCE_CODE', 'clientReferenceCode')
    const responseMessage = pick(data, 'RESPONSE_MESSAGE', 'responseMessage', 'RESPONSE_DATA')

    // Kart saklama alanlari (flag aciksa + RESPONSE_CODE==='2' iken kullanilir).
    const cardToken = pick(data, 'CardToken', 'cardToken', 'csCardToken', 'CS_CARD_TOKEN')
    const maskedPan = pick(data, 'maskedPan', 'MASKED_PAN', 'maskedCardNo', 'CARD_NO')
    const cardBrand = pick(data, 'cardBrand', 'CARD_BRAND', 'cardProgram')

    // ── 3) clientRefCode -> order'i merchant_oid uzerinden bul (SADECE OKUMA).
    //    Hash dogrulanana kadar order'a DOKUNULMAZ.
    let order: any = null
    if (clientRefCode) {
      const { data: o } = await supabase
        .from('orders')
        .select('id, user_id, total_price, type, macro_quantity, status, payment_status')
        .eq('merchant_oid', clientRefCode)
        .maybeSingle()
      order = o
    }

    // ── 4) RESPONSE HASH DOGRULAMA (sahte callback korumasi).
    //    Sira: MERCHANT_NO|REFERENCE_CODE|AUTH_CODE|RESPONSE_CODE|USE_3D|RND|
    //          INSTALLMENT|AUTHORIZATION_AMOUNT|CURRENCY_CODE|merchantSecretKey
    const expectedHash = await generatePaynkolayHash([
      merchantNo,
      referenceCode,
      authCode,
      responseCode,
      use3D,
      rnd,
      installment,
      authorizationAmount,
      currencyCode,
      SECRET_KEY,
    ])

    const hashValid = !!incomingHash && constantTimeEqual(expectedHash, incomingHash)

    if (!hashValid) {
      // SAHTE / BOZUK CALLBACK: order'a DOKUNMA. Audit'e logla, reddet.
      console.error('[paynkolay-callback] HASH MISMATCH — sahte callback reddedildi', {
        clientRefCode,
        referenceCode,
        responseCode,
        hasIncomingHash: !!incomingHash,
      })
      if (order?.user_id) {
        try {
          await supabase.from('failed_payments').insert([{
            user_id: order.user_id,
            error_message: 'Paynkolay hash mismatch — sahte/bozuk callback reddedildi',
            amount: 0,
            payment_method: 'kredi-karti',
            order_data: {
              reason: 'hash_mismatch',
              clientRefCode,
              referenceCode,
              responseCode,
              raw: data,
            },
            created_at: new Date().toISOString(),
          }])
        } catch (e) {
          console.error('[paynkolay-callback] failed_payments insert error (hash):', e)
        }
      }
      return htmlResponse(redirectHtml(FAIL_REDIRECT))
    }

    // ── Hash GECERLI. Bundan sonra order guncellemesi guvenli.
    if (!order) {
      // Test islemi veya bilinmeyen ref — DB'de eslesme yok.
      console.log('[paynkolay-callback] order bulunamadi, clientRefCode:', clientRefCode)
      return htmlResponse(redirectHtml(FAIL_REDIRECT))
    }

    // ── 5) IDEMPOTENCY: zaten paid ise tekrar isleme (cift callback guvenligi).
    if (order.payment_status === 'paid') {
      console.log('[paynkolay-callback] already paid, skipping order:', order.id)
      return htmlResponse(redirectHtml(SUCCESS_REDIRECT))
    }

    // ── 6) Basari kodu: Paynkolay'da RESPONSE_CODE === '2' finansal onaydir.
    const isSuccess = responseCode === '2'

    console.log('[paynkolay-callback] order transition', {
      orderId: order.id,
      isSuccess,
      responseCode,
      referenceCode,
      previousStatus: order.status ?? null,
    })

    // ── 7) Orders update.
    const updatePayload: Record<string, unknown> = {
      status: isSuccess ? 'confirmed' : 'payment_failed',
      payment_status: isSuccess ? 'paid' : 'failed',
      payment_provider: 'paynkolay',
      updated_at: new Date().toISOString(),
    }
    if (!isSuccess) {
      updatePayload.payment_failure_reason =
        responseMessage || `Paynkolay red (RESPONSE_CODE=${responseCode || 'bilinmiyor'})`
    }
    const { error: updateError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', order.id)
    if (updateError) {
      console.error('[paynkolay-callback] order update error:', updateError)
    }

    // ── 8) FAILED_PAYMENTS audit (basarisiz odeme).
    if (!isSuccess && order.user_id) {
      try {
        await supabase.from('failed_payments').insert([{
          user_id: order.user_id,
          error_message: responseMessage || `Odeme basarisiz (RESPONSE_CODE=${responseCode || 'bilinmiyor'})`,
          amount: 0,
          payment_method: 'kredi-karti',
          order_data: {
            orderId: order.id,
            clientRefCode,
            referenceCode,
            authCode,
            responseCode,
            raw: data,
          },
          created_at: new Date().toISOString(),
        }])
      } catch (e) {
        console.error('[paynkolay-callback] failed_payments insert error:', e)
      }
    }

    // ── 9) KART SAKLAMA (flag aciksa + basari + CardToken geldiyse).
    //    Flag KAPALIYKEN bu blok hic calismaz (CardToken zaten gelmez).
    if (CARD_SAVE_ENABLED && isSuccess && cardToken && order.user_id) {
      try {
        await saveUserCard(supabase, order.user_id, cardToken, maskedPan, cardBrand)
      } catch (e) {
        // Odeme zaten gecti; kart kaydi best-effort. Rollback yok.
        console.error('[paynkolay-callback] saveUserCard failed for order', order.id, e)
      }
    }

    // ── 10) Macro purchase tamamlama (payment-verify deseni).
    if (isSuccess && order.type === 'macro_purchase' && order.status !== 'confirmed') {
      try {
        await completeMacroPurchase(supabase, order)
      } catch (macroErr) {
        console.error('[macro] completeMacroPurchase FAILED for order', order.id, macroErr)
      }
    }

    // ── 11) Mobil WebView'i yakalayacagi son URL'e yonlendir.
    return htmlResponse(redirectHtml(isSuccess ? SUCCESS_REDIRECT : FAIL_REDIRECT))
  } catch (err) {
    console.error('[paynkolay-callback] error:', err)
    // Paynkolay'a hata patlatma; fail sayfasina yonlendir.
    return htmlResponse(redirectHtml(FAIL_REDIRECT))
  }
})

// ── Kart kaydet: UNIQUE(user_id, card_token) catismasini yut; ilk kartsa default.
async function saveUserCard(
  supabase: SupabaseClient,
  userId: string,
  cardToken: string,
  maskedPan: string,
  cardBrand: string,
): Promise<void> {
  // Zaten kayitliysa atla (UNIQUE(user_id, card_token)).
  const { data: existing } = await supabase
    .from('user_cards')
    .select('id')
    .eq('user_id', userId)
    .eq('card_token', cardToken)
    .maybeSingle()
  if (existing) return

  // Kullanicinin baska karti var mi? Yoksa bu kart default olsun.
  const { count } = await supabase
    .from('user_cards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  const isFirstCard = (count ?? 0) === 0

  // customerKey = normalize telefon (init'te de bu gonderildi).
  const { data: profile } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', userId)
    .maybeSingle()
  const customerKey = normalizePhone(profile?.phone ?? '')

  // Mevcut tablo semasi: last4 (varchar) + brand (varchar) — masked_pan/card_brand YOK.
  // Paynkolay masked PAN'inin son 4 hanesini last4'e yaz.
  const last4 = String(maskedPan ?? '').replace(/\D/g, '').slice(-4)

  await supabase.from('user_cards').insert([{
    user_id: userId,
    paynkolay_customer_key: customerKey,
    card_token: cardToken,
    last4: last4 || null,
    brand: cardBrand || null,
    is_default: isFirstCard,
  }])
}

type MacroOrder = {
  id: number | string
  user_id: string
  total_price: number | null
  type: string
  macro_quantity: number | null
}

async function completeMacroPurchase(
  supabase: SupabaseClient,
  order: MacroOrder,
): Promise<void> {
  const macroQty = Number(order.macro_quantity ?? 0)
  if (!macroQty || macroQty <= 0) {
    console.warn('[macro] macro_purchase order without macro_quantity', order.id)
    return
  }
  if (!order.user_id) {
    console.warn('[macro] macro_purchase order without user_id', order.id)
    return
  }

  const { data: settings } = await supabase
    .from('settings')
    .select('macro_threshold, macro_membership_days')
    .eq('id', 1)
    .maybeSingle()

  const threshold = Number(settings?.macro_threshold ?? FALLBACK_THRESHOLD)
  const membershipDays = Number(settings?.macro_membership_days ?? FALLBACK_MEMBERSHIP_DAYS)

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('macro_balance, total_macros_purchased, privileged_until')
    .eq('id', order.user_id)
    .maybeSingle()

  if (profileErr || !profile) {
    console.error('[macro] profile not found for order', order.id, profileErr)
    return
  }

  const newBalance = Number(profile.macro_balance ?? 0) + macroQty
  const newTotal = Number(profile.total_macros_purchased ?? 0) + macroQty

  const wasPrivilegedActive =
    !!profile.privileged_until && new Date(profile.privileged_until) > new Date()

  let privilegedUntil: string | null = profile.privileged_until
  let unlockedMembership = false

  if (newBalance >= threshold) {
    const base = wasPrivilegedActive
      ? new Date(profile.privileged_until as string)
      : new Date()
    base.setDate(base.getDate() + membershipDays)
    privilegedUntil = base.toISOString()
    if (!wasPrivilegedActive) unlockedMembership = true
  }

  const update: Record<string, unknown> = {
    macro_balance: newBalance,
    total_macros_purchased: newTotal,
  }
  if (privilegedUntil !== profile.privileged_until) {
    update.privileged_until = privilegedUntil
  }

  const { error: updateErr } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', order.user_id)

  if (updateErr) {
    console.error('[macro] profile update failed for order', order.id, updateErr)
    return
  }

  await supabase.from('macro_transactions').insert({
    user_id: order.user_id,
    type: 'purchase',
    amount: macroQty,
    price_paid: Number(order.total_price ?? 0),
    order_id: typeof order.id === 'number' ? order.id : Number(order.id),
    note: `${macroQty} Macro Coin satin alindi`,
  })

  if (unlockedMembership) {
    await supabase.from('macro_transactions').insert({
      user_id: order.user_id,
      type: 'membership_unlock',
      amount: 0,
      note: `Ayricalikli uyelik aktiflesti — ${membershipDays} gun`,
    })
  }
}
