// G13-S1 — Bayrak KAPALI Tracker = bugünkü (1.0.7) Tracker kanıtı.
//
// Snapshot `night12/release` tabanında (G13-S1 değişikliklerinden ÖNCE) üretildi
// ve ilk commit'le kilitlendi. Sonraki tüm değişiklikler bu snapshot'ı
// DEĞİŞTİRMEDEN geçmek zorunda: `yeni_kabuk` kapalıyken render ağacı bayt bayt
// aynı. (Snapshot güncellemesi `-u` ile YAPILMAZ; fark = regresyon.)
import React from 'react';
import { render, act } from '@testing-library/react-native';

// ── Bayraklar: hepsi kapalı (registry varsayılanı). ──────────────────────────
jest.mock('../../core/flags', () => ({ useFeature: () => false }));

// ── Gezinme ─────────────────────────────────────────────────────────────────
jest.mock('@react-navigation/native', () => {
  const R = jest.requireActual('react');
  const nav = { navigate: () => {}, goBack: () => {} };
  const route = { params: undefined };
  return {
    useNavigation: () => nav,
    useRoute: () => route,
    useFocusEffect: (cb: () => void | (() => void)) => R.useEffect(cb, [cb]),
  };
});

// ── Oturum ──────────────────────────────────────────────────────────────────
jest.mock('../../core/AuthContext', () => {
  // Kimlik SABİT olmalı: her render'da yeni nesne → fetchData bağımlılığı döner.
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
jest.mock('../../lib/products', () => ({
  fetchProductImagesByName: () => Promise.resolve({}),
}));
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

// ── Supabase: bugünün iki kaydı (manuel + dolap), diğer sorgular boş. ───────
const TODAY_ROWS = [
  {
    id: 'c2', source: 'manual', source_ref: null, name: 'Sütlü kahve', meal_type: 'atistirma',
    calories: 40, protein: 1, carbs: 4, fat: 2, note: null, consumed_at: '2026-11-06T15:40:00.000Z',
  },
  {
    id: 'c1', source: 'pantry', source_ref: 'p1-0', name: 'Tavuklu Bowl', meal_type: null,
    calories: 560, protein: 42, carbs: 55, fat: 18, note: null, consumed_at: '2026-11-06T10:05:00.000Z',
  },
];
jest.mock('../../core/supabase', () => {
  const zincir = (table: string) => {
    const state: { table: string; cols: string } = { table, cols: '' };
    const q: Record<string, unknown> = {};
    for (const m of ['insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'is', 'or', 'not',
      'gte', 'gt', 'lt', 'lte', 'order', 'limit', 'range']) {
      q[m] = () => q;
    }
    q.select = (cols: string) => { state.cols = cols ?? ''; return q; };
    const result = () => {
      if (state.table === 'meal_consumptions' && state.cols.startsWith('id,source')) {
        return { data: TODAY_ROWS, error: null };
      }
      if (state.table === 'meal_consumptions') {
        return { data: TODAY_ROWS.map(({ source, source_ref, calories, protein, carbs, fat, consumed_at }) =>
          ({ source, source_ref, calories, protein, carbs, fat, consumed_at })), error: null };
      }
      return { data: [], error: null };
    };
    q.maybeSingle = () => Promise.resolve({ data: null, error: null });
    q.single = () => Promise.resolve({ data: null, error: null });
    q.then = (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res);
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

beforeEach(() => {
  jest.setSystemTime(new Date('2026-11-06T16:00:00.000Z'));
});

test('yeni_kabuk KAPALI → Tracker render ağacı 1.0.7 ile aynı (snapshot)', async () => {
  const tree = render(<TrackerScreen />);
  // fetchData + görsel sorgusu çözülsün.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
  expect(tree.getByText('Bugün Tüketilenler')).toBeTruthy();
  expect(tree.getByText('Dolabındakiler')).toBeTruthy();
  expect(tree.toJSON()).toMatchSnapshot();
});
