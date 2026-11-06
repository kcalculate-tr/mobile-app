// G14-S1 — Vitrin mock ağ rotaları (Supabase REST/RPC yanıtları). YALNIZ __DEV__.
// Panolardaki örnek veriye benzer, AÇIKÇA vitrin verisi; üretime girmez.
// `empty` durumunu her rota kendisi uygular (hedef/profil dolu kalır, listeler boş).
//
// G15-S2: Final FinHomeR3 örneğiyle aynı içerik — makrolar 82 / 110 / 38 g,
// Su 1,5 / 2,5 L, teslim anında Akşam'a "Izgara Somon Bowl".
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ResolvedEntry } from './screenCatalog';
import type { MockRoute } from './vitrinState';

function todayAt(h: number, m: number): string {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** FinHomeR3 örneği: Kahvaltı (Tara) · Öğle (eatkcal) · Ara öğün (Keşfet + Elle). */
function meals(long = false, delivered = false): any[] {
  const rows: any[] = [
    { id: 'm4', source: 'manual', source_ref: null, name: 'Sütlü kahve', meal_type: 'snack', calories: 40, protein: 2, carbs: 8, fat: 2, note: null, consumed_at: todayAt(18, 40) },
    { id: 'm3', source: 'kesfet', source_ref: 'post-2', name: 'Süzme yoğurt kasesi', meal_type: 'snack', calories: 160, protein: 16, carbs: 20, fat: 4, note: null, consumed_at: todayAt(16, 30) },
    {
      id: 'm2',
      source: 'order',
      source_ref: 'KCAL-1042',
      name: long ? 'KCAL · Izgara tavuklu, kinoalı, avokadolu ve nar ekşili büyük akdeniz kasesi' : 'KCAL · Tavuklu Bowl',
      meal_type: 'lunch',
      calories: 560,
      protein: 44,
      carbs: 66,
      fat: 12,
      note: null,
      consumed_at: todayAt(13, 5),
    },
    { id: 'm1', source: 'ai_scan', source_ref: null, name: 'Menemen', meal_type: 'breakfast', calories: 320, protein: 20, carbs: 16, fat: 20, note: null, consumed_at: todayAt(8, 10) },
  ];
  if (delivered) {
    rows.unshift({
      id: 'm5',
      source: 'order',
      source_ref: 'KCAL-1043',
      name: 'Izgara Somon Bowl',
      meal_type: 'dinner',
      calories: 520,
      protein: 38,
      carbs: 44,
      fat: 18,
      note: null,
      consumed_at: todayAt(19, 20),
    });
  }
  return rows;
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
      consumed_protein: empty ? 0 : 82,
      consumed_carb: empty ? 0 : 110,
      consumed_fat: empty ? 0 : 38,
      remaining_kcal: 2180 - kcal,
      remaining_protein: empty ? 140 : 58,
      remaining_carb: empty ? 250 : 140,
      remaining_fat: empty ? 70 : 32,
    },
  ];
}

const HOME_SCENES = new Set(['meals', 'delivered', 'activity', 'streak', 'scanOffline', 'intro', 'introOrder', 'longNames']);

/** Oturumlu her sahne: kimlik satırı + hedef özeti (Profil başlığı, Hedefim). */
function identityRoutes(entry: ResolvedEntry): MockRoute[] {
  if (entry.auth !== 'user') return [];
  return [
    { match: '/rest/v1/profiles', body: [{ id: 'me', handle: 'deniz', is_private: false, avatar_url: null, display_name: 'Deniz Kaya' }] },
    { match: '/rest/v1/user_nutrition_profiles', body: PROFILE },
    { match: '/rpc/get_nutrition_summary', body: summary(entry.data === 'empty') },
  ];
}

export function mockRoutesFor(entry: ResolvedEntry): MockRoute[] {
  const scene = entry.scene ?? '';
  const target = JSON.stringify(entry.target);
  const isHome = target.includes('"Tracker"') && (HOME_SCENES.has(scene) || entry.data === 'empty' || scene === '');
  if (!isHome) return identityRoutes(entry);
  const empty = entry.data === 'empty';
  return [
    ...identityRoutes(entry),
    { match: '/rest/v1/meal_consumptions', body: () => (empty ? [] : meals(scene === 'longNames', scene === 'delivered')) },
    { match: '/rest/v1/body_measurements', body: [] },
    { match: '/rest/v1/orders', body: [] },
    // G15-S2 — Su halkası (water_daily, Final: 1,5 / 2,5 L).
    { match: '/rest/v1/water_daily', body: () => (empty ? [] : [{ ml: 1500 }]) },
  ];
}
