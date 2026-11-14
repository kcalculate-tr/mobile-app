// G50-S1 md.1 — Ana sayfa sırası (TrackerScreen tam render): profilsiz = Plan kartı → İlk gün görevleri → Neler
// yapabilirsin (tarama rozeti) → Koç hazır soruları → Bugünün tarifleri → … → eatkcal; profilli = mevcut takip
// bölümü AYNEN üstte → İlk gün görevleri → Seri ve haftalık özet → Koç hazır soruları → Bugünün tarifleri → eatkcal.
// Profilsiz kullanıcıda seri kartı YOK. (Kurulum g49HomeProfile ile aynı; yeni bölümler test kimlikli taklit.)
import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Bayraklar: yeni kabuk + etkinlik açık (4 eylemin hepsi görünür). ─────────────
const mockFlags = new Set<string>(['yeni_kabuk', 'etkinlik']);
jest.mock('../../core/flags', () => ({ useFeature: (k: string) => mockFlags.has(k) }));
// Koç uygun (ağ yoklaması yok).
jest.mock('../../modules/coach/access', () => ({ ...jest.requireActual('../../modules/coach/access'), useCoachEnabled: () => true }));
// md.4 (eatkcal bölümü) bu karşılaştırmanın dışında: brif "profilli Ana sayfa değişmez (madde 4 hariç)".
jest.mock('../../modules/gun/home/HomeRegion', () => {
  const R = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return { HomeRegionSection: () => R.createElement(View, { testID: 'x-eatkcal' }), setHomeRegionProvider: () => {} };
});
// G50 bölümleri: sıra / koşul testi için test kimlikli taklit (iç davranış g50HomeSections testinde).
const mockSectionProps: Record<string, Record<string, unknown>> = {};
jest.mock('../../modules/gun/home/HomeExtras', () => {
  const R = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  const stub = (id: string) => (p: Record<string, unknown>) => {
    mockSectionProps[id] = p;
    return R.createElement(View, { testID: id });
  };
  return {
    HomeFirstDayTasks: stub('x-tasks'),
    HomeStreakWeek: stub('x-streak'),
    HomeCoachPrompts: stub('x-coach'),
    HomeTodayRecipes: stub('x-recipes'),
  };
});
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
import { useSubscriptionStore } from '../../lib/subscription/purchases';
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

function order(tree: ReturnType<typeof render>): string[] {
  const seen: string[] = [];
  tree.UNSAFE_root.findAll((n: { props: Record<string, unknown>; type: unknown }) => typeof n.type === 'string' && /^(x-|home-profile-gate$|home-quick-actions$)/.test(String(n.props?.testID ?? ''))).forEach(
    (n: { props: Record<string, unknown> }) => {
      const id = String(n.props.testID);
      if (!seen.includes(id)) seen.push(id);
    },
  );
  return seen;
}

test('profilsiz sıra: Plan → Görevler → Neler yapabilirsin → Koç → Tarifler → eatkcal; seri kartı YOK', async () => {
  setProfile('none');
  const tree = render(<TrackerScreen />);
  await flush();
  expect(order(tree)).toEqual(['home-profile-gate', 'x-tasks', 'home-quick-actions', 'x-coach', 'x-recipes', 'x-eatkcal']);
  expect(tree.queryByTestId('x-streak')).toBeNull();
  expect(mockSectionProps['x-tasks'].planDone).toBe(false);
});

test('profilli sıra: takip bölümü üstte (aynen) → Görevler → Seri → Koç → Tarifler → eatkcal', async () => {
  setProfile('has');
  const tree = render(<TrackerScreen />);
  await flush();
  expect(order(tree)).toEqual(['x-tasks', 'x-streak', 'x-coach', 'x-recipes', 'x-eatkcal']);
  // takip bölümü (bugünün öğün kaydı) yeni bölümlerden ÖNCE
  const seq = tree.UNSAFE_root.findAll(
    (n: { props: Record<string, unknown>; type: unknown }) => typeof n.type === 'string' && (n.props?.testID === 'x-tasks' || n.props?.children === 'Tavuklu Bowl'),
  );
  expect(seq[0].props.children).toBe('Tavuklu Bowl');
  expect(mockSectionProps['x-tasks'].planDone).toBe(true);
  // seri kartı gerçek veriden: 30 günlük kova + bugünün kaydı
  expect(mockSectionProps['x-streak'].todayCount).toBe(1);
  expect(Array.isArray(mockSectionProps['x-streak'].days)).toBe(true);
});

test('tarama rozeti: kota okunamazsa yok; Ücretsiz kademede "Bugün N ücretsiz tarama" (profilsiz Tara kartı)', async () => {
  setProfile('none');
  mockFlags.add('ai_tarama');
  try {
    useSubscriptionStore.setState({ ai: null });
    const a = render(<TrackerScreen />);
    await flush();
    expect(a.queryByTestId('home-quick-scan-badge')).toBeNull();
    a.unmount();
    useSubscriptionStore.setState({ ai: { kind: 'ai', tier: 'free', remaining: 2, limit: 2, unlimited: false, resetAt: '2026-11-06T21:00:00.000Z' } });
    const b = render(<TrackerScreen />);
    await flush();
    expect(b.getByText('Bugün 2 ücretsiz tarama')).toBeTruthy();
    b.unmount();
    useSubscriptionStore.setState({ ai: { kind: 'ai', tier: 'balance', remaining: 41, limit: 50, unlimited: false, resetAt: '2026-11-06T21:00:00.000Z' } });
    const c = render(<TrackerScreen />);
    await flush();
    expect(c.getByText('Bugün 41 tarama')).toBeTruthy();
  } finally {
    mockFlags.delete('ai_tarama');
    useSubscriptionStore.setState({ ai: null });
  }
});
