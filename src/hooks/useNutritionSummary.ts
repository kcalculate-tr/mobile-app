import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSupabaseClient } from '../lib/supabase';

export type NutritionSummary = {
  targetKcal: number;
  targetProtein: number;
  targetCarb: number;
  targetFat: number;
  consumedKcal: number;
  consumedProtein: number;
  consumedCarb: number;
  consumedFat: number;
  remainingKcal: number;
  remainingProtein: number;
  remainingCarb: number;
  remainingFat: number;
};

const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const mapRow = (row: Record<string, unknown>): NutritionSummary => ({
  targetKcal: toNum(row.target_kcal),
  targetProtein: toNum(row.target_protein),
  targetCarb: toNum(row.target_carb),
  targetFat: toNum(row.target_fat),
  consumedKcal: toNum(row.consumed_kcal),
  consumedProtein: toNum(row.consumed_protein),
  consumedCarb: toNum(row.consumed_carb),
  consumedFat: toNum(row.consumed_fat),
  remainingKcal: toNum(row.remaining_kcal),
  remainingProtein: toNum(row.remaining_protein),
  remainingCarb: toNum(row.remaining_carb),
  remainingFat: toNum(row.remaining_fat),
});

/**
 * Günlük hedef/tüketilen/kalan makro değerlerinin tek kaynağı.
 * Sunucu tarafındaki `get_nutrition_summary` RPC'sini sarar; gün sınırı
 * Europe/Istanbul saat dilimine göre sunucuda hesaplanır.
 *
 * @param date `YYYY-MM-DD` formatında, verilmezse bugün (Europe/Istanbul).
 */
export function useNutritionSummary(date?: string) {
  const { user } = useAuth();
  const [data, setData] = useState<NutritionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      // RPC parametre almıyor: sunucu tarafında her zaman auth.uid() kullanılır
      // (bkz. 20260916093000_get_nutrition_summary_harden.sql) — başka bir
      // kullanıcının id'sini göndermenin bir yolu yok.
      const { data: rows, error: rpcError } = await supabase.rpc('get_nutrition_summary', {
        ...(date ? { p_date: date } : {}),
      });
      if (rpcError) throw rpcError;
      const row = Array.isArray(rows) ? rows[0] : rows;
      setData(row ? mapRow(row as Record<string, unknown>) : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Beslenme özeti alınamadı.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user, date]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { summary: data, loading, error, refetch };
}
