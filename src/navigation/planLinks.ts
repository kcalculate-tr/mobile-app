// G36-S1 md.14 (İlter 12 Kas, G34 SORULAR 8) — kişisel plan bildirim dokunuşları derin bağlantı.
// SAF (RN yok) → tsx birim testi. Yollar `linking.ts` config'inde de aynı (Linking URL'i açılırsa),
// bildirim dokunuşu `resolveNavigation` (src/lib/navigation.ts) üzerinden aynı hedefe gider.
//   kcal://plan/checkin → Haftalık tartı (PersonalPlanCheckin)
//   kcal://plan/today   → Öğün planı, bugün (MealPlan { date, weekStart }); öğün planı kapalıysa Kişisel planım
//   kcal://plan/mine    → Kişisel planım (PersonalPlanMine)
import { weekStartOf } from '../modules/plan/week';

export const PLAN_LINK = {
  checkin: 'plan/checkin',
  today: 'plan/today',
  mine: 'plan/mine',
} as const;

export const PLAN_URL = {
  checkin: `kcal://${PLAN_LINK.checkin}`,
  today: `kcal://${PLAN_LINK.today}`,
  mine: `kcal://${PLAN_LINK.mine}`,
} as const;

export interface PlanLinkTarget {
  name: 'PersonalPlanCheckin' | 'MealPlan' | 'PersonalPlanMine';
  params?: { date: string; weekStart: string };
  /** Hedef rota kayıtlı değilse (bayrak kapalı) gidilecek rota. */
  fallback?: 'PersonalPlanMine';
}

/** `kcal://plan/...` ya da `https://l.eatkcal.com/plan/...` → hedef; plan bağlantısı değilse null. */
export function planLinkTarget(url: string | null | undefined, today: string): PlanLinkTarget | null {
  if (typeof url !== 'string') return null;
  const path = url
    .trim()
    .replace(/^kcal:\/\//i, '')
    .replace(/^https?:\/\/l\.eatkcal\.com\//i, '')
    .replace(/[?#].*$/, '')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
  if (path === PLAN_LINK.checkin) return { name: 'PersonalPlanCheckin' };
  if (path === PLAN_LINK.today) return { name: 'MealPlan', params: { date: today, weekStart: weekStartOf(today) }, fallback: 'PersonalPlanMine' };
  if (path === PLAN_LINK.mine) return { name: 'PersonalPlanMine' };
  return null;
}

/** Bildirim türü → dokunuş URL'i (haftalık tartı → Haftalık tartı; öğün → Öğün planı bugün). */
export function reminderUrl(kind: 'meal' | 'weigh'): string {
  return kind === 'weigh' ? PLAN_URL.checkin : PLAN_URL.today;
}
