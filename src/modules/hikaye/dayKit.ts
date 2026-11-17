// G59-S1 — "Günüm" kiti + "Bugünden" çıkartmaları: mevcut gün verisinden (bugünün meal_consumptions'ı,
// user_nutrition_profiles.target_calories, su kaydı, gün halkası serisi). Uydurma veri YOK: kaynak yoksa
// ilgili çıkartma kütüphanede görünmez. ADIM verisi uygulamada yok → Adım çıkartması gizli (LOG/SORULAR).
import { newOverlayId } from './overlays';
import type { MealData, StickerSkin, StoryOverlay } from './types';
import type { TodayConsumption } from '../gun/todayConsumptions';

export interface DayKitData {
  meals: TodayConsumption[];
  kcal: number;
  goal: number | null;
  proteinG: number;
  waterMl: number | null;
  streak: number | null;
  steps: number | null;
}

/** Öğün türü (istemci kodu) → tasarım etiket anahtarı. */
export function mealTypeLabelKey(t: string | null | undefined): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const v = String(t ?? '').toLowerCase();
  if (v === 'breakfast' || v === 'kahvalti') return 'breakfast';
  if (v === 'dinner' || v === 'aksam') return 'dinner';
  if (v === 'snack' || v === 'atistirma') return 'snack';
  return 'lunch';
}

export function summarize(meals: readonly TodayConsumption[]): { kcal: number; proteinG: number } {
  return meals.reduce(
    (a, m) => ({ kcal: a.kcal + Math.max(0, m.kcal || 0), proteinG: a.proteinG + Math.max(0, Number(m.protein_g) || 0) }),
    { kcal: 0, proteinG: 0 },
  );
}

/** Halka yüzdesi (0..999; hedef yoksa 0). */
export function ringPercent(kcal: number, goal: number | null): number {
  if (!goal || goal <= 0) return 0;
  return Math.max(0, Math.min(999, Math.round((kcal / goal) * 100)));
}

/** Öğün çıkartması verisi (bugünkü kayıttan). */
export function mealDataFrom(m: TodayConsumption, skin: StickerSkin, showMacros: boolean, imageUrl: string | null = null): MealData {
  return {
    name: m.name.slice(0, 120),
    meal_type: m.meal_type ?? null,
    kcal: Math.max(0, Math.round(m.kcal || 0)),
    protein_g: m.protein_g ?? null,
    carbs_g: m.carbs_g ?? null,
    fat_g: m.fat_g ?? null,
    image_url: imageUrl,
    show_macros: showMacros,
    skin,
  };
}

/** Hangi "Bugünden" karoları gösterilir? (veri yoksa gizli; adım verisi yok → hep gizli). */
export function availableKitTiles(d: DayKitData): Array<'meal' | 'ring' | 'streak' | 'water' | 'steps' | 'poll'> {
  const out: Array<'meal' | 'ring' | 'streak' | 'water' | 'steps' | 'poll'> = [];
  if (d.meals.length) out.push('meal');
  if (d.goal && d.goal > 0) out.push('ring');
  if (d.streak != null && d.streak > 0) out.push('streak');
  if (d.waterMl != null) out.push('water');
  if (d.steps != null) out.push('steps');
  out.push('poll');
  return out;
}

/**
 * "Günüm" kiti (kameradaki "Günüm"): tasarım `kit` yerleşimi — halka sol üst, su ve seri sağda.
 * Veri olmayan parça eklenmez. Koordinatlar 393×699 tuvalinden orana çevrildi.
 */
export function buildDayKit(d: DayKitData, now: number = Date.now()): StoryOverlay[] {
  const out: StoryOverlay[] = [];
  let z = 0;
  if (d.goal && d.goal > 0) {
    out.push({ id: newOverlayId('ring', now), kind: 'ring', x: 0.25, y: 0.405, scale: 1.15, rotation: -4, z: z++, data: { kcal: Math.round(d.kcal), goal: Math.round(d.goal), skin: 'dark' } });
  }
  if (d.waterMl != null) {
    out.push({ id: newOverlayId('water', now + 1), kind: 'water', x: 0.6, y: 0.375, scale: 1.1, rotation: 3, z: z++, data: { ml: Math.round(d.waterMl), skin: 'glass' } });
  }
  if (d.streak != null && d.streak > 0) {
    out.push({ id: newOverlayId('streak', now + 2), kind: 'streak', x: 0.85, y: 0.38, scale: 1.05, rotation: -2, z: z++, data: { days: d.streak, skin: 'glass' } });
  }
  if (d.steps != null) {
    out.push({ id: newOverlayId('steps', now + 3), kind: 'steps', x: 0.85, y: 0.55, scale: 1, rotation: 2, z: z++, data: { steps: d.steps, skin: 'glass' } });
  }
  const last = d.meals[0];
  if (last) {
    out.push({ id: newOverlayId('meal', now + 4), kind: 'meal', x: 0.5, y: 0.66, scale: 1, rotation: 4, z: z++, data: mealDataFrom(last, 'light', true) });
  }
  return out;
}

type SupabaseModule = typeof import('../../core/supabase');

/** Gerçek veri (uygulama içi; testler `buildDayKit` / `availableKitTiles`'ı doğrudan sınar). */
export async function loadDayKit(userId: string | null | undefined, opts: { water: boolean }): Promise<DayKitData> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getTodayConsumptions } = require('../gun/todayConsumptions') as typeof import('../gun/todayConsumptions');
  const meals = await getTodayConsumptions().catch(() => [] as TodayConsumption[]);
  const { kcal, proteinG } = summarize(meals);
  let goal: number | null = null;
  let waterMl: number | null = null;
  let streak: number | null = null;
  if (userId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sb = (require('../../core/supabase') as SupabaseModule).getSupabaseClient();
      const { data } = await sb.from('user_nutrition_profiles').select('target_calories').eq('user_id', userId).maybeSingle();
      const g = Number((data as { target_calories?: unknown } | null)?.target_calories);
      goal = Number.isFinite(g) && g > 0 ? g : null;
    } catch {
      goal = null;
    }
    if (opts.water) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { fetchWaterToday } = require('../gun/water') as typeof import('../gun/water');
        waterMl = await fetchWaterToday(userId);
      } catch {
        waterMl = null;
      }
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getGunClient } = require('../gun/client') as typeof import('../gun/client');
      const rings = await getGunClient().getDayRings();
      const mine = rings[0];
      streak = mine && typeof mine.streak === 'number' ? mine.streak : null;
    } catch {
      streak = null;
    }
  }
  return { meals, kcal, goal, proteinG, waterMl, streak, steps: null };
}
