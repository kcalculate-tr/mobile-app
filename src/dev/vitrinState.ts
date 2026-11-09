// G14-S1 — Vitrin veri durumu: mock istemciler + ağ taklidi. YALNIZ __DEV__.
//
// Ağ: supabase-js her çağrıda global `fetch`'i çözer (resolveFetch → `fetch(...)`),
// bu yüzden global fetch'i sarmak yeterli.
//  - loading → hiç dönmez (iskelet/yükleniyor kalır)
//  - error/offline → "Network request failed"
//  - default/empty → eşleşen mock rota JSON'u; GET dışı her Supabase isteği
//    (yazma, rpc, auth) SAHTE yanıtla kesilir → vitrin CANLIYA YAZAMAZ.
//    Eşleşmeyen GET (herkese açık menü/ürün okumaları) gerçek ağa gider.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VitrinDataState } from './screenCatalog';
import { createMockKesfetClient, setKesfetClient } from '../modules/kesfet';
import { createMockGunClient, setGunClient } from '../modules/gun';
import { createMockProfilClient, setProfilClient } from '../modules/profil';
import { createMockAiScanClient, setAiScanClient } from '../modules/ai/scan';
import { vitrinGunClient, vitrinKesfetClient, vitrinProfilClient } from './vitrinKesfet';

export type MockRoute = {
  /** URL içinde aranacak parça (ör. `/rest/v1/orders`). */
  match: string;
  method?: string;
  body: unknown | ((url: string) => unknown);
  status?: number;
};

const realFetch: typeof fetch = global.fetch;
let installed = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/*' },
  });
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return (input as Request).url;
}

export function installNetwork(state: VitrinDataState, routes: MockRoute[]): void {
  installed = true;
  global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = urlOf(input);
    const method = (init?.method ?? (input as Request)?.method ?? 'GET').toUpperCase();
    const isSupabase = url.includes('.supabase.co');
    if (isSupabase || url.includes('/functions/v1/')) {
      if (state === 'loading') return new Promise<Response>(() => {});
      if (state === 'error' || state === 'offline') throw new TypeError('Network request failed');
    }
    for (const r of routes) {
      if (!url.includes(r.match)) continue;
      if (r.method && r.method.toUpperCase() !== method) continue;
      const body = typeof r.body === 'function' ? (r.body as (u: string) => unknown)(url) : r.body;
      return json(body, r.status ?? 200);
    }
    if (isSupabase) {
      if (url.includes('/auth/v1/')) return json({ error: 'vitrin' }, 401);
      if (url.includes('/storage/v1/') && method === 'GET') return realFetch(input as RequestInfo, init);
      if (method !== 'GET' && method !== 'HEAD') {
        // Yazma/rpc canlıya GİTMEZ. rpc → null, diğerleri boş liste.
        return json(url.includes('/rpc/') ? null : [], 200);
      }
      // Kullanıcıya özel okumalar anon'la zaten boş döner; herkese açık okumalar gerçek.
      return realFetch(input as RequestInfo, init);
    }
    if (state === 'loading') return new Promise<Response>(() => {});
    if (state === 'error' || state === 'offline') throw new TypeError('Network request failed');
    // Analitik vb. dış servisler vitrinde susturulur.
    if (/facebook|sentry|segment|amplitude|posthog/.test(url)) return json({});
    return realFetch(input as RequestInfo, init);
  }) as typeof fetch;
}

export function restoreNetwork(): void {
  if (installed) global.fetch = realFetch;
  installed = false;
}

/** Bir istemciyi duruma göre sarar: loading → bekler, error/offline → atar. */
export function stateClient<T extends object>(base: T, state: VitrinDataState): T {
  if (state === 'default' || state === 'empty') return base;
  return new Proxy(base, {
    get(target, key, recv) {
      const v = Reflect.get(target, key, recv);
      if (typeof v !== 'function' || String(key).startsWith('_')) return v;
      return () =>
        state === 'loading'
          ? new Promise(() => {})
          : Promise.reject(new Error(state === 'offline' ? 'Network request failed' : 'vitrin hata'));
    },
  });
}

/** Modül istemcilerini (Keşfet, Gün, Profil, AI tarama) mock'a çevirir. */
export function installMockClients(state: VitrinDataState, area?: string, scene?: string): void {
  const empty = state === 'empty';
  if (area === 'kesfet') {
    // G15-S3 — Keşfet sahneleri Final örnek içeriğiyle (vitrinKesfet.ts).
    setKesfetClient(stateClient(vitrinKesfetClient(scene ?? '', empty), state));
    setGunClient(stateClient(vitrinGunClient(createMockGunClient({}), empty || scene === 'following'), state));
    setProfilClient(stateClient(vitrinProfilClient(createMockProfilClient()), state));
    setAiScanClient(stateClient(createMockAiScanClient(), state));
    return;
  }
  setKesfetClient(
    stateClient(
      createMockKesfetClient(
        empty ? { count: 0, followingIndexes: [], unreadCount: 0 } : { withActivityPost: true },
      ),
      state,
    ),
  );
  setGunClient(stateClient(createMockGunClient(empty ? { ringCount: 0, cardCount: 0 } : {}), state));
  setProfilClient(stateClient(createMockProfilClient(), state));
  setAiScanClient(stateClient(createMockAiScanClient(), state));
}

/** Tek seferlik ipuçları/kapılar — sahneye göre görülmüş/görülmemiş yapılır. */
export async function seedStorage(entries: Record<string, string | null>): Promise<void> {
  for (const [k, v] of Object.entries(entries)) {
    try {
      if (v == null) await AsyncStorage.removeItem(k);
      else await AsyncStorage.setItem(k, v);
    } catch {
      // yut
    }
  }
}
