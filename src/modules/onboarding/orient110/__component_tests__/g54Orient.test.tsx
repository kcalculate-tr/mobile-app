// G54-S1 md.3 — 1.1.0 oryantasyonu (KRİTİK): eski hesap ilk giriş → tanıtım + ipuçları; yeni kayıt → yalnız ipuçları;
// ikinci açılışta görünmez; "Geç" kalıcı; başka katman açıkken başlamaz; yeni_onboarding KAPALIYKEN de çalışır;
// hesap değişince yeniden değerlendirilir; Ayarlar "turu tekrar izle"; ölçüm olayları.
import React from 'react';
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
  return { ...m, useSharedValue, default: { ...m.default, useSharedValue } };
});
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: { children: React.ReactNode }) => children };
});
const mockFlags: Record<string, boolean> = { yeni_kayit: true, yeni_onboarding: false };
jest.mock('../../../../core/flags', () => ({ __esModule: true, useFeature: (k: string) => !!mockFlags[k] }));
const mockAuth: { user: { id: string } | null } = { user: { id: 'u-old' } };
jest.mock('../../../../core/AuthContext', () => ({ useAuth: () => mockAuth }));
let mockRemote: Record<string, unknown> | null = {};
const mockUpdate = jest.fn((_: unknown) => ({ eq: async () => ({ error: null }) }));
jest.mock('../../../../core/supabase', () => {
  const q: Record<string, unknown> = {};
  q.select = () => q;
  q.eq = () => q;
  q.maybeSingle = async () => ({ data: mockRemote == null ? null : { onboarding_state: mockRemote }, error: null });
  q.update = (v: unknown) => mockUpdate(v);
  const client = { from: () => q };
  return { getSupabaseClient: () => client, supabase: client };
});
const mockTrack = jest.fn();
jest.mock('../../../../lib/analytics', () => ({ track: (...a: unknown[]) => mockTrack(...a) }));

import { I18nProvider } from '../../../../core/i18n';
import { ThemeProvider } from '../../../../core/design/ThemeProvider';
import { Orient110Host } from '../Orient110Host';
import { useOrient110 } from '../store';
import { useGateStore } from '../../first/overlayGate';
import { useOnbFirst } from '../../first/store';
import { orientDeviceKey, type Orient110Tip } from '../logic';
import { ONB_KEY } from '../../../kayit/storage';

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
const tick = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
};
/** Ekrandaki hedefler (ölçüm sahte: measureInWindow hemen döner). */
function targets(ids: Orient110Tip[] = ['scan', 'home', 'kesfet', 'eatkcal'], variant: 'card' | 'ring' = 'card') {
  act(() => {
    useOrient110.setState({ homeVariant: variant });
    ids.forEach((id, i) => useOrient110.getState().register(id, { current: { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(20 + i * 80, id === 'home' ? 120 : 780, 64, id === 'home' ? 160 : 56) } } as never));
  });
}
function resetStores() {
  useOrient110.setState({ uid: null, decided: false, seen: false, intro: false, phase: { kind: 'idle' }, replay: false, targets: {}, homeVariant: 'card' });
  useGateStore.setState({ open: 0 });
  useOnbFirst.setState({ celebrate: null });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockFlags.yeni_kayit = true;
  mockFlags.yeni_onboarding = false;
  mockAuth.user = { id: 'u-old' };
  mockRemote = {};
  resetStores();
});

async function mount(opts?: { ids?: Orient110Tip[]; variant?: 'card' | 'ring' }) {
  const r = render(wrap(<Orient110Host />));
  await flush();
  targets(opts?.ids, opts?.variant);
  await tick(600);
  await tick(400);
  return r;
}

test('eski hesap (bu cihazda onboarding görmemiş) ilk giriş → 4 sayfalık tanıtım, sonra 4 ipucu; yeni_onboarding KAPALI', async () => {
  const r = await mount();
  expect(r.getByTestId('orient110-intro')).toBeTruthy();
  expect(r.getByText('Tabağını tara')).toBeTruthy();
  expect(r.getByText('Kişisel planın')).toBeTruthy();
  expect(r.getByText('Kcalculate AI Koç')).toBeTruthy();
  expect(r.getByText('Keşfet ve eatkcal')).toBeTruthy();
  expect(r.getByTestId('orient110-intro-skip').props.accessibilityLabel).toBe('Geç');
  for (let i = 0; i < 3; i++) {
    expect(r.getByTestId('orient110-intro-next').props.accessibilityLabel).toBe('Devam');
    fireEvent.press(r.getByTestId('orient110-intro-next'));
    await flush();
  }
  expect(r.getByTestId('orient110-intro-next').props.accessibilityLabel).toBe('Başlayalım');
  fireEvent.press(r.getByTestId('orient110-intro-next'));
  await tick(400);
  for (const [tip, title] of [['scan', 'Tara'], ['home', 'Planını oluştur'], ['kesfet', 'Keşfet'], ['eatkcal', 'eatkcal']] as const) {
    expect(r.getByTestId(`orient110-tip-${tip}`)).toBeTruthy();
    expect(r.getByTestId('orient110-tip-title')).toHaveTextContent(title);
    fireEvent.press(r.getByTestId('orient110-tip-next'));
    await tick(250);
    await tick(400);
  }
  expect(r.queryByTestId(/orient110-/)).toBeNull();
  const views = mockTrack.mock.calls.filter((c) => c[0] === 'orient_v110_view').map((c) => (c[1] as { step: string }).step);
  expect(views).toEqual(['intro_1', 'intro_2', 'intro_3', 'intro_4', 'scan', 'home', 'kesfet', 'eatkcal']);
  expect(mockTrack).toHaveBeenCalledWith('orient_v110_complete', {});
  // Hesap + cihaz işareti.
  expect(await AsyncStorage.getItem(orientDeviceKey('u-old'))).toBeTruthy();
  expect(mockUpdate).toHaveBeenCalledWith({ onboarding_state: { orient_v110_seen_at: expect.any(String) } });
});

test('yeni kayıt (onboarding bu cihazda görüldü) → T1 sonrası Ana sayfada YALNIZ ipuçları (profilli: halka)', async () => {
  await AsyncStorage.setItem(ONB_KEY, JSON.stringify({ step: 5, start: 'track', path: 'a' }));
  mockAuth.user = { id: 'u-new' };
  const r = await mount({ variant: 'ring' });
  expect(r.queryByTestId('orient110-intro')).toBeNull();
  expect(r.getByTestId('orient110-tip-scan')).toBeTruthy();
  fireEvent.press(r.getByTestId('orient110-tip-next'));
  await tick(250);
  await tick(400);
  expect(r.getByTestId('orient110-tip-title')).toHaveTextContent('Günlük hedefin');
});

test('ikinci açılışta görünmez (cihaz işareti)', async () => {
  await AsyncStorage.setItem(orientDeviceKey('u-old'), '2026-11-14T10:00:00Z');
  const r = await mount();
  expect(r.queryByTestId(/orient110-/)).toBeNull();
});

test('başka cihazda görüldüyse (hesap işareti) görünmez', async () => {
  mockRemote = { orient_v110_seen_at: '2026-11-14T10:00:00Z', profileCard: 'done' };
  const r = await mount();
  expect(r.queryByTestId(/orient110-/)).toBeNull();
  expect(await AsyncStorage.getItem(orientDeviceKey('u-old'))).toBeTruthy();
});

test('"Geç" kalıcı: tanıtımda Geç → kapanır, ölçüm skip(intro_1); yeniden açılışta görünmez', async () => {
  const r = await mount();
  fireEvent.press(r.getByTestId('orient110-intro-skip'));
  await flush();
  expect(r.queryByTestId(/orient110-/)).toBeNull();
  expect(mockTrack).toHaveBeenCalledWith('orient_v110_skip', { step: 'intro_1' });
  r.unmount();
  resetStores();
  const r2 = await mount();
  expect(r2.queryByTestId(/orient110-/)).toBeNull();
});

test('ipucunda Geç → kalan ipuçları kapanır (skip step adıyla)', async () => {
  await AsyncStorage.setItem(ONB_KEY, '{"step":5}');
  const r = await mount();
  fireEvent.press(r.getByTestId('orient110-tip-skip'));
  await tick(400);
  expect(r.queryByTestId(/orient110-/)).toBeNull();
  expect(mockTrack).toHaveBeenCalledWith('orient_v110_skip', { step: 'scan' });
});

test('başka katman açıkken (T1/tebrik/izin sayfası) başlamaz; kapanınca başlar', async () => {
  useGateStore.setState({ open: 1 });
  const r = await mount();
  expect(r.queryByTestId(/orient110-/)).toBeNull();
  act(() => useGateStore.setState({ open: 0 }));
  await tick(600);
  expect(r.getByTestId('orient110-intro')).toBeTruthy();
});

test('Ana sayfa odakta değilken (hedef yok, ör. kök yığında T1/AuthSheet) başlamaz', async () => {
  const r = await mount({ ids: ['scan', 'kesfet', 'eatkcal'] });
  expect(r.queryByTestId(/orient110-/)).toBeNull();
});

test('oturumsuz → görünmez; girişten sonra görür; hesap değişince yeni hesap için yeniden değerlendirilir', async () => {
  mockAuth.user = null;
  const r = await mount();
  expect(r.queryByTestId(/orient110-/)).toBeNull();
  await AsyncStorage.setItem(orientDeviceKey('u-a'), '2026-11-14T10:00:00Z');
  mockAuth.user = { id: 'u-a' };
  r.rerender(wrap(<Orient110Host />));
  await tick(600);
  expect(r.queryByTestId(/orient110-/)).toBeNull();
  mockAuth.user = { id: 'u-b' };
  r.rerender(wrap(<Orient110Host />));
  await tick(600);
  await tick(600);
  expect(r.getByTestId('orient110-intro')).toBeTruthy();
});

test('yeni_kayit kapalı → hiç başlamaz', async () => {
  mockFlags.yeni_kayit = false;
  const r = await mount();
  expect(r.queryByTestId(/orient110-/)).toBeNull();
});

test('Profil › Ayarlar "Uygulama turunu tekrar izle" → işaret olsa da ipuçları yeniden (tanıtımsız)', async () => {
  await AsyncStorage.setItem(orientDeviceKey('u-old'), '2026-11-14T10:00:00Z');
  const r = await mount();
  expect(r.queryByTestId(/orient110-/)).toBeNull();
  act(() => useOrient110.getState().replayTips());
  await tick(600);
  await tick(400);
  expect(r.queryByTestId('orient110-intro')).toBeNull();
  expect(r.getByTestId('orient110-tip-scan')).toBeTruthy();
});

test('EN + koyu: ilk tanıtım sayfası metni', async () => {
  const r = render(wrap(<Orient110Host />, 'dark', 'en'));
  await flush();
  targets();
  await tick(600);
  expect(r.getByText('Scan your plate')).toBeTruthy();
  expect(r.getByTestId('orient110-intro-next').props.accessibilityLabel).toBe('Continue');
});

test('HIG: ipucu düğmeleri ≥ 44 pt, VoiceOver etiketi balon metnini içerir', async () => {
  await AsyncStorage.setItem(ONB_KEY, '{"step":5}');
  const r = await mount();
  const tip = r.getByTestId('orient110-tip-scan');
  const alert = tip.findAll((n: { props: { accessibilityRole?: string } }) => n.props.accessibilityRole === 'alert')[0];
  expect(alert.props.accessibilityLabel).toMatch(/^İpucu 1 \/ 4\. Tara\. /);
  const { StyleSheet } = require('react-native');
  expect(StyleSheet.flatten(r.getByTestId('orient110-tip-next').props.style).minHeight).toBeGreaterThanOrEqual(44);
});

test('kaynak: AppNavigator yeni_kayit açıkken Orient110Host bağlar; Ayarlar satırı var', () => {
  const { readFileSync } = require('fs');
  const { join } = require('path');
  const root = join(__dirname, '../../../../..');
  expect(readFileSync(join(root, 'src/navigation/AppNavigator.tsx'), 'utf8')).toMatch(/\{yeniKayit \? <Orient110Host \/> : <OrientHost \/>\}/);
  expect(readFileSync(join(root, 'src/modules/profil/ui/screens/FinPrProfileScreen.tsx'), 'utf8')).toMatch(/useOrient110\.getState\(\)\.replayTips\(\)/);
});
