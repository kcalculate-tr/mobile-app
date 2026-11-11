// G33-S1 — Hafta yardımcıları (gün anahtarı YYYY-MM-DD, Europe/Istanbul takvimi). SAF.
// Hafta Pazartesi başlar. "Ay görünümü" = bugünden itibaren KAYAN 4 hafta (takvim ayı değil).

/** YYYY-MM-DD → UTC öğlen Date (saat dilimi kaymasız gün aritmetiği). */
function toDate(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}
function toKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysKey(key: string, n: number): string {
  const d = toDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return toKey(d);
}

/** 0 = Pazartesi … 6 = Pazar. */
export function weekdayIndex(key: string): number {
  return (toDate(key).getUTCDay() + 6) % 7;
}

export function weekStartOf(key: string): string {
  return addDaysKey(key, -weekdayIndex(key));
}

export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i));
}

/** Kayan 4 hafta: bugünün haftası + sonraki 3 (hafta başları). */
export function rollingWeeks(today: string, count = 4): string[] {
  const ws = weekStartOf(today);
  return Array.from({ length: count }, (_, i) => addDaysKey(ws, i * 7));
}

export function dayOfMonth(key: string): number {
  return toDate(key).getUTCDate();
}

const TR_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const EN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const EN_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TR_DAYS = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
const EN_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TR_DAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const EN_DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export type Lang = 'tr' | 'en';

export function dayShort(key: string, lang: Lang): string {
  return (lang === 'en' ? EN_DAYS_SHORT : TR_DAYS_SHORT)[weekdayIndex(key)];
}
export function dayName(key: string, lang: Lang): string {
  return (lang === 'en' ? EN_DAYS : TR_DAYS)[weekdayIndex(key)];
}

/** "Çarşamba, 11 Kasım" · "Wednesday, 11 Nov". */
export function dayTitle(key: string, lang: Lang): string {
  const d = toDate(key);
  return lang === 'en'
    ? `${EN_DAYS[weekdayIndex(key)]}, ${d.getUTCDate()} ${EN_MONTHS_SHORT[d.getUTCMonth()]}`
    : `${TR_DAYS[weekdayIndex(key)]}, ${d.getUTCDate()} ${TR_MONTHS[d.getUTCMonth()]}`;
}

/** "9–15 Kasım" · "9–15 November" · ay geçişinde "28 Ekim – 3 Kasım". */
export function weekRange(weekStart: string, lang: Lang): string {
  const a = toDate(weekStart);
  const b = toDate(addDaysKey(weekStart, 6));
  const M = lang === 'en' ? EN_MONTHS : TR_MONTHS;
  if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}–${b.getUTCDate()} ${M[b.getUTCMonth()]}`;
  return `${a.getUTCDate()} ${M[a.getUTCMonth()]} – ${b.getUTCDate()} ${M[b.getUTCMonth()]}`;
}

/** "Çarşamba – Pazar, 5 gün" için uç günler. */
export function spanLabel(days: readonly string[], lang: Lang): string {
  if (!days.length) return '';
  const s = [...days].sort();
  const first = dayName(s[0], lang);
  const last = dayName(s[s.length - 1], lang);
  const n = s.length;
  return lang === 'en' ? `${first} – ${last}, ${n} day${n === 1 ? '' : 's'}` : `${first} – ${last}, ${n} gün`;
}
