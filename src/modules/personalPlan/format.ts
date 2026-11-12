// G34-S1 — Kişisel plan biçimlendirme (saf). TR ondalık virgül; nokta ayracı YOK (ortak kural).
import { parseDay } from './calc';

export type Lang = 'tr' | 'en';

const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TR_MON = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
const EN_MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Sayı: en fazla `digits` ondalık, sondaki sıfırlar atılır; TR'de virgül. Binlik ayraç YOK. */
export function fmtNum(n: number, lang: Lang, digits = 1): string {
  if (!Number.isFinite(n)) return '–';
  const f = Math.pow(10, digits);
  const r = Math.round(n * f) / f;
  let s = String(r);
  if (s.includes('e')) s = r.toFixed(digits);
  return lang === 'tr' ? s.replace('.', ',') : s;
}

/** Sabit ondalık (ör. 0,50 → "0,5" değil "0,50" gerekmez; tempo için 2 basamak, sıfır atılır). */
export function fmtPace(p: number, lang: Lang): string {
  return fmtNum(p, lang, 2);
}

export function fmtKg(n: number, lang: Lang): string {
  return fmtNum(n, lang, 1);
}

/** Artı/eksi işaretli fark (−0,3 / +0,3). */
export function fmtSigned(n: number, lang: Lang): string {
  const s = fmtNum(Math.abs(n), lang, 1);
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s;
}

/** "18 Şubat 2027" / "18 February 2027" */
export function fmtDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '–';
  const d = parseDay(iso);
  const m = (lang === 'tr' ? TR_MONTHS : EN_MONTHS)[d.getMonth()];
  return lang === 'tr' ? `${d.getDate()} ${m} ${d.getFullYear()}` : `${d.getDate()} ${m} ${d.getFullYear()}`;
}

/** "18 Şub" / "18 Feb" (grafik eksenleri). */
export function fmtShort(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '–';
  const d = parseDay(iso);
  return `${d.getDate()} ${(lang === 'tr' ? TR_MON : EN_MON)[d.getMonth()]}`;
}

/** "12–18 Kasım" (aynı ay) / "28 Eki – 3 Kas". */
export function fmtRange(fromIso: string, toIso: string, lang: Lang): string {
  const a = parseDay(fromIso);
  const b = parseDay(toIso);
  const months = lang === 'tr' ? TR_MONTHS : EN_MONTHS;
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${months[b.getMonth()]}`;
  return `${fmtShort(fromIso, lang)} – ${fmtShort(toIso, lang)}`;
}

/** Pazartesi = 0 … Pazar = 6. */
export function weekdayIndex(iso: string): number {
  return (parseDay(iso).getDay() + 6) % 7;
}
