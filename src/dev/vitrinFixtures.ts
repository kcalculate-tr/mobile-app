// G14-S1 — Vitrin mock ağ rotaları (Supabase REST/RPC yanıtları). YALNIZ __DEV__.
// Panolardaki örnek veriye benzer, AÇIKÇA uydurma vitrin verisi; üretime girmez.
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ResolvedEntry } from './screenCatalog';
import type { MockRoute } from './vitrinState';

export function mockRoutesFor(_entry: ResolvedEntry): MockRoute[] {
  return [];
}
