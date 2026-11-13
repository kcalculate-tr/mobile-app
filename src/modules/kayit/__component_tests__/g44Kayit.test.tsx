// G44-S1 — Kayıt akışı seçim hâlleri / hareket inceltmesi testleri:
//  · Onboarding 1–5 G42 ile BAYT BAYT aynı (ekran dosyası, sahne görselleri, maskot görselleri, onboarding metinleri)
//    + onboarding'in paylaştığı hareket değerleri (panorama 450 ms, maskot ±7 pt) değişmedi.
//  · Hareket bantları: seçim 150–180 ms, basış 0,98 + 120 ms, giriş 8–12 pt / 220–260 ms / kademe ≤ 150 ms,
//    balon 200 ms fade, sayaç ≤ 600 ms, baş sallama ≤ 300 ms, süzülme ve paralaks yarı genlik, push 300–350 ms.
//  · P1: seçim sonrası diğer kartlar tam opaklık + tam ölçek + cam yüzey; seçili kart tam lime + limeInk + rozet.
//  · Soru balonu harf harf yazılmaz (ilk karede tam metin).
//  · P9: "Spor yapmıyorum" seçiliyken gün hapları devre dışı/soluk değil.
//  · Geçişler: O5 → P1 / P14 → L1 / L1 → L2 çapraz geçiş, K1/E1 push, T1 alttan tam ekran modal.
import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { StyleSheet } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Reanimated taklidi paylaşılan değeri her çizimde baştan kurar (giriş opaklığı hep 0 görünür); burada çizimler
// arası korunur → giriş animasyonu bittiğinde gerçek kararlı hâl (opaklık 1, ölçek 1) ölçülür.
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
jest.mock('../../../core/flags', () => ({ __esModule: true, useFeature: () => true }));
jest.mock('../../../core/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: { fetch: () => Promise.resolve({ isConnected: true }) } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ regionCode: 'TR' }] }));
jest.mock('../../personalPlan/api', () => ({ healthConsentGiven: jest.fn(async () => false), savePlan: jest.fn(async () => ({ ok: true })) }));
jest.mock('../../onboarding/takibe/save', () => ({ saveTakibeProfile: jest.fn(async () => ({ ok: true })) }));

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), reset: jest.fn(), canGoBack: () => true, getParent: () => mockNav };
let mockParams: Record<string, unknown> | undefined;
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => mockNav, useRoute: () => ({ params: mockParams }) };
});

import { I18nProvider } from '../../../core/i18n';
import { ThemeProvider } from '../../../core/design/ThemeProvider';
import QuestionsScreen from '../screens/QuestionsScreen';
import { K_DARK, K_LIGHT, K_MOTION } from '../ui/theme';
import { mixColor, parseColor } from '../ui/motion';
import { useKayit } from '../store';
import { emptyKAnswers } from '../model';
import { tr, en } from '../i18n';

const ROOT = join(__dirname, '../../../..');
const blob = (rel: string) => {
  const buf = readFileSync(join(ROOT, rel));
  return createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest('hex');
};
const sha = (o: unknown) => createHash('sha1').update(JSON.stringify(o)).digest('hex');
const wrap = (el: React.ReactElement) => (
  <ThemeProvider forceScheme="light">
    <I18nProvider forceLang="tr">{el}</I18nProvider>
  </ThemeProvider>
);
// jest yapılandırması sahte zamanlayıcıyı global açar → zaman ilerletilir (requestAnimationFrame + Date.now dahil).
const wait = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};
const flat = (s: unknown) => (StyleSheet.flatten(s as never) ?? {}) as Record<string, unknown>;

/** Öğeden köke: herhangi bir atada opaklık < 1 ya da ölçek ≠ 1 var mı? */
function dimmedChain(node: { props: Record<string, unknown>; parent: unknown } | null): string | null {
  let n = node;
  while (n) {
    const st = flat(n.props.style);
    if (typeof st.opacity === 'number' && st.opacity < 1) return `opacity ${st.opacity}`;
    const tf = st.transform as Array<Record<string, number>> | undefined;
    const sc = tf?.find((x) => 'scale' in x)?.scale;
    if (typeof sc === 'number' && sc !== 1) return `scale ${sc}`;
    n = n.parent as typeof n;
  }
  return null;
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = undefined;
  useKayit.getState().reset();
  await AsyncStorage.clear();
});

describe('onboarding 1–5 G42 ile bayt bayt aynı (069e521)', () => {
  test('ekran dosyası, sahne görselleri, maskot görselleri', () => {
    const G42: Record<string, string> = {
      'src/modules/kayit/screens/OnboardingScreen.tsx': '7401f91a946cefe17352c3e37843253e2b3dfe11',
      'assets/onboarding/sahne-1.webp': '11d3910f45ad5d0558fcbac232001481c193f3f4',
      'assets/onboarding/sahne-2.webp': '23cd2309055b2b3f6cbe66f40445703c57d7e75e',
      'assets/onboarding/sahne-3-en.webp': '604096ed7908d5234332103001b994d24b0dde78',
      'assets/onboarding/sahne-3-tr.webp': 'e9d1948b9c66e604d785b4514ee772ea306eeeab',
      'assets/onboarding/sahne-4-en.webp': '4f8dc86459c042f123b49de6726059226b175cc7',
      'assets/onboarding/sahne-4-tr.webp': '45a43c35090b35d205512136301d429840f577ad',
      'assets/onboarding/sahne-5.webp': '3642c4091be603b265b067067a8f3e112e26f37e',
      'assets/coach/koc-acik.png': 'f4e7bdd8e01d77054c8fe41824027a9b67793b20',
      'assets/coach/koc-kapali.png': 'eabd14833f66356cadc15ee53089bc47586a2c89',
    };
    for (const [f, h] of Object.entries(G42)) expect([f, blob(f)]).toEqual([f, h]);
  });

  test('onboarding metinleri (TR + EN) değişmedi', () => {
    expect(sha(tr.onb)).toBe('341720f851462055a3be3fc900d8c1f388658677');
    expect(sha(en.onb)).toBe('38fd153660a22c47601bf00e6536816426b8a753');
  });

  test('onboarding ile ortak hareket değerleri G42 ile aynı (panorama 450 ms, maskot ±7 pt / 3,2 sn, göz kırpma 4–6 sn)', () => {
    expect(K_MOTION.pan).toBe(450);
    expect(K_MOTION.floatAmp).toBe(7);
    expect(K_MOTION.floatHalf * 2).toBe(K_MOTION.floatPeriod);
    expect([K_MOTION.blinkMin, K_MOTION.blinkMax, K_MOTION.blinkHold]).toEqual([4000, 6000, 140]);
    // Onboarding maskotu `fill` → onboarding kipi (zıplama + tam genlik) — parts.tsx sözleşmesi.
    const parts = readFileSync(join(ROOT, 'src/modules/kayit/ui/parts.tsx'), 'utf8');
    expect(parts).toMatch(/motion \?\? \(fill \? 'onboarding' : 'kayit'\)/);
    expect(readFileSync(join(ROOT, 'src/modules/kayit/screens/OnboardingScreen.tsx'), 'utf8')).toMatch(/<Mascot fill \/>/);
  });
});

test('hareket bantları (G44 md.2–5)', () => {
  expect(K_MOTION.select).toBeGreaterThanOrEqual(150);
  expect(K_MOTION.select).toBeLessThanOrEqual(180);
  expect(K_MOTION.pressScale).toBe(0.98);
  expect(K_MOTION.pressOut).toBe(120);
  expect(K_MOTION.enterDy).toBeGreaterThanOrEqual(8);
  expect(K_MOTION.enterDy).toBeLessThanOrEqual(12);
  expect(K_MOTION.enter).toBeGreaterThanOrEqual(220);
  expect(K_MOTION.enter).toBeLessThanOrEqual(260);
  expect(K_MOTION.stagger * 4).toBeLessThanOrEqual(150); // P1: 5 kart → 4 kademe
  expect(K_MOTION.staggerMax).toBeLessThanOrEqual(150);
  expect(K_MOTION.bubbleFade).toBe(200);
  expect(K_MOTION.count).toBeLessThanOrEqual(600);
  expect(K_MOTION.nod).toBeLessThanOrEqual(300);
  expect(K_MOTION.nodIn + K_MOTION.nodMid + K_MOTION.nodOut).toBeLessThanOrEqual(300);
  expect(K_MOTION.floatAmpKayit).toBe(K_MOTION.floatAmp / 2);
  expect(K_MOTION.push).toBeGreaterThanOrEqual(300);
  expect(K_MOTION.push).toBeLessThanOrEqual(350);
  expect(K_MOTION.cross).toBe(250);
  // Kaldırılan: harf harf, seçimde büyüme/soluklaştırma, paylaşılan öğe.
  for (const k of ['typeChar', 'pickScale', 'dimScale', 'dimOpacity', 'shared']) expect(k in K_MOTION).toBe(false);
});

test('renk karışımı: uçlar birebir, ara değer doğrusal; limeInk her temada siyah', () => {
  expect(mixColor(K_LIGHT.card, K_LIGHT.accent, 0)).toBe(K_LIGHT.card);
  expect(mixColor(K_LIGHT.card, K_LIGHT.accent, 1)).toBe(K_LIGHT.accent);
  expect(mixColor('#000000', '#FFFFFF', 0.5)).toBe('rgba(128,128,128,1)');
  expect(parseColor('rgba(10,10,10,0.72)')).toEqual([10, 10, 10, 0.72]);
  expect(mixColor('transparent', '#B9EF14', 0.5)).toBe('rgba(185,239,20,0.5)');
  expect(K_LIGHT.limeInk).toBe('#0A0A0A');
  expect(K_DARK.limeInk).toBe('#0A0A0A');
});

test('P1: harf harf yok — başlık ilk karede tam metin', () => {
  const r = render(wrap(<QuestionsScreen />));
  expect(r.getByTestId('kayit-q-title').props.children).toBe(tr.q.goal_title);
});

test('P1 seçim: diğer kartlar soluklaşmaz/küçülmez (cam yüzey, tam opaklık); seçili tam lime + limeInk + dolu rozet', async () => {
  const r = render(wrap(<QuestionsScreen />));
  await wait(20);
  fireEvent.press(r.getByTestId('kayit-goal-lose'));
  await wait(K_MOTION.select + 120);

  const sel = r.getByTestId('kayit-goal-lose');
  expect(sel.props.accessibilityState).toMatchObject({ checked: true });
  expect(flat(sel.props.style).backgroundColor).toBe(K_LIGHT.accent);
  expect(flat(sel.props.style).borderColor).toBe(K_LIGHT.accent);
  expect(flat(r.getByText(tr.q.goal_lose).props.style).color).toBe(K_LIGHT.limeInk);
  // Dolu onay rozeti: limeInk daire seçili kartın içinde.
  const badge = sel.findAll((n: { props: Record<string, unknown> }) => flat(n.props.style).backgroundColor === K_LIGHT.limeInk && flat(n.props.style).position === 'absolute');
  expect(badge.length).toBeGreaterThan(0);

  for (const g of ['maintain', 'gain', 'muscle', 'balanced']) {
    const tile = r.getByTestId(`kayit-goal-${g}`);
    expect(tile.props.accessibilityState).toMatchObject({ checked: false });
    expect(flat(tile.props.style).backgroundColor).toBe(K_LIGHT.card);
    expect(flat(tile.props.style).borderColor).toBe(K_LIGHT.cardEdge);
    expect(dimmedChain(tile as never)).toBeNull();
    expect(tile.findAll((n: { props: Record<string, unknown> }) => flat(n.props.style).backgroundColor === K_LIGHT.limeInk).length).toBe(0);
  }
  expect(dimmedChain(sel as never)).toBeNull();
});

test('P10 (beslenme) seçim: diğer kartlar cam yüzey ve tam opaklık', async () => {
  useKayit.getState().patch({ ...emptyKAnswers(), goal: 'lose', gender: 'female', birthYear: 1995, heightCm: 170, weightKg: 72, targetWeightKg: 66, activity: 'light' });
  mockParams = { vitrinStep: 'diet' };
  const r = render(wrap(<QuestionsScreen />));
  await wait(20);
  fireEvent.press(r.getByTestId('kayit-diet-vegan'));
  await wait(K_MOTION.select + 120);
  expect(flat(r.getByTestId('kayit-diet-vegan').props.style).backgroundColor).toBe(K_LIGHT.accent);
  for (const d of ['all', 'vegetarian', 'pescatarian']) {
    const tile = r.getByTestId(`kayit-diet-${d}`);
    expect(flat(tile.props.style).backgroundColor).toBe(K_LIGHT.card);
    expect(dimmedChain(tile as never)).toBeNull();
  }
});

test('P9: "Spor yapmıyorum" seçiliyken gün hapları devre dışı/soluk değil; güne dokunmak o seçimi kaldırır', async () => {
  useKayit.getState().patch({ ...emptyKAnswers(), goal: 'lose', noSport: true });
  mockParams = { vitrinStep: 'sport' };
  const r = render(wrap(<QuestionsScreen />));
  await wait(20);
  const days = tr.q.days.split(',');
  const longs = tr.q.days_long.split(',');
  const mon = r.getByTestId(`kayit-day-${days[0]}-${longs[0]}`);
  expect(mon.props.accessibilityState).toMatchObject({ disabled: false });
  expect(dimmedChain(mon as never)).toBeNull();
  fireEvent.press(mon);
  expect(useKayit.getState().answers.noSport).toBe(false);
  expect(useKayit.getState().answers.sportDays).toEqual([0]);
});

test('geçişler: O5 → P1 / P14 → L1 / L1 → L2 çapraz geçiş, K1/E1 push, T1 alttan tam ekran modal; azaltılmışta yok', () => {
  const nav = readFileSync(join(ROOT, 'src/modules/kayit/KayitNavigator.tsx'), 'utf8');
  expect(nav).toMatch(/name="KQuestions"[^\n]*\.\.\.cross/);
  expect(nav).toMatch(/name="KCalc"[^\n]*\.\.\.cross/);
  expect(nav).toMatch(/name="KResult"[^\n]*\.\.\.cross/);
  expect(nav).toMatch(/name="KSignup"[^\n]*options=\{push\}/);
  expect(nav).toMatch(/name="KEmail"[^\n]*options=\{push\}/);
  expect(nav).toMatch(/name="KOffer"[^\n]*\.\.\.modal/);
  expect(nav).toMatch(/presentation: 'fullScreenModal'/);
  expect(nav).toMatch(/animation: 'slide_from_bottom', presentation: 'fullScreenModal'/);
  expect(nav).toMatch(/animationDuration: K_MOTION\.cross/);
  expect(nav).toMatch(/reduced \? \(\{ animation: 'none' \} as const\)/);
  // Soru → soru ekran içi yığın geçişi; paylaşılan öğe taklidi yok.
  const q = readFileSync(join(ROOT, 'src/modules/kayit/screens/QuestionsScreen.tsx'), 'utf8');
  expect(q).toMatch(/<StackSwap k=\{step\} dir=\{dir\}>/);
  expect(q).not.toMatch(/StepSlide|dimmed/);
});
