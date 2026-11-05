// Kutlama sinyalleri — GERÇEK veriden ilk öğün + gün serisi (G13-S1 m.2).
// SAF; RN importu YOK (tsx ile birim test edilir). Seçim/ömür-boyu-bir-kez
// kuralı `pickCelebration` + AsyncStorage'da (useCelebrations).

export interface DayBucket {
  /** Yerel gün anahtarı YYYY-MM-DD. */
  date: string;
  kcal: number;
}

/**
 * Bugün dahil, geriye doğru kesintisiz kayıtlı gün sayısı. Bugün kayıt yoksa
 * 0 (seri "bugün" tamamlanmadan kutlanmaz). `days` sıralı olmak zorunda değil.
 */
export function computeStreak(days: readonly DayBucket[], todayKey: string): number {
  const logged = new Set(days.filter((d) => d.kcal > 0).map((d) => d.date));
  if (!logged.has(todayKey)) return 0;
  const cur = parseKey(todayKey);
  if (!cur) return 0;
  let n = 0;
  while (logged.has(formatKey(cur))) {
    n += 1;
    cur.setDate(cur.getDate() - 1);
  }
  return n;
}

/**
 * İlk öğün mü: bugün en az bir kayıt var VE bugünden önce hiç kayıt yok
 * (`hasEarlier` = sunucuda bugünden eski en az bir meal_consumptions satırı).
 */
export function isFirstMeal(todayCount: number, hasEarlier: boolean): boolean {
  return todayCount > 0 && !hasEarlier;
}

function parseKey(k: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

function formatKey(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}
