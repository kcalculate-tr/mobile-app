// G14-S1 — Vitrin sahne hazırlığı (yerel depolar + mock ağ rotaları). YALNIZ __DEV__.
// Gerçek ağ yalnız OKUMA için kullanılır (herkese açık menü); yazma yok.
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ResolvedEntry, RouteSpec } from './screenCatalog';
import { seedStorage, type MockRoute } from './vitrinState';
import { useCartStore } from '../store/cartStore';
import { useTbDraft } from '../modules/onboarding/takibe/draft';
import { FEED_TIP_SEEN_FLAG } from '../modules/kesfet/ui/FeedTip';
import { mockRoutesFor } from './vitrinFixtures';

export interface PreparedScene {
  routes: RouteSpec[] | null;
  mockRoutes: MockRoute[];
}

const CART_SCENES = new Set(['cart', 'cartLong', 'payWait', 'payFail', 'payUnknown']);

async function loadProducts(): Promise<any[]> {
  const { fetchProducts } = require('../lib/products');
  const list: any[] = await fetchProducts();
  return (list ?? []).filter((p) => p && p.is_active !== false && Number(p.price) > 0);
}

function replaceFirst(routes: RouteSpec[], id: string | null): RouteSpec[] {
  return routes.map((r) => ({
    ...r,
    params:
      r.params && r.params.productId === '__first__' ? { ...r.params, productId: id ?? '' } : r.params,
    state: r.state ? { routes: replaceFirst(r.state.routes, id) } : undefined,
  }));
}

export async function prepareScene(entry: ResolvedEntry): Promise<PreparedScene> {
  const scene = entry.scene ?? '';

  await seedStorage({
    'g12-intro-seen-v1': scene === 'intro' || scene === 'introOrder' ? null : '1',
    [FEED_TIP_SEEN_FLAG]: scene === 'tip' ? null : '1',
    'eatkcal-city-gate-passed': ['city', 'waitlist', 'berlin'].includes(scene) ? null : '1',
    // G15-S2 — FinCollectEntry: profilde koleksiyon şeridi (4 kart).
    '@kcal_collection_v1':
      entry.pano === 'FinCollectEntry'
        ? JSON.stringify({ assignments: { 'Tavuk kinoa bowl': 43, Menemen: 31, 'Mercimek çorbası': 24, 'Yulaf kasesi': 19 }, won: [] })
        : null,
  });

  // Sepet: Final sepet/özet sahneleri dolu, boş durumda boş.
  const cart = useCartStore.getState() as any;
  cart.clearCart?.();
  let routes: RouteSpec[] | null = null;
  const needsProducts =
    entry.data !== 'empty' &&
    (CART_SCENES.has(scene) || JSON.stringify(entry.target).includes('__first__'));
  if (needsProducts) {
    const products = await loadProducts().catch(() => []);
    if (CART_SCENES.has(scene)) {
      for (const p of products.slice(0, 2)) cart.addItem?.(p, {}, 1);
    }
    if (entry.target.kind === 'route') {
      routes = replaceFirst(entry.target.routes, products[0] ? String(products[0].id) : null);
    }
  }

  if (scene === 'draft') {
    // TakibeNavigator açılışta taslağı sıfırlar → sonra doldur.
    setTimeout(() => {
      const d = useTbDraft.getState();
      d.setGoal('lose');
      d.setPace(0.5);
      d.setGender('female' as any);
      d.setBirthYear(1994);
      d.setHeightCm(168);
      d.setWeightKg(68);
      d.setConsent(true);
      d.setActivity('moderate' as any);
    }, 400);
  }

  // G15-S2 — Tara: hak hapı görünsün (Final "Bugün N/3 tarama hakkın kaldı").
  if (JSON.stringify(entry.target).includes('AiScan')) {
    const { useScanQuotaStore } = require('../modules/ai/scan/quotaStore');
    useScanQuotaStore.getState().recordQuota(3, new Date(Date.now() + 864e5).toISOString());
  }

  // G15-S2 — Ana sayfa alt bölümleri: Final örneği (eatkcal şeridi + Keşfet videoları).
  const { setHomeStripsProvider } = require('../screens/tracker/HomeStrips');
  setHomeStripsProvider({
    eta: '30–55 dk',
    city: 'İzmir',
    dishes: async () => [
      { id: 'v-d1', name: 'Tavuklu Bowl', kcal: 560, price: 265, photo: null },
      { id: 'v-d2', name: 'Izgara Somon Bowl', kcal: 520, price: 285, photo: null },
      { id: 'v-d3', name: 'Peynirli omlet', kcal: 340, price: 195, photo: null },
    ],
    videos: async (lang: string) =>
      lang === 'en'
        ? [
            { id: 'post-1', title: 'Simit, X-rayed', thumb: null },
            { id: 'post-2', title: 'Calorie Court: Kumpir', thumb: null },
            { id: 'post-3', title: 'Label Detective: light', thumb: null },
          ]
        : [
            { id: 'post-1', title: 'Simidin röntgeni', thumb: null },
            { id: 'post-2', title: 'Kalori Mahkemesi: Kumpir', thumb: null },
            { id: 'post-3', title: 'Etiket Dedektifi: light', thumb: null },
          ],
  });

  return { routes, mockRoutes: mockRoutesFor(entry) };
}
