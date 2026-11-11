// G33-S1 md.7 — Balance: `meal-plan-generate` edge fonksiyonu YALNIZ adayları sıralar + kısa açıklama
// yazar (1 koç mesajı kotası). Makro/kalori istemcideki algoritmadan; yanıttaki sayılar KULLANILMAZ.
import type { GenerateResult } from './generate';
import { summarizeForCoach } from './generate';

export type CoachPlanOutcome =
  | { ok: true; index: number; note: string }
  | { ok: false; reason: 'quota' | 'error' };

/** Yanıt doğrulama (saf): sıra geçerli bir aday dizini, not kısa düz metin. */
export function parseCoachPlanReply(data: unknown, candidates: number): CoachPlanOutcome {
  const d = (data ?? {}) as { order?: unknown; note?: unknown; error?: unknown };
  if (d.error === 'quota') return { ok: false, reason: 'quota' };
  const order = Array.isArray(d.order) ? d.order.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < candidates) : [];
  const note = typeof d.note === 'string' ? d.note.replace(/\s+/g, ' ').trim().slice(0, 600) : '';
  if (!order.length || !note) return { ok: false, reason: 'error' };
  return { ok: true, index: order[0], note };
}

export async function askCoachToRank(
  candidates: GenerateResult[],
  ctx: { lang: 'tr' | 'en'; target: { kcal: number; protein: number }; avoid: string[]; diet: string },
): Promise<CoachPlanOutcome> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSupabaseClient } = require('../../core/supabase') as typeof import('../../core/supabase');
    const { data, error } = await getSupabaseClient().functions.invoke('meal-plan-generate', {
      body: { lang: ctx.lang, target: ctx.target, avoid: ctx.avoid, diet: ctx.diet, candidates: candidates.map(summarizeForCoach) },
    });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      return { ok: false, reason: status === 402 ? 'quota' : 'error' };
    }
    return parseCoachPlanReply(data, candidates.length);
  } catch {
    return { ok: false, reason: 'error' };
  }
}
