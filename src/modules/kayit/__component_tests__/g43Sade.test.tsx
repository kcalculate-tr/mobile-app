// G43-S1 — Sadeleştirme bileşen testleri: Apple ile giriş YALNIZ iOS'ta native `AppleAuthenticationButton`
// (açıkta siyah, koyuda beyaz) ve Android'de hiç çizilmez; azaltılmış harekette animasyon yok (ilerleme çubuğu,
// segment, adım geçişi anında; L1 maskotu göz kırpmaz); seçim satırı = radyo + 2 pt lime kenar, zemin beyaz.
import React from 'react';
import { Image, Platform } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native-reanimated', () => {
  const m = require('react-native-reanimated/mock');
  return { ...m, withTiming: jest.fn(m.withTiming) };
});
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: { children: React.ReactNode }) => children };
});
jest.mock('expo-apple-authentication', () => {
  const R = require('react');
  const { Pressable } = require('react-native');
  const AppleAuthenticationButton = jest.fn((p: { testID?: string; onPress: () => void }) => R.createElement(Pressable, { testID: p.testID, onPress: p.onPress, accessibilityRole: 'button' }));
  return { AppleAuthenticationButton, AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 }, AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 } };
});
const mockFlags: Record<string, boolean> = { yeni_kayit: true, kisisel_plan: true, kesfet: true };
jest.mock('../../../core/flags', () => ({ __esModule: true, useFeature: (k: string) => !!mockFlags[k] }));
const mockSignInWithApple = jest.fn(async () => ({ error: null }));
jest.mock('../../../core/AuthContext', () => ({
  useAuth: () => ({ user: null, signInWithApple: mockSignInWithApple, signInWithGoogle: jest.fn(), signInWithOtp: jest.fn(async () => ({ error: null })), verifyEmailOtp: jest.fn(async () => ({ error: null })), signIn: jest.fn() }),
}));
jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: { fetch: () => Promise.resolve({ isConnected: true }) } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ regionCode: 'TR' }] }));
jest.mock('../../../lib/consent/metaConsent', () => ({ requestMetaOptIn: jest.fn(async () => ({ granted: false, att: 'denied' })) }));
jest.mock('../../personalPlan/api', () => ({ healthConsentGiven: jest.fn(async () => false), savePlan: jest.fn(async () => ({ ok: true })) }));
jest.mock('../../onboarding/takibe/save', () => ({ saveTakibeProfile: jest.fn(async () => ({ ok: true })) }));
jest.mock('../../../lib/postSocialAuth', () => ({ resolvePostSocialAuth: jest.fn(async () => ({ kind: 'ok' })) }));

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), reset: jest.fn(), canGoBack: () => true, getParent: () => mockNav };
let mockParams: Record<string, unknown> | undefined;
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => mockNav, useRoute: () => ({ params: mockParams }) };
});

import { withTiming } from 'react-native-reanimated';
import * as AppleAuthentication from 'expo-apple-authentication';
import { I18nProvider } from '../../../core/i18n';
import { ThemeProvider } from '../../../core/design/ThemeProvider';
import { ReducedMotionProvider } from '../../../core/design';
import { SignupScreen } from '../screens/SignupScreens';
import QuestionsScreen from '../screens/QuestionsScreen';
import { Mascot, ProgressBar, Segment } from '../ui/parts';
import { OptionRow } from '../ui/pickers';
import { K_LIGHT } from '../ui/theme';
import { useKayit } from '../store';

const wrap = (el: React.ReactElement, opts: { scheme?: 'light' | 'dark'; reduced?: boolean | null } = {}) => (
  <ThemeProvider forceScheme={opts.scheme ?? 'light'}>
    <I18nProvider forceLang="tr">
      <ReducedMotionProvider value={opts.reduced ?? null}>{el}</ReducedMotionProvider>
    </I18nProvider>
  </ThemeProvider>
);
const flush = async () => {
  for (let i = 0; i < 4; i++) await act(async () => {});
};
const AppleBtn = AppleAuthentication.AppleAuthenticationButton as unknown as jest.Mock;
const timing = withTiming as unknown as jest.Mock;

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = { path: 'a' };
  useKayit.getState().reset();
  await AsyncStorage.clear();
});

describe('Apple ile giriş düğmesi', () => {
  test('iOS: native AppleAuthenticationButton (açık temada siyah, "Continue"), dokununca mevcut signInWithApple', async () => {
    const r = render(wrap(<SignupScreen />));
    await flush();
    expect(r.getByTestId('kayit-apple-native')).toBeTruthy();
    const props = AppleBtn.mock.calls[AppleBtn.mock.calls.length - 1][0];
    expect(props.buttonStyle).toBe(AppleAuthentication.AppleAuthenticationButtonStyle.BLACK);
    expect(props.buttonType).toBe(AppleAuthentication.AppleAuthenticationButtonType.CONTINUE);
    expect(props.cornerRadius).toBe(27);
    await act(async () => {
      fireEvent.press(r.getByTestId('kayit-apple-native'));
    });
    await flush();
    expect(mockSignInWithApple).toHaveBeenCalledTimes(1);
  });

  test('iOS koyu tema: native düğme beyaz stil', async () => {
    render(wrap(<SignupScreen />, { scheme: 'dark' }));
    await flush();
    const props = AppleBtn.mock.calls[AppleBtn.mock.calls.length - 1][0];
    expect(props.buttonStyle).toBe(AppleAuthentication.AppleAuthenticationButtonStyle.WHITE);
  });

  test('Android: Apple düğmesi hiç çizilmez; Google ve e-posta kalır', async () => {
    const restore = jest.replaceProperty(Platform, 'OS', 'android');
    try {
      const r = render(wrap(<SignupScreen />));
      await flush();
      expect(r.queryByTestId('kayit-apple')).toBeNull();
      expect(r.queryByTestId('kayit-apple-native')).toBeNull();
      expect(AppleBtn).not.toHaveBeenCalled();
      expect(r.getByTestId('kayit-google')).toBeTruthy();
      expect(r.getByTestId('kayit-email')).toBeTruthy();
    } finally {
      restore.restore();
    }
  });

  test('K1: Koşullar ve Gizlilik ayrı 44 pt bağlantı satırında', async () => {
    const r = render(wrap(<SignupScreen />));
    await flush();
    for (const id of ['kayit-terms', 'kayit-privacy']) {
      const el = r.getByTestId(id);
      expect(el.props.accessibilityRole).toBe('link');
      const flat = Object.assign({}, ...[el.props.style].flat(3).filter(Boolean));
      expect(flat.minHeight).toBeGreaterThanOrEqual(44);
    }
  });
});

describe('azaltılmış hareket', () => {
  test('ilerleme çubuğu: azaltılmışta anında (withTiming yok); normalde 220 ms dolar', () => {
    const r = render(wrap(<ProgressBar index={1} total={14} />, { reduced: true }));
    timing.mockClear();
    r.rerender(wrap(<ProgressBar index={2} total={14} />, { reduced: true }));
    expect(timing).not.toHaveBeenCalled();
    const r2 = render(wrap(<ProgressBar index={1} total={14} />, { reduced: false }));
    timing.mockClear();
    r2.rerender(wrap(<ProgressBar index={2} total={14} />, { reduced: false }));
    expect(timing).toHaveBeenCalledWith(2 / 14, expect.objectContaining({ duration: 220 }));
  });

  test('segment: azaltılmışta seçili hap anında yer değiştirir', () => {
    const opts = [
      { key: 'a', label: 'A' },
      { key: 'b', label: 'B' },
    ] as const;
    const r = render(wrap(<Segment testID="s" label="S" width={200} value="a" onChange={() => {}} options={opts} />, { reduced: true }));
    timing.mockClear();
    r.rerender(wrap(<Segment testID="s" label="S" width={200} value="b" onChange={() => {}} options={opts} />, { reduced: true }));
    expect(timing).not.toHaveBeenCalled();
  });

  test('soru adımları: azaltılmışta adım değişimi animasyonsuz', async () => {
    mockParams = undefined;
    const r = render(wrap(<QuestionsScreen />, { reduced: true }));
    await flush();
    fireEvent.press(r.getByTestId('kayit-goal-lose'));
    timing.mockClear();
    await act(async () => {
      fireEvent.press(r.getByTestId('kayit-next'));
    });
    await flush();
    expect(useKayit.getState().step).toBe('gender');
    expect(timing).not.toHaveBeenCalled();
  });

  test('L1 maskotu: normalde 4–6 sn\'de göz kırpar; azaltılmışta sabit kalır', () => {
    const rnd = jest.spyOn(Math, 'random').mockReturnValue(0);
    try {
      const src = (r: ReturnType<typeof render>) => r.UNSAFE_getByType(Image).props.source;
      const calm = render(wrap(<Mascot blink />, { reduced: true }));
      const open = src(calm);
      act(() => {
        jest.advanceTimersByTime(4050);
      });
      expect(src(calm)).toBe(open);
      const live = render(wrap(<Mascot blink />, { reduced: false }));
      act(() => {
        jest.advanceTimersByTime(4050);
      });
      expect(src(live)).not.toBe(open);
    } finally {
      rnd.mockRestore();
    }
  });
});

test('seçim satırı: radyo, seçili = 2 pt lime (accentLine) kenar + zemin beyaz kalır', () => {
  const r = render(wrap(<OptionRow testID="o" label="Kilo vermek" selected onPress={() => {}} />));
  const el = r.getByTestId('o');
  expect(el.props.accessibilityRole).toBe('radio');
  expect(el.props.accessibilityState.checked).toBe(true);
  const flat = Object.assign({}, ...[el.props.style].flat(3).filter(Boolean));
  expect(flat.borderWidth).toBe(2);
  expect(flat.borderColor).toBe(K_LIGHT.accentLine);
  expect(flat.backgroundColor).toBe(K_LIGHT.surface);
});
