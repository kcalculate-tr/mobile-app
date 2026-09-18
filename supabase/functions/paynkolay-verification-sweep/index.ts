import { createClient } from '@supabase/supabase-js'
import { runSweep } from '../_shared/paynkolay-card-verification.ts'

// ── Kart Ekle (1 TL doğrulama) sweep'i. pg_cron (migration 20260918160000, job
// 'card-verification-sweep') 5 dk'da bir, yalnız işi varsa tetikler. Yaptıkları:
//   1) callback'i hiç gelmemiş / zaman aşımı / iptal edilmiş kayıtları PaynKolay
//      raporundan (GRUPLU tek sorgu) kontrol eder; para çekilmişse kart+iade akışına sokar
//   2) refund_pending kayıtların iadesini SAATLİK yeniden dener (72. denemede refund_failed)
//   3) refund_attempts=0 ile 5 dk'dan eski 'succeeded' (takılı) kayıtların iadesini dener
// Aynı anda iki çalışma olmaz (sweep_locks, atomik + TTL). Her tur özet loglar.
//
// AUTH: verify_jwt=true (config.toml) + JWT'nin role=service_role olduğu doğrulanır
// (yalnız pg_cron/service-role; normal kullanıcı JWT'si 403 alır).
// GÜVENLİK: kart/token/secret log'a yazılmaz.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SX = (Deno.env.get('PAYNKOLAY_SX') ?? '').trim()
const REPORT_SX = (Deno.env.get('PAYNKOLAY_REPORT_SX') ?? '').trim()
const CANCEL_SX = (Deno.env.get('PAYNKOLAY_CANCEL_SX') ?? '').trim()
const SECRET_KEY = (Deno.env.get('PAYNKOLAY_SECRET_KEY') ?? '').trim()
const VPOS_URL = (Deno.env.get('PAYNKOLAY_VPOS_URL') ?? '').trim()

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

// JWT imzası gateway'de (verify_jwt=true) doğrulandı — burada yalnız role claim'i okunur.
function getJwtRole(authHeader: string | null): string | null {
  if (!authHeader) return null
  const parts = authHeader.replace(/^Bearer\s+/i, '').trim().split('.')
  if (parts.length < 2) return null
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload?.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    if (getJwtRole(req.headers.get('Authorization')) !== 'service_role') {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }
    if (!SX || !SECRET_KEY || !VPOS_URL) {
      return jsonResponse({ error: 'Paynkolay yapilandirmasi eksik' }, 500)
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const summary = await runSweep(admin, {
      secretKey: SECRET_KEY, sx: SX, vposUrl: VPOS_URL, cancelSx: CANCEL_SX, reportSx: REPORT_SX,
    })
    return jsonResponse({ success: true, ...summary })
  } catch (err) {
    console.error('[paynkolay-verification-sweep] error:', String((err as Error)?.message ?? err))
    return jsonResponse({ error: 'Sweep tamamlanamadi' }, 500)
  }
})
