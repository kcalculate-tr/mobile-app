// G54-S1 md.4 — kayıt soruları: mutfak kartları (görsel yokken degrade, çoklu seçim, sayaç, Fark etmez) ve
// yemediklerin (gruplar, arama, özel öğe ekleme/çıkarma, Hepsini yerim karşılıklı temizleme).
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets, SafeAreaView: ({ children }: { children: React.ReactNode }) => children };
});
const mockFlags: Record<string, boolean> = { yeni_kayit: true, kisisel_plan: true, kesfet: true };
jest.mock('../../../core/flags', () => ({ __esModule: true, useFeature: (k: string) => !!mockFlags[k] }));
let mockUser: { id: string } | null = null;
jest.mock('../../../core/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, signInWithApple: jest.fn(), signInWithGoogle: jest.fn(), signInWithOtp: jest.fn(async () => ({ error: null })), verifyEmailOtp: jest.fn(async () => ({ error: null })), signIn: jest.fn() }),
}));
jest.mock('@react-native-community/netinfo', () => ({ __esModule: true, default: { fetch: () => Promise.resolve({ isConnected: true }) } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ regionCode: 'TR' }] }));
jest.mock('../../../lib/consent/metaConsent', () => ({ requestMetaOptIn: jest.fn(async () => ({ granted: false, att: 'denied' })) }));
jest.mock('../../personalPlan/api', () => ({ healthConsentGiven: jest.fn(async () => false), savePlan: jest.fn(async () => ({ ok: true })) }));
jest.mock('../../onboarding/takibe/save', () => ({ saveTakibeProfile: jest.fn(async () => ({ ok: true })) }));
jest.mock('../../personalPlan/ui/entries', () => ({ usePersonalPlanEntry: () => ({ enabled: true, hasPlan: false, loaded: true }), useOpenPersonalPlan: () => jest.fn() }));

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), replace: jest.fn(), reset: jest.fn(), canGoBack: () => true, getParent: () => mockNav };
let mockParams: Record<string, unknown> | undefined;
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => mockNav, useRoute: () => ({ params: mockParams }), useFocusEffect: (cb: () => void) => jest.requireActual('react').useEffect(cb, []) };
});

import { I18nProvider } from '../../../core/i18n';
import { ThemeProvider } from '../../../core/design/ThemeProvider';
import QuestionsScreen from '../screens/QuestionsScreen';
import { useKayit } from '../store';
import { emptyKAnswers, type KAnswers } from '../model';
import { __sent } from '../events';
import { CUSTOM_PREFIX } from '../foods';

const wrap = (el: React.ReactElement, lang: 'tr' | 'en' = 'tr', scheme: 'light' | 'dark' = 'light') => (
  <ThemeProvider forceScheme={scheme}>
    <I18nProvider forceLang={lang}>{el}</I18nProvider>
  </ThemeProvider>
);
const flush = async () => {
  for (let i = 0; i < 4; i++) await act(async () => {});
};
const answers = (o: Partial<KAnswers> = {}): KAnswers => ({ ...emptyKAnswers(), goal: 'lose', gender: 'female', birthYear: 1995, heightCm: 170, weightKg: 72, targetWeightKg: 66, pace: 0.5, activity: 'light', diet: 'all', ...o });

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = undefined;
  await AsyncStorage.clear();
  useKayit.getState().reset();
  __sent.length = 0;
});

describe('G54 md.4b "Hangi mutfakları seversin?"', () => {
  test.each([
    ['tr', 'light'],
    ['en', 'dark'],
  ] as const)('%s/%s: başlık + alt metin; 18 büyük kart (ikon yok), görsel yokken degrade; çoklu seçim + "3 seçildi"', async (lang, scheme) => {
    useKayit.getState().patch(answers());
    mockParams = { vitrinStep: 'cuisines' };
    const r = render(wrap(<QuestionsScreen />, lang, scheme));
    await flush();
    expect(r.getByText(lang === 'tr' ? 'Hangi mutfakları seversin?' : 'Which cuisines do you love?')).toBeTruthy();
    expect(r.getByText(lang === 'tr' ? 'Birden fazla seçebilirsin.' : 'You can pick more than one.')).toBeTruthy();
    for (const k of ['turk', 'akdeniz', 'japon', 'balkan']) expect(r.getByTestId(`kayit-cuisine-${k}-gradient`)).toBeTruthy();
    expect(r.queryAllByTestId(/kayit-cuisine-[a-z]+-img$/)).toHaveLength(0);
    for (const k of ['turk', 'ege', 'japon']) fireEvent.press(r.getByTestId(`kayit-cuisine-${k}`));
    await flush();
    expect(useKayit.getState().answers.cuisines).toEqual(['turk', 'ege', 'japon']);
    expect(r.getByTestId('kayit-cuisines-count')).toHaveTextContent(lang === 'tr' ? '3 seçildi' : '3 selected');
    expect(r.getByTestId('kayit-cuisine-ege').props.accessibilityState).toMatchObject({ checked: true });
    fireEvent.press(r.getByTestId('kayit-cuisine-ege'));
    await flush();
    expect(useKayit.getState().answers.cuisines).toEqual(['turk', 'japon']);
  });

  test('"Fark etmez" → seçim temizlenir, I2 ara ekranına geçer; ölçüm reg_q_answer q=cuisines', async () => {
    useKayit.getState().patch(answers({ cuisines: ['hint'] }));
    mockParams = { vitrinStep: 'cuisines' };
    const r = render(wrap(<QuestionsScreen />));
    await flush();
    fireEvent.press(r.getByTestId('kayit-cuisines-none'));
    await flush();
    expect(useKayit.getState().answers.cuisines).toEqual([]);
    expect(useKayit.getState().step).toBe('i2');
    expect(__sent).toContainEqual({ name: 'reg_q_answer', props: { q: 'cuisines', path: 'a' } });
  });

  test('"Nasıl beslenirsin" → Devam → mutfaklar', async () => {
    useKayit.getState().patch(answers());
    mockParams = { vitrinStep: 'diet' };
    const r = render(wrap(<QuestionsScreen />));
    await flush();
    fireEvent.press(r.getByTestId('kayit-next'));
    await flush();
    expect(useKayit.getState().step).toBe('cuisines');
  });
});

describe('G54 md.4a "Yemediğin bir şey var mı?"', () => {
  const open = async () => {
    useKayit.getState().patch(answers());
    mockParams = { vitrinStep: 'dislikes' };
    const r = render(wrap(<QuestionsScreen />));
    await flush();
    return r;
  };
  test('gruplu çipler (9 grup); seçilen en üstte "Seçtiklerin" satırında, × ile çıkar', async () => {
    const r = await open();
    for (const g of ['meat', 'sea', 'dairy_egg', 'grain', 'legume_nut', 'veg', 'fruit', 'taste', 'other']) expect(r.getByTestId(`kayit-dislike-group-${g}`)).toBeTruthy();
    expect(r.getByText('Et ve tavuk')).toBeTruthy();
    fireEvent.press(r.getByTestId('kayit-dislike-okra'));
    await flush();
    expect(useKayit.getState().answers.dislikes).toEqual(['okra']);
    expect(r.getByTestId('kayit-dislike-selected')).toBeTruthy();
    expect(r.queryByTestId('kayit-dislike-okra')).toBeNull();
    fireEvent.press(r.getByTestId('kayit-dislike-sel-okra'));
    await flush();
    expect(useKayit.getState().answers.dislikes).toEqual([]);
  });
  test('"Besin ara" gerçekten arar (TR/EN öneri satırları); listede yoksa "‘…’ ekle" → özel çip, × ile çıkar', async () => {
    const r = await open();
    fireEvent.changeText(r.getByTestId('kayit-dislike-search'), 'somo');
    await flush();
    fireEvent.press(r.getByTestId('kayit-dislike-hit-salmon'));
    await flush();
    expect(useKayit.getState().answers.dislikes).toEqual(['salmon']);
    fireEvent.changeText(r.getByTestId('kayit-dislike-search'), 'Ejder meyvesi');
    await flush();
    expect(r.getByTestId('kayit-dislike-add')).toHaveTextContent('‘Ejder meyvesi’ ekle');
    fireEvent.press(r.getByTestId('kayit-dislike-add'));
    await flush();
    expect(useKayit.getState().answers.dislikes).toEqual(['salmon', `${CUSTOM_PREFIX}Ejder meyvesi`]);
    expect(r.getByText('Ejder meyvesi')).toBeTruthy();
    fireEvent.press(r.getByTestId('kayit-dislike-sel-custom'));
    await flush();
    expect(useKayit.getState().answers.dislikes).toEqual(['salmon']);
  });
  test('"Hepsini yerim" diğer seçimleri temizler; sonra bir besin seçilince "Hepsini yerim" kalkar', async () => {
    const r = await open();
    fireEvent.press(r.getByTestId('kayit-dislike-onion'));
    await flush();
    fireEvent.press(r.getByTestId('kayit-eats-all'));
    await flush();
    expect(useKayit.getState().answers).toMatchObject({ dislikes: [], eatsAll: true });
    fireEvent.press(r.getByTestId('kayit-dislike-garlic'));
    await flush();
    expect(useKayit.getState().answers).toMatchObject({ dislikes: ['garlic'], eatsAll: false });
  });
});
