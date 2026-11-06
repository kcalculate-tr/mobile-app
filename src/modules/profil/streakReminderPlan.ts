/** G15-S4 — Seri hatırlatması zaman planı (saf; node testlerinde import edilebilir). */
export const REMINDER_HOUR = 19;
export const REMINDER_MINUTE = 30;
export const HORIZON_DAYS = 7;

/**
 * Bildirim zamanları (saf): bugünden başlayarak `days` gün; geçmişte kalan
 * (şimdiden önceki) ve — bugün loglandıysa — bugünün 19:30'u atlanır.
 */
export function planReminderDates(now: Date, loggedToday: boolean, days: number = HORIZON_DAYS): Date[] {
  const out: Date[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, REMINDER_HOUR, REMINDER_MINUTE, 0, 0);
    if (d.getTime() <= now.getTime()) continue;
    if (i === 0 && loggedToday) continue;
    out.push(d);
  }
  return out;
}
