// G48-S1 md.1–5 — sepet hesaba özel + eatkcal konum kapısı (EkLocationGate) bileşen / depo testleri.
//  (a) A sepete ekler, çıkar, B girer → B boş; A tekrar girer → A'nın sepeti geri gelir (kupon + seçili adres kuralı)
//  (b) eski `kcal-cart` kaydı migrate'te temizlenir
//  (c) adresi olmayan hesap → kapı; adresi olan hesap → doğrudan ana sayfa (aynı cihazda sırayla)
//  (d) İzmir › hizmet ilçesi → adres ekleme (ilçe dolu); İzmir › hizmet dışı ilçe → Çok yakında
//  (e) İzmir dışı il / yabancı şehir → Çok yakında + iki düğme; form gönderimi doğru alanlarla (mock)
//  (f) vitrin sahnesinden sonra gerçek oturumda sepet boş
import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native-reanimated', () => {
  const m = require('react-native-reanimated/mock');
  const R = require('react');
  const useSharedValue = (init: unknown) => {
    const ref = R.useRef(null);
    if (!ref.current) ref.current = { value: init };
    return ref.current;
  };
  const withTiming = (v: unknown, _c?: unknown, cb?: (ok: boolean) => void) => {
    cb?.(true);
    return v;
  };
  const withDelay = (_d: number, v: unknown) => v;
  const runOnJS = (fn: (...a: unknown[]) => unknown) => fn;
  return { ...m, useSharedValue, withTiming, withDelay, runOnJS, default: { ...m.default, useSharedValue } };
});
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: { children: React.ReactNode }) => children };
});
jest.mock('expo-blur', () => ({ BlurView: () => null }));
jest.mock('../../../../core/flags', () => ({ __esModule: true, useFeature: () => false }));
const mockAuth: { user: { id: string } | null; session: { user: { id: string } } | null } = { user: null, session: null };
jest.mock('../../../../core/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../../../lib/analytics', () => ({ track: jest.fn() }));
const ZONES = [
  { city: 'İzmir', district: 'Bornova', is_active: true },
  { city: 'İzmir', district: 'Torbalı', is_active: false },
  { city: 'İzmir', district: 'Karşıyaka', is_active: true },
];
jest.mock('../../../../lib/delivery', () => ({
  fetchAllDeliveryZones: jest.fn(async () => ZONES),
  fetchGlobalDeliverySettings: jest.fn(async () => null),
}));
jest.mock('../../v2/model/addressGeocode', () => ({
  requestLocationPermission: jest.fn(async () => true),
  currentCoords: jest.fn(async () => ({ latitude: 38.46, longitude: 27.22 })),
  reverseGeocodeAdmin: jest.fn(async () => ({ isoCountryCode: 'TR', region: 'İzmir', subregion: 'Bornova', postalCode: '35040' })),
}));
// Supabase: adres sayısı + bekleme listesi ekleme yakalanır.
const mockDb: { addresses: Record<string, number>; addressError: boolean; inserts: Record<string, unknown>[]; sessionUser: string | null } = {
  addresses: {},
  addressError: false,
  inserts: [],
  sessionUser: null,
};
jest.mock('../../../../core/supabase', () => {
  const client = {
    from: (table: string) => {
      const st: { uid?: string } = {};
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.eq = (_c: string, v: string) => {
        st.uid = v;
        return q;
      };
      q.order = () => q;
      q.range = () => q;
      q.limit = async () => {
        if (table !== 'addresses') return { data: [], error: null };
        if (mockDb.addressError) return { data: null, error: { message: 'network' } };
        const n = mockDb.addresses[st.uid ?? ''] ?? 0;
        return { data: Array.from({ length: Math.min(n, 1) }, (_, i) => ({ id: `a${i}` })), error: null };
      };
      q.insert = async (row: Record<string, unknown>) => {
        mockDb.inserts.push({ table, ...row });
        return { error: null };
      };
      return q;
    },
    rpc: async () => ({ data: [], error: null }),
    auth: {
      getSession: async () => ({ data: { session: mockDb.sessionUser ? { user: { id: mockDb.sessionUser } } : null } }),
    },
  };
  return { getSupabaseClient: () => client, supabase: client };
});
const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), canGoBack: () => true, getParent: () => mockNav, setParams: jest.fn() };
let mockParams: Record<string, unknown> | undefined;
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const R = require('react');
  return {
    ...actual,
    useNavigation: () => mockNav,
    useRoute: () => ({ params: mockParams }),
    useFocusEffect: (cb: () => void) => R.useEffect(cb, []),
  };
});

import { I18nProvider } from '../../../../core/i18n';
import { ThemeProvider } from '../../../../core/design/ThemeProvider';
import { track } from '../../../../lib/analytics';
import { useCartStore } from '../../../../store/cartStore';
import { useAddressStore } from '../../../../store/addressStore';
import { applySessionUser, forgetSessionUser } from '../../../../store/sessionScope';
import { enterStoreSandbox, __resetStoreSandboxForTest } from '../../../../store/storeSandbox';
import { EkLocationGate } from '../EkLocationGate';
import { resolveEatGate, invalidateEatGateCache, markHasAddress } from '../eatGate';
import EkCityGateScreen from '../../v2/screens/EkCityGateScreen';
import type { Product, Address } from '../../../../types';

const ROOT = join(__dirname, '../../../../..');
const src = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const wrap = (el: React.ReactElement, scheme: 'light' | 'dark' = 'light', lang: 'tr' | 'en' = 'tr') => (
  <ThemeProvider forceScheme={scheme}>
    <I18nProvider forceLang={lang}>{el}</I18nProvider>
  </ThemeProvider>
);
const flush = async (n = 8) => {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};
const product = (id: number): Product => ({ id, name: `Ürün ${id}`, price: 100, brand: 'kcal', category: 'x' }) as unknown as Product;
const addr = (id: string): Address => ({ id, title: 'Ev', district: 'Bornova', city: 'İzmir' }) as unknown as Address;
const coupon = { code: 'X10', campaignId: '1', discountType: 'fixed' as const, discountValue: 10, discountAmount: 10, title: 'X' };
const trackMock = track as unknown as jest.Mock;

beforeEach(async () => {
  jest.clearAllMocks();
  __resetStoreSandboxForTest();
  await AsyncStorage.clear();
  mockDb.addresses = {};
  mockDb.addressError = false;
  mockDb.inserts = [];
  mockDb.sessionUser = null;
  mockAuth.user = null;
  mockAuth.session = null;
  mockParams = undefined;
  invalidateEatGateCache();
  useCartStore.setState({ items: [], appliedCoupon: null, ownerKey: 'anon', byOwner: {} });
  useAddressStore.setState({ selectedAddress: null, ownerKey: 'anon' });
});

// ─── (a) sepet + adres hesaba özel ─────────────────────────────────────────────
describe('(a) sepet hesaba özel', () => {
  test('A ekler (kuponla) → çıkar → B girer: B boş, adres yok; A tekrar girer: A\'nın sepeti ve kuponu geri gelir', async () => {
    await applySessionUser('A');
    useCartStore.getState().addItem(product(1), {}, 2);
    useCartStore.getState().setCoupon(coupon);
    useAddressStore.getState().setSelectedAddress(addr('adrA'));
    await applySessionUser(null); // çıkış
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useCartStore.getState().appliedCoupon).toBeNull();
    expect(useAddressStore.getState().selectedAddress).toBeNull();
    await applySessionUser('B');
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useAddressStore.getState().selectedAddress).toBeNull();
    // kalıcı kayıtta canlı sepet B'nin (boş); A'nınki yalnız bekleyen kutuda
    await flush();
    const saved = JSON.parse((await AsyncStorage.getItem('kcal-cart')) ?? '{}');
    expect(saved.version).toBe(6);
    expect(saved.state.ownerKey).toBe('B');
    expect(saved.state.items).toHaveLength(0);
    await applySessionUser(null);
    await applySessionUser('A');
    expect(useCartStore.getState().items.map((i) => [i.productId, i.quantity])).toEqual([['1', 2]]);
    expect(useCartStore.getState().appliedCoupon?.code).toBe('X10');
  });

  test('hesap değişimi (A → B, çıkış olayı yok) da A\'nın sepetini ve adresini gizler; hesap silinince A\'nınki cihazdan gider', async () => {
    await applySessionUser('A');
    useCartStore.getState().addItem(product(7), {}, 1);
    useAddressStore.getState().setSelectedAddress(addr('adrA'));
    await applySessionUser('B');
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useAddressStore.getState().selectedAddress).toBeNull();
    await applySessionUser('A');
    forgetSessionUser('A');
    expect(useCartStore.getState().items).toHaveLength(0);
    expect(useAddressStore.getState().selectedAddress).toBeNull();
  });

  test('oturumsuz sepet girişte boş hesaba taşınır; dolu hesapta atılır', async () => {
    await applySessionUser(null);
    useCartStore.getState().addItem(product(3), {}, 1);
    await applySessionUser('C');
    expect(useCartStore.getState().items.map((i) => i.productId)).toEqual(['3']);
    await applySessionUser(null);
    useCartStore.getState().addItem(product(4), {}, 1);
    await applySessionUser('C');
    expect(useCartStore.getState().items.map((i) => i.productId)).toEqual(['3']);
  });

  test('AuthContext: her oturum değişiminde applySessionUser, adres doldurma ondan sonra; hesap silmede forgetSessionUser', () => {
    const auth = src('src/core/AuthContext.tsx');
    expect(auth.match(/applySessionUser\(/g)?.length).toBeGreaterThanOrEqual(4);
    expect(auth).toMatch(/applySessionUser\(yeniKullaniciId \?\? null\)\.then\(\(\) => \{\s*if \(yeniKullaniciId && !useAddressStore\.getState\(\)\.selectedAddress\) \{\s*void hydrateSelectedAddress/);
    for (const f of ['src/screens/profile/SecurityScreen.tsx', 'src/modules/profil/ui/screens/SettingsSecurityScreen.tsx']) {
      expect(src(f)).toMatch(/if \(user\?\.id\) forgetSessionUser\(user\.id\);\s*\n\s*await signOut\(\);/);
    }
  });
});

// ─── (b) eski kayıt ──────────────────────────────────────────────────────────
test('(b) eski sahipsiz `kcal-cart` (v5) ve `kcal-selected-address` (v0) ilk açılışta temizlenir', async () => {
  await AsyncStorage.setItem('kcal-cart', JSON.stringify({ state: { items: [{ lineKey: 'k', productId: '9', name: 'Eski', quantity: 3, unitPrice: 10 }], appliedCoupon: coupon }, version: 5 }));
  await AsyncStorage.setItem('kcal-selected-address', JSON.stringify({ state: { selectedAddress: addr('eski') }, version: 0 }));
  await act(async () => {
    await useCartStore.persist.rehydrate();
    await useAddressStore.persist.rehydrate();
  });
  expect(useCartStore.getState().items).toHaveLength(0);
  expect(useCartStore.getState().appliedCoupon).toBeNull();
  expect(useCartStore.getState().ownerKey).toBe('anon');
  expect(useAddressStore.getState().selectedAddress).toBeNull();
});

// ─── (c) kapı kuralı ─────────────────────────────────────────────────────────
describe('(c) adres yoksa kapı', () => {
  test('aynı cihazda sırayla: adressiz hesap → kapı; adresli hesap → geçer; tekrar adressiz → kapı (cihaz işareti atlatmaz)', async () => {
    await AsyncStorage.setItem('eatkcal-city-gate-passed', '1');
    mockDb.addresses = { A: 0, B: 2 };
    expect(await resolveEatGate('A')).toBe(true);
    expect(await resolveEatGate('B')).toBe(false);
    expect(await resolveEatGate('A')).toBe(true);
    // A adres kaydeder → kapı kalkar
    markHasAddress('A');
    mockDb.addresses.A = 1;
    expect(await resolveEatGate('A')).toBe(false);
  });

  test('ağ yok: son bilinen değer; hiç bilinmiyorsa kapı. Oturumsuz: yalnız oturumsuz gezinme işareti', async () => {
    mockDb.addresses = { B: 1 };
    expect(await resolveEatGate('B')).toBe(false);
    mockDb.addressError = true;
    invalidateEatGateCache(); // bellek boş → cihaz önbelleği
    expect(await resolveEatGate('B')).toBe(false);
    expect(await resolveEatGate('Z')).toBe(true);
    expect(await resolveEatGate(null)).toBe(true);
    await AsyncStorage.setItem('eatkcal-city-gate-passed', '1');
    expect(await resolveEatGate(null)).toBe(false);
  });
});

// ─── (d) İzmir ilçe adımı ────────────────────────────────────────────────────
describe('(d) İzmir › ilçe', () => {
  test('Ülke → İl (İzmir) → İlçe listesi (delivery_zones, hizmet durumu) → hizmet ilçesi → onServed (ilçe dolu)', async () => {
    const onServed = jest.fn();
    const r = render(wrap(<EkLocationGate onServed={onServed} showTabSpace={false} />));
    await flush();
    expect(trackMock).toHaveBeenCalledWith('eatkcal_gate_view', { state: 'address' });
    expect(r.getByTestId('gate48-see').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(r.getByTestId('gate48-city'));
    fireEvent.press(r.getByTestId('gate48-opt-İzmir'));
    await flush();
    expect(r.getByTestId('gate48-see').props.accessibilityState).toMatchObject({ disabled: true }); // İzmir'de ilçe zorunlu
    fireEvent.press(r.getByTestId('gate48-district'));
    await flush();
    expect(r.getByTestId('gate48-opt-Bornova').props.accessibilityLabel).toBe('Bornova, Hizmet var');
    expect(r.getByTestId('gate48-opt-Torbalı').props.accessibilityLabel).toBe('Torbalı, Çok yakında');
    fireEvent.press(r.getByTestId('gate48-opt-Bornova'));
    await flush();
    await act(async () => {
      fireEvent.press(r.getByTestId('gate48-see'));
    });
    await flush();
    expect(onServed).toHaveBeenCalledWith(expect.objectContaining({ country: 'TR', city: 'İzmir', district: 'Bornova' }));
    expect(trackMock).toHaveBeenCalledWith('eatkcal_gate_select', { country: 'TR', city: 'İzmir', district: 'Bornova', served: true });
  });

  test('rota girişi (EkCityGate) + oturum: hizmet ilçesi → EkAddressAdd (ilçe dolu, kapı hedefi taşınır)', async () => {
    mockAuth.session = { user: { id: 'A' } };
    mockParams = { next: 'EkStore', brandKey: 'kcal' };
    const r = render(wrap(<EkCityGateScreen />));
    await flush();
    fireEvent.press(r.getByTestId('gate48-city'));
    fireEvent.press(r.getByTestId('gate48-opt-İzmir'));
    fireEvent.press(r.getByTestId('gate48-district'));
    await flush();
    fireEvent.press(r.getByTestId('gate48-opt-Karşıyaka'));
    await act(async () => {
      fireEvent.press(r.getByTestId('gate48-see'));
    });
    await flush();
    expect(mockNav.replace).toHaveBeenCalledWith('EkAddressAdd', { gateDistrict: 'Karşıyaka', afterGate: { next: 'EkStore', brandKey: 'kcal' } });
    // adres ekleme ekranı: ilçe kapıdan dolu, il İzmir (form sabiti), harita ilk konumu ilçeyi ezmez
    const add = src('src/modules/eatkcal/v2/screens/EkAddressAddScreen.tsx');
    expect(add).toMatch(/district: gateOpt\?\.value \?\? EMPTY_FORM\.district/);
    expect(add).toMatch(/const keep = lockDistrict\.current && !!prev\.district && m\.district !== prev\.district;/);
    expect(add).toMatch(/markHasAddress\(user\.id\);/);
  });

  test('rota girişi oturumsuz: hizmet ilçesi → oturumsuz gezinme işareti + hedef (mağaza)', async () => {
    mockParams = { next: 'EkStore', brandKey: 'kcal' };
    const r = render(wrap(<EkCityGateScreen />));
    await flush();
    fireEvent.press(r.getByTestId('gate48-city'));
    fireEvent.press(r.getByTestId('gate48-opt-İzmir'));
    fireEvent.press(r.getByTestId('gate48-district'));
    await flush();
    fireEvent.press(r.getByTestId('gate48-opt-Bornova'));
    await act(async () => {
      fireEvent.press(r.getByTestId('gate48-see'));
    });
    await flush();
    expect(await AsyncStorage.getItem('eatkcal-city-gate-passed')).toBe('1');
    expect(mockNav.replace).toHaveBeenCalledWith('EkStore', { brandKey: 'kcal' });
  });

  test('İzmir › hizmet dışı ilçe (Torbalı) → Çok yakında; hap "Torbalı, İzmir · Değiştir" → forma döner, seçim korunur', async () => {
    const onServed = jest.fn();
    const r = render(wrap(<EkLocationGate onServed={onServed} showTabSpace={false} initialSelection={{ country: 'TR', city: 'İzmir', district: 'Torbalı' }} />));
    await flush();
    await act(async () => {
      fireEvent.press(r.getByTestId('gate48-see'));
    });
    await flush();
    expect(onServed).not.toHaveBeenCalled();
    expect(r.getByTestId('ek-gate48-soon')).toBeTruthy();
    expect(r.getByTestId('gate48-where').props.children).toBe('Torbalı, İzmir');
    expect(trackMock).toHaveBeenCalledWith('eatkcal_gate_select', { country: 'TR', city: 'İzmir', district: 'Torbalı', served: false });
    expect(trackMock).toHaveBeenCalledWith('eatkcal_gate_view', { state: 'soon' });
    fireEvent.press(r.getByTestId('gate48-change'));
    await flush();
    expect(r.getByTestId('ek-gate48-address')).toBeTruthy();
    expect(r.getByTestId('gate48-district').props.accessibilityLabel).toBe('İlçe: Torbalı');
  });

  test('konum düğmesi: izin → ters geocode ile ülke/il/ilçe/posta kodu dolar; izin yoksa sessiz', async () => {
    const r = render(wrap(<EkLocationGate onServed={jest.fn()} showTabSpace={false} />));
    await flush();
    await act(async () => {
      fireEvent.press(r.getByTestId('gate48-locate'));
    });
    await flush();
    expect(r.getByTestId('gate48-city').props.accessibilityLabel).toBe('Şehir: İzmir');
    expect(r.getByTestId('gate48-district').props.accessibilityLabel).toBe('İlçe: Bornova');
    expect(r.getByTestId('gate48-postcode').props.value).toBe('35040');
    const geo = jest.requireMock('../../v2/model/addressGeocode') as { requestLocationPermission: jest.Mock; currentCoords: jest.Mock };
    geo.requestLocationPermission.mockResolvedValueOnce(false);
    const r2 = render(wrap(<EkLocationGate onServed={jest.fn()} showTabSpace={false} />));
    await flush();
    geo.currentCoords.mockClear();
    await act(async () => {
      fireEvent.press(r2.getByTestId('gate48-locate'));
    });
    await flush();
    expect(geo.currentCoords).not.toHaveBeenCalled();
    expect(r2.getByTestId('gate48-city').props.accessibilityLabel).toBe('Şehir: Seç');
  });
});

// ─── (e) İzmir dışı il / yabancı şehir + form ────────────────────────────────
describe('(e) Çok yakında + formlar', () => {
  test.each([
    [{ country: 'TR', city: 'Ankara', district: null }, 'Ankara'],
    [{ country: 'TR', city: 'İstanbul', district: 'Kadıköy' }, 'Kadıköy, İstanbul'],
    [{ country: 'DE', city: 'Berlin', district: null }, 'Berlin'],
  ])('%j → Çok yakında + "Restoranını ekle" + "Çevrendeki restoranları öner"', async (sel, where) => {
    const onServed = jest.fn();
    const r = render(wrap(<EkLocationGate onServed={onServed} showTabSpace={false} initialSelection={sel} />));
    await flush();
    await act(async () => {
      fireEvent.press(r.getByTestId('gate48-see'));
    });
    await flush();
    expect(onServed).not.toHaveBeenCalled();
    expect(r.getByTestId('gate48-where').props.children).toBe(where);
    expect(r.getByTestId('gate48-add').props.accessibilityLabel).toBe('Restoranını ekle');
    expect(r.getByTestId('gate48-suggest').props.accessibilityLabel).toBe('Çevrendeki restoranları öner');
  });

  test('"Çevrendeki restoranları öner" → form sheet (ilçe dolu) → gönderim eatkcal_waitlist_requests (district + user_id), olayda kişisel veri yok', async () => {
    mockDb.sessionUser = 'A';
    const r = render(
      wrap(<EkLocationGate onServed={jest.fn()} showTabSpace={false} initialState="soon" initialSelection={{ country: 'TR', city: 'İstanbul', district: 'Kadıköy' }} />),
    );
    await flush();
    fireEvent.press(r.getByTestId('gate48-suggest'));
    await flush();
    expect(r.getByTestId('ek-waitlist-district').props.value).toBe('Kadıköy');
    expect(r.getByTestId('ek-waitlist-city').props.value).toBe('İstanbul');
    fireEvent.changeText(r.getByTestId('ek-waitlist-restaurant_name'), 'Yeşil Tabak');
    fireEvent.changeText(r.getByTestId('ek-waitlist-email'), 'ben@ornek.com');
    await act(async () => {
      fireEvent.press(r.getByTestId('ek-waitlist-send'));
    });
    await flush(12);
    expect(mockDb.inserts).toHaveLength(1);
    expect(mockDb.inserts[0]).toMatchObject({
      table: 'eatkcal_waitlist_requests',
      kind: 'restaurant_suggest',
      country: 'TR',
      city: 'İstanbul',
      district: 'Kadıköy',
      restaurant_name: 'Yeşil Tabak',
      user_id: 'A',
    });
    expect(trackMock).toHaveBeenCalledWith('eatkcal_waitlist_submit', { kind: 'restaurant_suggest' });
    const sent = trackMock.mock.calls.filter((c) => c[0] === 'eatkcal_waitlist_submit');
    expect(JSON.stringify(sent)).not.toMatch(/ornek|Yeşil/);
  });

  test('"Restoranını ekle" → FinWaitlistAdd form sheet\'i', async () => {
    const r = render(wrap(<EkLocationGate onServed={jest.fn()} showTabSpace={false} initialState="soon" initialSelection={{ country: 'DE', city: 'Berlin' }} />));
    await flush();
    fireEvent.press(r.getByTestId('gate48-add'));
    await flush();
    expect(r.getByTestId('ek-waitlist-add')).toBeTruthy();
    expect(r.getByTestId('ek-waitlist-city').props.value).toBe('Berlin');
  });

  test('EN metinler (pano 03/04)', async () => {
    const r = render(wrap(<EkLocationGate onServed={jest.fn()} showTabSpace={false} initialState="soon" initialSelection={{ country: 'TR', city: 'İstanbul', district: 'Kadıköy' }} />, 'dark', 'en'));
    await flush();
    expect(r.getByText('COMING SOON')).toBeTruthy();
    expect(r.getByTestId('gate48-add').props.accessibilityLabel).toBe('Add your restaurant');
    expect(r.getByTestId('gate48-suggest').props.accessibilityLabel).toBe('Suggest restaurants near you');
  });
});

// ─── (f) vitrin ──────────────────────────────────────────────────────────────
test('(f) vitrin sahnesi gerçek kalıcı depoya yazmaz → yeniden yüklemede gerçek oturumun sepeti boş', async () => {
  await applySessionUser('A');
  await flush();
  const before = await AsyncStorage.getItem('kcal-cart');
  enterStoreSandbox([useCartStore, useAddressStore]);
  useCartStore.getState().addItem(product(11), {}, 1);
  useCartStore.getState().addItem(product(12), {}, 1);
  useAddressStore.getState().setSelectedAddress(addr('vitrin'));
  await flush();
  expect(await AsyncStorage.getItem('kcal-cart')).toBe(before);
  const real = JSON.parse((await AsyncStorage.getItem('kcal-cart')) ?? '{"state":{"items":[]}}');
  expect(real.state.items).toHaveLength(0);
  expect(await AsyncStorage.getItem('kcal-selected-address')).not.toMatch(/vitrin/);
  // vitrin hazırlığı depolara yazmadan ÖNCE bellek deposuna geçer; vitrin kodu üretimde yok
  const setup = src('src/dev/vitrinSetup.ts');
  const iSandbox = setup.indexOf('enterStoreSandbox([useCartStore, useAddressStore]);');
  expect(iSandbox).toBeGreaterThan(0);
  expect(iSandbox).toBeLessThan(setup.indexOf('cart.addItem?.('));
  expect(iSandbox).toBeLessThan(setup.indexOf('setSelectedAddress?.('));
  expect(src('App.tsx')).toMatch(/const VitrinGate: [^=]+= __DEV__\s*\?\s*require\('\.\/src\/dev\/VitrinGate'\)\.default/);
});
