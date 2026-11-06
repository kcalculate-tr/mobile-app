// G14-S1 — Vitrin mock ağ rotaları (Supabase REST/RPC yanıtları). YALNIZ __DEV__.
// Panolardaki örnek veriye benzer, AÇIKÇA vitrin verisi; üretime girmez.
// `empty` durumunu her rota kendisi uygular (hedef/profil dolu kalır, listeler boş).
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ResolvedEntry } from './screenCatalog';
import type { MockRoute } from './vitrinState';

function todayAt(h: number, m: number): string {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** FinHomeR3 örneği: Kahvaltı (Tara) · Öğle (eatkcal) · Ara öğün (Keşfet + Elle). */
function meals(long = false): any[] {
  return [
    { id: 'm4', source: 'manual', source_ref: null, name: 'Sütlü kahve', meal_type: 'snack', calories: 40, protein: 2, carbs: 4, fat: 2, note: null, consumed_at: todayAt(18, 40) },
    { id: 'm3', source: 'kesfet', source_ref: 'post-2', name: 'Süzme yoğurt kasesi', meal_type: 'snack', calories: 160, protein: 12, carbs: 14, fat: 6, note: null, consumed_at: todayAt(16, 30) },
    {
      id: 'm2',
      source: 'order',
      source_ref: 'KCAL-1042',
      name: long ? 'KCAL · Izgara tavuklu, kinoalı, avokadolu ve nar ekşili büyük akdeniz kasesi' : 'KCAL · Tavuklu Bowl',
      meal_type: 'lunch',
      calories: 560,
      protein: 42,
      carbs: 48,
      fat: 18,
      note: null,
      consumed_at: todayAt(13, 5),
    },
    { id: 'm1', source: 'ai_scan', source_ref: null, name: 'Menemen', meal_type: 'breakfast', calories: 320, protein: 18, carbs: 12, fat: 22, note: null, consumed_at: todayAt(8, 10) },
  ];
}

const PROFILE = [
  { target_calories: 2180, target_protein: 140, target_carbs: 250, target_fat: 70, target_water: 2.5 },
];

function summary(empty: boolean): any[] {
  const kcal = empty ? 0 : 1080;
  return [
    {
      target_kcal: 2180,
      target_protein: 140,
      target_carb: 250,
      target_fat: 70,
      consumed_kcal: kcal,
      consumed_protein: empty ? 0 : 74,
      consumed_carb: empty ? 0 : 78,
      consumed_fat: empty ? 0 : 48,
      remaining_kcal: 2180 - kcal,
      remaining_protein: empty ? 140 : 66,
      remaining_carb: empty ? 250 : 172,
      remaining_fat: empty ? 70 : 22,
    },
  ];
}

const HOME_SCENES = new Set(['meals', 'delivered', 'activity', 'streak', 'scanOffline', 'intro', 'introOrder', 'longNames']);

export function mockRoutesFor(entry: ResolvedEntry): MockRoute[] {
  const scene = entry.scene ?? '';
  const target = JSON.stringify(entry.target);
  const isHome = target.includes('"Tracker"') && (HOME_SCENES.has(scene) || entry.data === 'empty' || scene === '');
  if (!isHome) return [];
  const empty = entry.data === 'empty';
  return [
    { match: '/rest/v1/user_nutrition_profiles', body: PROFILE },
    { match: '/rest/v1/meal_consumptions', body: () => (empty ? [] : meals(scene === 'longNames')) },
    { match: '/rest/v1/body_measurements', body: [] },
    { match: '/rest/v1/orders', body: [] },
    { match: '/rpc/get_nutrition_summary', body: summary(empty) },
  ];
}
