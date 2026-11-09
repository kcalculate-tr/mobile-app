// G15-S2 — Su takibi veri katmanı (bayrak `su_takibi`).
//
// Sunucu: public.water_daily (kullanıcı başına günlük tek satır, RLS yalnız
// sahibi) + public.log_water(p_ml) RPC (20261106000100_g15_water.sql).
// Bayrak KAPALIYKEN bu modül hiç çağrılmaz (TrackerScreen → useWaterToday(false)).
import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '../../core/supabase';

import { istanbulDay } from './waterFormat';
import { applyWater, validWaterDelta } from './track/limits';

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
  return typeof data === 'number' ? data : null;
}

/**
 * Ana sayfa Su halkası durumu. `enabled=false` → hiç istek yok, ml=null.
 * add(ml): iyimser güncelleme; hata olursa geri alır.
 *
 * G19-S2 md.3 düzeltmeleri:
 *  · Geri alma değeri setState güncelleyicisinin İÇİNDE yakalanıyordu; React
 *    güncelleyiciyi sonraki çizime erteleyebildiği için hata anında `before`
 *    0 kalıp toplam sıfıra düşebiliyordu → değer ref'te tutulur.
 *  · İyimser toplam sunucu sınırlarıyla aynı ([0, 20000], tek adım ≤ 2000).
 *  · Hızlı ardışık dokunuşlarda geç gelen eski yanıt yeni toplamı ezmez (sıra no).
 *  · refresh(): gece yarısı / ön plana dönüş / başka cihazdaki kayıt.
 *  · Dönüş: gerçekten uygulanan fark (tavanda kırpılan kısım geri alınmaz).
 */
export function useWaterToday(enabled: boolean, userId: string | null | undefined) {
  const [ml, setMl] = useState<number | null>(null);
  const mlRef = useRef<number | null>(null);
  const alive = useRef(true);
  const seq = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const set = useCallback((v: number | null) => {
    mlRef.current = v;
    if (alive.current) setMl(v);
  }, []);

  const refresh = useCallback(() => {
    if (!enabled || !userId) return;
    const mine = ++seq.current;
    fetchWaterToday(userId)
      .then((v) => {
        if (mine === seq.current) set(v);
      })
      .catch(() => {
        if (mine === seq.current && mlRef.current == null) set(0);
      });
  }, [enabled, userId, set]);

  useEffect(() => {
    if (!enabled || !userId) {
      set(null);
      return;
    }
    refresh();
  }, [enabled, userId, refresh, set]);

  const add = useCallback(
    async (delta: number): Promise<number> => {
      if (!enabled || !validWaterDelta(delta)) return 0;
      const before = mlRef.current ?? 0;
      const after = applyWater(before, delta);
      if (after === before) return 0;
      const mine = ++seq.current;
      set(after);
      try {
        const total = await logWater(after - before);
        if (total != null && mine === seq.current) set(total);
      } catch {
        if (mine === seq.current) set(before);
        return 0;
      }
      return after - before;
    },
    [enabled, set],
  );

  return { ml, add, refresh };
}
