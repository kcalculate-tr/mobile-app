// G19-S2 md.5 — Öğün hatırlatması (fin_reminder_*) YEREL bildirim planı. SAF;
// tsx ile birim testli. Native kurulum `mealReminder.ts`'te.
//
// Kural:
//  · Öğün saatinde o öğün yuvasına bugün kayıt yoksa hatırlat (İstanbul saati):
//    kahvaltı 10:30 · öğle 14:30 · akşam 21:00. Ara öğün hatırlatılmaz (şablon
//    var ama günde en fazla 3 hatırlatma; seri hatırlatması 19:30 ayrı).
//  · Bugünün yuvası loglandıysa o bildirim kurulmaz; gelecek günler "kayıt yok"
//    varsayımıyla kurulur ve uygulama her açıldığında / her kayıtta yeniden eşitlenir.
//  · notification_preferences.reminder_enabled = false → hiç kurulmaz.
//  · Sessiz saatler (quiet_hours_start/end, "HH:MM[:SS]", gece yarısını
//    sarabilir) içine düşen hatırlatma ATLANIR (kaydırılmaz).
//  · "Bugün sessize al" (FinPush aksiyonu) → bugünün kalanı kurulmaz.
//  · Son 7 günde hiç kaydı olmayan kullanıcıya öğün hatırlatması kurulmaz
//    (takip etmeyen kullanıcıya bildirim yağmuru yok; seri hatırlatması ayrı).
//  · Ufuk 3 gün (≤ 9 bildirim; iOS 64 sınırının çok altında).
import { addDays, dayKey } from './dayClock';

export type ReminderMeal = 'breakfast' | 'lunch' | 'dinner';

export const MEAL_REMINDER_TIMES: Record<ReminderMeal, string> = {
  breakfast: '10:30',
  lunch: '14:30',
  dinner: '21:00',
};

export const MEAL_REMINDER_HORIZON_DAYS = 3;

export interface ReminderPrefs {
  reminder_enabled?: boolean | null;
  quiet_hours_start?: string | null;
  quiet_hours_end?: string | null;
}

export interface PlannedReminder {
  meal: ReminderMeal;
  /** İstanbul gün anahtarı. */
  day: string;
  date: Date;
}

function toMin(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** Dakika (0–1439) sessiz aralıkta mı. start == end → sessiz saat yok. */
export function inQuietHours(minuteOfDay: number, start: string | null | undefined, end: string | null | undefined): boolean {
  const s = toMin(start);
  const e = toMin(end);
  if (s == null || e == null || s === e) return false;
  return s < e ? minuteOfDay >= s && minuteOfDay < e : minuteOfDay >= s || minuteOfDay < e;
}

export function planMealReminders(input: {
  now: Date;
  /** Bugün kayıt olan yuvalar. */
  loggedToday: ReadonlySet<string>;
  prefs: ReminderPrefs | null;
  /** "Bugün sessize al" bitişi (epoch ms) — yoksa null. */
  mutedUntil: number | null;
  recentlyActive: boolean;
  days?: number;
}): PlannedReminder[] {
  const { now, loggedToday, prefs, mutedUntil, recentlyActive } = input;
  if (!recentlyActive) return [];
  if (prefs && prefs.reminder_enabled === false) return [];
  const today = dayKey(now);
  const out: PlannedReminder[] = [];
  const horizon = input.days ?? MEAL_REMINDER_HORIZON_DAYS;
  for (let i = 0; i < horizon; i += 1) {
    const day = addDays(today, i);
    for (const meal of Object.keys(MEAL_REMINDER_TIMES) as ReminderMeal[]) {
      const time = MEAL_REMINDER_TIMES[meal];
      const date = new Date(`${day}T${time}:00+03:00`);
      if (date.getTime() <= now.getTime()) continue;
      if (i === 0 && loggedToday.has(meal)) continue;
      if (mutedUntil != null && date.getTime() <= mutedUntil) continue;
      if (prefs && inQuietHours(toMin(time)!, prefs.quiet_hours_start, prefs.quiet_hours_end)) continue;
      out.push({ meal, day, date });
    }
  }
  return out;
}

/** Bildirim kimliği (aynı gün+öğün için tek bildirim; yeniden eşitlemede değişmez). */
export function reminderId(r: { meal: ReminderMeal; day: string }): string {
  return `fin-reminder-${r.day}-${r.meal}`;
}
