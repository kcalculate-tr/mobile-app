// G15-S2 — Su takibi veri katmanı (bayrak `su_takibi`).
//
// Sunucu: public.water_daily (kullanıcı başına günlük tek satır, RLS yalnız
// sahibi) + public.log_water(p_ml) RPC (20261106000100_g15_water.sql).
// Bayrak KAPALIYKEN bu modül hiç çağrılmaz (TrackerScreen → useWaterToday(false)).
import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '../../core/supabase';

import { istanbulDay } from './waterFormat';
import { track } from '../../lib/analytics';

// Saf yardımcılar tek kaynakta (birim testli): waterFormat.ts.
export { WATER_STEP_ML, formatLiters, istanbulDay, waterTargetMl } from './waterFormat';

export async function fetchWaterToday(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('water_daily')
    .select('ml')
    .eq('user_id', userId)
    .eq('day', istanbulDay())
    .maybeSingle();
  if (error) throw error;
  return Number((data as { ml?: number } | null)?.ml ?? 0) || 0;
}

/** Bugünün toplamına ml ekler (negatif = geri al). Yeni toplamı döner (sunucu null dönerse null). */
export async function logWater(ml: number): Promise<number | null> {
  const { data, error } = await supabase.rpc('log_water', { p_ml: Math.round(ml) });
  if (error) throw error;
  track('water_add', { ml: Math.round(ml) });
  return typeof data === 'number' ? data : null;
}

/**
 * Ana sayfa Su halkası durumu. `enabled=false` → hiç istek yok, ml=null.
 * add(ml): iyimser güncelleme; hata olursa geri alır.
 */
export function useWaterToday(enabled: boolean, userId: string | null | undefined) {
  const [ml, setMl] = useState<number | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !userId) {
      setMl(null);
      return;
    }
    fetchWaterToday(userId)
      .then((v) => alive.current && setMl(v))
      .catch(() => alive.current && setMl(0));
  }, [enabled, userId]);

  const add = useCallback(
    async (delta: number) => {
      if (!enabled) return;
      let before = 0;
      setMl((cur) => {
        before = cur ?? 0;
        return Math.max(0, before + delta);
      });
      try {
        const total = await logWater(delta);
        if (total != null && alive.current) setMl(total);
      } catch {
        if (alive.current) setMl(before);
      }
    },
    [enabled],
  );

  return { ml, add };
}
