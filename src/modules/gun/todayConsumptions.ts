// "Bugünkü kayıtlarımdan seç" — bugün zaten loglanmış `meal_consumptions`
// satırlarını okur (TrackerScreen'in sorguladığı aynı tablo). Bu bir RPC değil,
// RLS ile zaten yalnız `auth.uid()`'a ait satırları döner (TrackerScreen'deki
// sorguyla aynı yetki modeli). `core/supabase` tembel require — Node testlerinde
// bu dosya hiç çağrılmaz (mock kullanılır).
import type { MealType } from '../kesfet/types';

export interface TodayConsumption {
  id: string;
  name: string;
  meal_type: MealType | null;
  kcal: number;
  consumed_at: string; // ISO
  // G22-S2 md.5 (FinShareDay önizlemesi) — İSTEĞE BAĞLI; aynı tablonun sütunları
  // (get_day_cards da bunları okur). Eski çağıranlar etkilenmez.
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  photo_url?: string | null;
}

type SupabaseModule = typeof import('../../core/supabase');
function sb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../../core/supabase') as SupabaseModule).getSupabaseClient();
}

async function realGetTodayConsumptions(): Promise<TodayConsumption[]> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

  const { data, error } = await sb()
    .from('meal_consumptions')
    .select('id,name,meal_type,calories,consumed_at,protein,carbs,fat,photo_path')
    .gte('consumed_at', todayStart)
    .lt('consumed_at', tomorrowStart)
    .order('consumed_at', { ascending: false });
  if (error) throw new Error(`meal_consumptions: ${error.message}`);
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    meal_type: row.meal_type ?? null,
    kcal: row.calories ?? 0,
    consumed_at: row.consumed_at,
    protein_g: row.protein ?? null,
    carbs_g: row.carbs ?? null,
    fat_g: row.fat ?? null,
    photo_url: row.photo_path ?? null,
  }));
}

let activeProvider: () => Promise<TodayConsumption[]> = realGetTodayConsumptions;

export function getTodayConsumptions(): Promise<TodayConsumption[]> {
  return activeProvider();
}

/** __DEV__ ekranı / testler için — gerçek sorguyu bellek içi listeyle değiştirir. */
export function setTodayConsumptionsProvider(provider: () => Promise<TodayConsumption[]>): void {
  activeProvider = provider;
}

export function resetTodayConsumptionsProvider(): void {
  activeProvider = realGetTodayConsumptions;
}
