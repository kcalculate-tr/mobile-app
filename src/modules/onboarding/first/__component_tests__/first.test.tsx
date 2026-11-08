// G18-S1 — ilk 60 saniye bileşen testleri: e-posta sheet'i (auth çağrıları AYNEN),
// profil kartı (kapat → kalıcı + oryantasyon başlar), kutlama (gerçek kcal), ipucu
// (hedef kaydolunca balon, Sonraki/Atla), boş hâl (demo kart yazmaz), açılış (Atla).
import React from 'react';
import { View } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let mockFlags: Record<string, boolean> = { yeni_onboarding: true };
jest.mock('../../../../core/flags', () => ({ useFeature: (k: string) => mockFlags[k] === true }));

const mockAuth = {
  user: { id: 'u1' } as null | { id: string },
  signInWithOtp: jest.fn(),
  verifyEmailOtp: jest.fn(),
};
jest.mock('../../../../core/AuthContext', () => ({ useAuth: () => mockAuth }));

const mockNav = { navigate: jest.fn(), goBack: jest.fn() };
jest.mock('@react-navigation/native', () => {
  const R = jest.requireActual('react');
  return {
    useNavigation: () => mockNav,
    useRoute: () => ({ params: undefined }),
    useFocusEffect: (cb: () => void | (() => void)) => R.useEffect(cb, [cb]),
  };
});
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  return { useSafeAreaInsets: () => insets };
});
jest.mock('expo-blur', () => ({ BlurView: () => null }));

import { AccountEmailSheet } from '../AccountEmailSheet';
import { ProfileCard } from '../ProfileCard';
import { CelebrateProfile } from '../CelebrateProfile';
import { HomeEmptyR1 } from '../HomeEmptyR1';
import { OpenSignature, __resetOpenSignature } from '../OpenSignature';
import { OrientHost } from '../orient/OrientHost';
import { useOrientTarget } from '../orient/useOrientTarget';
import { useOnbFirst, OPEN_SEEN_KEY, ONB_FIRST_KEY } from '../store';

beforeEach(async () => {
  jest.clearAllMocks();
  mockFlags = { yeni_onboarding: true };
  mockAuth.signInWithOtp.mockResolvedValue({ error: null });
  mockAuth.verifyEmailOtp.mockResolvedValue({ error: null });
  await AsyncStorage.clear();
  useOnbFirst.getState()._reset();
});

describe('AccountEmailSheet (FinOnbAccountEmail)', () => {
  test('geçersiz e-posta → kod gönderilmez; geçerli → signInWithOtp, kod adımı → verifyEmailOtp → onVerified', async () => {
    const onVerified = jest.fn();
    const ui = render(<AccountEmailSheet visible onClose={() => {}} onVerified={onVerified} />);
    fireEvent.changeText(ui.getByTestId('fin-onb-email-input'), 'yanlis');
    await act(async () => fireEvent.press(ui.getByText('Kod gönder')));
    expect(mockAuth.signInWithOtp).not.toHaveBeenCalled();
    expect(ui.getByText('Geçerli bir e-posta gir.')).toBeTruthy();

    fireEvent.changeText(ui.getByTestId('fin-onb-email-input'), ' ad@ornek.com ');
    await act(async () => fireEvent.press(ui.getByText('Kod gönder')));
    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith('ad@ornek.com');
    expect(ui.getByText('Kod gönderildi. E-postana gelen kodu gir.')).toBeTruthy();

    fireEvent.changeText(ui.getByTestId('fin-onb-email-code'), '12a3456');
    await act(async () => fireEvent.press(ui.getByText('Doğrula ve devam et')));
    expect(mockAuth.verifyEmailOtp).toHaveBeenCalledWith('ad@ornek.com', '123456');
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  test('yanlış kod → hata, onVerified yok; "E-postayı değiştir" forma döner', async () => {
    mockAuth.verifyEmailOtp.mockResolvedValue({ error: 'invalid' });
    const onVerified = jest.fn();
    const ui = render(<AccountEmailSheet visible onClose={() => {}} onVerified={onVerified} />);
    fireEvent.changeText(ui.getByTestId('fin-onb-email-input'), 'ad@ornek.com');
    await act(async () => fireEvent.press(ui.getByText('Kod gönder')));
    fireEvent.changeText(ui.getByTestId('fin-onb-email-code'), '000000');
    await act(async () => fireEvent.press(ui.getByText('Doğrula ve devam et')));
    expect(onVerified).not.toHaveBeenCalled();
    expect(ui.getByText('Kod yanlış. Tekrar dene.')).toBeTruthy();
    fireEvent.press(ui.getByText('E-postayı değiştir'));
    expect(ui.getByTestId('fin-onb-email-input')).toBeTruthy();
  });
});

describe('Profil kartı + Profil hazır', () => {
  test('X → onDismiss (kapanış animasyonu sonrası)', async () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    const ui = render(<ProfileCard onCreate={() => {}} onDismiss={onDismiss} />);
    fireEvent.press(ui.getByTestId('fin-home-profile-card-close'));
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    jest.useRealTimers();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  test('kart durumu kalıcı (AsyncStorage) ve oryantasyon başlar', async () => {
    const s = useOnbFirst.getState();
    s.setCard('dismissed');
    s.startOrient();
    const raw = JSON.parse((await AsyncStorage.getItem(ONB_FIRST_KEY)) ?? '{}');
    expect(raw.profileCard).toBe('dismissed');
    expect(raw.orient.started).toBe(true);
  });

  test('Profil hazır: gerçek hedef kcal gösterilir; hedef yoksa sayı yok', () => {
    const a = render(<CelebrateProfile visible kcal={2180} onDone={() => {}} />);
    expect(a.getByText('Günlük hedefin 2.180 kcal. Şimdi uygulamayı dört kısa ipucuyla tanıyalım.')).toBeTruthy();
    a.unmount();
    const b = render(<CelebrateProfile visible kcal={null} onDone={() => {}} />);
    expect(b.queryByText(/kcal\. Şimdi/)).toBeNull();
    expect(b.getByText('Şimdi uygulamayı dört kısa ipucuyla tanıyalım.')).toBeTruthy();
  });
});

function ScanTarget() {
  return <View {...useOrientTarget('scan')} testID="target" />;
}

describe('Oryantasyon (FinOrient1)', () => {
  test('başlamadıysa ipucu yok; başlayınca hedef ölçülür → 1/4 balonu; Sonraki → adım 1 görüldü', async () => {
    jest.useFakeTimers();
    jest
      .spyOn(View.prototype as unknown as { measureInWindow: (cb: (...a: number[]) => void) => void }, 'measureInWindow')
      .mockImplementation(function (cb: (...a: number[]) => void) {
        cb(314, 765, 62, 62);
      });
    useOnbFirst.setState({ hydrated: true, userId: 'u1' });
    const ui = render(
      <>
        <ScanTarget />
        <OrientHost />
      </>,
    );
    await act(async () => {
      jest.advanceTimersByTime(800);
    });
    expect(ui.queryByTestId('fin-orient-1')).toBeNull();
    await act(async () => {
      useOnbFirst.getState().startOrient();
    });
    await act(async () => {
      jest.advanceTimersByTime(800);
    });
    expect(ui.getByTestId('fin-orient-1')).toBeTruthy();
    expect(ui.getByText('Tabağını tara')).toBeTruthy();
    expect(ui.getByText('1/4')).toBeTruthy();
    fireEvent.press(ui.getByTestId('fin-orient-next'));
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    jest.useRealTimers();
    expect(useOnbFirst.getState().synced.orient.seen[1]).toBe(true);
  });

  test('bayrak kapalı: hedef kancası prop eklemez, ipucu çizilmez', async () => {
    mockFlags = {};
    useOnbFirst.setState({ hydrated: true, synced: { profileCard: 'open', orient: { started: true, skipped: false, seen: { 1: false, 2: false, 3: false, 4: false } } } });
    const ui = render(
      <>
        <ScanTarget />
        <OrientHost />
      </>,
    );
    await act(async () => {});
    expect(ui.getByTestId('target').props.collapsable).toBeUndefined();
    expect(ui.queryByTestId('fin-orient-1')).toBeNull();
  });
});

describe('Boş hâl (FinHomeEmptyR1)', () => {
  test('hedef yok → "Hedef belirlenmedi"; Tara/Elle gir çağrılır; demo kart dokunulamaz', () => {
    const onScan = jest.fn();
    const onManual = jest.fn();
    const ui = render(<HomeEmptyR1 hasTarget={false} onScan={onScan} onManual={onManual} />);
    expect(ui.getByText('Hedef belirlenmedi')).toBeTruthy();
    fireEvent.press(ui.getByText('Tara'));
    fireEvent.press(ui.getByText('Elle gir'));
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onManual).toHaveBeenCalledTimes(1);
    expect(ui.getByText('Peynirli omlet')).toBeTruthy();
    expect(ui.getByTestId('fin-home-demo').props.onPress).toBeUndefined();
  });
});

describe('Açılış imzası (FinOpen)', () => {
  test('ilk açılış: oynar ve görüldü kaydedilir; Atla ilk kareden var', async () => {
    __resetOpenSignature();
    const ui = render(<OpenSignature />);
    await act(async () => {});
    expect(ui.getByTestId('fin-open-skip')).toBeTruthy();
    expect(await AsyncStorage.getItem(OPEN_SEEN_KEY)).toBe('true');
  });
});
