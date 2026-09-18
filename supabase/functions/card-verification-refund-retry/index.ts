import { createClient } from '@supabase/supabase-js'
import { isAllowlistedAdmin } from '../_shared/paynkolay-cards.ts'
import { runManualRefundRetry } from '../_shared/paynkolay-card-verification.ts'

// ── Boss panel: Kart Ekle doğrulama iadesini (1 TL) TEK satır için elle yeniden dener.
// Yalnız refund_pending / refund_failed satırlar (retryRefundManually). Para hareketi yapan kritik
// işlem -> sıkı auth: verify_jwt + getUser + admin_allowlist (paynkolay-refund ile AYNI katmanlar).
// Sipariş iadesi (orders/refunds) DEĞİL; yalnız card_verifications satırı güncellenir.
// GÜVENLİK: secret/sx/kart/token log'a ya da yanıta KONMAZ; yanıt yalnız durum.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SX = (Deno.env.get('PAYNKOLAY_SX') ?? '').trim()
const CANCEL_SX = (Deno.env.get('PAYNKOLAY_CANCEL_SX') ?? '').trim()
const SECRET_KEY = (Deno.env.get('PAYNKOLAY_SECRET_KEY') ?? '').trim()
const VPOS_URL = (Deno.env.get('PAYNKOLAY_VPOS_URL') ?? '').trim()

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control, pragma',
}
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Oturum doğrulanamadı' }, 401)
    const authedClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authError } = await authedClient.auth.getUser()
    if (authError || !user) return jsonResponse({ error: 'Oturum doğrulanamadı' }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    if (!(await isAllowlistedAdmin(admin, user.id, user.email ?? undefined))) {
      return jsonResponse({ error: 'Yetkin yok — yönetici izni gerekli' }, 403)
    }
    if (!SX || !CANCEL_SX || !SECRET_KEY || !VPOS_URL) {
      return jsonResponse({ error: 'PaynKolay iade yapılandırması eksik' }, 500)
    }

    let body: any = {}
    try { const text = await req.text(); if (text) body = JSON.parse(text) } catch { body = {} }
    const id = String(body?.verificationId ?? '')
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) return jsonResponse({ error: 'verificationId zorunlu' }, 400)

    const r = await runManualRefundRetry(admin, { secretKey: SECRET_KEY, sx: SX, vposUrl: VPOS_URL, cancelSx: CANCEL_SX }, id, user.id)
    console.log('[card-verification-refund-retry]', { verificationId: id, result: r.kind, status: r.kind === 'done' ? r.status : undefined })

    switch (r.kind) {
      case 'not_found': return jsonResponse({ error: 'Kayıt bulunamadı' }, 404)
      case 'not_retryable': return jsonResponse({ error: 'Bu kayıt için iade yeniden denenemez (durum: ' + r.status + ')', status: r.status }, 409)
      case 'no_reference': return jsonResponse({ error: 'PaynKolay referans kodu yok — otomatik tarama raporla çözmeyi dener' }, 409)
      case 'busy': return jsonResponse({ error: 'Kayıt şu anda başka bir işlem tarafından işleniyor, biraz sonra tekrar dene' }, 409)
      case 'done':
        return jsonResponse({ success: true, status: r.status, refunded: r.status === 'refunded' })
    }
  } catch (err) {
    console.error('[card-verification-refund-retry] error:', String((err as Error)?.message ?? err))
    return jsonResponse({ error: 'İşlem tamamlanamadı' }, 500)
  }
})
