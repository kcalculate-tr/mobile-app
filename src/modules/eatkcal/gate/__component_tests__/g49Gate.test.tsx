// G49-S1 md.1 — konum kapısı alan hatası: İLÇE / POSTA KODU metin alanları seçicilerle aynı 44 pt kutu
// (flex YOK → dikey sütunda 0 yüksekliğe çökmez); şehir değişince posta kodu boşalır; konum düğmesi şehirle
// tutarsız posta kodu bırakmaz.
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
import { EkLocationGate } from '../EkLocationGate';
import type { GateSelection } from '../gateRule';
import { reverseGeocodeAdmin } from '../../v2/model/addressGeocode';

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
type Node = { props: Record<string, unknown> };
const flat = (n: Node) => StyleSheet.flatten(n.props.style as never) as Record<string, unknown>;
const mount = (sel: GateSelection, scheme: 'light' | 'dark' = 'light') =>
  render(wrap(<EkLocationGate onServed={jest.fn()} showTabSpace={false} initialSelection={sel} />, scheme));

/** Alan kutusu: 44 pt, zemin + kenar + iç boşluk, flex YOK (seçici alanla aynı kutu). */
function expectBox(input: Node, picker: Node) {
  const s = flat(input);
  const p = flat(picker);
  expect(s.height).toBe(44);
  expect(s.flex).toBeUndefined();
  expect(s.flexGrow).toBeUndefined();
  expect(s.backgroundColor).toBe(p.backgroundColor);
  expect(s.borderColor).toBe(p.borderColor);
  expect(s.borderWidth).toBe(p.borderWidth);
  expect(s.borderRadius).toBe(p.borderRadius);
  expect(s.paddingHorizontal ?? s.paddingLeft).toBe(p.paddingLeft);
  expect(p.height).toBe(44);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.user = null;
  mockAuth.session = null;
});

describe('G49 md.1 · alan yüksekliği', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme} · Türkiye › İstanbul (serbest ilçe + posta kodu): iki metin alanı da 44 pt kutu`, async () => {
      const r = mount({ country: 'TR', city: 'İstanbul', district: null }, scheme);
      await flush();
      const picker = r.getByTestId('gate48-city') as unknown as Node;
      expectBox(r.getByTestId('gate48-district') as unknown as Node, picker);
      expectBox(r.getByTestId('gate48-postcode') as unknown as Node, picker);
      // metin, etiketin üstüne binmesin: alan metni dikeyde ortalı, yatay iç boşluk 13
      expect(flat(r.getByTestId('gate48-postcode') as unknown as Node).textAlignVertical).toBe('center');
      // İzmir posta kodu yer tutucusu ("35040") İstanbul'da gösterilmez.
      expect(r.getByTestId('gate48-postcode').props.placeholder).toBe('');
    });
  }

  test('yabancı şehir (Berlin): ilçe + posta kodu 44 pt, posta kodu yer tutucusu yok', async () => {
    const r = mount({ country: 'DE', city: 'Berlin', district: null });
    await flush();
    const picker = r.getByTestId('gate48-city') as unknown as Node;
    expectBox(r.getByTestId('gate48-district') as unknown as Node, picker);
    expectBox(r.getByTestId('gate48-postcode') as unknown as Node, picker);
    expect(r.getByTestId('gate48-postcode').props.placeholder).toBe('');
  });

  test('İzmir: ilçe seçici (liste), posta kodu metin alanı yine 44 pt', async () => {
    const r = mount({ country: 'TR', city: 'İzmir', district: 'Bornova' });
    await flush();
    expect(r.getByTestId('gate48-district').props.accessibilityRole).toBe('button');
    expect(r.getByTestId('gate48-postcode').props.placeholder).toBe('35040');
    expectBox(r.getByTestId('gate48-postcode') as unknown as Node, r.getByTestId('gate48-city') as unknown as Node);
  });

  test('kaynak: metin alanı `fieldText` (flex: 1) kullanmıyor', () => {
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const s = readFileSync(join(__dirname, '../EkLocationGate.tsx'), 'utf8');
    expect(s).toMatch(/style=\{\[styles\.field, styles\.inputText, styles\.input,/);
    expect(s).not.toMatch(/styles\.field, styles\.fieldText, styles\.input/);
    expect(s).toMatch(/inputText: \{ color: GATE\.ink, fontFamily: fontFamily\.bodySemibold, fontSize: 16 \}/);
  });
});

describe('G49 md.1 · posta kodu', () => {
  test('şehir değişince (İzmir → İstanbul) ilçe ve posta kodu boşalır', async () => {
    const r = mount({ country: 'TR', city: 'İzmir', district: 'Bornova', postalCode: '35160' });
    await flush();
    expect(r.getByTestId('gate48-postcode').props.value).toBe('35160');
    fireEvent.press(r.getByTestId('gate48-city'));
    await flush();
    fireEvent.changeText(r.getByTestId('gate48-search'), 'İstanbul');
    await flush();
    fireEvent.press(r.getByTestId('gate48-opt-İstanbul'));
    await flush();
    expect(r.getByTestId('gate48-city').props.accessibilityLabel).toBe('Şehir: İstanbul');
    expect(r.getByTestId('gate48-postcode').props.value).toBe('');
    expect(r.getByTestId('gate48-district').props.value).toBe('');
  });

  test('elle yazılan posta kodu şehir değişince silinir; aynı şehirde yazı korunur', async () => {
    const r = mount({ country: 'TR', city: 'Ankara', district: null });
    await flush();
    fireEvent.changeText(r.getByTestId('gate48-postcode'), '06100');
    expect(r.getByTestId('gate48-postcode').props.value).toBe('06100');
    fireEvent.press(r.getByTestId('gate48-city'));
    await flush();
    fireEvent.changeText(r.getByTestId('gate48-search'), 'Bursa');
    await flush();
    fireEvent.press(r.getByTestId('gate48-opt-Bursa'));
    await flush();
    expect(r.getByTestId('gate48-postcode').props.value).toBe('');
  });

  test('konum düğmesi: il ile tutarsız posta kodu (İstanbul + 35160) yazılmaz; tutarlı olan (İzmir + 35040) yazılır', async () => {
    const geo = reverseGeocodeAdmin as unknown as jest.Mock;
    geo.mockResolvedValueOnce({ isoCountryCode: 'TR', region: 'İstanbul', subregion: 'Kadıköy', postalCode: '35160' });
    const r = mount({ country: 'TR', city: null, district: null });
    await flush();
    await act(async () => {
      fireEvent.press(r.getByTestId('gate48-locate'));
    });
    await flush();
    expect(r.getByTestId('gate48-city').props.accessibilityLabel).toBe('Şehir: İstanbul');
    expect(r.getByTestId('gate48-postcode').props.value).toBe('');
    geo.mockResolvedValueOnce({ isoCountryCode: 'TR', region: 'İzmir', subregion: 'Bornova', postalCode: '35040' });
    await act(async () => {
      fireEvent.press(r.getByTestId('gate48-locate'));
    });
    await flush();
    expect(r.getByTestId('gate48-city').props.accessibilityLabel).toBe('Şehir: İzmir');
    expect(r.getByTestId('gate48-postcode').props.value).toBe('35040');
  });
});
