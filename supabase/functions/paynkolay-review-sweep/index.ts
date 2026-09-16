import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { OrderForOutcome, resolvePendingPaymentViaReport } from '../_shared/paynkolay-cards.ts'

// ── Bekleyen ödeme incelemesi (needs_manual_review) yeniden-deneme süpürücüsü.
// pg_cron (migration 20260916260000, job 'paynkolay-review-sweep') her 5
// dakikada bir, en fazla 24 saat boyunca bu fonksiyonu tetikler:
//   select net.http_post(url:='.../paynkolay-review-sweep', headers:=..., body:='{}')
// Yalnizca payment_review_pending=true VE payment_review_started_at 24h icinde
// olan siparisler icin PfTransactionReportList tekrar sorgulanir.
//
// AUTH: verify_jwt=true (config.toml) + Authorization header'daki JWT'nin
// role=service_role oldugu payload'dan teyit edilir (sadece pg_cron/service-role
// cagirabilir — normal kullanici JWT'si verify_jwt'den gecse bile role
// eslesmez, 403 alir).

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SX = (Deno.env.get('PAYNKOLAY_SX') ?? '').trim()
const REPORT_SX = (Deno.env.get('PAYNKOLAY_REPORT_SX') ?? '').trim()
const SECRET_KEY = (Deno.env.get('PAYNKOLAY_SECRET_KEY') ?? '').trim()
const VPOS_URL = (Deno.env.get('PAYNKOLAY_VPOS_URL') ?? '').trim()

const REVIEW_WINDOW_MS = 24 * 60 * 60 * 1000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// JWT imzasi gateway'de (verify_jwt=true) zaten dogrulandi — burada sadece
// payload'daki role claim'ini okuyoruz (service_role_key de gecerli bir JWT'dir).
function getJwtRole(authHeader: string | null): string | null {
  if (!authHeader) return null
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(base64))
    return typeof payload?.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

type ReviewOrder = OrderForOutcome & { order_code?: string | null }

async function notifyUser(orderId: number, orderCode: string | null, userId: string | null, success: boolean): Promise<void> {
  if (!userId) return
  const label = orderCode ? `#${orderCode}` : `#${orderId}`
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        mode: 'by_content',
        user_ids: [userId],
        title: success ? 'Ödemen onaylandı' : 'Ödeme başarısız',
        body: success
          ? `Siparişin ${label} için ödemen onaylandı.`
          : `Siparişin ${label} için ödeme tamamlanamadı. Lütfen tekrar deneyin.`,
        category: 'transactional',
        deep_link: `kcal://orders/${orderId}`,
        data: { order_id: orderId },
      }),
    })
  } catch (e) {
    console.error('[paynkolay-review-sweep] notify error:', orderId, e)
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const role = getJwtRole(req.headers.get('Authorization'))
    if (role !== 'service_role') {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    if (!SX || !REPORT_SX || !SECRET_KEY || !VPOS_URL) {
      return jsonResponse({ error: 'Paynkolay yapilandirmasi eksik' }, 500)
    }

    const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const cutoffIso = new Date(Date.now() - REVIEW_WINDOW_MS).toISOString()
    const { data: pendingOrders, error: fetchErr } = await admin
      .from('orders')
      .select('id, user_id, total_price, type, macro_quantity, status, payment_status, merchant_oid, order_code')
      .eq('payment_review_pending', true)
      .gte('payment_review_started_at', cutoffIso)

    if (fetchErr) {
      console.error('[paynkolay-review-sweep] orders fetch error:', fetchErr)
      return jsonResponse({ error: 'Siparisler cekilemedi' }, 500)
    }

    const results = { checked: 0, resolved_success: 0, resolved_failed: 0, still_pending: 0 }

    for (const order of (pendingOrders ?? []) as ReviewOrder[]) {
      results.checked++
      const clientRefCode = String(order.merchant_oid ?? '')
      if (!clientRefCode) {
        console.error('[paynkolay-review-sweep] merchant_oid yok, atlaniyor', { orderId: order.id })
        continue
      }

      const outcome = await resolvePendingPaymentViaReport(
        admin,
        order,
        clientRefCode,
        { reportSx: REPORT_SX, secretKey: SECRET_KEY, vposUrl: VPOS_URL },
        { secretKey: SECRET_KEY, vposUrl: VPOS_URL, sx: SX },
      )

      if (outcome === 'success') {
        results.resolved_success++
        await notifyUser(order.id, order.order_code ?? null, order.user_id, true)
      } else if (outcome === 'failed') {
        results.resolved_failed++
        await notifyUser(order.id, order.order_code ?? null, order.user_id, false)
      } else {
        results.still_pending++
      }
    }

    console.log('[paynkolay-review-sweep]', results)
    return jsonResponse({ success: true, ...results })
  } catch (err) {
    console.error('[paynkolay-review-sweep] error:', err)
    return jsonResponse({ error: String(err) }, 500)
  }
})
