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

  return { routes, mockRoutes: mockRoutesFor(entry) };
}
