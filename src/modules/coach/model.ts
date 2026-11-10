// G24-S1 md.3 — kcalAI Koç SAF mantık (RN/ağ yok → tsx --test).
import type { CoachCard, CoachMessage, CoachStatus } from './types';

type T = (key: string, opts?: Record<string, string | number>) => string;

/** Sunucu limitleri gelmezse (app_settings okunamadı) kullanılan sayılar — README Tur 26k. */
export const COACH_DAILY_FALLBACK = 30;
export const COACH_TRIAL_FALLBACK = 3;
export const COACH_RETENTION_DAYS = 30;
/** 3. deneme yanıtından sonra "Koç Balance'ta" sheet'i (FinMoCoach: 1100 ms). */
export const UPSELL_DELAY_MS = 1100;

/** my_coach_status / reserve yanıtı → durum (bilinmeyen alan → null). */
export function statusFrom(raw: unknown): CoachStatus | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const used = num(o.used);
  const limit = num(o.limit);
  if (used == null || limit == null) return null;
  const kind = o.kind === 'daily' ? 'daily' : 'trial';
  const tier = o.tier === 'free' || o.tier === 'fresh' || o.tier === 'balance' ? o.tier : null;
  return { used, limit, kind, tier, resetsAt: typeof o.resets_at === 'string' ? o.resets_at : null };
}

export const remainingOf = (s: CoachStatus): number => Math.max(0, s.limit - s.used);

/** Hap: Balance "Bugün N/30" · deneme "Deneme N/3" (N = kalan). */
export function pillText(s: CoachStatus | null, t: T): { label: string; a11y: string; balance: boolean } | null {
  if (!s) return null;
  const n = remainingOf(s);
  if (s.kind === 'daily') {
    return { label: t('coach.pill_daily', { n, cap: s.limit }), a11y: t('coach.pill_a11y_daily', { n, cap: s.limit }), balance: true };
  }
  return { label: t('coach.pill_trial', { n, cap: s.limit }), a11y: t('coach.pill_a11y_trial', { n, cap: s.limit }), balance: false };
}

export type GateState = 'open' | 'limit' | 'trial_out';

/** Yazma alanı açık mı? Balance'ta hak bitti → limit; denemede bitti → trial_out (upsell). */
export function gateOf(s: CoachStatus | null): GateState {
  if (!s) return 'open';
  if (remainingOf(s) > 0) return 'open';
  return s.kind === 'daily' ? 'limit' : 'trial_out';
}

/** Gönderimden hemen sonra (yanıt beklenirken) hapı iyimser güncelle. */
export function optimisticUse(s: CoachStatus | null): CoachStatus | null {
  return s ? { ...s, used: Math.min(s.limit, s.used + 1) } : s;
}

/**
 * Akan yanıt temposu (FinMoCoach): SSE yok; metin istemcide kelime kelime açılır. Her parça
 * opaklıkla 110 ms'de belirir; toplam süre en çok ~2200 ms (uzun yanıt beklemesin).
 */
export function streamPlan(text: string, maxTotalMs = 2200, stepMs = 45): { chunks: string[]; interval: number } {
  const chunks = text.match(/\S+\s*/g) ?? [];
  if (chunks.length === 0) return { chunks: [], interval: 0 };
  const interval = Math.max(16, Math.min(stepMs, Math.floor(maxTotalMs / chunks.length)));
  return { chunks, interval };
}

/** "Bugün 18:40" / "Dün 21:15" / "11 Kas 19:03". */
export function stampLabel(iso: string, now: Date, lang: 'tr' | 'en', t: T): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const dk = dayKey(d);
  if (dk === dayKey(now)) return t('coach.today_at', { time });
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (dk === dayKey(y)) return t('coach.yesterday_at', { time });
  return `${dateLabel(d, lang)} ${time}`;
}

const MONTHS = {
  tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
export function dateLabel(d: Date, lang: 'tr' | 'en'): string {
  return lang === 'en' ? `${MONTHS.en[d.getMonth()]} ${d.getDate()}` : `${d.getDate()} ${MONTHS.tr[d.getMonth()]}`;
}
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Mesaj listesinde zaman ayracı: ilk mesaj ve 30 dk'dan uzun aradan sonra. */
export function needsStamp(prev: CoachMessage | undefined, cur: CoachMessage): boolean {
  if (!prev) return true;
  return new Date(cur.created_at).getTime() - new Date(prev.created_at).getTime() > 30 * 60_000;
}

export interface HistoryItem {
  id: string;
  q: string;
  a: string;
  time: string;
}
export interface HistoryGroup {
  key: string;
  label: string;
  items: HistoryItem[];
}

/**
 * FinCoachHistory: soru (kullanıcı) + ilk yanıt (Koç) çiftleri, gün gün (yeniden eskiye):
 * "Bugün" · "Dün" · "11 Kas".
 */
export function groupHistory(messages: readonly CoachMessage[], now: Date, lang: 'tr' | 'en', t: T): HistoryGroup[] {
  const sorted = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const pairs: HistoryItem[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i];
    if (m.role !== 'user') continue;
    const next = sorted[i + 1];
    const a = next && next.role === 'assistant' ? next.body : '';
    const d = new Date(m.created_at);
    pairs.push({
      id: m.id,
      q: m.body,
      a: a.length > 90 ? `${a.slice(0, 88).trimEnd()}…` : a,
      time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    });
  }
  pairs.reverse();
  const today = dayKey(now);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterday = dayKey(y);
  const groups: HistoryGroup[] = [];
  for (const p of pairs) {
    const m = sorted.find((x) => x.id === p.id)!;
    const d = new Date(m.created_at);
    const k = dayKey(d);
    const label = k === today ? t('coach.hist_today') : k === yesterday ? t('coach.hist_yesterday') : dateLabel(d, lang);
    let g = groups.find((x) => x.key === k);
    if (!g) {
      g = { key: k, label, items: [] };
      groups.push(g);
    }
    g.items.push(p);
  }
  return groups;
}

/** Başlık alt satırı: "Bugün %62, 760 kcal kaldı" (hedef yoksa sabit satır). */
export function headerSub(consumed: number | null, target: number | null, t: T): { text: string; pct: number | null } {
  if (!target || target <= 0 || consumed == null) return { text: t('coach.head_sub_none'), pct: null };
  const pct = Math.round((consumed / target) * 100);
  const left = Math.round(target - consumed);
  if (left < 0) return { text: t('coach.head_sub_over', { over: -left }), pct: Math.min(100, pct) };
  return { text: t('coach.head_sub', { pct, left }), pct };
}

/** Ana sayfa kartı satırı + önceden doldurulan soru (FinHomeR3 coachLine). */
export function homeLine(
  consumed: number | null,
  target: number | null,
  proteinLeft: number | null,
  t: T,
): { line: string; question: string } {
  const empty = !consumed;
  if (empty) return { line: t('coach.home_line_empty'), question: t('coach.home_q_empty') };
  if (target && consumed && consumed > target) return { line: t('coach.home_line_over'), question: t('coach.home_q_over') };
  if (!target || !proteinLeft || proteinLeft <= 0) return { line: t('coach.home_line_plain'), question: t('coach.home_q_plain') };
  const n = Math.round(proteinLeft);
  return { line: t('coach.home_line_protein', { n }), question: t('coach.home_q_protein') };
}

/** Haftalık grafik çubukları (FinCoachChat): kalori hedef içinde / protein hedefin %80'i. */
export function chartBars(card: Extract<CoachCard, { type: 'weekly_chart' }>, metric: 'kcal' | 'protein') {
  const days = card.days ?? [];
  const goal = metric === 'kcal' ? card.goal_kcal ?? null : card.goal_protein ?? null;
  const values = days.map((d) => (metric === 'kcal' ? d.kcal : d.protein));
  const max = Math.max(1, ...values, goal ?? 0) * 1.15;
  const bars = days.map((d, i) => {
    const v = values[i];
    const good = goal == null ? true : metric === 'kcal' ? v <= goal : v >= goal * 0.8;
    return { date: d.date, value: v, ratio: v / max, good };
  });
  const logged = values.filter((v) => v > 0);
  const avg = logged.length ? Math.round(logged.reduce((a, b) => a + b, 0) / logged.length) : 0;
  return { bars, goal, goalRatio: goal != null ? goal / max : null, avg };
}

/** Pazartesi=0 … Pazar=6 (YYYY-MM-DD → kısa gün adı listesindeki sıra). */
export function weekdayIndex(date: string): number {
  const d = new Date(`${date}T12:00:00`);
  return (d.getDay() + 6) % 7;
}
