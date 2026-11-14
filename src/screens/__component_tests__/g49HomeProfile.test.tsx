// G49-S1 — Ana sayfa (yeni kabuk): profilli kullanıcının Ana sayfası DEĞİŞMEDİ (anlık görüntü G48 kodunda
// üretildi: `git archive 8ab1e8b` kopyasında bu dosya çalıştırıldı, .snap buraya taşındı); profilsiz Ana sayfada
// yeni plan kartı + "Neler yapabilirsin" 4 eylem; eylemler profil kapısından geçer.
import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Bayraklar: yeni kabuk + etkinlik açık (4 eylemin hepsi görünür). ─────────────
jest.mock('../../core/flags', () => ({ useFeature: (k: string) => k === 'yeni_kabuk' || k === 'etkinlik' }));
// Koç uygun (ağ yoklaması yok).
jest.mock('../../modules/coach/access', () => ({ ...jest.requireActual('../../modules/coach/access'), useCoachEnabled: () => true }));
// md.4 (eatkcal bölümü) bu karşılaştırmanın dışında: brif "profilli Ana sayfa değişmez (madde 4 hariç)".
jest.mock('../../modules/gun/home/HomeRegion', () => ({ HomeRegionSection: () => null, setHomeRegionProvider: () => {} }));
// G19-S2: çevrimdışı kuyruk NetInfo dinler — testte paketin resmî sahtesi.
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));
// Test renderer measureInWindow çağırmaz → popover çapası sabit (home.test ile aynı).
jest.mock('../../modules/gun/home/MealMenuPopover', () => {
  const actual = jest.requireActual('../../modules/gun/home/MealMenuPopover');
  return {
    ...actual,
    useAnchorMeasure: () => ({ ref: { current: null }, measure: async () => ({ x: 58, y: 200, width: 190, height: 44 }) }),
  };
});

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => {
  const R = jest.requireActual('react');
  const nav = { navigate: (...a: unknown[]) => mockNavigate(...a), goBack: () => {}, setParams: () => {} };
  const route = { params: { asTab: true } };
  return {
    useNavigation: () => nav,
    useRoute: () => route,
    useFocusEffect: (cb: () => void | (() => void)) => R.useEffect(cb, [cb]),
  };
});
// G30-S1 md.3: değiştirilebilir — token yenilemesi AYNI kimlikle YENİ user nesnesi verir.
const mockAuthState: { user: { id: string; email: string; user_metadata: Record<string, unknown> } } = {
  user: { id: 'u1', email: 'test@example.com', user_metadata: {} },
};
jest.mock('../../core/AuthContext', () => ({ useAuth: () => mockAuthState }));
jest.mock('../../hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ session: {}, loading: false, isAuthenticated: true }),
}));
// G19-S2: hedef testte değiştirilebilir (hedef yok → "Hedef belirlenmedi").
const DEFAULT_SUMMARY = { targetKcal: 2000, targetProtein: 120, targetCarb: 250, targetFat: 65 };
const mockSummary: { value: Record<string, number> | null } = { value: DEFAULT_SUMMARY };
jest.mock('../../hooks/useNutritionSummary', () => {
  const refetch = () => {};
  return { useNutritionSummary: () => ({ summary: mockSummary.value, refetch }) };
});
jest.mock('../../lib/products', () => ({ fetchProductImagesByName: () => Promise.resolve({}) }));
jest.mock('expo-print', () => ({ printToFileAsync: () => Promise.resolve({ uri: '' }) }));
jest.mock('expo-sharing', () => ({ shareAsync: () => Promise.resolve() }));
jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('react-native-safe-area-context', () => {
  const R = jest.requireActual('react');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    useSafeAreaInsets: () => insets,
    SafeAreaView: ({ children }: { children?: React.ReactNode }) => R.createElement(R.Fragment, null, children),
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => R.createElement(R.Fragment, null, children),
  };
});
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => Promise.resolve({ status: 'undetermined', canAskAgain: true }),
  requestPermissionsAsync: () => Promise.resolve({ status: 'granted' }),
}));
jest.mock('../../core/notifications', () => ({
  registerForPushNotifications: jest.fn(() => Promise.resolve({ success: true })),
}));
// G26-S1: bildirim izni tek fonksiyon (core/push/pushPermission).
jest.mock('../../core/push/pushPermission', () => ({
  canOfferPush: jest.fn(() => Promise.resolve(true)),
  requestPushPermission: jest.fn(() => Promise.resolve('granted')),
  pushGranted: jest.fn(() => Promise.resolve(false)),
}));

// ── Supabase: test başına ayarlanan küçük bellek içi "db" + çağrı kaydı. ─────
type Row = Record<string, unknown>;
const mockDb: { today: Row[]; earlier: Row[]; orders: Row[]; calls: { table: string; op: string; payload: unknown; filters: Record<string, unknown[][]> }[] } = {
  today: [],
  earlier: [],
  orders: [],
  calls: [],
};
jest.mock('../../core/supabase', () => {
  const zincir = (table: string) => {
    const st = { table, cols: '', op: 'select', payload: null as unknown, filters: {} as Record<string, unknown[][]> };
    const q: Record<string, unknown> = {};
    for (const m of ['eq', 'neq', 'in', 'is', 'or', 'not', 'gte', 'gt', 'lt', 'lte', 'order', 'limit', 'range']) {
      q[m] = (...a: unknown[]) => {
        (st.filters[m] = st.filters[m] ?? []).push(a);
        return q;
      };
    }
    q.select = (c: string) => {
      st.cols = c ?? '';
      return q;
    };
    for (const op of ['insert', 'update', 'upsert', 'delete']) {
      q[op] = (p: unknown) => {
        st.op = op;
        st.payload = p;
        mockDb.calls.push(st);
        return q;
      };
    }
    const result = () => {
      if (st.op === 'upsert') {
        const p = st.payload as Row;
        return { data: { ...p, id: `new-${String(p.source_ref)}` }, error: null };
      }
      if (st.op !== 'select') return { data: null, error: null };
      if (table === 'meal_consumptions') {
        if (st.cols === 'id') return { data: mockDb.earlier, error: null };
        return { data: mockDb.today, error: null };
      }
      if (table === 'orders' && st.cols.startsWith('id,delivered_at')) return { data: mockDb.orders, error: null };
      return { data: [], error: null };
    };
    q.maybeSingle = () => Promise.resolve(result());
    q.single = () => Promise.resolve(result());
    q.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result()).then(res, rej);
    return q;
  };
  const client = {
    from: zincir,
    rpc: () => Promise.resolve({ data: null, error: null }),
    auth: { getSession: () => Promise.resolve({ data: { session: null } }) },
  };
  return { supabase: client, getSupabaseClient: () => client };
});

import TrackerScreen from '../TrackerScreen';
import { usePantryStore } from '../../store/pantryStore';
import { useProfileGateStore, __devForceProfileStatus } from '../../modules/kayit/profileGate';

const NOW = new Date('2026-11-06T16:00:00.000Z');
const BASE_ROWS: Row[] = [
  {
    id: 'c1', source: 'pantry', source_ref: 'p1-0', name: 'Tavuklu Bowl', meal_type: 'ogle',
    calories: 560, protein: 42, carbs: 55, fat: 18, note: null, consumed_at: '2026-11-06T10:05:00.000Z',
  },
];

async function flush() {
  await act(async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve();
  });
}

function setProfile(status: 'has' | 'none') {
  __devForceProfileStatus(status);
  useProfileGateStore.setState({ flag: true, kisiselPlan: true, session: true, status, userId: 'u1' });
}

beforeEach(async () => {
  jest.setSystemTime(NOW);
  mockDb.today = [...BASE_ROWS];
  mockDb.earlier = [{ id: 'old' }];
  mockDb.orders = [];
  mockDb.calls = [];
  mockNavigate.mockClear();
  usePantryStore.setState({ items: [] });
  mockSummary.value = DEFAULT_SUMMARY;
  mockAuthState.user = { id: 'u1', email: 'test@example.com', user_metadata: {} };
  await AsyncStorage.clear();
});
afterAll(() => __devForceProfileStatus(null));

test('profilli Ana sayfa anlık görüntüsü (G48 ile aynı)', async () => {
  setProfile('has');
  const tree = render(<TrackerScreen />);
  await flush();
  expect(tree.queryByTestId('home-profile-gate')).toBeNull();
  expect(tree.queryByTestId('home-quick-actions')).toBeNull();
  expect(tree.toJSON()).toMatchSnapshot();
});

test('profilsiz Ana sayfa: yeni kart + hemen altında 4 eylem; takip bölümü yok', async () => {
  setProfile('none');
  const tree = render(<TrackerScreen />);
  await flush();
  expect(tree.getByTestId('home-profile-gate')).toBeTruthy();
  expect(tree.getByText('Kalorilerini ve sağlığını takip et')).toBeTruthy();
  expect(tree.getByTestId('home-gate-sample')).toBeTruthy();
  expect(tree.getByTestId('home-quick-actions')).toBeTruthy();
  for (const a of ['scan', 'activity', 'share', 'coach']) expect(tree.getByTestId(`home-quick-${a}`)).toBeTruthy();
  // Sıra: kart → eylemler (kartın hemen altında).
  const ids = tree.UNSAFE_root.findAll((n: { props: Record<string, unknown>; type: unknown }) => ['home-profile-gate', 'home-quick-actions'].includes(String(n.props?.testID)) && typeof n.type !== 'string').map((n: { props: Record<string, unknown> }) => n.props.testID);
  expect([...new Set(ids)]).toEqual(['home-profile-gate', 'home-quick-actions']);
  // Takip bölümü (öğün yuvaları, halka) çizilmez.
  expect(tree.queryByText('Kahvaltı’ya logla')).toBeNull();
  expect(tree.queryByText('Tavuklu Bowl')).toBeNull();
});

test('profilsiz: Tara · Etkinlik · Koç → kayıt akışı (dönüş = dokunulan eylem); Paylaş → Composer değil Keşfet/giriş kuralı', async () => {
  setProfile('none');
  const tree = render(<TrackerScreen />);
  await flush();
  fireEvent.press(tree.getByTestId('home-quick-scan'));
  expect(mockNavigate).toHaveBeenLastCalledWith('Kayit', { entry: 'gate', returnTo: { name: 'Tabs', params: { screen: 'Tracker', params: { finOpenManual: expect.any(String) } } } });
  fireEvent.press(tree.getByTestId('home-quick-activity'));
  expect(mockNavigate).toHaveBeenLastCalledWith('Kayit', { entry: 'gate', returnTo: { name: 'Tabs', params: { screen: 'Tracker', params: { finAddActivity: true } } } });
  fireEvent.press(tree.getByTestId('home-quick-coach'));
  expect(mockNavigate).toHaveBeenLastCalledWith('Kayit', { entry: 'gate', returnTo: { name: 'CoachIntro', params: { from: 'home', prefill: 'Akşam ne yesem?' } } });
  fireEvent.press(tree.getByTestId('home-profile-gate-start'));
  expect(mockNavigate).toHaveBeenLastCalledWith('Kayit', { entry: 'gate', returnTo: null });
  // Paylaş profil kapısına takılmaz: oturum var + kesfet_paylasim kapalı → Keşfet sekmesi.
  fireEvent.press(tree.getByTestId('home-quick-share'));
  expect(mockNavigate).toHaveBeenLastCalledWith('Tabs', { screen: 'KesfetTab' });
});
