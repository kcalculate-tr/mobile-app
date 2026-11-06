// G15-S2 — Su takibi saf yardımcıları (RN/Supabase bağımsız; birim testli).

/** Hızlı ekleme adımı (bir bardak). */
export const WATER_STEP_ML = 250;

/**
 * Bugünün tarihi (Europe/Istanbul, YYYY-MM-DD). Türkiye 2016'dan beri sabit
 * UTC+3 (yaz saati yok) → log_water()'ın `now() at time zone 'Europe/Istanbul'`
 * günüyle aynı.
 */
export function istanbulDay(now: Date = new Date()): string {
  const d = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

/** ml → "1,5" (tr) / "1.5" (en); tam litrede ondalık yok. */
export function formatLiters(ml: number, lang: 'tr' | 'en' = 'tr'): string {
  const l = Math.round((Math.max(0, ml) / 1000) * 10) / 10;
  const s = Number.isInteger(l) ? String(l) : l.toFixed(1);
  return lang === 'tr' ? s.replace('.', ',') : s;
}

/** Hedef litre (nutrition profile target_water; litre) → ml. Geçersizse null. */
export function waterTargetMl(targetLiters: number | null | undefined): number | null {
  if (targetLiters == null || !Number.isFinite(targetLiters) || targetLiters <= 0) return null;
  // Eski kayıtlarda ml olarak yazılmış değerler (ör. 2500) → litreye çevrilmiş say.
  return targetLiters > 50 ? Math.round(targetLiters) : Math.round(targetLiters * 1000);
}

/** Yüzde etiketi: TR "%50", EN "50%" (FinHomeEN). */
export function pctLabel(p: number, lang: string): string {
  const n = Math.round(p * 100);
  return lang === 'en' ? `${n}%` : `%${n}`;
}
