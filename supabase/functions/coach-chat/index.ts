// coach-chat — kcalAI Koç sohbeti. G24-S1 md.2. YALNIZ DOSYA: deploy edilmez, anahtar koda yazılmaz.
//
// POST { message: string (≤ 1000), lang?: 'tr'|'en', ref?: {type:'recipe',post_id} | {type:'scan',name,kcal,protein,carbs,fat} }
//
// Akış:
//  1) JWT zorunlu (Authorization) → kullanıcı. Yoksa 401.
//  2) Saklama: coach_retention_days'ten (vars. 30) eski kendi mesajları silinir.
//  3) Dakika sınırı: son 60 sn'de kullanıcının mesajı ≥ coach_per_minute (vars. 6) → 429 {error:'rate_limit'}.
//  4) Güvenlik ön filtresi (safety.ts): tıbbi / yeme bozukluğu işareti → model ÇAĞRILMAZ, hak DÜŞMEZ,
//     sabit güvenli yanıt (FinCoachSafety) kaydedilir ve döner.
//  5) reserve_coach_message() (kullanıcının JWT'siyle) → hak yoksa 402 {error:'quota', status}.
//  6) Bağlam: bugünün toplamları + hedefler, son 7 gün kalori/protein, son öğünler, İzmir'deyse
//     kısa eatkcal ürün listesi, herkese açık tarifler (kart beyaz listesi), son 20 mesaj.
//  7) Anthropic Messages API (ANTHROPIC_API_KEY, model COACH_MODEL, varsayılan analyze-ai-scan ile
//     aynı) → JSON {type,text,cards}; JSON değilse yalnız metin. Model taban altı günlük kalori
//     önerirse yanıt güvenli yanıtla değiştirilir.
//  8) Hata (model/zaman aşımı/boş yanıt) → release_coach_message + 502 {error:'model'|'timeout'}.
//  9) Başarı → iki satır coach_messages (user + assistant), consume_coach_message, yanıt:
//     { user_message, reply:{id,role,body,cards,feedback,created_at}, status:{used,limit,kind,resets_at,tier}, safety? }
//
// Kartlar: meal_suggestion{name,kcal,p,c,f} · recipe{post_id,+name,kcal,protein,photo_url} ·
// eatkcal_product{product_id,+name,kcal,price,img} (yalnız İzmir) · weekly_chart{metric,+days,goal_*} · safety{variant}.
import { createClient } from '@supabase/supabase-js'
import { classifyMessage, minDailyKcal, replyViolatesFloor, safetyReply, type SafetyKind } from './safety.ts'
import { buildSystemPrompt, type CoachContext } from './prompt.ts'
import { parseModelReply, toModelHistory, type CoachCard } from './cards.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
// Varsayılan analyze-ai-scan'deki AI_SCAN_MODEL varsayılanıyla aynı; deploy öncesi COACH_MODEL set edilebilir.
const COACH_MODEL = Deno.env.get('COACH_MODEL') ?? 'claude-haiku-5-5'
const TIMEOUT_MS = Math.min(40_000, Math.max(5_000, Number(Deno.env.get('COACH_TIMEOUT_MS') ?? '') || 25_000))
const MAX_INPUT = 1000
const HISTORY = 20

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const n0 = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
const nOrNull = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v)
  return v == null || !Number.isFinite(n) ? null : n
}
const cleanText = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''

// Türkiye 2016'dan beri sabit UTC+3.
function istanbulDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}
function dayStartIso(date: string): string {
  return `${date}T00:00:00+03:00`
}
function addDays(date: string, k: number): string {
  const d = new Date(`${date}T12:00:00+03:00`)
  d.setUTCDate(d.getUTCDate() + k)
  return istanbulDate(d)
}

// deno-lint-ignore no-explicit-any
type Admin = any

async function intSetting(admin: Admin, key: string, fallback: number): Promise<number> {
  try {
    const { data } = await admin.from('app_settings').select('value').eq('key', key).maybeSingle()
    const n = Number((data as { value?: unknown } | null)?.value)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback
  } catch {
    return fallback
  }
}

interface Ctx {
  context: CoachContext
  recipes: Map<string, { name: string; kcal: number | null; protein: number | null; photo_url: string | null }>
  products: Map<number, { name: string; kcal: number | null; price: number | null; img: string | null }>
}

async function buildContext(admin: Admin, uid: string, lang: 'tr' | 'en', refIn: unknown): Promise<Ctx> {
  const today = istanbulDate(new Date())
  const weekStart = addDays(today, -6)

  const [profRes, mealsRes, addrRes] = await Promise.all([
    admin.from('user_nutrition_profiles')
      .select('gender, target_calories, target_protein, target_carbs, target_fat, custom_calories, custom_protein, custom_carbs, custom_fat, use_custom_macros, updated_at')
      .eq('user_id', uid).order('updated_at', { ascending: false }).limit(1),
    admin.from('meal_consumptions')
      .select('name, meal_type, calories, protein, carbs, fat, consumed_at')
      .eq('user_id', uid).gte('consumed_at', dayStartIso(weekStart))
      .order('consumed_at', { ascending: false }).limit(300),
    admin.from('addresses').select('city').eq('user_id', uid).limit(20),
  ])

  const prof = ((profRes?.data ?? []) as Record<string, unknown>[])[0] ?? {}
  const custom = prof.use_custom_macros === true
  const goals = {
    kcal: nOrNull(custom ? prof.custom_calories ?? prof.target_calories : prof.target_calories),
    protein: nOrNull(custom ? prof.custom_protein ?? prof.target_protein : prof.target_protein),
    carbs: nOrNull(custom ? prof.custom_carbs ?? prof.target_carbs : prof.target_carbs),
    fat: nOrNull(custom ? prof.custom_fat ?? prof.target_fat : prof.target_fat),
  }
  const gender = typeof prof.gender === 'string' ? prof.gender : null

  const meals = (mealsRes?.data ?? []) as Record<string, unknown>[]
  const byDay = new Map<string, { kcal: number; protein: number }>()
  for (let i = 0; i < 7; i++) byDay.set(addDays(weekStart, i), { kcal: 0, protein: 0 })
  const todayTot = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  for (const m of meals) {
    const at = typeof m.consumed_at === 'string' ? new Date(m.consumed_at) : null
    if (!at || Number.isNaN(at.getTime())) continue
    const d = istanbulDate(at)
    const slot = byDay.get(d)
    if (slot) {
      slot.kcal += n0(m.calories)
      slot.protein += n0(m.protein)
    }
    if (d === today) {
      todayTot.kcal += n0(m.calories)
      todayTot.protein += n0(m.protein)
      todayTot.carbs += n0(m.carbs)
      todayTot.fat += n0(m.fat)
    }
  }
  const last7 = [...byDay.entries()].map(([date, v]) => ({ date, kcal: Math.round(v.kcal), protein: Math.round(v.protein) }))
  const recentMeals = meals.slice(0, 8).map((m) => ({
    name: cleanText(m.name, 60),
    kcal: Math.round(n0(m.calories)),
    protein: Math.round(n0(m.protein)),
    meal_type: typeof m.meal_type === 'string' ? m.meal_type : null,
    at: String(m.consumed_at ?? ''),
  }))

  const izmir = ((addrRes?.data ?? []) as { city?: unknown }[]).some((a) =>
    typeof a.city === 'string' && a.city.toLocaleLowerCase('tr').replace(/ı/g, 'i').includes('izmir'))

  const products = new Map<number, { name: string; kcal: number | null; price: number | null; img: string | null }>()
  if (izmir) {
    try {
      const { data } = await admin.from('products')
        .select('id, name, calories, cal, protein, price, img')
        .eq('is_available', true).order('order', { ascending: true }).limit(20)
      for (const p of (data ?? []) as Record<string, unknown>[]) {
        const id = Number(p.id)
        const name = cleanText(p.name, 60)
        if (!Number.isFinite(id) || !name) continue
        products.set(id, { name, kcal: nOrNull(p.calories ?? p.cal), price: nOrNull(p.price), img: typeof p.img === 'string' ? p.img : null })
      }
    } catch {
      // ürün listesi yoksa kart yok
    }
  }

  const recipes = new Map<string, { name: string; kcal: number | null; protein: number | null; photo_url: string | null }>()
  try {
    const { data } = await admin.from('posts')
      .select('id, author_id, meal_card')
      .eq('status', 'published').not('meal_card', 'is', null)
      .order('published_at', { ascending: false }).limit(30)
    const rows = (data ?? []) as { id: string; author_id: string; meal_card: Record<string, unknown> | null }[]
    const authors = [...new Set(rows.map((r) => r.author_id))]
    let priv = new Set<string>()
    if (authors.length) {
      const { data: profs } = await admin.from('profiles').select('id, is_private').in('id', authors)
      priv = new Set(((profs ?? []) as { id: string; is_private?: boolean }[]).filter((p) => p.is_private).map((p) => p.id))
    }
    for (const r of rows) {
      if (recipes.size >= 12) break
      if (priv.has(r.author_id) && r.author_id !== uid) continue
      const mc = r.meal_card ?? {}
      const name = cleanText(mc.name, 60)
      if (!name) continue
      recipes.set(r.id, { name, kcal: nOrNull(mc.kcal), protein: nOrNull(mc.protein_g), photo_url: typeof mc.photo_url === 'string' ? mc.photo_url : null })
    }
  } catch {
    // tarif listesi yoksa kart yok
  }

  // Bağlam referansı (tarif "Bu tarif bana uyar mı?" · Tara sonucu "Koça sor").
  let ref: CoachContext['ref'] = null
  const r = (refIn ?? {}) as Record<string, unknown>
  if (r.type === 'recipe' && typeof r.post_id === 'string') {
    const id = r.post_id.slice(0, 64)
    let rec = recipes.get(id)
    if (!rec) {
      try {
        const { data } = await admin.from('posts').select('id, meal_card, status').eq('id', id).maybeSingle()
        const mc = (data?.meal_card ?? null) as Record<string, unknown> | null
        if (data?.status === 'published' && mc && cleanText(mc.name, 60)) {
          rec = { name: cleanText(mc.name, 60), kcal: nOrNull(mc.kcal), protein: nOrNull(mc.protein_g), photo_url: typeof mc.photo_url === 'string' ? mc.photo_url : null }
          recipes.set(id, rec)
        }
      } catch {
        // yok say
      }
    }
    if (rec) ref = { type: 'recipe', post_id: id, name: rec.name, kcal: rec.kcal, protein: rec.protein }
  } else if (r.type === 'scan') {
    const name = cleanText(r.name, 80)
    if (name) ref = { type: 'scan', name, kcal: Math.round(n0(r.kcal)), protein: Math.round(n0(r.protein)), carbs: Math.round(n0(r.carbs)), fat: Math.round(n0(r.fat)) }
  }

  const context: CoachContext = {
    lang,
    date: today,
    gender,
    kcalFloor: minDailyKcal(gender),
    today: { kcal: Math.round(todayTot.kcal), protein: Math.round(todayTot.protein), carbs: Math.round(todayTot.carbs), fat: Math.round(todayTot.fat) },
    goals,
    last7,
    recentMeals,
    izmir,
    products: [...products.entries()].map(([id, p]) => ({ id, name: p.name, kcal: p.kcal, protein: null })),
    recipes: [...recipes.entries()].map(([post_id, p]) => ({ post_id, name: p.name, kcal: p.kcal, protein: p.protein })),
    ref,
  }
  return { context, recipes, products }
}

/** Kartları istemci için zenginleştir (ek sorgu gerekmesin). */
function enrichCards(cards: CoachCard[], ctx: Ctx): CoachCard[] {
  return cards.map((c) => {
    if (c.type === 'recipe') {
      const r = ctx.recipes.get(c.post_id)
      return r ? { ...c, name: r.name, kcal: r.kcal, protein: r.protein, photo_url: r.photo_url } : c
    }
    if (c.type === 'eatkcal_product') {
      const p = ctx.products.get(c.product_id)
      return p ? { ...c, name: p.name, kcal: p.kcal, price: p.price, img: p.img } : c
    }
    if (c.type === 'weekly_chart') {
      return { ...c, days: ctx.context.last7, goal_kcal: ctx.context.goals.kcal, goal_protein: ctx.context.goals.protein }
    }
    return c
  })
}

async function statusOf(authed: Admin): Promise<unknown> {
  try {
    const { data, error } = await authed.rpc('my_coach_status')
    return error ? null : data
  } catch {
    return null
  }
}

async function store(admin: Admin, uid: string, userText: string, reply: { text: string; cards: CoachCard[] }) {
  const now = Date.now()
  const { data, error } = await admin.from('coach_messages').insert([
    { user_id: uid, role: 'user', body: userText, cards: null, created_at: new Date(now).toISOString() },
    { user_id: uid, role: 'assistant', body: reply.text.slice(0, 4000), cards: reply.cards.length ? reply.cards : null, created_at: new Date(now + 1).toISOString() },
  ]).select('id, role, body, cards, feedback, created_at')
  if (error) return { user: null, assistant: null }
  const rows = (data ?? []) as { role: string }[]
  return { user: rows.find((r) => r.role === 'user') ?? null, assistant: rows.find((r) => r.role === 'assistant') ?? null }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)

  // 1) Kimlik.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'unauthorized' }, 401)
  const authed = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
  const { data: { user }, error: authErr } = await authed.auth.getUser()
  if (authErr || !user) return json({ error: 'unauthorized' }, 401)

  let body: { message?: unknown; lang?: unknown; ref?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request' }, 400)
  }
  const lang: 'tr' | 'en' = body.lang === 'en' ? 'en' : 'tr'
  const message = cleanText(body.message, MAX_INPUT)
  if (!message) return json({ error: 'empty' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // 2) Saklama süresi.
  const retention = await intSetting(admin, 'coach_retention_days', 30)
  try {
    await admin.from('coach_messages').delete().eq('user_id', user.id)
      .lt('created_at', new Date(Date.now() - retention * 86_400_000).toISOString())
  } catch {
    // tablo yoksa aşağıda zaten hata
  }

  // 3) Dakika sınırı.
  const perMinute = await intSetting(admin, 'coach_per_minute', 6)
  {
    const { count, error } = await admin.from('coach_messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('role', 'user')
      .gte('created_at', new Date(Date.now() - 60_000).toISOString())
    if (error) return json({ error: 'server' }, 500)
    if ((count ?? 0) >= perMinute) return json({ error: 'rate_limit' }, 429)
  }

  // 4) Güvenlik ön filtresi (model yok, hak yok).
  let gender: string | null = null
  try {
    const { data } = await admin.from('user_nutrition_profiles').select('gender').eq('user_id', user.id).limit(1)
    gender = ((data ?? []) as { gender?: string | null }[])[0]?.gender ?? null
  } catch {
    gender = null
  }
  const pre: SafetyKind | null = classifyMessage(message, gender)
  if (pre) {
    const reply = safetyReply(pre, lang)
    const saved = await store(admin, user.id, message, reply)
    return json({
      user_message: saved.user,
      reply: saved.assistant ?? { id: null, role: 'assistant', body: reply.text, cards: reply.cards, feedback: null, created_at: new Date().toISOString() },
      status: await statusOf(authed),
      safety: pre,
    })
  }

  if (!ANTHROPIC_API_KEY) return json({ error: 'config' }, 500)

  // 5) Hak ayır (kullanıcının JWT'siyle — auth.uid()).
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

  // 6) Bağlam + geçmiş.
  let ctx: Ctx
  let history: { role: 'user' | 'assistant'; content: string }[] = []
  try {
    ctx = await buildContext(admin, user.id, lang, body.ref)
    const { data: hist } = await admin.from('coach_messages')
      .select('role, body, created_at').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(HISTORY)
    history = toModelHistory(((hist ?? []) as { role: string; body: string }[]).reverse(), HISTORY)
  } catch {
    await release()
    return json({ error: 'server' }, 500)
  }
  // Son mesaj kullanıcınınki olmalı (geçmiş user ile bitiyorsa birleşir).
  const messages = toModelHistory([...history.map((h) => ({ role: h.role, body: h.content })), { role: 'user', body: message }], HISTORY + 1)

  // 7) Model.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let modelText = ''
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: COACH_MODEL, max_tokens: 900, system: buildSystemPrompt(ctx.context), messages }),
    })
    if (!resp.ok) {
      await release()
      return json({ error: 'model', status: resp.status }, 502)
    }
    const data = await resp.json()
    modelText = Array.isArray(data?.content)
      ? data.content.filter((b: { type?: string }) => b.type === 'text').map((b: { text?: string }) => b.text ?? '').join('')
      : ''
  } catch (_e) {
    await release()
    return json({ error: 'timeout' }, 502)
  } finally {
    clearTimeout(timer)
  }

  const parsed = parseModelReply(modelText, {
    recipeIds: new Set(ctx.recipes.keys()),
    productIds: new Set(ctx.products.keys()),
    izmir: ctx.context.izmir,
  })
  if (!parsed) {
    await release()
    return json({ error: 'model' }, 502)
  }

  // Son denetim: taban altı günlük kalori önerisi → güvenli yanıt.
  let reply: { text: string; cards: CoachCard[] }
  let safety: SafetyKind | null = null
  if (replyViolatesFloor(parsed.text, ctx.context.gender)) {
    safety = 'ed'
    reply = safetyReply('ed', lang)
  } else if (parsed.type === 'safety') {
    safety = 'medical'
    reply = { text: parsed.text, cards: [{ type: 'safety', variant: 'medical' }] }
  } else {
    reply = { text: parsed.text, cards: enrichCards(parsed.cards, ctx) }
  }

  // 9) Kaydet + hakkı tüket.
  const saved = await store(admin, user.id, message, reply)
  try {
    await admin.rpc('consume_coach_message', { p_reservation: reservationId })
  } catch {
    // tüketim işareti yazılamadı: sayaç zaten düştü
  }
  return json({
    user_message: saved.user,
    reply: saved.assistant ?? { id: null, role: 'assistant', body: reply.text, cards: reply.cards, feedback: null, created_at: new Date().toISOString() },
    status: await statusOf(authed),
    ...(safety ? { safety } : {}),
  })
})
