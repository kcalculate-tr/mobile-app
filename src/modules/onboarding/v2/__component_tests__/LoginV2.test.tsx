// G15-S1 (Ek karar) — Giriş v2: başarılı giriş, hatalı kod, sosyal iptal,
// geçersiz e-posta, 18+ onayı engeli; auth/supabase/navigasyon mock'lu.
import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockNav = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNav,
  useRoute: () => ({ params: undefined }),
}));

const mockAuth = {
  user: null as null | { id: string },
  signInWithOtp: jest.fn(),
  verifyEmailOtp: jest.fn(),
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
};
jest.mock('../../../../core/AuthContext', () => ({ useAuth: () => mockAuth }));

const mockResolve = jest.fn();
jest.mock('../../../../lib/postSocialAuth', () => ({ resolvePostSocialAuth: (p: unknown) => mockResolve(p) }));

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

async function mount(opts: { ageDone?: boolean } = {}) {
  await AsyncStorage.clear();
  if (opts.ageDone) await AsyncStorage.setItem('@kcal_age_18_confirmed', 'true');
  const utils = render(<LoginV2 />);
  await act(async () => {});
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.user = null;
  mockAuth.signInWithOtp.mockResolvedValue({ error: null });
  mockAuth.verifyEmailOtp.mockResolvedValue({ error: null });
});

describe('LoginV2', () => {
  test('geçersiz e-posta: kod gönderilmez, mesaj görünür', async () => {
    const { getByTestId, getByLabelText, findByText } = await mount({ ageDone: true });
    fireEvent.changeText(getByTestId('login-email-input'), 'abc');
    fireEvent.press(getByLabelText('Kod gönder'));
    expect(await findByText('Geçerli bir e-posta gir.')).toBeTruthy();
    expect(mockAuth.signInWithOtp).not.toHaveBeenCalled();
  });

  test('18+ onayı yokken kod gönderilmez', async () => {
    const { getByTestId, getByLabelText, findByText } = await mount();
    fireEvent.changeText(getByTestId('login-email-input'), 'a@b.co');
    fireEvent.press(getByLabelText('Kod gönder'));
    expect(await findByText('Devam etmek için 18 yaşından büyük olduğunu onayla.')).toBeTruthy();
    expect(mockAuth.signInWithOtp).not.toHaveBeenCalled();
  });

  test('başarılı giriş: kod gönder → doğru kod → Tabs/Home\'a replace', async () => {
    const { getByTestId, getByLabelText, findByTestId } = await mount({ ageDone: true });
    fireEvent.changeText(getByTestId('login-email-input'), 'a@b.co');
    fireEvent.press(getByLabelText('Kod gönder'));
    const codeInput = await findByTestId('login-code-input');
    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith('a@b.co');
    await act(async () => {
      fireEvent.changeText(codeInput, '123456');
    });
    await waitFor(() => expect(mockAuth.verifyEmailOtp).toHaveBeenCalledWith('a@b.co', '123456'));
    await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('Tabs', { screen: 'Home' }));
    expect(await AsyncStorage.getItem('@kcal_onboarding_done')).toBe('true');
  });

  test('hatalı kod: hata gösterilir, ilerlenmez', async () => {
    mockAuth.verifyEmailOtp.mockResolvedValue({ error: 'invalid' });
    const { getByTestId, getByLabelText, findByTestId, findByText } = await mount({ ageDone: true });
    fireEvent.changeText(getByTestId('login-email-input'), 'a@b.co');
    fireEvent.press(getByLabelText('Kod gönder'));
    const codeInput = await findByTestId('login-code-input');
    await act(async () => {
      fireEvent.changeText(codeInput, '000000');
    });
    expect(await findByText('Kod yanlış. Tekrar dene.')).toBeTruthy();
    expect(mockNav.replace).not.toHaveBeenCalled();
  });

  test('sosyal iptal: hata yok, yönlendirme yok', async () => {
    mockAuth.signInWithGoogle.mockResolvedValue({ error: null, cancelled: true });
    const { getByLabelText, queryByText } = await mount({ ageDone: true });
    await act(async () => {
      fireEvent.press(getByLabelText('Google ile devam et'));
    });
    expect(mockResolve).not.toHaveBeenCalled();
    expect(mockNav.replace).not.toHaveBeenCalled();
    expect(queryByText('Bir hata oluştu.')).toBeNull();
  });

  test('sosyal hata: mesaj görünür', async () => {
    mockAuth.signInWithGoogle.mockResolvedValue({ error: 'Google hatası' });
    const { getByLabelText, findByText } = await mount({ ageDone: true });
    await act(async () => {
      fireEvent.press(getByLabelText('Google ile devam et'));
    });
    expect(await findByText('Google hatası')).toBeTruthy();
  });

  test('sosyal başarı: resolvePostSocialAuth çağrılır, hedefe geçilir', async () => {
    mockAuth.signInWithGoogle.mockResolvedValue({ error: null, email: 'a@b.co' });
    mockResolve.mockResolvedValue({ outcome: 'returning_user' });
    const { getByLabelText } = await mount({ ageDone: true });
    await act(async () => {
      fireEvent.press(getByLabelText('Google ile devam et'));
    });
    await waitFor(() => expect(mockNav.replace).toHaveBeenCalledWith('Tabs', { screen: 'Home' }));
  });
});
