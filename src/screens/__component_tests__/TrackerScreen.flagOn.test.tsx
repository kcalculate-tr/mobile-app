// G13-S1 — `yeni_kabuk` AÇIK Ana sayfa: öğün yuvaları (m.1), kutlama mount
// (m.2), çapraz sekme Logla vurgusu (m.3), kayıt menüsü, teslim otomatik log.
import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Bayraklar: yalnız yeni_kabuk açık. ───────────────────────────────────────
jest.mock('../../core/flags', () => ({ useFeature: (k: string) => k === 'yeni_kabuk' }));

jest.mock('@react-navigation/native', () => {
  const R = jest.requireActual('react');
  const nav = { navigate: () => {}, goBack: () => {} };
  const route = { params: { asTab: true } };
  return {
    useNavigation: () => nav,
    useRoute: () => route,
    useFocusEffect: (cb: () => void | (() => void)) => R.useEffect(cb, [cb]),
  };
});
jest.mock('../../core/AuthContext', () => {
  const auth = { user: { id: 'u1', email: 'test@example.com', user_metadata: {} } };
  return { useAuth: () => auth };
});
jest.mock('../../hooks/useRequireAuth', () => ({
  useRequireAuth: () => ({ session: {}, loading: false, isAuthenticated: true }),
}));
jest.mock('../../hooks/useNutritionSummary', () => {
  const v = {
    summary: { targetKcal: 2000, targetProtein: 120, targetCarb: 250, targetFat: 65 },
    refetch: () => {},
  };
  return { useNutritionSummary: () => v };
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
  requestPushPermissionOnly: jest.fn(() => Promise.resolve('granted')),
  registerForPushNotifications: jest.fn(() => Promise.resolve({ success: true })),
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
import { emitLogFlight, emitLogUndo } from '../../modules/shell/logEvents';
import { usePantryStore } from '../../store/pantryStore';
import { DURATION, TIMING } from '../../core/design';

const NOW = new Date('2026-11-06T16:00:00.000Z');
const BASE_ROWS: Row[] = [
  {
    id: 'c2', source: 'manual', source_ref: null, name: 'Sütlü kahve', meal_type: 'atistirma',
    calories: 40, protein: 1, carbs: 4, fat: 2, note: null, consumed_at: '2026-11-06T15:40:00.000Z',
  },
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
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
}

beforeEach(async () => {
  jest.setSystemTime(NOW);
  mockDb.today = [...BASE_ROWS];
  mockDb.earlier = [{ id: 'old' }]; // varsayılan: ilk öğün DEĞİL (kutlama yok)
  mockDb.orders = [];
  mockDb.calls = [];
  usePantryStore.setState({ items: [] });
  await AsyncStorage.clear();
});

test('yuvalar: 4 öğün, kaynak etiketi, boş yuvada "…’e logla"; Dolabındakiler YOK', async () => {
  const tree = render(<TrackerScreen />);
  await flush();
  expect(tree.queryByText('Dolabındakiler')).toBeNull();
  expect(tree.queryByText('Bugün Tüketilenler')).toBeNull();
  for (const n of ['Kahvaltı', 'Öğle', 'Akşam', 'Ara öğün']) expect(tree.getByText(n)).toBeTruthy();
  expect(tree.getByText('Tavuklu Bowl')).toBeTruthy();
  expect(tree.getByText('eatkcal (teslim edildi)')).toBeTruthy(); // pantry → eatkcal
  expect(tree.getByText('Elle')).toBeTruthy(); // manual
  expect(tree.getByText('Kahvaltı’ya logla')).toBeTruthy(); // boş yuva
  expect(tree.getByText('Akşam’a logla')).toBeTruthy();
  expect(tree.getByText('600 / 2.000 kcal')).toBeTruthy(); // gün toplamı
  // otomatik (eatkcal) kayıtta "Düzenle" görünür
  expect(tree.getByText('Düzenle')).toBeTruthy();
  // G15-S2 — eski tasarım bölümleri yeni kabukta YOK (Final karşılıkları üst blokta).
  expect(tree.queryByText('Makrolar')).toBeNull();
  expect(tree.queryByText('Su Takibi')).toBeNull();
  expect(tree.queryByText('Kalori Ekle')).toBeNull();
  expect(tree.queryByText('Detay için tıkla →')).toBeNull();
  // Su halkası: su_takibi kapalıyken cihaz içi bardak sayacı (8 × 250 ml) Final halka diliyle.
  expect(tree.getByText('Su')).toBeTruthy();
  // G18-S2 (FinHomeR3 Tur 26 hero): Su satırı tek etiket "0 / 2 L" + 4 pt çubuk.
  expect(tree.getByText('0 / 2 L')).toBeTruthy();
});

test('logFlight → yeni kayıt bir kez vurgulanır (nokta → satır → halka); logUndo geri alır', async () => {
  const tree = render(<TrackerScreen />);
  await flush();
  mockDb.today = [
    {
      id: 'c3', source: 'kesfet', source_ref: 'k1', name: 'Fırın tavuk', meal_type: 'aksam',
      calories: 480, protein: 30, carbs: 40, fat: 12, note: null, consumed_at: '2026-11-06T15:59:00.000Z',
    },
    ...BASE_ROWS,
  ];
  await act(async () => {
    emitLogFlight({ x: 0, y: 0, w: 0, h: 0, mealLabel: 'Akşam' });
  });
  await flush();
  expect(tree.getByText('Fırın tavuk')).toBeTruthy();
  expect(tree.getByText('Keşfet')).toBeTruthy();
  // 'dot' evresi: lime nokta; halka henüz yeni kaydı saymaz (600 kcal)
  expect(tree.getByTestId('home-dot-c3')).toBeTruthy();
  expect(tree.getByLabelText('600 / 2000 kcal')).toBeTruthy(); // G14-S1: Enerji halkası etiketi
  // 'row' evresi: satır yanar, saat "şimdi"
  await advance(TIMING.logTrail);
  expect(tree.queryByTestId('home-dot-c3')).toBeNull();
  expect(tree.getByText('şimdi')).toBeTruthy();
  // 'ring' evresi: halka yeni kaydı sayar
  await advance(DURATION.base);
  expect(tree.getByLabelText('1080 / 2000 kcal')).toBeTruthy();
  // Geri al → vurgu kalkar, kayıt listeden düşer
  mockDb.today = [...BASE_ROWS];
  await act(async () => {
    emitLogUndo({ id: 'c3' });
  });
  await flush();
  expect(tree.queryByText('şimdi')).toBeNull();
  expect(tree.queryByText('Fırın tavuk')).toBeNull();
});

test('aynı kayıt için ikinci logFlight tekrar vurgulamaz ("bir kez")', async () => {
  const tree = render(<TrackerScreen />);
  await flush();
  mockDb.today = [
    {
      id: 'c4', source: 'ai_scan', source_ref: null, name: 'Menemen', meal_type: 'breakfast',
      calories: 320, protein: 18, carbs: 10, fat: 22, note: null, consumed_at: '2026-11-06T15:58:00.000Z',
    },
    ...BASE_ROWS,
  ];
  await act(async () => {
    emitLogFlight({ id: 'c4', x: 0, y: 0, w: 0, h: 0 });
  });
  await flush();
  expect(tree.getByTestId('home-dot-c4')).toBeTruthy();
  expect(tree.getByText('Tara')).toBeTruthy(); // ai_scan → Tara etiketi
  await advance(TIMING.logTrail + DURATION.base + TIMING.dailyRing);
  expect(tree.queryByText('şimdi')).toBeNull();
  await act(async () => {
    emitLogFlight({ id: 'c4', x: 0, y: 0, w: 0, h: 0 });
  });
  await flush();
  expect(tree.queryByTestId('home-dot-c4')).toBeNull();
});

test('kayıt menüsü: uzun bas → Kaldır → meal_consumptions satırı silinir', async () => {
  const tree = render(<TrackerScreen />);
  await flush();
  fireEvent(tree.getByLabelText(/Sütlü kahve, Elle/), 'longPress');
  fireEvent.press(tree.getByLabelText('Kaldır'));
  await flush();
  const del = mockDb.calls.find((c) => c.table === 'meal_consumptions' && c.op === 'delete');
  expect(del).toBeTruthy();
  expect(del!.filters.eq).toEqual(expect.arrayContaining([['id', 'c2']]));
  expect(tree.queryByText('Sütlü kahve')).toBeNull();
});

test('teslim edilen sipariş otomatik loglanır (source=pantry, consumed_at=teslim)', async () => {
  mockDb.today = [];
  usePantryStore.setState({
    items: [
      {
        id: 'p9', productId: 'pr9', orderItemId: 'oi9', name: 'Izgara Somon Bowl',
        calories: 520, protein: 40, carbs: 45, fat: 16, quantity: 1, addedAt: NOW.toISOString(),
      },
    ],
  });
  mockDb.orders = [{ id: 'o9', delivered_at: '2026-11-06T15:30:00.000Z', order_items: [{ id: 'oi9' }] }];
  const tree = render(<TrackerScreen />);
  await flush();
  await flush();
  const up = mockDb.calls.find((c) => c.table === 'meal_consumptions' && c.op === 'upsert');
  expect(up).toBeTruthy();
  expect(up!.payload).toEqual(
    expect.objectContaining({ source: 'pantry', source_ref: 'p9-0', consumed_at: '2026-11-06T15:30:00.000Z' }),
  );
  expect(tree.getByText('Izgara Somon Bowl')).toBeTruthy();
  // Yeniden mount → aynı kopya ikinci kez loglanmaz (kalıcı küme).
  tree.unmount();
  mockDb.calls = [];
  render(<TrackerScreen />);
  await flush();
  await flush();
  expect(mockDb.calls.filter((c) => c.op === 'upsert')).toHaveLength(0);
});

test('ilk öğün: gerçek sinyalle kutlama bir kez + ardından bildirim izni sheet’i', async () => {
  mockDb.earlier = []; // bugünden eski kayıt yok → ilk öğün
  const tree = render(<TrackerScreen />);
  await flush();
  await advance(TIMING.logTrail + DURATION.base + TIMING.dailyRing);
  expect(tree.getByText('İlk öğün eklendi')).toBeTruthy();
  fireEvent.press(tree.getByLabelText('Devam et'));
  await flush();
  await flush();
  expect(tree.queryByText('İlk öğün eklendi')).toBeNull();
  expect(tree.getByText('Serini korumak için akşam 19:30’da hatırlatayım mı?')).toBeTruthy();
  const shown = JSON.parse((await AsyncStorage.getItem('@kcal_celebrate_shown')) ?? '{}');
  expect(shown.first).toBe(true);
  // Yeniden mount → ömür boyu bir kez: tekrar gösterilmez.
  tree.unmount();
  const again = render(<TrackerScreen />);
  await flush();
  await advance(TIMING.logTrail + DURATION.base + TIMING.dailyRing);
  expect(again.queryByText('İlk öğün eklendi')).toBeNull();
});

test('ilk öğün değil + seri yok → kutlama yok', async () => {
  const tree = render(<TrackerScreen />);
  await flush();
  await advance(TIMING.logTrail + DURATION.base + TIMING.dailyRing);
  expect(tree.queryByText('İlk öğün eklendi')).toBeNull();
  expect(tree.queryByText('3 günlük seri')).toBeNull();
});
