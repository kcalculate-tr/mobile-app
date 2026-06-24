import { createClient } from '@supabase/supabase-js'

// ── Paynkolay İptal/İade (CancelRefundPayment) ──────────────────────────────
// ASIL PARA İADESİ. KRİTİK işlem -> sıkı guard'lar + admin auth.
//
// type OTOMATİK: trxDate == bugün (TR) -> 'cancel' (aynı gün), değilse -> 'refund'.
// referenceCode/trxDate order'da yoksa -> paynkolay-query'yi HTTP ile ÇAĞIR
// (hash mantığı TEK kaynakta = query/init/callback; burada KOPYALANMAZ).
//
// AUTH (query ile AYNI 4 katman): verify_jwt + getUser + admin_allowlist (service-role).
//
// ⚠️ BAŞARISIZ iadede order'a DOKUNULMAZ (eski kozmetik açığın tersi): Paynkolay
//    responseCode==='2' onaylamadıkça DB'de order 'refunded' OLMAZ.
//
// GÜVENLİK: PAYNKOLAY_SECRET_KEY / PAYNKOLAY_CANCEL_SX response'a/loga KONMAZ.

const CANCEL_SX = (Deno.env.get('PAYNKOLAY_CANCEL_SX') ?? '').trim()
const SECRET_KEY = (Deno.env.get('PAYNKOLAY_SECRET_KEY') ?? '').trim()
const VPOS_URL = (Deno.env.get('PAYNKOLAY_VPOS_URL') ?? '').trim() // ".../Vpos"
// CancelRefundPayment endpoint VPOS_URL'den türetilir (test/prod otomatik takip).
//   prod: https://paynkolay.nkolayislem.com.tr/Vpos/v1/CancelRefundPayment
const CANCEL_URL = VPOS_URL ? `${VPOS_URL}/v1/CancelRefundPayment` : ''

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// ── Hash: parts.join('|') -> UTF-8 -> SHA-512 (binary) -> base64 (init/callback/query AYNI).
async function generatePaynkolayHash(parts: string[]): Promise<string> {
  const hashString = parts.join('|')
  const data = new TextEncoder().encode(hashString)
  const hashBuffer = await crypto.subtle.digest('SHA-512', data)
  const bytes = new Uint8Array(hashBuffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

// Bugün TR (GMT+3) tarihi yyyy.mm.dd — type (cancel/refund) kararı için.
function todayTR(): string {
  const now = new Date()
  const tr = new Date(now.getTime() + 3 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${tr.getUTCFullYear()}.${pad(tr.getUTCMonth() + 1)}.${pad(tr.getUTCDate())}`
}

// admin_allowlist teyidi (service-role; user_id, fallback email) — query ile AYNI.
async function isAllowlistedAdmin(
  admin: ReturnType<typeof createClient>,
  userId: string,
  email: string | undefined,
): Promise<boolean> {
  const byId = await admin.from('admin_allowlist').select('id').eq('user_id', userId).maybeSingle()
  if (byId.data) return true
  if (email) {
    const byEmail = await admin.from('admin_allowlist').select('id').eq('email', email).maybeSingle()
    if (byEmail.data) return true
  }
  return false
}

// referenceCode/trxDate order'da yoksa paynkolay-query'yi HTTP ile çağır.
// Caller JWT'si iletilir -> query'nin admin kontrolü geçer. Hash query'de hesaplanır.
async function resolveViaQuery(
  authHeader: string,
  orderId: number,
): Promise<{ referenceCode: string; trxDate: string } | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/paynkolay-query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader, // caller JWT
        'apikey': ANON_KEY,          // gateway apikey
      },
      body: JSON.stringify({ orderId }),
    })
    const j = await res.json().catch(() => null)
    if (!res.ok || !j?.found) return null
    const referenceCode = String(j.referenceCode ?? '')
    const trxDate = String(j.trxDate ?? '')
    if (!referenceCode) return null
    return { referenceCode, trxDate }
  } catch (e) {
    console.error('[paynkolay-refund] query fallback error:', e)
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!CANCEL_SX || !SECRET_KEY || !CANCEL_URL) {
      return jsonResponse({ error: 'Paynkolay iade yapilandirmasi eksik' }, 500)
    }

    // ── AUTH 2: getUser (caller JWT)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
    const authedClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await authedClient.auth.getUser()
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    // ── AUTH 3: admin_allowlist (service-role)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const allowed = await isAllowlistedAdmin(admin, user.id, user.email ?? undefined)
    if (!allowed) {
      return jsonResponse({ error: 'Forbidden — admin yetkisi yok' }, 403)
    }

    // ── Girdi
    let body: any = {}
    try {
      const text = await req.text()
      if (text) body = JSON.parse(text)
    } catch { body = {} }

    const orderId = body?.orderId ? Number(body.orderId) : NaN
    if (!orderId || Number.isNaN(orderId)) {
      return jsonResponse({ error: 'orderId zorunlu' }, 400)
    }
    const reason = String(body?.reason ?? '').trim()

    // ── Order (service-role)
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, merchant_oid, status, payment_status, total_price, payment_total_amount, refunded_at, paynkolay_reference_code, paynkolay_trx_date')
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr || !order) {
      return jsonResponse({ error: 'Siparis bulunamadi' }, 404)
    }

    // ── GUARD 1: çift iade engeli (KRİTİK)
    if (order.status === 'refunded' || order.refunded_at) {
      return jsonResponse({ error: 'Bu siparis zaten iade edilmis', alreadyRefunded: true }, 409)
    }
    // ── GUARD 2: ödenmemiş order iade edilemez
    const isPaid = order.payment_status === 'paid' || order.status === 'confirmed'
    if (!isPaid) {
      return jsonResponse({ error: 'Siparis odenmemis (confirmed/paid degil) — iade edilemez' }, 400)
    }
    // ── GUARD 3: merchant_oid (Paynkolay ile ödenmiş mi)
    const merchantOid = String(order.merchant_oid ?? '')
    if (!merchantOid) {
      return jsonResponse({ error: 'Sipariste merchant_oid yok — Paynkolay ile odenmemis' }, 400)
    }
    // ── GUARD 4: tutar (kısmi izinli, ödeneni AŞAMAZ)
    const paidAmount = Number(order.payment_total_amount ?? order.total_price ?? 0)
    if (!paidAmount || paidAmount <= 0) {
      return jsonResponse({ error: 'Siparis odeme tutari gecersiz' }, 400)
    }
    const requested = body?.amount != null ? Number(body.amount) : paidAmount
    if (!requested || requested <= 0 || requested > paidAmount) {
      return jsonResponse({ error: `Gecersiz iade tutari (0 < amount <= ${paidAmount})` }, 400)
    }
    const amountStr = requested.toFixed(2) // "150.00" (init ile aynı ondalık TL)

    // ── referenceCode + trxDate: order'da varsa kullan, yoksa query fallback
    let referenceCode = String(order.paynkolay_reference_code ?? '')
    let trxDate = String(order.paynkolay_trx_date ?? '')
    if (!referenceCode || !trxDate) {
      const resolved = await resolveViaQuery(authHeader, order.id as number)
      if (resolved) {
        referenceCode = referenceCode || resolved.referenceCode
        trxDate = trxDate || resolved.trxDate
      }
    }
    if (!referenceCode || !trxDate) {
      return jsonResponse({ error: 'Paynkolay referenceCode/trxDate cozulemedi — iade yapilamaz' }, 422)
    }

    // ── type OTOMATİK: aynı gün -> cancel, değilse -> refund
    const type = trxDate === todayTR() ? 'cancel' : 'refund'

    // ── Hash: sx(cancel) | referenceCode | type | amount | trxDate | secret
    const cancelHash = await generatePaynkolayHash([
      CANCEL_SX,
      referenceCode,
      type,
      amountStr,
      trxDate,
      SECRET_KEY,
    ])

    // ── CancelRefundPayment çağrısı (multipart/form-data, hashDatav2 küçük v)
    const form = new FormData()
    form.set('sx', CANCEL_SX)
    form.set('referenceCode', referenceCode)
    form.set('type', type)
    form.set('amount', amountStr)
    form.set('trxDate', trxDate)
    form.set('hashDatav2', cancelHash)

    let providerJson: any = null
    let providerRaw = ''
    let httpOk = false
    let httpStatus = 0
    try {
      const res = await fetch(CANCEL_URL, { method: 'POST', body: form })
      httpStatus = res.status
      httpOk = res.ok
      providerRaw = await res.text()
      try { providerJson = JSON.parse(providerRaw) } catch { providerJson = { raw: providerRaw } }
    } catch (e) {
      console.error('[paynkolay-refund] CancelRefund fetch error:', e)
      return jsonResponse({ error: 'Paynkolay iade API erisilemedi' }, 502)
    }

    const responseCode = String(providerJson?.responseCode ?? providerJson?.RESPONSE_CODE ?? '')
    const responseMessage = String(
      providerJson?.responseData ?? providerJson?.responseMessage ?? providerJson?.RESPONSE_MESSAGE ?? '',
    )
    const isSuccess = httpOk && responseCode === '2'

    if (!isSuccess) {
      // ── BAŞARISIZ: order'a DOKUNMA. Sadece audit (refunds status='failed').
      try {
        await admin.from('refunds').insert({
          order_id: order.id,
          amount: requested,
          reason: reason || null,
          type,
          paynkolay_reference: referenceCode,
          provider_response: providerJson,
          status: 'failed',
          created_at: new Date().toISOString(),
        })
      } catch (e) {
        console.error('[paynkolay-refund] failed-audit insert error:', e)
      }
      console.error('[paynkolay-refund] iade reddedildi', {
        orderId: order.id, type, responseCode, httpStatus,
      })
      return jsonResponse({
        success: false,
        error: 'Iade Paynkolay tarafindan onaylanmadi — order degismedi',
        responseCode,
        reason: responseMessage || undefined,
      }, 502)
    }

    // ── BAŞARILI: order'ı refunded yap + refunds audit (success)
    const refundedAt = new Date().toISOString()
    const { error: updErr } = await admin
      .from('orders')
      .update({
        status: 'refunded',
        refund_amount: requested,
        refunded_at: refundedAt,
        updated_at: refundedAt,
      })
      .eq('id', order.id)
    if (updErr) {
      console.error('[paynkolay-refund] order update failed (iade BAŞARILI ama DB yazılamadı):', updErr.message)
    }

    try {
      await admin.from('refunds').insert({
        order_id: order.id,
        amount: requested,
        reason: reason || null,
        type,
        paynkolay_reference: referenceCode,
        provider_response: providerJson,
        status: 'success',
        refunded_at: refundedAt,
        created_at: refundedAt,
      })
    } catch (e) {
      console.error('[paynkolay-refund] success-audit insert error:', e)
    }

    console.log('[paynkolay-refund] iade BAŞARILI', {
      orderId: order.id, type, amount: amountStr,
    })

    return jsonResponse({
      success: true,
      orderId: order.id,
      type,                 // cancel | refund
      amount: requested,
      referenceCode,
      trxDate,
      refundedAt,
    })
  } catch (err) {
    console.error('[paynkolay-refund] error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
