/**
 * Beslenme günlüğünde "hangi güne yazılacak" sorusunun TEK cevabı.
 *
 * 24.09.2026: aynı `meal_consumptions` satırı üç farklı güne düşebiliyordu —
 *   · TrackerScreen  → cihazın YEREL tarihi (getFullYear/getMonth/getDate)
 *   · ProfileScreen  → UTC (toISOString().split('T')[0])
 *   · get_nutrition_summary RPC → Europe/Istanbul (sunucuda)
 *
 * Türkiye UTC+3 olduğu için 00:00–03:00 arasında işaretlenen bir öğünün
 * `consumed_at` değeri UTC'de bir ÖNCEKİ güne aittir. Somut sonuç: gece
 * 01:00'de öğün işaretleyen kullanıcı Tracker'da "bugün", Profil'deki
 * haftalık kalori grafiğinde "dün" görüyordu — aynı anda iki ekranda iki
 * farklı günlük kalori.
 *
 * Doğru referans sunucununki: Europe/Istanbul. Sunucu günlük özetin
 * otoritesi, istemci ona uymak zorunda.
 *
 * Intl.DateTimeFormat'ın `timeZone` seçeneğine BİLEREK güvenilmiyor: Hermes
 * bazı Android derlemelerinde ICU olmadan geliyor ve seçenek sessizce
 * yok sayılabiliyor ya da hata fırlatabiliyor. Türkiye 2016'dan beri yaz
 * saati uygulamıyor, sabit UTC+03:00 — kaymayı elle eklemek hem kesin hem
 * bağımlılıksız.
 */

/** Türkiye'nin sabit UTC farkı (dakika). 2016'dan beri yaz saati yok. */
const ISTANBUL_OFFSET_MIN = 3 * 60;

/** `YYYY-MM-DD` — Europe/Istanbul gününe göre. */
export function dayKey(date: Date = new Date()): string {
  const t = date.getTime();
  if (!Number.isFinite(t)) return '';
  return new Date(t + ISTANBUL_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

/** `consumed_at` gibi bir ISO damgasını gün anahtarına çevirir. */
export function dayKeyFromIso(iso: string | null | undefined): string {
  if (!iso) return '';
  return dayKey(new Date(iso));
}

/** Bugünden geriye N günün anahtarları — eskiden yeniye. */
export function lastDayKeys(count: number, from: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    out.push(dayKey(new Date(from.getTime() - i * 86_400_000)));
  }
  return out;
}

/**
 * Bir İstanbul gününün BAŞLANGICININ UTC ISO damgası — sorgu sınırı için.
 * `offsetDays` negatifse geçmiş, pozitifse gelecek gün.
 *
 * Önceden bu sınırlar cihazın yerel gece yarısından üretiliyordu; Türkiye'de
 * aynı sonucu verir ama yurt dışındaki bir kullanıcıda gün anahtarıyla
 * ayrışırdı (anahtar İstanbul'a, sınır cihazına göre).
 */
export function startOfDayIso(offsetDays = 0, from: Date = new Date()): string {
  const anahtar = dayKey(new Date(from.getTime() + offsetDays * 86_400_000));
  if (!anahtar) return '';
  // "2026-09-24" İstanbul gece yarısı = aynı günün 00:00 - 03:00 = UTC 21:00
  // bir önceki gün. Date.parse ile ofseti açıkça vererek kuruyoruz.
  return new Date(`${anahtar}T00:00:00+03:00`).toISOString();
}
