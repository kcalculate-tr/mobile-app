import { createClient } from '@supabase/supabase-js'
import { cancelOrRefundTransaction, chooseRefundType } from '../_shared/paynkolay-refund.ts'

// ── Paynkolay İptal/İade (CancelRefundPayment) ──────────────────────────────
// ASIL PARA İADESİ. KRİTİK işlem -> sıkı guard'lar + admin auth.
//
// type OTOMATİK: trxDate == bugün (TR) -> 'cancel' (aynı gün), değilse -> 'refund'.
// YEDEK: aynı gün 'cancel' PaynKolay'ca reddedilirse (ör. gün sonu kesintisi) 'refund' denenir
// (ağ hatası/zaman aşımı gibi BELİRSİZ durumda denenmez). Çağrı/hash/başarı kuralı
// _shared/paynkolay-refund.ts'te — Kart Ekle doğrulama iadesiyle ORTAK.
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
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

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
    if (!CANCEL_SX || !SECRET_KEY || !VPOS_URL) {
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

    // ── type OTOMATİK: aynı gün -> cancel, değilse -> refund (yedek: cancel reddedilirse refund)
    const plannedType = chooseRefundType(trxDate)

    // ── DRY-RUN (regresyon/teşhis): guard'lar + referenceCode/trxDate çözümü + tip seçimi
    //    çalışır, PaynKolay'a HİÇ çağrı yapılmaz, DB'ye HİÇ yazılmaz.
    if (body?.dryRun === true) {
      return jsonResponse({
        success: true,
        dryRun: true,
        plan: {
          orderId: order.id,
          type: plannedType,
          fallbackType: plannedType === 'cancel' ? 'refund' : null,
          amount: amountStr,
          referenceCode,
          trxDate,
        },
      })
    }

    // ── CancelRefundPayment (ortak servis)
    const result = await cancelOrRefundTransaction(
      { cancelSx: CANCEL_SX, secretKey: SECRET_KEY, vposUrl: VPOS_URL },
      { referenceCode, trxDate, amount: amountStr },
    )
    // Ağ hatası/zaman aşımı (PaynKolay'a hiç ulaşılamadı / belirsiz): eski davranış —
    // audit satırı yazmadan 502 (iade gerçekleşmiş olabilir, "reddedildi" denmez).
    if (result.attempts[result.attempts.length - 1]?.networkError) {
      console.error('[paynkolay-refund] CancelRefund fetch error:', result.attempts[result.attempts.length - 1]?.message)
      return jsonResponse({ error: 'Paynkolay iade API erisilemedi' }, 502)
    }
    const type = result.type // başarılıysa başarılı olan tip; değilse son denenen
    const isSuccess = result.ok
    const responseCode = result.responseCode
    const responseMessage = result.message
    const httpStatus = result.attempts[result.attempts.length - 1]?.httpStatus ?? 0
    const providerJson: Record<string, unknown> =
      result.raw && typeof result.raw === 'object' && !Array.isArray(result.raw)
        ? { ...(result.raw as Record<string, unknown>) }
        : { raw: result.raw }
    // Denemeler (tip/kod/HTTP) audit'e eklenir — secret/sx/hash YOK.
    providerJson.attempts = result.attempts.map((a) => ({
      type: a.type, ok: a.ok, httpStatus: a.httpStatus, responseCode: a.responseCode, networkError: a.networkError,
    }))

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
        orderId: order.id, type, responseCode, httpStatus, attempts: result.attempts.length,
      })
      return jsonResponse({
        success: false,
        error: 'Iade Paynkolay tarafindan onaylanmadi — order degismedi',
        responseCode,
        reason: responseMessage || undefined,
        attemptedTypes: result.attempts.map((a) => a.type),
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
      orderId: order.id, type, amount: amountStr, fellBack: result.fellBack,
    })

    return jsonResponse({
      success: true,
      orderId: order.id,
      type,                 // cancel | refund (başarılı olan)
      fellBack: result.fellBack, // cancel reddedildi, refund ile tamamlandı
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
