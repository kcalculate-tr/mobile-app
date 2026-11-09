// AI tarama tahminini güne kaydet. G7-S1 (migration 20261104001100): CHECK'e
// 'ai_scan' eklendi; kayıt `source: 'ai_scan'`, `source_ref: <sourceRef>` ile
// yazılır. sourceRef taramaya özgü BENZERSİZ anahtardır (reservation/idempotency
// anahtarı) — (user_id, source, source_ref) UNIQUE kısıtı yüzünden sabit bir
// source_ref aynı gün ikinci taramada çakışıyordu; benzersiz ref bunu çözer.
// meal_type sunucu koduna (kahvalti|…) çevrilir (bkz. core/meal/mealType).
//
// Bağımlılık enjekte edilir (gerçek Supabase istemcisi çağıran tarafından
// verilir) — bu dosya native import YAPMAZ, saf birim testlerle doğrulanır.
import type { ScanEstimate } from './types';
import { toServerMealType } from '../../../core/meal/mealType';

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
        single(): PromiseLike<{ data: MealConsumptionRow | null; error: { message: string; code?: string } | null }>;
      };
    };
  };
}

const COLUMNS = 'id,name,meal_type,calories,protein,carbs,fat,consumed_at';

type DbError = { message: string; code?: string };

export function isUniqueViolation(error: DbError | null | undefined): boolean {
  if (!error) return false;
  return error.code === '23505' || /duplicate key|unique constraint/i.test(error.message ?? '');
}

type SelectableSupabase = {
  from(table: string): {
    select(columns: string): {
      eq(c: string, v: string): {
        eq(c: string, v: string): {
          eq(c: string, v: string): { maybeSingle(): PromiseLike<{ data: MealConsumptionRow | null; error: DbError | null }> };
        };
      };
    };
  };
};

async function fetchExisting(supabase: InsertableSupabase, userId: string, sourceRef: string): Promise<MealConsumptionRow | null> {
  try {
    const db = supabase as unknown as SelectableSupabase;
    const { data } = await db
      .from('meal_consumptions')
      .select(COLUMNS)
      .eq('user_id', userId)
      .eq('source', 'ai_scan')
      .eq('source_ref', sourceRef)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}


export async function saveAiScanEstimate(
  supabase: InsertableSupabase,
  params: { userId: string; mealType: string; sourceRef: string; estimate: Omit<ScanEstimate, 'isEstimate'> },
): Promise<MealConsumptionRow> {
  const { userId, mealType, sourceRef, estimate } = params;
  const { data, error } = await supabase
    .from('meal_consumptions')
    .insert({
      user_id: userId,
      source: 'ai_scan',
      source_ref: sourceRef,
      name: estimate.name,
      meal_type: toServerMealType(mealType),
      calories: Math.max(0, Math.round(estimate.kcal)),
      protein: Math.max(0, Math.round(estimate.protein_g)),
      carbs: Math.max(0, Math.round(estimate.carbs_g)),
      fat: Math.max(0, Math.round(estimate.fat_g)),
      note: null,
      consumed_at: new Date().toISOString(),
    })
    .select(COLUMNS)
    .single();
  if (error) {
    // G19-S1 md.2: (user_id, source, source_ref) UNIQUE — aynı tarama zaten loglandıysa
    // (çift dokunma, yanıtı kaybolan yeniden deneme, kuyruk + elle aynı anda) hata
    // DEĞİL: mevcut satır döner, ikinci kayıt oluşmaz.
    if (isUniqueViolation(error)) {
      const existing = await fetchExisting(supabase, userId, sourceRef);
      if (existing) return existing;
    }
    throw new Error(`meal_consumptions.insert: ${error.message}`);
  }
  if (!data) throw new Error('meal_consumptions.insert: boş yanıt');
  return data;
}
