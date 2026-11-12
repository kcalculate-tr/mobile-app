// Soğuk açılış bayrakları (G11-S2 → G30-S1 md.3). AppNavigator'dan ayrıldı (test edilebilir).
//
// Bayrak AÇILIŞTA BİR KEZ okunur ve sabitlenir: sunucudan çalışma anında gelen değişiklik
// navigasyonu BOZMAZ (ağaç yeniden kurulmaz), bir sonraki soğuk açılışta uygulanır. Bayrak
// henüz bilinmiyorsa eski kabuk gösterilir (güvenli varsayılan); ilk bilinen değerde dondurulur.
//
// G30-S1 md.3: "bilinen" = sunucu çözümü (ready) YA DA önbellekteki son bilinen bayraklar
// (settled). Önceden oturumlu soğuk açılışta önce eski kabuk çiziliyor, `get_my_features`
// dönünce bütün sekme ağacı yeni kabukla YENİDEN KURULUYORDU (açılışta yanıp sönme).
import { useRef } from 'react';
import { useFeature, useFlagsContext, type FlagKey } from '../core/flags';

export function useColdStartFeature(key: FlagKey): boolean {
  const live = useFeature(key);
  const ctx = useFlagsContext();
  const known = ctx ? (ctx.settled ?? ctx.ready) : true;
  const frozen = useRef<boolean | undefined>(undefined);
  if (frozen.current === undefined && known) {
    frozen.current = live;
  }
  return frozen.current ?? false;
}

/** Oturumlu soğuk açılışta bayrak bekleme üst sınırı (önbellek yoksa). */
export const SESSION_FLAGS_WAIT_MS = 1500;

/**
 * Splash bayraklar için açık kalsın mı? Oturumsuz: sunucu/anon çözümü (ANON_TIMEOUT_MS sınırlı).
 * Oturumlu: önbellek uygulanana ya da sunucu çözülene kadar, en çok SESSION_FLAGS_WAIT_MS —
 * çevrimdışında açılış takılmaz, süre dolunca güvenli varsayılan.
 */
export function shouldWaitFlags(a: { hasSession: boolean; ready: boolean; settled: boolean; sessionWaitOver: boolean }): boolean {
  if (a.ready) return false;
  if (!a.hasSession) return true;
  return !a.settled && !a.sessionWaitOver;
}
