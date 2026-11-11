// G33-S1 md.7 — meal-plan-generate saf yardımcıları (Deno + Node testi ortak).
// Model YALNIZ aday sırası + kısa açıklama üretir; makro/kalori istemcinin algoritmasından gelir
// ve burada DEĞİŞTİRİLMEZ. Yanıt JSON değilse ya da sıra geçersizse → null (hak iade edilir).

export interface CandidateDay {
  date: string
  kcal: number
  protein: number
  meals: string[]
}
export interface Candidate {
  days: CandidateDay[]
  eatkcal_days: string[]
}
export interface RankInput {
  lang: 'tr' | 'en'
  target: { kcal: number; protein: number }
  avoid: string[]
  diet: string
  candidates: Candidate[]
}

const clean = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/** İstemci gövdesini doğrula/kırp (en çok 3 aday · 7 gün · 6 öğün). */
export function parseRankInput(body: unknown): RankInput | null {
  const b = (body ?? {}) as Record<string, unknown>
  const lang = b.lang === 'en' ? 'en' : 'tr'
  const t = (b.target ?? {}) as Record<string, unknown>
  const target = { kcal: Math.round(num(t.kcal)), protein: Math.round(num(t.protein)) }
  if (target.kcal < 800 || target.kcal > 6000) return null
  const raw = Array.isArray(b.candidates) ? b.candidates.slice(0, 3) : []
  const candidates: Candidate[] = raw.map((c) => {
    const cc = (c ?? {}) as Record<string, unknown>
    const days = (Array.isArray(cc.days) ? cc.days.slice(0, 7) : []).map((d) => {
      const dd = (d ?? {}) as Record<string, unknown>
      return {
        date: clean(dd.date, 10),
        kcal: Math.round(num(dd.kcal)),
        protein: Math.round(num(dd.protein)),
        meals: (Array.isArray(dd.meals) ? dd.meals.slice(0, 6) : []).map((m) => clean(m, 80)).filter(Boolean),
      }
    })
    const eatkcal_days = (Array.isArray(cc.eatkcal_days) ? cc.eatkcal_days.slice(0, 7) : []).map((x) => clean(x, 10))
    return { days, eatkcal_days }
  }).filter((c) => c.days.length > 0)
  if (!candidates.length) return null
  const avoid = (Array.isArray(b.avoid) ? b.avoid.slice(0, 8) : []).map((x) => clean(x, 20)).filter(Boolean)
  return { lang, target, avoid, diet: clean(b.diet, 20) || 'all', candidates }
}

export function buildSystemPrompt(lang: 'tr' | 'en'): string {
  if (lang === 'en') {
    return [
      'You are kcalAI Coach. You receive up to 3 candidate weekly meal plans that were already calculated by the app.',
      'Your ONLY job: rank the candidates (best first) for the user\'s goal and variety, and write ONE short explanation (max 3 sentences, plain text, friendly, no emoji).',
      'Never change, invent or recalculate calories or macros; you may only quote numbers that appear in the input.',
      'Mention removed allergens and which days include eatkcal meals if relevant. No medical advice, no diagnosis, no weight-loss promises.',
      'Reply with JSON only: {"order":[indexes],"note":"..."}',
    ].join('\n')
  }
  return [
    'Sen kcalAI Koç\'sun. Uygulamanın önceden HESAPLADIĞI en çok 3 haftalık öğün planı adayı alırsın.',
    'TEK görevin: adayları kullanıcının hedefine ve çeşitliliğe göre sırala (en iyisi önce) ve TEK kısa açıklama yaz (en çok 3 cümle, düz metin, samimi, emoji yok, "sen" dili).',
    'Kalori ya da makroyu asla değiştirme, uydurma veya yeniden hesaplama; yalnız girdide geçen sayıları kullanabilirsin.',
    'Gerekirse çıkarılan alerjenleri ve eatkcal öğünlerinin hangi günlerde olduğunu söyle. Tıbbi tavsiye, teşhis, kilo vaadi yok.',
    'Yalnız JSON yanıt ver: {"order":[dizinler],"note":"..."}',
  ].join('\n')
}

export function buildUserMessage(inp: RankInput): string {
  return JSON.stringify({
    target: inp.target,
    diet: inp.diet,
    avoid_allergens: inp.avoid,
    candidates: inp.candidates.map((c, i) => ({ index: i, ...c })),
  })
}

/** Model metni → { order, note }; geçersizse null. */
export function parseModelRank(text: string, candidates: number): { order: number[]; note: string } | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  let j: unknown
  try {
    j = JSON.parse(m[0])
  } catch {
    return null
  }
  const o = (j ?? {}) as { order?: unknown; note?: unknown }
  const seen = new Set<number>()
  const order: number[] = []
  for (const x of Array.isArray(o.order) ? o.order : []) {
    const n = Number(x)
    if (Number.isInteger(n) && n >= 0 && n < candidates && !seen.has(n)) {
      seen.add(n)
      order.push(n)
    }
  }
  for (let i = 0; i < candidates; i++) if (!seen.has(i)) order.push(i)
  const note = clean(o.note, 600)
  if (!note || !Array.isArray(o.order) || !o.order.length) return null
  return { order, note }
}
