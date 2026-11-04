// "Takibe başla" kaydı — MEVCUT beslenme profili tablosuna yazar
// (`user_nutrition_profiles` + `body_measurements`). YENİ TABLO YOK; kolon
// eşlemesi NutritionProfileScreen (S3) ile birebir aynıdır. Hedef/makro
// `lib/nutrition` servisiyle hesaplanır (calc.computeResult).
//
// NOT (ENTEGRASYONA · S4/S6): Profil › Hedefim "Hedefi düzenle" bu akışı açar;
// giriş noktasının bağlanması ve mevcut profil değerleriyle ÖN DOLDURMA S4'e
// aittir (ProfileScreen S4 sahipliğinde). Bu dosya yalnız kaydı yapar.

import { getSupabaseClient } from '../../../core/supabase';
import { computeResult, type TbDraftValues } from './calc';

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export async function saveTakibeProfile(
  userId: string,
  draft: TbDraftValues,
  currentYear: number,
): Promise<SaveResult> {
  const result = computeResult(draft, currentYear);
  if (!result) return { ok: false, error: 'invalid' };

  try {
    const supabase = getSupabaseClient();
    const today = new Date().toISOString().split('T')[0];
    const { input, macros } = result;

    const [profileRes, measurementRes] = await Promise.all([
      supabase.from('user_nutrition_profiles').upsert(
        {
          user_id: userId,
          gender: input.gender,
          age: input.age,
          height: input.heightCm,
          weight: input.weightKg,
          goal: input.goal,
          activity_level: input.activity,
          target_calories: macros.calories,
          target_protein: macros.protein,
          target_carbs: macros.carbs,
          target_fat: macros.fat,
          target_water: macros.water,
          use_custom_macros: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      ),
      supabase.from('body_measurements').upsert(
        {
          user_id: userId,
          date: today,
          weight_kg: input.weightKg,
        },
        { onConflict: 'user_id,date' },
      ),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (measurementRes.error) throw measurementRes.error;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'save_failed' };
  }
}
