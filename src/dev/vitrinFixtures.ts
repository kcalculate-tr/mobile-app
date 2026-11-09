// G14-S1 — Vitrin mock ağ rotaları (Supabase REST/RPC yanıtları). YALNIZ __DEV__.
// Panolardaki örnek veriye benzer, AÇIKÇA vitrin verisi; üretime girmez.
// `empty` durumunu her rota kendisi uygular (hedef/profil dolu kalır, listeler boş).
//
// G15-S2: Final FinHomeR3 örneğiyle aynı içerik — makrolar 82 / 110 / 38 g,
// Su 1,5 / 2,5 L, teslim anında Akşam'a "Izgara Somon Bowl".
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ResolvedEntry } from './screenCatalog';
import type { MockRoute } from './vitrinState';

function todayAt(h: number, m: number): string {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** FinHomeR3 örneği: Kahvaltı (Tara) · Öğle (eatkcal) · Ara öğün (Keşfet + Elle). */
function meals(long = false, delivered = false): any[] {
  const rows: any[] = [
    { id: 'm4', source: 'manual', source_ref: null, name: 'Sütlü kahve', meal_type: 'snack', calories: 40, protein: 2, carbs: 8, fat: 2, note: null, consumed_at: todayAt(18, 40) },
    { id: 'm3', source: 'kesfet', source_ref: 'post-2', name: 'Süzme yoğurt kasesi', meal_type: 'snack', calories: 160, protein: 16, carbs: 20, fat: 4, note: null, consumed_at: todayAt(16, 30) },
    {
      id: 'm2',
      source: 'order',
      source_ref: 'KCAL-1042',
      name: long ? 'KCAL · Izgara tavuklu, kinoalı, avokadolu ve nar ekşili büyük akdeniz kasesi' : 'KCAL · Tavuklu Bowl',
      meal_type: 'lunch',
      calories: 560,
      protein: 44,
      carbs: 66,
      fat: 12,
      note: null,
      consumed_at: todayAt(13, 5),
    },
    { id: 'm1', source: 'ai_scan', source_ref: null, name: 'Menemen', meal_type: 'breakfast', calories: 320, protein: 20, carbs: 16, fat: 20, note: null, consumed_at: todayAt(8, 10) },
  ];
  if (delivered) {
    rows.unshift({
      id: 'm5',
      source: 'order',
      source_ref: 'KCAL-1043',
      name: 'Izgara Somon Bowl',
      meal_type: 'dinner',
      calories: 520,
      protein: 38,
      carbs: 44,
      fat: 18,
      note: null,
      consumed_at: todayAt(19, 20),
    });
  }
  return rows;
}

const PROFILE = [
  { target_calories: 2180, target_protein: 140, target_carbs: 250, target_fat: 70, target_water: 2.5 },
];

function summary(empty: boolean): any[] {
  const kcal = empty ? 0 : 1080;
  return [
    {
      target_kcal: 2180,
      target_protein: 140,
      target_carb: 250,
      target_fat: 70,
      consumed_kcal: kcal,
      consumed_protein: empty ? 0 : 82,
      consumed_carb: empty ? 0 : 110,
      consumed_fat: empty ? 0 : 38,
      remaining_kcal: 2180 - kcal,
      remaining_protein: empty ? 140 : 58,
      remaining_carb: empty ? 250 : 140,
      remaining_fat: empty ? 70 : 32,
    },
  ];
}

// G18-S1: profileCard (FinHomeProfileCard) + orient3 (ilk kayıttan sonra Gün halkası) öğünlü Ana sayfa.
const HOME_SCENES = new Set(['meals', 'izmir', 'outside', 'delivered', 'activity', 'streak', 'scanOffline', 'intro', 'introOrder', 'longNames', 'profileCard', 'orient3']);

/** Oturumlu her sahne: kimlik satırı + hedef özeti (Profil başlığı, Hedefim). */
function identityRoutes(entry: ResolvedEntry): MockRoute[] {
  if (entry.auth !== 'user') return [];
  return [
    { match: '/rest/v1/profiles', body: [{ id: 'me', handle: 'deniz', is_private: false, avatar_url: null, display_name: 'Deniz Kaya' }] },
    { match: '/rest/v1/user_nutrition_profiles', body: PROFILE },
    { match: '/rpc/get_nutrition_summary', body: summary(entry.data === 'empty') },
  ];
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/** G15-S5 FinEkReviews/Store: onaylı yorum örnekleri (vitrin_yorumlari RPC biçimi). */
const REVIEWS = [
  { id: 'r1', rating: 5, yorum: 'Porsiyon doyurucu, makrolar etiketteki gibi.', ad: 'Deniz K.', tarih: daysAgo(2), kaynak: 'siparis' },
  { id: 'r2', rating: 4, yorum: 'Sıcak geldi, sos biraz az.', ad: 'Ece T.', tarih: daysAgo(5), kaynak: 'siparis' },
];

/**
 * G15-S5 FinEkOrders / OrderDetail: Final'deki dört satır (Yolda · Teslim edildi ×2 ·
 * İade edildi). Ürün id'leri gerçek menüden (satır fotoğrafı); tutarlar örnek.
 */
function orders(ids: string[]): any[] {
  const pid = (i: number) => ids[i % Math.max(1, ids.length)] ?? null;
  const item = (i: number, name: string, price: number) => ({
    id: pid(i),
    name,
    quantity: 1,
    unit_price: price,
    total_price: price,
    calories: 520,
    protein: 42,
    carbs: 48,
    fats: 14,
    legacy_selected_options: {},
  });
  return [
    { id: 1, order_code: 'KCAL-1042', created_at: daysAgo(0), delivered_at: null, total_amount: 742, status: 'on_way', payment_status: 'paid', address: 'Ev · Kıbrıs Şehitleri Cd. No 12, Alsancak', delivery_method: 'delivery', scheduled_date: null, scheduled_time: null, items: [item(0, 'Tavuklu Bowl', 389), item(1, 'Somon Salata', 353)], order_items: [{ product_name: 'Tavuklu Bowl', quantity: 1, unit_price: 389, total_price: 389 }, { product_name: 'Somon Salata', quantity: 1, unit_price: 353, total_price: 353 }] },
    { id: 2, order_code: 'KCAL-1031', created_at: daysAgo(3), delivered_at: daysAgo(3), total_amount: 405, status: 'delivered', payment_status: 'paid', items: [item(1, 'Somon Salata', 405)] },
    { id: 3, order_code: 'KCAL-1019', created_at: daysAgo(8), delivered_at: daysAgo(8), total_amount: 355.5, status: 'delivered', payment_status: 'paid', items: [item(2, 'Mercimek Çorbası', 355.5)] },
    { id: 4, order_code: 'KCAL-1004', created_at: daysAgo(15), delivered_at: null, total_amount: 382.5, status: 'refunded', payment_status: 'refunded', items: [item(3, 'Izgara Köfte', 382.5)] },
  ];
}

/** G15-S5 FinEkAddresses / Checkout: Final'deki üç adres (Ev varsayılan · İş · Yazlık). */
function addresses(): any[] {
  const base = { user_id: '00000000-0000-4000-8000-00000000a14e', city: 'İzmir', contact_name: 'Deniz Kaya', first_name: 'Deniz', last_name: 'Kaya', contact_phone: '+90 532 000 00 00', verified_at: daysAgo(30), updated_at: daysAgo(30) };
  return [
    { ...base, id: 'va1', title: 'Ev', is_default: true, district: 'Konak', neighborhood: 'Alsancak', street: 'Kıbrıs Şehitleri Cd.', building_no: '12', floor: '3', apartment_no: '5', full_address: 'Kıbrıs Şehitleri Cd. No 12, Alsancak, Konak', latitude: 38.4371, longitude: 27.1428, created_at: daysAgo(30) },
    { ...base, id: 'va2', title: 'İş', is_default: false, district: 'Bornova', neighborhood: 'Kazımdirik', street: 'Üniversite Cd.', building_no: '7', floor: '', apartment_no: '', full_address: 'Üniversite Cd. No 7, Kazımdirik, Bornova', latitude: 38.4622, longitude: 27.2178, created_at: daysAgo(20) },
    { ...base, id: 'va3', title: 'Yazlık', is_default: false, district: 'Urla', neighborhood: 'İskele', street: '', building_no: '', floor: '', apartment_no: '', full_address: 'İskele Mh., Urla', latitude: 38.3711, longitude: 26.7667, created_at: daysAgo(10) },
  ];
}

/** G15-S5 FinEkHome: seçili adres (Ev · Konak). */
export function vitrinHomeAddress(): any {
  return addresses()[0];
}

/** G15-S5 FinEkHome: canlı sipariş kartı (Hazırlanıyor). */
function activeOrder(ids: string[]): any[] {
  return [
    {
      id: 1,
      order_code: 'KCAL-1042',
      status: 'preparing',
      total_amount: 742,
      items: [{ id: ids[0] ?? null, name: 'Tavuklu Bowl', quantity: 1 }],
      created_at: new Date(Date.now() - 12 * 60000).toISOString(),
      updated_at: new Date(Date.now() - 4 * 60000).toISOString(),
      district: 'Konak',
      delivery_method: 'home_delivery',
    },
  ];
}

export function mockRoutesFor(entry: ResolvedEntry, productIds: string[] = []): MockRoute[] {
  const scene = entry.scene ?? '';
  const target = JSON.stringify(entry.target);
  const ekHomeTab = /"name":"Home"/.test(target) && !/"name":"Ek/.test(target) && !target.includes('"Tracker"');
  if (ekHomeTab && !['city', 'waitlist', 'berlin'].includes(scene)) {
    return [...identityRoutes(entry), { match: '/rest/v1/orders', body: entry.data === 'empty' ? [] : activeOrder(productIds) }];
  }
  if (/"Ek(Addresses|Checkout|Cart)"/.test(target)) {
    return [...identityRoutes(entry), { match: '/rest/v1/addresses', body: entry.data === 'empty' ? [] : addresses() }];
  }
  if (target.includes('"EkOrders"') || target.includes('"EkOrderDetail"')) {
    // FinEkOrdersFilterEmpty: İptal filtresi boş kalsın (iade satırı yok).
    const all = entry.data === 'empty' ? [] : orders(productIds);
    const list = scene === 'filterEmpty' ? all.filter((o) => o.status !== 'refunded') : all;
    return [
      ...identityRoutes(entry),
      {
        match: '/rest/v1/orders',
        body: (url: string) => {
          const m = /[?&]id=eq\.(\d+)/.exec(url);
          return m ? list.find((o) => String(o.id) === m[1]) ?? null : list;
        },
      },
      { match: '/rest/v1/order_modifications', body: [] },
      { match: '/rest/v1/order_reviews', body: [] },
    ];
  }
  if (target.includes('"EkStore"')) {
    return [...identityRoutes(entry), { match: '/rpc/vitrin_yorumlari', body: entry.data === 'empty' ? [] : REVIEWS }];
  }
  const isHome = scene === 'scanOffline' || target.includes('"Tracker"') && (HOME_SCENES.has(scene) || entry.data === 'empty' || scene === '');
  if (!isHome) return identityRoutes(entry);
  const empty = entry.data === 'empty';
  return [
    ...identityRoutes(entry),
    { match: '/rest/v1/meal_consumptions', body: () => (empty ? [] : scene === 'scanOffline' ? meals(false, false).filter((m: any) => m.source === 'ai_scan') : meals(scene === 'longNames', scene === 'delivered')) },
    { match: '/rest/v1/body_measurements', body: [] },
    { match: '/rest/v1/orders', body: [] },
    // G15-S2 — Su halkası (water_daily, Final: 1,5 / 2,5 L).
    { match: '/rest/v1/water_daily', body: () => (empty ? [] : [{ ml: 1500 }]) },
  ];
}
