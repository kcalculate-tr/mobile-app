// eatkcal v2 (G22-S2 md.3) — şehir araması (cihaz tarafı): duraksamalı `search_cities` RPC.
// Durumlar: idle (kısa sorgu) · loading · ok · empty · error (ağ yok / RPC canlıda yok).
// Eski yanıtlar yok sayılır (sıra numarası); ekrandan çıkınca zamanlayıcı temizlenir.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '../../../../../core/supabase';
import { CITY_SEARCH_DEBOUNCE_MS, normalizeCityQuery, searchCities, type GeoCity } from '../../model/geo';

export type CitySearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; cities: GeoCity[] }
  | { status: 'empty' }
  | { status: 'error' };

const rpc = (fn: 'search_cities', args: { q: string; country: string | null }) =>
  getSupabaseClient().rpc(fn, args) as unknown as PromiseLike<{ data: unknown; error: unknown }>;

export function useCitySearch(query: string, country: string | null, enabled: boolean) {
  const [state, setState] = useState<CitySearchState>({ status: 'idle' });
  const seq = useRef(0);
  const [nonce, setNonce] = useState(0);
  const q = normalizeCityQuery(query);

  useEffect(() => {
    const my = ++seq.current;
    if (!enabled || !q) {
      setState({ status: 'idle' });
      return;
    }
    setState({ status: 'loading' });
    const timer = setTimeout(() => {
      searchCities(rpc, q, country).then((r) => {
        if (seq.current !== my) return;
        setState(r.status === 'ok' ? { status: 'ok', cities: r.cities } : { status: r.status });
      });
    }, CITY_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, country, enabled, nonce]);

  // Ekrandan çıkınca geç gelen yanıt durum yazmasın.
  useEffect(
    () => () => {
      seq.current += 1;
    },
    [],
  );

  const retry = useCallback(() => setNonce((n) => n + 1), []);
  return { state, retry, query: q };
}
