// G14-S1 — Vitrin sahne hazırlığı (yerel depolar + mock ağ rotaları). YALNIZ __DEV__.
// Gerçek ağ yalnız OKUMA için kullanılır (herkese açık menü); yazma yok.
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ResolvedEntry, RouteSpec } from './screenCatalog';
import { seedStorage, type MockRoute } from './vitrinState';
import { useCartStore } from '../store/cartStore';
import { useTbDraft } from '../modules/onboarding/takibe/draft';
import { FEED_TIP_SEEN_FLAG } from '../modules/kesfet/ui/FeedTip';
import { mockRoutesFor, vitrinHomeAddress } from './vitrinFixtures';
import { useAddressStore } from '../store/addressStore';

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

function replaceFirst(routes: RouteSpec[], id: string | null, brand: string | null = null): RouteSpec[] {
  return routes.map((r) => {
    let params = r.params;
    if (params && params.productId === '__first__') params = { ...params, productId: id ?? '' };
    // G15-S5: mağaza panoları (FinEkStore/Reviews) gerçek menüdeki ilk marka anahtarıyla.
    if (params && params.brandKey === '__first__') params = { ...params, brandKey: brand ?? '' };
    return { ...r, params, state: r.state ? { routes: replaceFirst(r.state.routes, id, brand) } : undefined };
  });
}

export async function prepareScene(entry: ResolvedEntry): Promise<PreparedScene> {
  const scene = entry.scene ?? '';

  await seedStorage({
    'g12-intro-seen-v1': scene === 'intro' || scene === 'introOrder' ? null : '1',
    [FEED_TIP_SEEN_FLAG]: scene === 'tip' ? null : '1',
    'eatkcal-city-gate-passed': ['city', 'waitlist', 'berlin'].includes(scene) ? null : '1',
  });

  // G15-S5: eatkcal ana sayfa (FinEkHome) teslimat satırı için seçili adres
  // (gerçekte AuthContext.hydrateSelectedAddress doldurur; vitrin oturumu sahte).
  const targetJson = JSON.stringify(entry.target);
  const isEkHomeTab = /"name":"Home"/.test(targetJson) && !/"name":"Ek/.test(targetJson);
  if (entry.area === 'eatkcal') (useAddressStore.getState() as any).setSelectedAddress?.(
    (isEkHomeTab || CART_SCENES.has(scene)) && entry.data !== 'empty' && !['city', 'waitlist', 'berlin'].includes(scene)
      ? vitrinHomeAddress()
      : null,
  );

  // Sepet: Final sepet/özet sahneleri dolu, boş durumda boş.
  const cart = useCartStore.getState() as any;
  cart.clearCart?.();
  let routes: RouteSpec[] | null = null;
  // G15-S5: sipariş panoları da gerçek menü ürünlerini kullanır (satır fotoğrafı).
  const isOrders = /"EkOrders?(Detail)?"|"EkOrders"/.test(JSON.stringify(entry.target));
  const needsProducts =
    entry.data !== 'empty' &&
    (CART_SCENES.has(scene) || isOrders || JSON.stringify(entry.target).includes('__first__'));
  let productIds: string[] = [];
  if (needsProducts) {
    const products = await loadProducts().catch(() => []);
    productIds = products.filter((p) => p.img).map((p) => String(p.id));
    if (CART_SCENES.has(scene)) {
      // G15-S5: Final sepet örneği makrolu ürünler (satır makro çipleri + özet halkaları).
      const withMacros = products.filter((p) => Number(p.calories) > 0);
      for (const p of (withMacros.length >= 2 ? withMacros : products).slice(0, 2)) cart.addItem?.(p, {}, 1);
    }
    if (entry.target.kind === 'route') {
      const brand = products.find((p) => typeof p.brand === 'string' && p.brand)?.brand ?? null;
      // G15-S5: makro verisi olan ilk ürün (Final ürün panosu dolu makro halkalarıyla).
      const withMacros = products.find((p) => Number(p.calories) > 0) ?? products[0];
      routes = replaceFirst(entry.target.routes, withMacros ? String(withMacros.id) : null, brand);
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

  return { routes, mockRoutes: mockRoutesFor(entry, productIds) };
}
