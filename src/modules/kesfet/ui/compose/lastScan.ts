// G15-S3 — Composer "Tara sonucundan": bugün loglanan EN SON AI tarama kaydını
// (meal_consumptions, source='ai_scan') öğün kartına doldurmak için okur. Yalnız
// OKUMA; RLS kullanıcının kendi satırlarını döndürür. Hata/kayıt yok → null.
type SupabaseModule = typeof import('../../../../core/supabase');

export interface LastScanMeal {
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export async function fetchLastScanMeal(now: Date = new Date()): Promise<LastScanMeal | null> {
  try {
    const sb = (require('../../../../core/supabase') as SupabaseModule).getSupabaseClient();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const { data, error } = await sb
      .from('meal_consumptions')
      .select('name, calories, protein, carbs, fat, consumed_at')
      .eq('source', 'ai_scan')
      .gte('consumed_at', start.toISOString())
      .order('consumed_at', { ascending: false })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const r = data[0] as { name: string; calories: number; protein: number; carbs: number; fat: number };
    if (!r.name) return null;
    return {
      name: r.name,
      kcal: Number(r.calories) || 0,
      protein_g: Number(r.protein) || 0,
      carbs_g: Number(r.carbs) || 0,
      fat_g: Number(r.fat) || 0,
    };
  } catch {
    return null;
  }
}
