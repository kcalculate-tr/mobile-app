// G33-S1 md.7 — meal-plan-generate (Balance "Koç'la oluştur").
//
// Akış:
//  1) Yalnız POST + geçerli kullanıcı JWT'si (verify_jwt varsayılan).
//  2) Gövde: { lang, target, avoid, diet, candidates[≤3] } — adaylar istemcinin DETERMİNİSTİK
//     algoritmasından (src/modules/plan/generate.ts); makro/kalori HESAPLANMIŞ gelir.
//  3) reserve_coach_message() (kullanıcının JWT'siyle) → 1 koç mesajı kotası; hak yoksa 402 {error:'quota'}.
//     (Kota RPC'leri 20261111100100_g24_coach'ta; ayrı sayaç yok — her Koç'la oluşturma 1 mesaj.)
//  4) Anthropic Messages API — coach-chat ile AYNI sağlayıcı/model (COACH_MODEL, varsayılan aynı).
//     Model YALNIZ sıra + kısa açıklama döner; sayılar değiştirilemez (istemci zaten kendi sayısını kullanır).
//  5) Hata/zaman aşımı/geçersiz yanıt → release_coach_message + 502. Başarı → consume_coach_message.
//
// Deploy (İlter onayıyla): supabase functions deploy meal-plan-generate
// Secret: ANTHROPIC_API_KEY (coach-chat ile aynı, zaten var); isteğe bağlı COACH_MODEL.
import { createClient } from '@supabase/supabase-js'
import { buildSystemPrompt, buildUserMessage, parseModelRank, parseRankInput } from './rank.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
// coach-chat ile aynı varsayılan (analyze-ai-scan AI_SCAN_MODEL varsayılanı).
const COACH_MODEL = Deno.env.get('COACH_MODEL') ?? 'claude-haiku-5-5'
const TIMEOUT_MS = Math.min(40_000, Math.max(5_000, Number(Deno.env.get('COACH_TIMEOUT_MS') ?? '') || 25_000))

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'auth' }, 401)
  const authed = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } })
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data: userData, error: userErr } = await authed.auth.getUser()
  if (userErr || !userData?.user) return json({ error: 'auth' }, 401)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'body' }, 400)
  }
  const input = parseRankInput(body)
  if (!input) return json({ error: 'body' }, 400)
  if (!ANTHROPIC_API_KEY) return json({ error: 'config' }, 500)

  // Hak ayır (kullanıcının JWT'siyle — auth.uid()).
  const { data: resv, error: resvErr } = await authed.rpc('reserve_coach_message')
  if (resvErr) return json({ error: 'server' }, 500)
  const rs = (resv ?? {}) as { ok?: boolean; reservation_id?: string }
  if (!rs.ok || !rs.reservation_id) return json({ error: 'quota', status: resv }, 402)
  const reservationId = rs.reservation_id
  const release = async () => {
    try {
      await admin.rpc('release_coach_message', { p_reservation: reservationId })
    } catch {
      // iade edilemedi: kayıt 'reserved' kalır
    }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let text = ''
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: COACH_MODEL,
        max_tokens: 400,
        system: buildSystemPrompt(input.lang),
        messages: [{ role: 'user', content: buildUserMessage(input) }],
      }),
    })
    if (!resp.ok) {
      await release()
      return json({ error: 'model', status: resp.status }, 502)
    }
    const data = await resp.json()
    text = Array.isArray(data?.content)
      ? data.content.filter((b: { type?: string }) => b.type === 'text').map((b: { text?: string }) => b.text ?? '').join('')
      : ''
  } catch (_e) {
    await release()
    return json({ error: 'timeout' }, 502)
  } finally {
    clearTimeout(timer)
  }

  const ranked = parseModelRank(text, input.candidates.length)
  if (!ranked) {
    await release()
    return json({ error: 'model' }, 502)
  }
  try {
    await admin.rpc('consume_coach_message', { p_reservation: reservationId })
  } catch {
    // tüketim işareti yazılamadı: sayaç zaten düştü
  }
  let status: unknown = null
  try {
    const { data } = await authed.rpc('my_coach_status')
    status = data ?? null
  } catch {
    status = null
  }
  return json({ order: ranked.order, note: ranked.note, status })
})
