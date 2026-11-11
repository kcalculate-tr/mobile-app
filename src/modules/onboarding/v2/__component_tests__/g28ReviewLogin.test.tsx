// G28-S1 md.5 — inceleme girişi: apple@ / review@inceleme.eatkcal.com yazılınca "Şifreyle giriş"
// alanı açılır (signInWithPassword); diğer herkes için kod (OTP) akışı aynı.
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockNav = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNav,
  useRoute: () => ({ params: undefined }),
}));

const mockAuth = {
  user: null as null | { id: string },
  signIn: jest.fn(),
  signInWithOtp: jest.fn(),
  verifyEmailOtp: jest.fn(),
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
};
jest.mock('../../../../core/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../../../lib/postSocialAuth', () => ({ resolvePostSocialAuth: jest.fn() }));
jest.mock('../../../../core/supabase', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: 'u1' }, error: null }) }) }),
    }),
  }),
}));
jest.mock('react-native-safe-area-context', () => {
  const R = jest.requireActual('react');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    useSafeAreaInsets: () => insets,
    SafeAreaView: ({ children }: { children?: React.ReactNode }) => R.createElement(R.Fragment, null, children),
  };
});

import LoginV2 from '../LoginV2';

async function mount() {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('@kcal_age_18_confirmed', 'true');
  await AsyncStorage.setItem('@kcal_onboarding_done', 'true');
  const utils = render(<LoginV2 />);
  await act(async () => {});
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.user = null;
  mockAuth.signIn.mockResolvedValue({ error: null });
  mockAuth.signInWithOtp.mockResolvedValue({ error: null });
});

test('normal e-posta: şifre alanı YOK, "Kod gönder" OTP gönderir', async () => {
  const ui = await mount();
  fireEvent.changeText(ui.getByTestId('login-email-input'), 'a@b.co');
  expect(ui.queryByTestId('login-review-password')).toBeNull();
  await act(async () => {
    fireEvent.press(ui.getByLabelText('Kod gönder'));
  });
  expect(mockAuth.signInWithOtp).toHaveBeenCalledWith('a@b.co');
  expect(mockAuth.signIn).not.toHaveBeenCalled();
});

test.each(['apple@inceleme.eatkcal.com', ' Review@Inceleme.eatkcal.com '])(
  'inceleme adresi (%s): şifre alanı açılır, kod GÖNDERİLMEZ, signInWithPassword çağrılır',
  async (addr) => {
    const ui = await mount();
    fireEvent.changeText(ui.getByTestId('login-email-input'), addr);
    expect(ui.getByTestId('login-review-password')).toBeTruthy();
    expect(ui.queryByLabelText('Kod gönder')).toBeNull();
    fireEvent.changeText(ui.getByTestId('login-review-password'), 'pw-from-test');
    await act(async () => {
      fireEvent.press(ui.getByTestId('login-review-submit'));
    });
    expect(mockAuth.signIn).toHaveBeenCalledWith(addr.trim().toLowerCase(), 'pw-from-test');
    expect(mockAuth.signInWithOtp).not.toHaveBeenCalled();
    expect(mockNav.replace).toHaveBeenCalled();
  },
);

test('yanlış şifre: hata görünür, gezinme yok', async () => {
  mockAuth.signIn.mockResolvedValue({ error: 'Invalid login credentials' });
  const ui = await mount();
  fireEvent.changeText(ui.getByTestId('login-email-input'), 'apple@inceleme.eatkcal.com');
  fireEvent.changeText(ui.getByTestId('login-review-password'), 'x');
  await act(async () => {
    fireEvent.press(ui.getByTestId('login-review-submit'));
  });
  expect(ui.getByText('E-posta ya da şifre yanlış.')).toBeTruthy();
  expect(mockNav.replace).not.toHaveBeenCalled();
});

test('adres değişince şifre alanı kapanır', async () => {
  const ui = await mount();
  fireEvent.changeText(ui.getByTestId('login-email-input'), 'apple@inceleme.eatkcal.com');
  expect(ui.getByTestId('login-review-password')).toBeTruthy();
  fireEvent.changeText(ui.getByTestId('login-email-input'), 'apple@inceleme.eatkcal.co');
  expect(ui.queryByTestId('login-review-password')).toBeNull();
});
