// G19-S2 md.1 — Günlük takibin SAATİ. Saf modül (RN yok; tsx ile birim testli).
//
// KURAL (yazılı + testli, `__tests__/g19track.test.ts`):
//  1. Gün sınırı HER ZAMAN Europe/Istanbul gece yarısıdır — cihazın saat dilimi
//     ne olursa olsun (Berlin'deki kullanıcı için gün 23:00 Berlin'de döner).
//     Neden: günlük toplamın otoritesi sunucu (get_user_day_progress, log_water,
//     get_nutrition_summary hepsi `at time zone 'Europe/Istanbul'`). İstemci
//     başka bir sınır kullanırsa aynı öğün iki ekranda iki güne düşer.
//  2. Öğün yuvası (kahvaltı/öğle/akşam/ara) ve satır saati de İstanbul saatiyle
//     hesaplanır — aynı kayıt hem gün hem yuva için tek saate bakar.
//  3. Türkiye 2016'dan beri sabit UTC+03:00 (yaz saati yok); Intl `timeZone`
//     Hermes/ICU'suz Android'de güvenilmez → kaydırma elle (dayKey.ts ile aynı).
//  4. Gece yarısı geçişinde açık ekran yeni günü yükler: `msUntilNextDay` kadar
//     sonra (+ küçük pay) ve uygulama ön plana döndüğünde gün anahtarı yeniden
//     karşılaştırılır (useDayRollover).
import { dayKey, startOfDayIso } from '../../../lib/dayKey';

export { dayKey, startOfDayIso };

const OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** İstanbul duvar saati (0–23). */
export function istanbulHour(at: Date = new Date()): number {
  const t = at.getTime();
  if (!Number.isFinite(t)) return 12;
  return new Date(t + OFFSET_MS).getUTCHours();
}

/** ISO damgası → İstanbul saati "HH:MM". Geçersizse ''. */
export function istanbulHHMM(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const d = new Date(t + OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** Bir sonraki İstanbul gece yarısına kalan ms (her zaman 1..DAY_MS). */
export function msUntilNextDay(now: Date = new Date()): number {
  const t = now.getTime();
  const local = t + OFFSET_MS;
  const next = Math.floor(local / DAY_MS) * DAY_MS + DAY_MS;
  return Math.max(1, next - local);
}

/** İki an aynı İstanbul gününde mi. */
export function sameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/** ISO damgası verilen gün anahtarına mı ait (İstanbul). */
export function isOnDay(iso: string | null | undefined, key: string): boolean {
  if (!iso) return false;
  return dayKey(new Date(iso)) === key;
}

/** Gün anahtarı aritmetiği (saat dilimsiz, UTC öğlen üzerinden). */
export function addDays(key: string, delta: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
