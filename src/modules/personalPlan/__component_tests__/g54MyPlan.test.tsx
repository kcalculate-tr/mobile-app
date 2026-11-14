// G54-S1 md.2 — "Kişisel planım" yeni kayıt verisini okur (İlter cihaz testi: kayıt bitti, personal_plan dolu, hedef
// 2320 kcal → ekran "Henüz kişisel planın yok" gösteriyordu). Kök neden: bellekteki plan deposu kayıttan ÖNCE boş
// yüklenip yenilenmiyordu + kısa profil/eski profil satırlarında personal_plan yoktu. Testler sunucu satırından
// (supabase sahte) gerçek loadPlan → tek okuyucu → ekran yolunu sınar.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: { children: React.ReactNode }) => children };
});
const mockFlags: Record<string, boolean> = { kisisel_plan: true, yeni_kayit: true, ogun_plani: false, koc: false };
jest.mock('../../../core/flags', () => ({ __esModule: true, useFeature: (k: string) => !!mockFlags[k] }));
jest.mock('../../../core/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u-1' } }) }));
let mockRow: Record<string, unknown> | null = null;
jest.mock('../../../core/supabase', () => {
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gte', 'order', 'limit']) q[m] = () => q;
  q.maybeSingle = async () => ({ data: (q as { table?: string }).table === 'user_nutrition_profiles' ? mockRow : null, error: null });
  q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res);
  const client = { from: (t: string) => ((q as { table?: string }).table = t, q) };
  return { getSupabaseClient: () => client, supabase: client };
});
jest.mock('../../../lib/subscription/purchases', () => ({ useTier: () => ({ tier: 'free', status: 'verified' }) }));
jest.mock('../../coach/access', () => ({ hasCoachConsent: jest.fn(async () => false) }));
const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn() };

import { I18nProvider } from '../../../core/i18n';
import { ThemeProvider } from '../../../core/design/ThemeProvider';
import MyPlanScreen from '../screens/MyPlanScreen';
import { useMyPlanStore } from '../useMyPlan';
import { computeKayitPlan, toPpSaved } from '../../kayit/plan';
import { emptyKAnswers } from '../../kayit/model';

const flush = async () => {
  for (let i = 0; i < 8; i++) await act(async () => {});
};
const wrap = (el: React.ReactElement, scheme: 'light' | 'dark' = 'light') => (
  <ThemeProvider forceScheme={scheme}>
    <I18nProvider forceLang="tr">{el}</I18nProvider>
  </ThemeProvider>
);
const screen = () => <MyPlanScreen navigation={mockNav as never} route={{ key: 'm', name: 'PersonalPlanMine', params: undefined } as never} />;

function kayitRow() {
  const a = { ...emptyKAnswers(), goal: 'lose' as const, gender: 'male' as const, birthYear: 1990, heightCm: 182, weightKg: 92, targetWeightKg: 84, pace: 0.5 as const, activity: 'moderate' as const, diet: 'all' as const, meals: 3, cooking: 'sometimes' as const, struggle: 'evening_snack' as const };
  const plan = computeKayitPlan(a, { currentYear: new Date().getFullYear(), startIso: '2026-11-14' })!;
  const saved = toPpSaved(a, plan, { startIso: '2026-11-14', nowIso: '2026-11-14T10:00:00Z', start: 'track' });
  return { plan, saved, row: { user_id: 'u-1', target_calories: plan.calories, personal_plan: JSON.parse(JSON.stringify(saved)) } };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  useMyPlanStore.getState().clear();
  mockRow = null;
  mockFlags.yeni_kayit = true;
});

test('kayıttan ÖNCE boş yüklenmiş depo: yeni kayıt satırı yazıldıktan sonra ekran açılınca DOLU (kalori = kayıttaki hedef)', async () => {
  // Ana sayfa açıkken (profilsiz) depo boş yüklendi.
  await useMyPlanStore.getState().load('u-1');
  expect(useMyPlanStore.getState().loaded).toBe(true);
  expect(useMyPlanStore.getState().saved).toBeNull();
  // Kayıt sunucuya yazdı (bu test depoyu elle doldurmuyor).
  const { plan, row } = kayitRow();
  mockRow = row;
  const r = render(wrap(screen()));
  await flush();
  expect(r.getByTestId('pp-mine')).toBeTruthy();
  expect(r.getByTestId('pp-kcal')).toHaveTextContent(String(plan.calories));
  expect(r.queryByTestId('pp-mine-create')).toBeNull();
});

test('kayıt akışı planı kaydedince depo hemen dolar (prime) — ağ beklemeden dolu', async () => {
  const { plan, saved } = kayitRow();
  await useMyPlanStore.getState().load('u-1');
  useMyPlanStore.getState().prime('u-1', saved);
  const r = render(wrap(screen(), 'dark'));
  expect(r.getByTestId('pp-kcal')).toHaveTextContent(String(plan.calories));
});

test('kısa profil / eski profil (personal_plan yok, hedef var) → dolu', async () => {
  mockRow = { user_id: 'u-1', target_calories: 2320, target_protein: 150, target_carbs: 250, target_fat: 75, goal: 'lose_weight', gender: 'male', age: 36, height: 182, weight: 92, activity_level: 'moderate' };
  const r = render(wrap(screen()));
  await flush();
  expect(r.getByTestId('pp-kcal')).toHaveTextContent('2320');
});

test('plan gerçekten yok → boş hâl; "Kişisel planımı oluştur" YENİ kayıt akışına gider (eski funnel değil)', async () => {
  const r = render(wrap(screen()));
  await flush();
  fireEvent.press(r.getByTestId('pp-mine-create'));
  expect(mockNav.replace).toHaveBeenCalledWith('Kayit', { entry: 'gate', returnTo: { name: 'PersonalPlanMine' } });
  expect(mockNav.replace).not.toHaveBeenCalledWith('PersonalPlan', expect.anything());
});

test('yeni_kayit kapalı → eski davranış (PersonalPlan akışı)', async () => {
  mockFlags.yeni_kayit = false;
  const r = render(wrap(screen()));
  await flush();
  fireEvent.press(r.getByTestId('pp-mine-create'));
  expect(mockNav.replace).toHaveBeenCalledWith('PersonalPlan', { origin: 'mine' });
});
