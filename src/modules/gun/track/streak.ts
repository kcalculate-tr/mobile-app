// G19-S2 md.4 — Seri kuralı (sunucu `get_user_day_progress` ile BİREBİR) ve
// gün sonu özeti zamanlaması. Saf modül; tsx ile birim testli.
//
// SERİ KURALI:
//  · Bir gün "sayılır" ⇔ o İstanbul gününde en az 1 `meal_consumptions` satırı
//    var (kcal 0 olsa bile — su/kahve taraması). Su (water_daily) ve etkinlik
//    (activity_logs) seriyi SAYDIRMAZ (sunucuda da öyle).
//  · Gösterilen seri (çip, FinStreak): bugün kayıt varsa bugünden, yoksa DÜNDEN
//    geriye kesintisiz gün sayısı — gün bitmeden seri "kırılmış" görünmez.
//  · Kaçırılan gün: arada kayıtsız bir İstanbul günü varsa seri orada biter;
//    bugün de kayıt yoksa ve dün de yoksa seri 0.
//  · Kutlama serisi (FinCelebStreak3/7): yalnız BUGÜN kayıt varsa (bugünü
//    tamamlayan kayıt anı kutlanır) — `celebrationStreak`.
import { addDays } from './dayClock';

/** Kayıtlı gün anahtarları kümesi. Satır listesi ya da kova verilebilir. */
export function loggedDays(
  rows: readonly { date?: string; count?: number; kcal?: number }[],
): Set<string> {
  const s = new Set<string>();
  for (const r of rows) {
    if (!r.date) continue;
    // count verilmişse onu, yoksa kcal>0'ı kullan (eski 30 günlük kova yalnız kcal taşır).
    const counted = typeof r.count === 'number' ? r.count > 0 : (r.kcal ?? 0) > 0;
    if (counted) s.add(r.date);
  }
  return s;
}

function runBack(days: ReadonlySet<string>, from: string): number {
  let n = 0;
  let k = from;
  // 400 gün üst sınır: bozuk veride sonsuz döngü yok (kova zaten 30 gün).
  while (n < 400 && days.has(k)) {
    n += 1;
    k = addDays(k, -1);
  }
  return n;
}

/** Gösterilen seri (sunucu kuralı: bugün yoksa dünden say). */
export function displayStreak(days: ReadonlySet<string>, todayKey: string): number {
  if (days.has(todayKey)) return runBack(days, todayKey);
  return runBack(days, addDays(todayKey, -1));
}

/** Kutlama serisi: bugün kayıt yoksa 0. */
export function celebrationStreak(days: ReadonlySet<string>, todayKey: string): number {
  return days.has(todayKey) ? runBack(days, todayKey) : 0;
}

/** Bugünün ilk kaydı seriyi bir gün uzattı mı (streak_day olayı). */
export function isNewStreakDay(prevTodayCount: number, nextTodayCount: number): boolean {
  return prevTodayCount === 0 && nextTodayCount > 0;
}

// ─── Kutlama: "yalnız bir kez" ───────────────────────────────────────────────
export type StreakMilestone = 'streak3' | 'streak7';

/**
 * Gösterildi işaretlerini genişletir: 7'lik kutlama gösterildiyse 3'lük de
 * gösterilmiş sayılır (yeni kullanıcı ilk seriyi 7'de yakalarsa sonradan 3'lük
 * "geri" kutlama çıkmasın). Kutlama ekrana GELDİĞİ anda işaretlenir (kapatmayı
 * beklemeden) → uygulama kutlama açıkken öldürülse bile ikinci kez çıkmaz.
 */
export function markShown(shown: Record<string, boolean>, moment: string): Record<string, boolean> {
  const next = { ...shown, [moment]: true };
  if (moment === 'streak7') next.streak3 = true;
  return next;
}

/** Kullanıcıya özel depolama anahtarı (aynı cihazda iki hesap birbirini etkilemez). */
export function celebrateStorageKey(userId: string | null | undefined): string {
  return userId ? `@kcal_celebrate_shown:${userId}` : '@kcal_celebrate_shown';
}

// ─── Gün sonu özeti (FinGunEnd / FinGunDone) zamanı ──────────────────────────
/** Gün sonu penceresi başlangıcı (İstanbul saati). */
export const DAY_END_HOUR = 20;

/**
 * Gün sonu özeti ne zaman gösterilir:
 *  · 'done'  → hedef tamamlandı (FinGunDone) — günün herhangi bir saatinde, bir kez.
 *  · 'end'   → saat ≥ 20:00 ve bugün ≥ 1 kayıt var ama hedef tamamlanmadı (FinGunEnd).
 *  · null    → kayıt yok (FinGunEmpty yalnız görüntüleyicide) ya da henüz erken.
 * Aynı gün için bir kez: `lastShownDay === todayKey` ise null.
 */
export function dayEndKind(input: {
  hour: number;
  todayCount: number;
  ringDone: boolean;
  todayKey: string;
  lastShownDay: string | null;
}): 'end' | 'done' | null {
  if (input.lastShownDay === input.todayKey) return null;
  if (input.todayCount <= 0) return null;
  if (input.ringDone) return 'done';
  if (input.hour >= DAY_END_HOUR) return 'end';
  return null;
}
