// G14-S1 — Vitrin sahne hazırlığı (yerel depolar + mock ağ rotaları). YALNIZ __DEV__.
// Gerçek ağ yalnız OKUMA için kullanılır (herkese açık menü); yazma yok.
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ResolvedEntry, RouteSpec } from './screenCatalog';
import { seedStorage, type MockRoute } from './vitrinState';
import { useCartStore } from '../store/cartStore';
import { useTbDraft } from '../modules/onboarding/takibe/draft';
import { FEED_TIP_SEEN_FLAG } from '../modules/kesfet/ui/FeedTip';
import { mockRoutesFor, vitrinHomeAddress } from './vitrinFixtures';
import { resolveVitrinPhotos } from './vitrinKesfet';
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

/** G18-S1 — `@kcal_onb_first_v1` vitrin tohumu (bkz. modules/onboarding/first/state.ts). */
function onbFirstSeed(scene: string, pano: string) {
  const seen = (n: number) => ({ 1: n >= 1, 2: n >= 2, 3: n >= 3, 4: n >= 4 });
  const m = /^orient([1-4])$/.exec(scene);
  if (m) {
    const step = Number(m[1]);
    return { profileCard: 'dismissed', orient: { started: true, skipped: false, seen: seen(step - 1) } };
  }
  const cardOpen = scene === 'profileCard' || pano === 'FinHomeEmptyR1';
  return { profileCard: cardOpen ? 'open' : 'done', orient: { started: true, skipped: true, seen: seen(0) } };
}

export async function prepareScene(entry: ResolvedEntry): Promise<PreparedScene> {
  const scene = entry.scene ?? '';

  await seedStorage({
    'g12-intro-seen-v1': scene === 'intro' || scene === 'introOrder' ? null : '1',
    [FEED_TIP_SEEN_FLAG]: scene === 'tip' ? null : '1',
    'eatkcal-city-gate-passed': ['city', 'waitlist', 'berlin'].includes(scene) ? null : '1',
    // G18-S1 — ilk 60 saniye bayrakları: varsayılan kart tamam + oryantasyon atlandı
    // (diğer panolara karışmasın); kendi sahnelerinde açık.
    '@kcal_onb_first_v1': JSON.stringify(onbFirstSeed(scene, entry.pano)),
    // G16-S1 — FinScanOffline: bugün 13:05'te çekilmiş 1 bekleyen fotoğraf.
    '@kcal_ai_scan_pending_queue':
      scene === 'scanOffline'
        ? JSON.stringify([
            {
              id: 'vitrin-pending-1',
              imageUri: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200',
              mealType: 'lunch',
              queuedAt: new Date(new Date().setHours(13, 5, 0, 0)).toISOString(),
            },
          ])
        : null,
    // G15-S2 — FinCollectEntry: profilde koleksiyon şeridi (4 kart).
    '@kcal_collection_v1':
      entry.pano === 'FinCollectEntry'
        ? JSON.stringify({ assignments: { 'Tavuk kinoa bowl': 43, Menemen: 31, 'Mercimek çorbası': 24, 'Yulaf kasesi': 19 }, won: [] })
        : null,
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

  // G15-S2 — Gün görüntüleyici: Final örneği (Dyt. · Kahvaltı/Öğle/Akşam · Tavuk kinoa bowl).
  if (entry.target.kind === 'component' && entry.target.key === 'gunViewer') {
    const { setGunClient, createMockGunClient } = require('../modules/gun');
    const base = createMockGunClient();
    const today = (h: number) => {
      const d = new Date();
      d.setHours(h, 30, 0, 0);
      return d.toISOString();
    };
    const cards = [
      ['Yulaf kasesi', 'breakfast', 8, 340, 14, 52, 9],
      ['Tavuk kinoa bowl', 'lunch', 12, 540, 42, 48, 18],
      ['Mercimek çorbası', 'dinner', 19, 260, 14, 38, 6],
    ];
    setGunClient({
      ...base,
      getDayRings: async () => [
        { user: { id: 'me', display_name: 'Ben', avatar_url: null }, progress: 0.4, streak: 3, has_new: false },
        { user: { id: 'dyt', display_name: 'Dyt. Elif', avatar_url: null }, progress: 0.72, streak: 6, has_new: true },
      ],
      getDayCards: async ({ user }: { user: string }) =>
        cards.map(([name, meal, h, kcal, p, c, f], i) => ({
          id: `v-${user}-${i}`,
          consumption_id: `v-c-${user}-${i}`,
          name,
          meal_type: meal,
          consumed_at: today(h as number),
          photo_url: null,
          kcal,
          protein_g: p,
          carbs_g: c,
          fat_g: f,
        })),
    });
  }

  // G15-S2 — Tara: hak hapı görünsün (Final "Bugün N/3 tarama hakkın kaldı").
  if (JSON.stringify(entry.target).includes('AiScan')) {
    const { useScanQuotaStore } = require('../modules/ai/scan/quotaStore');
    useScanQuotaStore.getState().recordQuota(3, new Date(Date.now() + 864e5).toISOString());
    // G17-S2: vitrin ağı sahte → analiz yanıtı yok. Yalnız vitrinde, FinMoScan
    // analiz katmanı görünsün diye 2,5 sn gecikmeli bellek içi istemci.
    const { setAiScanClient } = require('../modules/ai/scan/client');
    const { createMockAiScanClient } = require('../modules/ai/scan/mock');
    const mock = createMockAiScanClient({ cap: 3 });
    // FinMoScan: dokunma aracı olmadan deklanşör (yalnız __DEV__ dinleyicisi).
    if (scene === 'autoShutter') {
      const { DeviceEventEmitter } = require('react-native');
      const { DEV_SCAN_SHUTTER_EVENT } = require('../modules/ai/scan/ui/FinScanCamera');
      setTimeout(() => DeviceEventEmitter.emit(DEV_SCAN_SHUTTER_EVENT), 3000);
    }
    setAiScanClient({
      ...mock,
      analyzeImage: async (p: { idempotencyKey: string; imageRef: string }) => {
        await new Promise((r) => setTimeout(r, 2500));
        return mock.analyzeImage(p);
      },
    });
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
  // G18-S2 — Ana sayfa Tur 26: öne çıkanlar banner'ı, bölge (İzmir / dışı), Keşfet kapakları.
  // Örnek içerik = Final panosunun örneği (yalnız vitrin; üretimde gerçek kaynaklar).
  {
    const { Image: RNImage } = require('react-native');
    const ph = (m: number) => RNImage.resolveAssetSource(m)?.uri ?? null;
    const P = {
      mercimek: ph(require('./assets/ph-mercimek.jpg')),
      kinoa: ph(require('./assets/ph-tavuk-kinoa.jpg')),
      coban: ph(require('./assets/ph-coban.jpg')),
      yogurt: ph(require('./assets/ph-yogurt.jpg')),
      menemen: ph(require('./assets/ph-menemen.jpg')),
      somon: ph(require('./assets/ph-somon.jpg')),
    };
    const { setHomeBannerProvider } = require('../modules/gun/home/HomeBanner');
    const { setHomeRegionProvider } = require('../modules/gun/home/HomeRegion');
    const { setHomeRegionOverride } = require('../modules/gun/home/useHomeRegion');
    const en = entry.lang === 'en';
    const vp = (id: string, extra: Record<string, unknown>) => ({
      id,
      author: { id: 'u-ed', display_name: en ? 'Editor’s pick' : 'Editör seçimi', handle: 'kcal', avatar_url: null, role: 'kurum', verified: true },
      published_at: new Date().toISOString(),
      lang: en ? 'en' : 'tr',
      body: '',
      media: [],
      meal_card: null,
      quote: null,
      thread: null,
      stats: { likes: 0, saves: 0, adds: 0, comments: 0, did_it: 0 },
      me: {},
      post_type: 'serbest',
      status: 'published',
      activity_card: null,
      ...extra,
    });
    setHomeBannerProvider({
      posts: async () => [
        vp('post-recipe', {
          post_type: 'ogun',
          stats: { likes: 9, saves: 0, adds: 0, comments: 0, did_it: 0 },
          media: [{ url: P.mercimek, width: 1, height: 1, kind: 'image' }],
          meal_card: { name: en ? 'Red lentil soup' : 'Mercimek çorbası', kcal: 220, protein_g: 12, carbs_g: 30, fat_g: 5, portion_label: '1' },
        }),
        vp('post-featured', {
          body: en ? 'Chicken quinoa bowl' : 'Tavuk kinoa bowl',
          stats: { likes: 8, saves: 0, adds: 0, comments: 0, did_it: 0 },
          media: [{ url: P.kinoa, width: 1, height: 1, kind: 'image' }],
        }),
      ],
      campaign: async () => ({ id: 'v-camp', title: en ? '[Campaign title]' : '[Kampanya başlığı]', subtitle: null, image: P.coban, link: null }),
    });
    // G39-S1 md.6: Ana sayfa eatkcal vitrini — kampanya bannerları + restoran/mağaza kartları (örnek içerik).
    const cell = (id: string, image: string | null, title: string) => ({ id, row_id: 'v-row', position: 0, image_url: image, title, link: null, navigate_to: null, is_active: true });
    const brand = (key: string, name: string, tagline: string, cover: string | null) => ({
      key,
      brand: { key, name, tagline, description: null, hero_image_url: cover, accent_color: null },
      cover,
    });
    setHomeRegionProvider({
      eta: scene === 'izmirNoAddr' ? null : en ? '30-45 min' : '30-45 dk',
      campaigns: async () => [
        cell('v-c1', P.coban, en ? 'Fresh salads, 20% off' : 'Taze salatalarda %20 indirim'),
        cell('v-c2', P.somon, en ? 'Salmon week' : 'Somon haftası'),
      ],
      stores: async () =>
        scene === 'izmirEmpty'
          ? []
          : [
              brand('kcalculate', 'kcalculate', en ? 'Macro-counted meals' : 'Makrosu hesaplı öğünler', P.kinoa),
              brand('tera', 'Tera', en ? 'Bowls and wraps' : 'Bowl ve dürümler', P.somon),
              brand('breakingfast', 'Breaking Fast', en ? 'All-day breakfast' : 'Gün boyu kahvaltı', P.menemen),
            ],
    });
    setHomeRegionOverride(scene === 'outside' ? 'other' : 'izmir');
    // Adres var / yok (G39-S1 md.6): yalnız Ana sayfa sahnelerinde.
    if (entry.area === 'ana') (useAddressStore.getState() as any).setSelectedAddress?.(scene === 'izmirNoAddr' ? null : vitrinHomeAddress());
    // G39-S1: koç girişleri (bayrak koc + abonelik) vitrinde açık → koç kartı / sohbet çizilsin.
    if (entry.flags.includes('koc' as any)) {
      const { useSubscriptionStore } = require('../lib/subscription/purchases');
      const { useCoachAccessStore } = require('../modules/coach/access');
      useSubscriptionStore.setState({ available: true });
      useCoachAccessStore.getState().setAvail('ok');
    }
    setHomeStripsProvider({
      eta: '30–55 dk',
      city: 'İzmir',
      dishes: async () => [],
      videos: async (lang: string) =>
        lang === 'en'
          ? [
              { id: 'post-1', title: 'Menemen, X-rayed', thumb: P.menemen },
              { id: 'post-2', title: 'Calorie Court: Shepherd’s salad', thumb: P.coban },
              { id: 'post-3', title: 'Label Detective: strained yogurt', thumb: P.yogurt },
            ]
          : [
              { id: 'post-1', title: 'Menemenin röntgeni', thumb: P.menemen },
              { id: 'post-2', title: 'Kalori Mahkemesi: Çoban salata', thumb: P.coban },
              { id: 'post-3', title: 'Etiket Dedektifi: süzme yoğurt', thumb: P.yogurt },
            ],
    });
  }
  // G15-S3 — rota parametrelerindeki `__vitrinPhoto:<ad>` işaretlerini dev görsel URI'sine çevir.
  const base = routes ?? (entry.target.kind === 'route' ? entry.target.routes : null);
  if (base && JSON.stringify(base).includes('__vitrinPhoto:')) routes = resolveVitrinPhotos(base);

  return { routes, mockRoutes: mockRoutesFor(entry, productIds) };
}
