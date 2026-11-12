// G36-S1 md.4 (İlter 12 Kas) — Logla tüketim zamanı. SAF (RN yok) → tsx birim testi.
// Bugün için "şimdi". Geçmiş gün için o günün tarihi + öğün yuvasının saati: kişisel plandaki
// öğün saatleri, yoksa Kahvaltı 08:00 · Öğle 13:00 · Ara öğün 16:00 · Akşam 19:30.
// Gün anahtarları Europe/Istanbul (sabit UTC+3, `lib/dayKey.ts` ile aynı kural).
import type { Slot } from './types';

export const DEFAULT_SLOT_TIME: Record<Slot, string> = {
  breakfast: '08:00',
  lunch: '13:00',
  snack: '16:00',
  dinner: '19:30',
};

const ISTANBUL_OFFSET_MIN = 3 * 60;

function parseHHMM(v: string | null | undefined): { h: number; m: number } | null {
  if (typeof v !== 'string') return null;
  const mt = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!mt) return null;
  const h = Number(mt[1]);
  const m = Number(mt[2]);
  if (h > 23 || m > 59) return null;
  return { h, m };
}

/** Yuvanın saati "HH:MM": kişisel plan saati geçerliyse o, değilse varsayılan. */
export function slotTime(slot: Slot, times?: Partial<Record<string, string>> | null): string {
  const own = times?.[slot];
  return parseHHMM(own) ? (own as string).trim().padStart(5, '0') : DEFAULT_SLOT_TIME[slot];
}

/**
 * Plan satırının `consumed_at` anı. `date` ve `today` İstanbul gün anahtarı (YYYY-MM-DD).
 * `date >= today` → şimdi (Logla gelecek günde zaten kapalı; güvenli taraf "şimdi").
 */
export function planConsumedAt(
  date: string,
  slot: Slot,
  today: string,
  times?: Partial<Record<string, string>> | null,
  now: Date = new Date(),
): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date >= today) return now;
  const { h, m } = parseHHMM(slotTime(slot, times)) ?? { h: 12, m: 0 };
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, m) - ISTANBUL_OFFSET_MIN * 60_000);
}
