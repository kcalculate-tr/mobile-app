import { createClient } from '@supabase/supabase-js'
import { isAllowlistedAdmin, PaynkolayReportError, queryPaynkolayTransactionReport } from '../_shared/paynkolay-cards.ts'

// ── Paynkolay Reporting (PfTransactionReportList) sorgulama ─────────────────
// Amac: (a) bir order'in Paynkolay'daki durumunu (SUCCESS/ERROR/NEW) sorgula,
//       (b) refsiz order icin referenceCode'u COZ (iade/CancelRefundPayment fallback).
//
// SADECE OKUMA — para hareketi YOK. Yine de admin auth ZORUNLU (islem verisi hassas).
//
// AUTH (4 katman, onayli model — init ile tutarli):
//   1) verify_jwt=true (config.toml, ADIM 5) — gateway gecersiz JWT'yi reddeder
//   2) getUser() — caller user_id + email
//   3) admin_allowlist teyidi (service-role; user_id, fallback email) — yoksa 403
//   4) admin ise devam
//
// Sorgu mantigi (hash, tarih araligi, yanit parse) artik _shared/paynkolay-cards.ts
// icinde — paynkolay-cards (pay, non-3D hash fallback) ile PAYLASILIR.
//
// GUVENLIK: PAYNKOLAY_SECRET_KEY / PAYNKOLAY_REPORT_SX response'a/loga KONMAZ.

const REPORT_SX = (Deno.env.get('PAYNKOLAY_REPORT_SX') ?? '').trim()
const SECRET_KEY = (Deno.env.get('PAYNKOLAY_SECRET_KEY') ?? '').trim()
const VPOS_URL = (Deno.env.get('PAYNKOLAY_VPOS_URL') ?? '').trim()

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!REPORT_SX || !SECRET_KEY || !VPOS_URL) {
      return jsonResponse({ error: 'Paynkolay reporting yapilandirmasi eksik' }, 500)
    }

    // ── AUTH 2: getUser
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

    // ── AUTH 3: admin_allowlist teyidi (service-role)
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
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

    // ── Order (service-role) — merchant_oid (= clientRefCode) + tarih + mevcut ref
    const { data: order, error: orderErr } = await admin
      .from('orders')
      .select('id, merchant_oid, created_at, paynkolay_reference_code, paynkolay_trx_date')
      .eq('id', orderId)
      .maybeSingle()

    if (orderErr || !order) {
      return jsonResponse({ error: 'Siparis bulunamadi' }, 404)
    }
    const merchantOid = String(order.merchant_oid ?? '')
    if (!merchantOid) {
      return jsonResponse({ error: 'Sipariste merchant_oid (clientRefCode) yok — Paynkolay ile odenmemis' }, 400)
    }

    const created = order.created_at ? new Date(order.created_at) : new Date()

    let report
    try {
      report = await queryPaynkolayTransactionReport(
        { reportSx: REPORT_SX, secretKey: SECRET_KEY, vposUrl: VPOS_URL },
        merchantOid,
        created,
      )
    } catch (e) {
      if (e instanceof PaynkolayReportError) {
        console.error('[paynkolay-query] reporting error:', e.message, e.httpStatus)
        return jsonResponse({ error: e.message, httpStatus: e.httpStatus, detail: e.detail }, e.httpStatus ? 502 : 500)
      }
      console.error('[paynkolay-query] reporting fetch error:', e)
      return jsonResponse({ error: 'Paynkolay reporting API erisilemedi' }, 502)
    }

    if (!report.found) {
      return jsonResponse({
        success: true,
        found: false,
        message: 'Paynkolay\'da bu clientReferenceCode icin kayit bulunamadi',
        clientReferenceCode: merchantOid,
        range: report.range,
        matchCount: 0,
      }, 200)
    }

    // ── Cache: bulunan referans/trxDate'i order'a yaz (bos olanlari) -> bir dahaki
    //    iadede query gerekmez. Var olani EZME (callback'in yazdigini koru).
    const cacheUpd: Record<string, unknown> = {}
    if (report.referenceCode && !order.paynkolay_reference_code) cacheUpd.paynkolay_reference_code = report.referenceCode
    if (report.trxDate && !order.paynkolay_trx_date) cacheUpd.paynkolay_trx_date = report.trxDate
    if (Object.keys(cacheUpd).length > 0) {
      const { error: updErr } = await admin.from('orders').update(cacheUpd).eq('id', order.id)
      if (updErr) console.error('[paynkolay-query] cache update failed:', updErr.message)
    }

    console.log('[paynkolay-query]', {
      orderId: order.id,
      clientRef: merchantOid,
      found: true,
      status: report.status,
      cached: Object.keys(cacheUpd),
    })

    return jsonResponse({
      success: true,
      found: true,
      referenceCode: report.referenceCode,
      status: report.status,                 // SUCCESS | ERROR | NEW
      transactionType: report.transactionType,
      trxDate: report.trxDate,                // yyyy.mm.dd (normalize) — iade trxDate kaynagi
      trxDateRaw: report.trxDateRaw,          // Paynkolay ham degeri (teshis)
      clientReferenceCode: merchantOid,
      range: report.range,
    })
  } catch (err) {
    console.error('[paynkolay-query] error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
