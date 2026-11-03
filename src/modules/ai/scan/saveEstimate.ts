// AI tarama tahminini güne kaydet. G6-S1'in `meal_consumptions_source_check`
// güncellemesi (CHECK'e 'ai_scan' ekler) henüz bu dala alınmadı; bu yüzden
// şimdilik mevcut izinli değer `source: 'manual'` kullanılır, köken
// `source_ref: 'ai_scan'` ile işaretlenir (bkz. docs/night/G6-S4-LOG.md
// SORULAR — G6-S1 entegre olunca source='ai_scan'a geçilebilir).
//
// Bağımlılık enjekte edilir (gerçek Supabase istemcisi çağıran tarafından
// verilir) — bu dosya native import YAPMAZ, saf birim testlerle doğrulanır.
import type { ScanEstimate } from './types';

export interface MealConsumptionRow {
  id: string;
  name: string;
  meal_type: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  consumed_at: string;
}

export interface InsertableSupabase {
  from(table: string): {
    insert(row: Record<string, unknown>): {
      select(columns: string): {
        // PromiseLike: Supabase'in PostgrestBuilder'ı tam Promise değil (catch/finally
        // yok) ama await ile çalışır; gerçek istemciyle uyumlu olsun diye gevşek tip.
        single(): PromiseLike<{ data: MealConsumptionRow | null; error: { message: string } | null }>;
      };
    };
  };
}

export async function saveAiScanEstimate(
  supabase: InsertableSupabase,
  params: { userId: string; mealType: string; estimate: Omit<ScanEstimate, 'isEstimate'> },
): Promise<MealConsumptionRow> {
  const { userId, mealType, estimate } = params;
  const { data, error } = await supabase
    .from('meal_consumptions')
    .insert({
      user_id: userId,
      source: 'manual',
      source_ref: 'ai_scan',
      name: estimate.name,
      meal_type: mealType,
      calories: Math.max(0, Math.round(estimate.kcal)),
      protein: Math.max(0, Math.round(estimate.protein_g)),
      carbs: Math.max(0, Math.round(estimate.carbs_g)),
      fat: Math.max(0, Math.round(estimate.fat_g)),
      note: null,
      consumed_at: new Date().toISOString(),
    })
    .select('id,name,meal_type,calories,protein,carbs,fat,consumed_at')
    .single();
  if (error) throw new Error(`meal_consumptions.insert: ${error.message}`);
  if (!data) throw new Error('meal_consumptions.insert: boş yanıt');
  return data;
}
