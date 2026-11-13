// G39-S1 md.8 — Ana sayfa kcalAI Koç kartı (md.5): lime dolgu + her temada siyah metin/düğme, maskot (kase yok),
// azaltılmış harekette süzülme ve göz kırpma YOK (statik maskot), ekran odakta değilken hareket durur;
// "Koçuna sor" eylemi ve kota satırı aynı. Koç maskotu sohbet avatarında ve boş hâlde (md.4).
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: { children: React.ReactNode }) => children };
});

type L = () => void;
const mockListeners: Record<string, L[]> = { focus: [], blur: [] };
const mockNav = {
  navigate: jest.fn(),
  isFocused: () => true,
  addListener: (e: string, cb: L) => {
    mockListeners[e].push(cb);
    return () => {
      mockListeners[e] = mockListeners[e].filter((x) => x !== cb);
    };
  },
};
jest.mock('@react-navigation/native', () => {
  const R = jest.requireActual('react');
  return {
    useNavigation: () => mockNav,
    useRoute: () => ({ params: undefined }),
    NavigationContext: R.createContext({
      navigate: (...a: unknown[]) => (mockNav.navigate as (...x: unknown[]) => void)(...a),
      isFocused: () => mockNav.isFocused(),
      addListener: (e: string, cb: () => void) => mockNav.addListener(e, cb),
    }),
  };
});
jest.mock('../access', () => ({
  useCoachEnabled: () => true,
  introSeen: () => Promise.resolve(true),
  consentGiven: () => Promise.resolve(true),
}));
const mockOpen = jest.fn();
jest.mock('../actions', () => ({ openCoach: (...a: unknown[]) => mockOpen(...a) }));

// eslint-disable-next-line import/first
import { ReducedMotionProvider, ThemeProvider, palette } from '../../../core/design';
// eslint-disable-next-line import/first
import { CoachHomeCard } from '../ui/entries';
// eslint-disable-next-line import/first
import { CoachAvatar, CoachGlass } from '../ui/parts';
// eslint-disable-next-line import/first
import { COACH_MASCOT_MOTION, nextBlinkDelay } from '../ui/CoachHomeMascot';
// eslint-disable-next-line import/first
import { useSubscriptionStore } from '../../../lib/subscription/purchases';

const H = { includeHiddenElements: true } as const;
const src = (n: { props: { source: unknown } }) => JSON.stringify(n.props.source);

function card(reduced: boolean, scheme: 'light' | 'dark' = 'light') {
  return render(
    <ThemeProvider forceScheme={scheme}>
      <ReducedMotionProvider value={reduced}>
        <CoachHomeCard consumedKcal={1200} targetKcal={2000} proteinLeft={38} />
      </ReducedMotionProvider>
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.useFakeTimers();
  mockOpen.mockClear();
  mockListeners.focus = [];
  mockListeners.blur = [];
  useSubscriptionStore.setState({ rc: null, server: null, limits: null });
});
afterEach(() => {
  jest.useRealTimers();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`${scheme}: kart dolgusu marka lime'ı (#B9EF14), metin ve düğme SİYAH, lime üstünde beyaz yazı yok`, () => {
    const r = card(false, scheme);
    const root = r.getByTestId('coach-home-card');
    expect(StyleSheet.flatten(root.props.style).backgroundColor).toBe(palette.brandLime);
    expect(palette.brandLime).toBe('#B9EF14');
    const texts = root.findAll((n: TNode) => typeof n.type !== 'string' && typeof n.props?.children === 'string' && n.props?.style != null);
    const btn = r.getByTestId('coach-home-open');
    const btnBg = StyleSheet.flatten(typeof btn.props.style === 'function' ? btn.props.style({ pressed: false }) : btn.props.style).backgroundColor;
    expect(btnBg).toBe('#0A0A0A');
    for (const t of texts) {
      const color = StyleSheet.flatten(t.props.style)?.color;
      if (color == null) continue;
      const insideBtn = btn.findAll((n: TNode) => n === t).length > 0;
      if (insideBtn) expect(color).toBe(palette.brandLime); // siyah düğme üstünde lime yazı
      else expect(['#0A0A0A', 'rgba(10,10,10,0.72)']).toContain(color);
    }
  });
}

test('azaltılmış hareket: süzülme yok (statik -15° poz), göz kırpma zamanlayıcısı kurulmaz', () => {
  const r = card(true);
  expect(r.getByTestId('coach-home-mascot-static', H)).toBeTruthy();
  expect(r.queryByTestId('coach-home-mascot-float', H)).toBeNull();
  const st = StyleSheet.flatten(r.getByTestId('coach-home-mascot-static', H).props.style);
  expect(JSON.stringify(st.transform)).toContain('-15deg');
  act(() => {
    jest.advanceTimersByTime(20000);
  });
  // Kapalı göz katmanı hiç görünmedi.
  expect(StyleSheet.flatten(r.getByTestId('coach-home-mascot-closed', H).props.style).opacity).toBe(0);
  expect(StyleSheet.flatten(r.getByTestId('coach-home-mascot-open', H).props.style).opacity).toBe(1);
});

test('hareket açık: süzülür; 3–5 sn içinde göz kırpar (koc-kapali 90 ms) ve açılır', () => {
  const r = card(false);
  expect(r.getByTestId('coach-home-mascot-float', H)).toBeTruthy();
  expect(src(r.getByTestId('coach-home-mascot-open', H))).toContain('koc-acik');
  expect(src(r.getByTestId('coach-home-mascot-closed', H))).toContain('koc-kapali');
  const closedOpacity = () => StyleSheet.flatten(r.getByTestId('coach-home-mascot-closed', H).props.style).opacity;
  let blinked = false;
  for (let t = 0; t < 5100; t += 10) {
    act(() => {
      jest.advanceTimersByTime(10);
    });
    if (closedOpacity() === 1) {
      blinked = true;
      expect(t).toBeGreaterThanOrEqual(COACH_MASCOT_MOTION.blinkMin - 20);
      act(() => {
        jest.advanceTimersByTime(COACH_MASCOT_MOTION.blinkClosed);
      });
      expect(closedOpacity()).toBe(0);
      break;
    }
  }
  expect(blinked).toBe(true);
});

test('ekran odaktan çıkınca (blur) hareket durur, dönünce (focus) yeniden başlar', () => {
  const r = card(false);
  expect(r.getByTestId('coach-home-mascot-float', H)).toBeTruthy();
  act(() => mockListeners.blur.forEach((cb) => cb()));
  expect(r.getByTestId('coach-home-mascot-static', H)).toBeTruthy();
  act(() => mockListeners.focus.forEach((cb) => cb()));
  expect(r.getByTestId('coach-home-mascot-float', H)).toBeTruthy();
});

test('maskot dekoratif (VoiceOver gizli), arkasında radyal siyah ışıma; "Koçuna sor" aynı eylemi açar', () => {
  const r = card(false);
  expect(r.getByTestId('coach-home-mascot', H).props.accessibilityElementsHidden).toBe(true);
  expect(r.getByTestId('coach-home-glow', H)).toBeTruthy();
  expect(COACH_MASCOT_MOTION.glowOpacity).toBeGreaterThanOrEqual(0.25);
  expect(COACH_MASCOT_MOTION.glowOpacity).toBeLessThanOrEqual(0.4);
  fireEvent.press(r.getByTestId('coach-home-open'));
  expect(mockOpen).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ from: 'home' }));
  // Kota satırı (Balance değil) duruyor.
  expect(r.getByText(/deneme mesajı hediye/)).toBeTruthy();
});

test('hareket değerleri: ±6 pt, ±3°, 3,5 sn döngü; kırpma gecikmesi 3–5 sn', () => {
  expect(COACH_MASCOT_MOTION.floatAmp).toBe(6);
  expect(COACH_MASCOT_MOTION.rotateAmp).toBe(3);
  expect(COACH_MASCOT_MOTION.halfPeriod * 2).toBe(3500);
  expect(nextBlinkDelay(() => 0)).toBe(3000);
  expect(nextBlinkDelay(() => 1)).toBe(5000);
});

test('md.4: sohbet avatarı ve boş hâl (CoachGlass) kase değil maskot', () => {
  const r = render(
    <>
      <CoachAvatar />
      <CoachGlass size={100} />
    </>,
  );
  expect(src(r.getByTestId('coach-avatar-mascot', H))).toContain('koc-acik');
  const imgs = r.getByTestId('coach-mascot', H).findAll((n: TNode) => n.props?.source != null);
  expect(imgs.map(src).join()).toContain('koc-acik');
  expect(imgs.map(src).join()).not.toContain('bowl');
});

// Test ağacı düğümü (react-test-renderer tipi pakette yok).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TNode = { props: Record<string, any>; type: unknown };
