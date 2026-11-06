// G15-S1 (Ek karar) — Kcal AI kayıt v2: adımlar, sosyal iptal, kod hatası, handle
// hatası, Atla/geri; bayrak kapıyı (SignupAIGate) doğrular. Tümü mock'larla.
import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';

const mockAuth = {
  user: { id: 'u1' },
  signInWithApple: jest.fn(),
  signInWithGoogle: jest.fn(),
  signInWithOtp: jest.fn(),
  verifyEmailOtp: jest.fn(),
};
jest.mock('../../../../core/AuthContext', () => ({ useAuth: () => mockAuth }));

const mockFlags: Record<string, boolean> = { kesfet: true, yeni_onboarding: true };
jest.mock('../../../../core/flags', () => ({ useFeature: (k: string) => !!mockFlags[k] }));

const mockReg: any = {
  enabled: true,
  displayName: '',
  setDisplayName: jest.fn(),
  handle: { value: '', normalized: '', status: 'idle', messageKey: null, setValue: jest.fn() },
  submitting: false,
  error: null,
  canSubmit: true,
  submit: jest.fn(),
};
jest.mock('../../../profil/useRegistration', () => ({ useKcalculateAiRegistration: () => mockReg }));

const mockUpdateProfile = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../profil/client', () => ({
  getProfilClient: () => ({ updatePublicProfile: mockUpdateProfile }),
}));
jest.mock('../../../profil/avatarUpload', () => ({ pickAndUploadAvatar: jest.fn().mockResolvedValue(null) }));

let mockHasHandle = false;
jest.mock('../../../../core/supabase', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: mockHasHandle ? { handle: 'ilter' } : null }) }),
      }),
    }),
  }),
}));
jest.mock('react-native-safe-area-context', () => {
  const R = jest.requireActual('react');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    useSafeAreaInsets: () => insets,
    SafeAreaView: ({ children }: { children?: React.ReactNode }) => R.createElement(R.Fragment, null, children),
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => R.createElement(R.Fragment, null, children),
  };
});
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

// Gate testi için: eski rota ve navigasyon.
jest.mock('../../../profil/ui/signup/KcalAiSignUpRoute', () => {
  const { Text } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <Text>ESKI_KAYIT</Text> };
});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ replace: jest.fn(), goBack: jest.fn() }),
}));

import SignupAIFlowV2 from '../SignupAIFlowV2';
import SignupAIGate from '../SignupAIGate';

const flush = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
  jest.clearAllMocks();
  mockHasHandle = false;
  mockReg.canSubmit = true;
  mockReg.error = null;
  mockReg.submit.mockResolvedValue({ ok: true, startTracking: false });
});

function open(props: Partial<React.ComponentProps<typeof SignupAIFlowV2>> = {}) {
  const onDone = jest.fn();
  const onBack = jest.fn();
  const r = render(<SignupAIFlowV2 onDone={onDone} onBack={onBack} {...props} />);
  return { ...r, onDone, onBack };
}

test('Apple girişi → handle yoksa ad+kullanıcı adı adımı', async () => {
  mockAuth.signInWithApple.mockResolvedValue({ error: null });
  const { getByText, findByText } = open();
  await act(async () => { fireEvent.press(getByText('Apple ile devam et')); });
  expect(await findByText('Seni nasıl tanısınlar?')).toBeTruthy();
});

test('zaten handle varsa doğrudan onDone', async () => {
  mockHasHandle = true;
  mockAuth.signInWithGoogle.mockResolvedValue({ error: null });
  const { getByText, onDone } = open();
  await act(async () => { fireEvent.press(getByText('Google ile devam et')); });
  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
});

test('sosyal iptal: adım değişmez, hata yok', async () => {
  mockAuth.signInWithApple.mockResolvedValue({ cancelled: true, error: null });
  const { getByText, queryByText, onDone } = open();
  await act(async () => { fireEvent.press(getByText('Apple ile devam et')); });
  await flush();
  expect(queryByText('Seni nasıl tanısınlar?')).toBeNull();
  expect(getByText('Apple ile devam et')).toBeTruthy();
  expect(onDone).not.toHaveBeenCalled();
});

test('sosyal hata mesajı gösterilir', async () => {
  mockAuth.signInWithGoogle.mockResolvedValue({ error: 'ağ hatası' });
  const { getByText, findByText } = open();
  await act(async () => { fireEvent.press(getByText('Google ile devam et')); });
  expect(await findByText('ağ hatası')).toBeTruthy();
});

test('e-posta → kod adımı; yanlış kod hata verir, doğru kod handle adımına geçer', async () => {
  mockAuth.signInWithOtp.mockResolvedValue({ error: null });
  mockAuth.verifyEmailOtp.mockResolvedValueOnce({ error: 'bad' }).mockResolvedValueOnce({ error: null });
  const { getByText, getByPlaceholderText, findByText } = open();
  fireEvent.press(getByText('E-posta ile devam et'));
  fireEvent.changeText(getByPlaceholderText('ornek@eposta.com'), 'a@b.co');
  await act(async () => { fireEvent.press(getByText('Devam')); });
  expect(await findByText('Kodunu gönderdik.')).toBeTruthy();

  await act(async () => { fireEvent.changeText(getByPlaceholderText('000000'), '123456'); });
  expect(await findByText('Kod yanlış. Tekrar dene.')).toBeTruthy();

  await act(async () => { fireEvent.changeText(getByPlaceholderText('000000'), '654321'); });
  expect(await findByText('Seni nasıl tanısınlar?')).toBeTruthy();
});

test('geçersiz e-posta kod göndermez', async () => {
  const { getByText, getByPlaceholderText, findByText } = open();
  fireEvent.press(getByText('E-posta ile devam et'));
  fireEvent.changeText(getByPlaceholderText('ornek@eposta.com'), 'yanlis');
  await act(async () => { fireEvent.press(getByText('Devam')); });
  expect(await findByText('Geçerli bir e-posta gir.')).toBeTruthy();
  expect(mockAuth.signInWithOtp).not.toHaveBeenCalled();
});

test('handle adımı: submit başarılı → profil adımı; Keşfet\'e geç profili kaydeder ve bitirir', async () => {
  const { getByText, findByText, onDone } = open({ vitrinStep: 'handle' });
  await act(async () => { fireEvent.press(getByText('Devam')); });
  expect(await findByText('Profilini tamamla')).toBeTruthy();
  await act(async () => { fireEvent.press(getByText('Keşfet’e geç')); });
  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  expect(mockUpdateProfile).toHaveBeenCalledWith({ displayName: '', bio: null, avatarUrl: null });
});

test('handle submit başarısızsa profil adımına geçmez', async () => {
  mockReg.submit.mockResolvedValue({ ok: false, startTracking: false });
  const { getByText, queryByText } = open({ vitrinStep: 'handle' });
  await act(async () => { fireEvent.press(getByText('Devam')); });
  await flush();
  expect(queryByText('Profilini tamamla')).toBeNull();
  expect(getByText('Seni nasıl tanısınlar?')).toBeTruthy();
});

test('profil adımında Atla kaydetmeden bitirir', async () => {
  const { getByText, onDone } = open({ vitrinStep: 'profile' });
  await act(async () => { fireEvent.press(getByText('Atla')); });
  await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
  expect(mockUpdateProfile).not.toHaveBeenCalled();
});

test('geri: handle → karşılama; karşılama/profil → onBack', async () => {
  const a = open({ vitrinStep: 'handle' });
  fireEvent.press(a.getByLabelText('Geri'));
  expect(a.getByText('Apple ile devam et')).toBeTruthy();
  a.unmount();
  const b = open({ vitrinStep: 'profile' });
  fireEvent.press(b.getByLabelText('Geri'));
  expect(b.onBack).toHaveBeenCalledTimes(1);
});

test('kesfet bayrağı kapalıysa hiçbir şey çizmez', () => {
  mockReg.enabled = false;
  const { toJSON } = open();
  expect(toJSON()).toBeNull();
  mockReg.enabled = true;
});

test('Gate: yeni_onboarding kapalı → eski rota, açık → v2', () => {
  mockFlags.yeni_onboarding = false;
  const off = render(<SignupAIGate />);
  expect(off.getByText('ESKI_KAYIT')).toBeTruthy();
  off.unmount();
  mockFlags.yeni_onboarding = true;
  const on = render(<SignupAIGate />);
  expect(on.queryByText('ESKI_KAYIT')).toBeNull();
  expect(on.getByText('Apple ile devam et')).toBeTruthy();
});
