// GunViewer'ın hangi kullanıcı sırasında ilerleyeceğini belirleyen SAF mantık.
// Seçilen halkadan başlar, şeritteki SONRAKİ kullanıcılara ilerler (geriye
// sarma yok — IG hikâyeleri gibi son kullanıcıda biter). `rings[0]` sözleşme
// gereği her zaman "ben" (bkz. G5-CONTRACT.md "Gün halkası").
import type { DayRing } from '../types';

export function buildViewerQueue(rings: DayRing[], startUserId: string): string[] {
  const startIndex = rings.findIndex((r) => r.user.id === startUserId);
  const from = startIndex === -1 ? 0 : startIndex;
  return rings.slice(from).map((r) => r.user.id);
}
