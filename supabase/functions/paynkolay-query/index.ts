import { createClient } from '@supabase/supabase-js'

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
// GUVENLIK: PAYNKOLAY_SECRET_KEY / PAYNKOLAY_REPORT_SX response'a/loga KONMAZ.

// Env (Supabase secrets) — mobile/panel ASLA inmez.
const REPORT_SX = (Deno.env.get('PAYNKOLAY_REPORT_SX') ?? '').trim()
const SECRET_KEY = (Deno.env.get('PAYNKOLAY_SECRET_KEY') ?? '').trim()
const VPOS_URL = (Deno.env.get('PAYNKOLAY_VPOS_URL') ?? '').trim() // ".../Vpos"
// Reporting endpoint VPOS_URL'den turetilir -> test/prod otomatik VPOS_URL'i takip eder.
//   prod : https://paynkolay.nkolayislem.com.tr/Vpos/Payment/PfTransactionReportList
//   test : https://paynkolaytest.nkolayislem.com.tr/Vpos/Payment/PfTransactionReportList
const REPORT_URL = VPOS_URL ? `${VPOS_URL}/Payment/PfTransactionReportList` : ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// ── Hash: parts.join('|') -> UTF-8 -> SHA-512 (binary) -> base64 (init/callback ile AYNI).
async function generatePaynkolayHash(parts: string[]): Promise<string> {
  const hashString = parts.join('|')
  const data = new TextEncoder().encode(hashString)
  const hashBuffer = await crypto.subtle.digest('SHA-512', data)
  const bytes = new Uint8Array(hashBuffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

// Reporting startDate/endDate formati: DD.MM.YYYY (UTC tabanli; ±3 gun marji
// timezone farkini zaten yutar).
function fmtDDMMYYYY(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`
}

// Reporting trxDate -> orders.paynkolay_trx_date formati (yyyy.mm.dd) normalize.
// Hem "2026-06-24 .." (YYYY-MM-DD) hem "24.06.2026 .." (DD.MM.YYYY) toleransli.
function toYmdDots(raw: string): string {
  const s = String(raw ?? '').trim()
  let m = /^(\d{4})[.\-](\d{2})[.\-](\d{2})/.exec(s)
  if (m) return `${m[1]}.${m[2]}.${m[3]}`
  m = /^(\d{2})[.\-](\d{2})[.\-](\d{4})/.exec(s)
  if (m) return `${m[3]}.${m[2]}.${m[1]}`
  return ''
}

// Caller'in admin_allowlist'te olup olmadigini service-role ile teyit et
// (App.jsx guard'i ile ayni: once user_id, sonra email fallback).
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!REPORT_SX || !SECRET_KEY || !REPORT_URL) {
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

    // ── Tarih araligi: order tarihi merkez, ±3 gun. endDate gelecekte olmasin
    //    (bugune kadar). Boylece max 1 ay siniri da asilmaz (pencere ~6 gun).
    const created = order.created_at ? new Date(order.created_at) : new Date()
    const start = new Date(created.getTime() - 3 * 86400000)
    let end = new Date(created.getTime() + 3 * 86400000)
    const now = new Date()
    if (end.getTime() > now.getTime()) end = now
    const startDate = fmtDDMMYYYY(start)
    const endDate = fmtDDMMYYYY(end)

    // ── Hash: sx | startDate | endDate | clientReferenceCode | referenceCode | secret
    //    clientReferenceCode = merchant_oid; referenceCode = '' (clientRef ile sorgu).
    const reportHash = await generatePaynkolayHash([
      REPORT_SX,
      startDate,
      endDate,
      merchantOid,
      '', // referenceCode (sorgulamiyoruz) -> hash'te bos string
      SECRET_KEY,
    ])

    // ── Reporting API: POST multipart/form-data (hashDatav2 — kucuk 'v').
    const form = new FormData()
    form.set('sx', REPORT_SX)
    form.set('startDate', startDate)
    form.set('endDate', endDate)
    form.set('clientReferenceCode', merchantOid)
    form.set('referenceCode', '')
    form.set('hashDatav2', reportHash)

    let reportJson: any = null
    let reportRaw = ''
    try {
      const res = await fetch(REPORT_URL, { method: 'POST', body: form })
      reportRaw = await res.text()
      try { reportJson = JSON.parse(reportRaw) } catch { reportJson = { raw: reportRaw } }
      if (!res.ok) {
        console.error('[paynkolay-query] reporting HTTP', res.status)
        return jsonResponse({ error: 'Paynkolay reporting API hatasi', httpStatus: res.status, detail: reportJson }, 502)
      }
    } catch (e) {
      console.error('[paynkolay-query] reporting fetch error:', e)
      return jsonResponse({ error: 'Paynkolay reporting API erisilemedi' }, 502)
    }

    // ── Yanit: List[] icinden clientReferenceCode eslesen, tercihen SALES kaydi.
    const list: any[] = Array.isArray(reportJson?.List) ? reportJson.List
      : Array.isArray(reportJson?.list) ? reportJson.list
      : []
    const matches = list.filter((t) => String(t?.clientReferenceCode ?? '') === merchantOid)
    const sale = matches.find((t) => String(t?.transactionType ?? '').toUpperCase() === 'SALES')
      ?? matches[0]
      ?? null

    if (!sale) {
      return jsonResponse({
        success: true,
        found: false,
        message: 'Paynkolay\'da bu clientReferenceCode icin kayit bulunamadi',
        clientReferenceCode: merchantOid,
        range: { startDate, endDate },
        matchCount: matches.length,
      }, 200)
    }

    const referenceCode = String(sale.referenceCode ?? '')
    const status = String(sale.status ?? '')
    const trxDateRaw = String(sale.trxDate ?? '')
    const trxDate = toYmdDots(trxDateRaw)

    // ── Cache: bulunan referans/trxDate'i order'a yaz (bos olanlari) -> bir dahaki
    //    iadede query gerekmez. Var olani EZME (callback'in yazdigini koru).
    const cacheUpd: Record<string, unknown> = {}
    if (referenceCode && !order.paynkolay_reference_code) cacheUpd.paynkolay_reference_code = referenceCode
    if (trxDate && !order.paynkolay_trx_date) cacheUpd.paynkolay_trx_date = trxDate
    if (Object.keys(cacheUpd).length > 0) {
      const { error: updErr } = await admin.from('orders').update(cacheUpd).eq('id', order.id)
      if (updErr) console.error('[paynkolay-query] cache update failed:', updErr.message)
    }

    console.log('[paynkolay-query]', {
      orderId: order.id,
      clientRef: merchantOid,
      found: true,
      status,
      cached: Object.keys(cacheUpd),
    })

    return jsonResponse({
      success: true,
      found: true,
      referenceCode,
      status,                 // SUCCESS | ERROR | NEW
      transactionType: String(sale.transactionType ?? ''),
      trxDate,                // yyyy.mm.dd (normalize) — iade trxDate kaynagi
      trxDateRaw,             // Paynkolay ham degeri (teshis)
      clientReferenceCode: merchantOid,
      range: { startDate, endDate },
    })
  } catch (err) {
    console.error('[paynkolay-query] error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
