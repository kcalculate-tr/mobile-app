// G60-S1 md.4 — yabancı ülkede arama boşken ülkenin en kalabalık şehirleri (`top_cities` RPC).
// Durumlar: idle (kapalı / Türkiye) · loading · ok · nodata (veri yok → serbest yazım) · error (Tekrar dene).
// Ülke başına bellek içi önbellek (sheet her açılışta yeniden istemesin); hata önbelleğe yazılmaz.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '../../../../../core/supabase';
import { fetchTopCities, type GeoCity, type TopCitiesResult } from '../../model/geo';

export type TopCitiesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; cities: GeoCity[] }
  | { status: 'nodata' }
  | { status: 'error' };

const cache = new Map<string, TopCitiesResult>();

const rpc = (fn: 'top_cities', args: { p_country: string; p_limit: number }) =>
  getSupabaseClient().rpc(fn, args) as unknown as PromiseLike<{ data: unknown; error: unknown }>;

export function useTopCities(country: string | null, enabled: boolean) {
  const [state, setState] = useState<TopCitiesState>({ status: 'idle' });
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const my = ++seq.current;
    if (!enabled || !country) {
      setState({ status: 'idle' });
      return;
    }
    const hit = cache.get(country);
    if (hit) {
      setState(hit.status === 'ok' ? { status: 'ok', cities: hit.cities } : { status: hit.status });
      return;
    }
    setState({ status: 'loading' });
    void fetchTopCities(rpc, country).then((r) => {
      if (r.status !== 'error') cache.set(country, r);
      if (seq.current !== my) return;
      setState(r.status === 'ok' ? { status: 'ok', cities: r.cities } : { status: r.status });
    });
  }, [country, enabled, nonce]);

  useEffect(
    () => () => {
      seq.current += 1;
    },
    [],
  );

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { state, retry };
}

/** Test: önbelleği temizle. */
export function __clearTopCitiesCache(): void {
  cache.clear();
}
