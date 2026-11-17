// G60-S1 md.4 — eatkcal konum kapısı: yabancı ülkede şehir/eyalet listesi.
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';

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
// G60: RPC yanıtları teste göre değişir (top_cities / search_cities).
type RpcRes = { data: unknown; error: unknown };
const mockRpcLog: Array<[string, Record<string, unknown>]> = [];
let mockTop: (args: Record<string, unknown>) => RpcRes = () => ({ data: [], error: null });
let mockSearch: (args: Record<string, unknown>) => RpcRes = () => ({ data: [], error: null });
function mockRpc(fn: string, args: Record<string, unknown>): RpcRes {
  mockRpcLog.push([fn, args]);
  if (fn === 'top_cities') return mockTop(args);
  if (fn === 'search_cities') return mockSearch(args);
  return { data: [], error: null };
}
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
    rpc: async (fn: string, args: Record<string, unknown>) => mockRpc(fn, args),
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
import { EkLocationGate } from '../EkLocationGate';
import type { GateSelection } from '../gateRule';
import { __clearTopCitiesCache } from '../../v2/ui/gate/useTopCities';

// G60-S1 md.4 — yabancı ülkede şehir seçici: arama boşken büyük şehirler (eyalet alt satırı), veri yok →
// serbest yazım ("Şehrini yaz" + yazılanla devam satırı hemen), hata → "Şehirler yüklenemedi" + Tekrar dene.
const wrap = (el: React.ReactElement, lang: 'tr' | 'en' = 'tr') => (
  <ThemeProvider forceScheme="light">
    <I18nProvider forceLang={lang}>{el}</I18nProvider>
  </ThemeProvider>
);
const flush = async (n = 10) => {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};
const city = (id: number, name: string, cc: string, admin1: string, pop: number) => ({
  geonameid: id, name, ascii_name: name, country_iso2: cc, population: pop, lat: 0, lng: 0, admin1,
});
const DE = [
  city(1, 'Berlin', 'DE', 'Land Berlin', 3_400_000),
  city(2, 'Hamburg', 'DE', 'Freie und Hansestadt Hamburg', 1_700_000),
  city(3, 'München', 'DE', 'Bavaria', 1_200_000),
];
async function openCity(sel: GateSelection, lang: 'tr' | 'en' = 'tr') {
  const r = render(wrap(<EkLocationGate onServed={jest.fn()} showTabSpace={false} initialSelection={sel} />, lang));
  await flush();
  fireEvent.press(r.getByTestId('gate48-city'));
  await flush();
  return r;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  mockRpcLog.length = 0;
  __clearTopCitiesCache();
  mockTop = () => ({ data: [], error: null });
  mockSearch = () => ({ data: [], error: null });
});

describe('G60 — yabancı ülke şehir listesi', () => {
  it.each(['tr', 'en'] as const)('TR dışı ülke + boş arama → en kalabalık şehirler listelenir, eyalet alt satırı (%s)', async (lang) => {
    mockTop = () => ({ data: DE, error: null });
    const r = await openCity({ country: 'DE', city: null, district: null }, lang);
    expect(mockRpcLog.find(([fn]) => fn === 'top_cities')?.[1]).toEqual({ p_country: 'DE', p_limit: 30 });
    expect(r.getByTestId('gate48-opt-Berlin')).toBeTruthy();
    expect(r.getByTestId('gate48-opt-München')).toBeTruthy();
    expect(r.getByText('Bavaria')).toBeTruthy();
    expect(r.getByTestId('gate48-list-header').props.children).toBe(lang === 'tr' ? 'Büyük şehirler' : 'Major cities');
    expect(r.queryByText(lang === 'tr' ? 'Sonuç yok' : 'No results')).toBeNull();
    expect(r.getByTestId('gate48-opt-München').props.accessibilityLabel).toBe('München, Bavaria');
    // 1 harf: yerel süzme (sunucuya search_cities gitmez)
    fireEvent.changeText(r.getByTestId('gate48-search'), 'm');
    await flush();
    expect(r.queryByTestId('gate48-opt-Berlin')).toBeNull();
    expect(r.getByTestId('gate48-opt-München')).toBeTruthy();
    expect(mockRpcLog.some(([fn]) => fn === 'search_cities')).toBe(false);
  });

  it('2+ harf → search_cities sonucu; büyük şehir listesi yerine arama', async () => {
    mockTop = () => ({ data: DE, error: null });
    mockSearch = () => ({ data: [city(9, 'Hannover', 'DE', 'Lower Saxony', 500_000)], error: null });
    const r = await openCity({ country: 'DE', city: null, district: null });
    fireEvent.changeText(r.getByTestId('gate48-search'), 'Han');
    await act(async () => {
      await new Promise((res) => setTimeout(res, 350));
    });
    await flush();
    expect(r.getByTestId('gate48-opt-Hannover')).toBeTruthy();
    expect(r.queryByTestId('gate48-opt-Berlin')).toBeNull();
  });

  it.each(['tr', 'en'] as const)('ülkenin verisi yok → serbest yazım: "Şehrini yaz", yazılanı kullan satırı hemen (%s)', async (lang) => {
    mockTop = () => ({ data: [], error: null });
    const r = await openCity({ country: 'JP', city: null, district: null }, lang);
    expect(r.getByTestId('gate48-search').props.placeholder).toBe(lang === 'tr' ? 'Şehrini yaz' : 'Type your city');
    expect(String(r.getByTestId('gate48-list-header').props.children)).toContain(lang === 'tr' ? 'şehir listesi henüz yok' : 'don’t have a city list');
    fireEvent.changeText(r.getByTestId('gate48-search'), 'Osaka');
    await flush(2);
    // Arama beklenmez: yazılanla devam satırı hemen görünür, search_cities hiç çağrılmaz.
    expect(r.getByTestId('gate48-opt-Osaka')).toBeTruthy();
    expect(mockRpcLog.some(([fn]) => fn === 'search_cities')).toBe(false);
    expect(r.queryByText(lang === 'tr' ? 'Sonuç yok' : 'No results')).toBeNull();
  });

  it('top_cities canlıda henüz yok (PGRST202) → serbest yazım (hata değil)', async () => {
    mockTop = () => ({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.top_cities' } });
    const r = await openCity({ country: 'DE', city: null, district: null });
    expect(r.getByTestId('gate48-search').props.placeholder).toBe('Şehrini yaz');
    expect(r.queryByTestId('gate48-cities-retry')).toBeNull();
  });

  it.each(['tr', 'en'] as const)('hata → "Şehirler yüklenemedi" + Tekrar dene (boş liste değil); tekrar deneyince liste (%s)', async (lang) => {
    let fail = true;
    mockTop = () => (fail ? { data: null, error: { code: '500', message: 'network' } } : { data: DE, error: null });
    const r = await openCity({ country: 'DE', city: null, district: null }, lang);
    const retry = r.getByTestId('gate48-cities-retry');
    expect(r.getByText(lang === 'tr' ? 'Şehirler yüklenemedi.' : 'Couldn’t load cities.')).toBeTruthy();
    expect(r.getByText(lang === 'tr' ? 'Tekrar dene' : 'Try again')).toBeTruthy();
    expect(retry.props.accessibilityRole).toBe('button');
    fail = false;
    fireEvent.press(retry);
    await flush();
    expect(r.queryByTestId('gate48-cities-retry')).toBeNull();
    expect(r.getByTestId('gate48-opt-Berlin')).toBeTruthy();
  });

  it('arama hatası da tekrar dene gösterir; yazılanla devam satırı yine var', async () => {
    mockTop = () => ({ data: DE, error: null });
    mockSearch = () => ({ data: null, error: { code: '500', message: 'network' } });
    const r = await openCity({ country: 'DE', city: null, district: null });
    fireEvent.changeText(r.getByTestId('gate48-search'), 'Rostock');
    await act(async () => {
      await new Promise((res) => setTimeout(res, 350));
    });
    await flush();
    expect(r.getByTestId('gate48-cities-retry')).toBeTruthy();
    expect(r.getByTestId('gate48-opt-Rostock')).toBeTruthy();
  });

  it('Türkiye: il listesi aynen (top_cities çağrılmaz)', async () => {
    const r = await openCity({ country: 'TR', city: null, district: null });
    expect(r.getByTestId('gate48-opt-İzmir')).toBeTruthy();
    expect(mockRpcLog.some(([fn]) => fn === 'top_cities')).toBe(false);
  });

  it('yabancı şehir seçilince mevcut "Çok yakında" akışı aynen', async () => {
    mockTop = () => ({ data: DE, error: null });
    const r = await openCity({ country: 'DE', city: null, district: null });
    fireEvent.press(r.getByTestId('gate48-opt-Hamburg'));
    await flush();
    fireEvent.press(r.getByTestId('gate48-see'));
    await flush(20);
    expect(r.getByTestId('gate48-soon-title')).toBeTruthy();
  });
});
