// G21-S1 md.10 — klavye altında kalan katmanlar (tekrar eden hata, ÖNCELİKLİ).
// Her giriş alanlı katman için: klavye açılınca katman klavyenin ÜSTÜNE kalkar
// (kalkma = kap alt kenarı − klavye üst kenarı), kaydırma alanı
// keyboardShouldPersistTaps="handled" taşır, klavye kapanınca yerine döner;
// Android'de pencere zaten küçüldüyse (adjustResize) ÇİFT kaldırma yok.
import React from 'react';
import { Keyboard, StyleSheet } from 'react-native';
import { act, fireEvent, render as rtlRender } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ReducedMotionProvider, Sheet, AppText } from '../../index';
import { KeyboardLiftView } from '../KeyboardLiftView';
import { keyboardLift, keyboardTopFromEvent, sheetMaxHeight, SHEET_KEYBOARD_EVENTS, SHEET_TOP_GAP } from '../../keyboard';

jest.mock('../../../../lib/offers', () => ({
  fetchAvailableCampaigns: jest.fn(async () => []),
  validateCoupon: jest.fn(async () => ({ valid: false, error: 'not_found' })),
  getCouponErrorMessage: () => 'Kupon bulunamadı',
}));
jest.mock('../../../../modules/eatkcal/v2/ui/gate/waitlistSend', () => ({
  submitWaitlist: jest.fn(async () => {}),
  flushWaitlistQueue: jest.fn(async () => {}),
}));
jest.mock('../../../../lib/banners', () => ({ fetchBannerRows: jest.fn(async () => ({ hero: [] })) }));
jest.mock('../../../../core/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
// Sağlayıcısız useT her çağrıda yeni `t` döndürür (FinPrCoupons `load` bağımlılığı
// → sonsuz yükleme); uygulamada I18nProvider var. Testte kimliği sabit çeviri.
jest.mock('../../../../core/i18n', () => {
  const actual = jest.requireActual('../../../../core/i18n');
  const stable = {
    lang: 'tr',
    ready: true,
    setLang: () => {},
    t: (k: string, p?: Record<string, unknown>) => actual.translate('tr', k, p),
    fmt: (v: number, o?: unknown) => actual.formatNumber('tr', v, o),
  };
  return { ...actual, useT: () => stable };
});
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }) };
});

const SCREEN_H = 844;
const KB_H = 336;
const METRICS = { frame: { x: 0, y: 0, width: 390, height: SCREEN_H }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

// Azaltılmış hareket: kayma anında (setValue) uygulanır → değerler eşzamanlı okunur.
function render(ui: React.ReactElement) {
  return rtlRender(
    <SafeAreaProvider initialMetrics={METRICS}>
      <ReducedMotionProvider value>{ui}</ReducedMotionProvider>
    </SafeAreaProvider>,
  );
}

// Keyboard olaylarını yakala (her dinleyici ayrı; kaldırınca düşer).
let handlers: Record<string, ((e: unknown) => void)[]> = {};
beforeEach(() => {
  handlers = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((evt: string, cb: (e: unknown) => void) => {
    (handlers[evt] ??= []).push(cb);
    return {
      remove: () => {
        handlers[evt] = (handlers[evt] ?? []).filter((f) => f !== cb);
      },
    };
  }) as never);
  jest.spyOn(Keyboard, 'metrics').mockReturnValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

function emit(evt: string, e: unknown) {
  act(() => {
    (handlers[evt] ?? []).slice().forEach((f) => f(e));
  });
}
const showKeyboard = (h = KB_H) =>
  emit(SHEET_KEYBOARD_EVENTS.show, { endCoordinates: { height: h, screenY: SCREEN_H - h, screenX: 0, width: 390 }, duration: 250 });
const hideKeyboard = () =>
  emit(SHEET_KEYBOARD_EVENTS.hide, { endCoordinates: { height: 0, screenY: SCREEN_H, screenX: 0, width: 390 }, duration: 250 });
function layout(node: Parameters<typeof fireEvent>[0], height = SCREEN_H, y = 0) {
  act(() => {
    fireEvent(node, 'layout', { nativeEvent: { layout: { x: 0, y, width: 390, height } } });
  });
}
function translateY(node: { props: { style?: unknown } }): number {
  const flat = StyleSheet.flatten(node.props.style as never) as { transform?: { translateY?: number }[] } | undefined;
  const tr = (flat?.transform ?? []).find((x) => x.translateY != null);
  return Number(tr?.translateY ?? 0) + 0; // -0 → 0
}
const style = (node: { props: { style?: unknown } }) => (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;

describe('saf hesap (core/design/keyboard)', () => {
  test('kalkma = kap alt − klavye üst; kapalı/küçülmüş pencere → 0', () => {
    expect(keyboardLift(844, 508)).toBe(336);
    expect(keyboardLift(844, null)).toBe(0);
    expect(keyboardLift(508, 508)).toBe(0); // Android adjustResize: pencere zaten küçüldü
    expect(keyboardLift(500, 508)).toBe(0);
  });
  test('klavye üstü: screenY yoksa pencere − yükseklik; yükseklik 0 → kapalı', () => {
    expect(keyboardTopFromEvent({ endCoordinates: { height: 300, screenY: 544, screenX: 0, width: 390 } }, 844)).toBe(544);
    expect(keyboardTopFromEvent({ endCoordinates: { height: 300, screenY: 0, screenX: 0, width: 390 } }, 844)).toBe(544);
    expect(keyboardTopFromEvent({ endCoordinates: { height: 0, screenY: 844, screenX: 0, width: 390 } }, 844)).toBeNull();
  });
  test('yükseklik sınırı: klavye açıkken ekran − klavye − üst boşluk', () => {
    expect(sheetMaxHeight(844, 0.9, 0)).toBeCloseTo(759.6);
    expect(sheetMaxHeight(844, 0.85, 336)).toBe(844 - 336 - SHEET_TOP_GAP);
  });
  test('iOS "will" olayları (klavyeyle aynı anda)', () => {
    expect(SHEET_KEYBOARD_EVENTS).toEqual({ show: 'keyboardWillShow', hide: 'keyboardWillHide' });
  });
});

describe('ortak Sheet (core/design) — bütün Sheet tabanlı katmanlar', () => {
  test('klavye açılınca katman klavye kadar kalkar, yükseklik sınırlanır, kapanınca döner', () => {
    const r = render(
      <Sheet visible title="Katman" onClose={() => {}} scroll testID="t-sheet">
        <AppText>İçerik</AppText>
      </Sheet>,
    );
    layout(r.getByTestId('t-sheet-root'));
    const sheet = r.getByLabelText('Katman');
    expect(translateY(sheet)).toBe(0);
    showKeyboard();
    expect(translateY(r.getByLabelText('Katman'))).toBe(-KB_H);
    expect(style(r.getByLabelText('Katman')).maxHeight).toBe(SCREEN_H - KB_H - SHEET_TOP_GAP);
    hideKeyboard();
    expect(translateY(r.getByLabelText('Katman'))).toBe(0);
    expect(style(r.getByLabelText('Katman')).maxHeight).toBeCloseTo(SCREEN_H * 0.9);
  });

  test('scroll gövdesi keyboardShouldPersistTaps="handled" + küçülebilir', () => {
    const r = render(
      <Sheet visible title="Katman" onClose={() => {}} scroll testID="t-sheet">
        <AppText>İçerik</AppText>
      </Sheet>,
    );
    const sv = r.getByTestId('t-sheet-scroll');
    expect(sv.props.keyboardShouldPersistTaps).toBe('handled');
    expect(style(sv).flexShrink).toBe(1);
  });

  test('Android: pencere zaten küçüldüyse (onLayout küçük) çift kaldırma yok', () => {
    const r = render(
      <Sheet visible title="Katman" onClose={() => {}} testID="t-sheet">
        <AppText>İçerik</AppText>
      </Sheet>,
    );
    layout(r.getByTestId('t-sheet-root'));
    showKeyboard();
    expect(translateY(r.getByLabelText('Katman'))).toBe(-KB_H);
    layout(r.getByTestId('t-sheet-root'), SCREEN_H - KB_H); // pencere küçüldü
    expect(translateY(r.getByLabelText('Katman'))).toBe(0);
  });

  test('animasyonlu yol: klavye süresiyle native sürücülü Animated.timing başlatılır', () => {
    const { Animated } = require('react-native');
    const timing = jest.spyOn(Animated, 'timing');
    const r = rtlRender(
      <SafeAreaProvider initialMetrics={METRICS}>
        <ReducedMotionProvider value={false}>
          <KeyboardLiftView testID="lift-anim">
            <AppText>Panel</AppText>
          </KeyboardLiftView>
        </ReducedMotionProvider>
      </SafeAreaProvider>,
    );
    layout(r.getByTestId('lift-anim'));
    showKeyboard();
    const call = timing.mock.calls.find((c) => (c[1] as { toValue: number }).toValue === KB_H);
    expect(call).toBeTruthy();
    expect(call![1]).toMatchObject({ toValue: KB_H, duration: 250, useNativeDriver: true });
  });
});

describe('Sepet › "Kupon kodu ekle" (eatkcal v2 CouponSheet)', () => {
  test('klavye açılınca kupon katmanı klavyenin üstüne çıkar; alan görünür, kaydırılabilir', async () => {
    const { CouponSheet } = require('../../../../modules/eatkcal/v2/ui/CouponSheet');
    const r = render(<CouponSheet visible onClose={() => {}} cartTotal={500} items={[]} onApplied={() => {}} />);
    await act(async () => {});
    layout(r.getByTestId('ek-coupon-sheet-root'));
    showKeyboard();
    const sheet = r.getByTestId('ek-coupon-sheet');
    expect(translateY(sheet)).toBe(-KB_H);
    expect(r.getByTestId('ek-coupon-sheet-scroll').props.keyboardShouldPersistTaps).toBe('handled');
    expect(r.getByTestId('ek-coupon-apply')).toBeTruthy();
  });
});

describe('Keşfet BottomSheet (gönderi düzenleme, etkinlik ekleme)', () => {
  test('düzenleme katmanı klavye kadar kalkar, alt güvenli alan boşluğu kalkar', () => {
    const { BottomSheet } = require('../../../../modules/kesfet/ui/BottomSheet');
    const r = render(
      <BottomSheet visible onClose={() => {}} accessibilityLabel="Düzenle">
        <AppText>Metin</AppText>
      </BottomSheet>,
    );
    layout(r.getByTestId('kesfet-sheet-root'));
    showKeyboard();
    const lift = r.getByTestId('kesfet-sheet-lift');
    expect(translateY(lift)).toBe(-KB_H);
    expect(style(lift).maxHeight).toBe(SCREEN_H - KB_H - SHEET_TOP_GAP);
    expect(style(r.getByLabelText('Düzenle')).paddingBottom).toBe(16);
    hideKeyboard();
    expect(translateY(r.getByTestId('kesfet-sheet-lift'))).toBe(0);
  });
});

describe('KeyboardLiftView (kendi kabuğunu çizen katmanlar: yorum, elle giriş, e-posta kodu, Tara eksik ekle)', () => {
  test('flex-end panelin alt kenarı ekran dibindeyse klavye kadar kalkar; limitHeight sınırlar', () => {
    const r = render(
      <KeyboardLiftView limitHeight testID="lift">
        <AppText>Panel</AppText>
      </KeyboardLiftView>,
    );
    layout(r.getByTestId('lift'), 400, SCREEN_H - 400);
    showKeyboard();
    expect(translateY(r.getByTestId('lift'))).toBe(-KB_H);
    // Sınır pencere yüksekliğinden (jest penceresi Dimensions'tan okunur).
    const { Dimensions } = require('react-native');
    expect(style(r.getByTestId('lift')).maxHeight).toBe(Dimensions.get('window').height - KB_H - SHEET_TOP_GAP);
  });

  test('elle giriş (HomeManualMealSheet): katman klavyenin üstünde', () => {
    const { HomeManualMealSheet } = require('../../../../screens/tracker/HomeManualMealSheet');
    const r = render(
      <HomeManualMealSheet
        visible
        mealType="ogle"
        calories=""
        note=""
        saving={false}
        onMealType={() => {}}
        onCalories={() => {}}
        onNote={() => {}}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    layout(r.getByTestId('manual-meal-lift'), 460, SCREEN_H - 460);
    showKeyboard();
    expect(translateY(r.getByTestId('manual-meal-lift'))).toBe(-KB_H);
  });
});

describe('Keşfet yorumlar (CommentsSheet) ve e-posta kodu (AccountEmailSheet)', () => {
  test('yorum katmanı klavye kadar kalkar ve yüksekliği sınırlanır', () => {
    const { CommentsSheet } = require('../../../../modules/kesfet/ui/CommentsSheet');
    const r = render(<CommentsSheet visible postId={null} currentUser={null} onClose={() => {}} onToast={() => {}} />);
    layout(r.getByTestId('comments-lift'), 520, SCREEN_H - 520);
    showKeyboard();
    expect(translateY(r.getByTestId('comments-lift'))).toBe(-KB_H);
    expect(style(r.getByTestId('comments-lift')).maxHeight).toBeGreaterThan(0);
  });

  test('e-posta kodu katmanı klavye kadar kalkar; kaydırma alanı handled', () => {
    const { AccountEmailSheet } = require('../../../../modules/onboarding/first/AccountEmailSheet');
    const r = render(<AccountEmailSheet visible accepted onAcceptedChange={() => {}} onClose={() => {}} onVerified={() => {}} />);
    layout(r.getByTestId('email-sheet-lift'), 560, SCREEN_H - 560);
    showKeyboard();
    expect(translateY(r.getByTestId('email-sheet-lift'))).toBe(-KB_H);
    hideKeyboard();
    expect(translateY(r.getByTestId('email-sheet-lift'))).toBe(0);
  });
});

describe('"Çok yakında" form sheet\'i (WaitlistFormSheet)', () => {
  test('üstten+alttan sabit katmanın alt kenarı klavye yüksekliğine çıkar (KAV padding mutlak çocuğu kaldırmıyordu)', () => {
    const { WaitlistFormSheet } = require('../../../../modules/eatkcal/v2/ui/gate/WaitlistFormSheet');
    const r = render(<WaitlistFormSheet kind="restaurant_add" visible city="Ankara" country="TR" onClose={() => {}} onPrivacy={() => {}} />);
    layout(r.getByTestId('ek-waitlist-root'));
    expect(style(r.getByTestId('ek-waitlist-add')).bottom).toBe(0);
    showKeyboard();
    expect(style(r.getByTestId('ek-waitlist-add')).bottom).toBe(KB_H);
  });
});

describe('Profil › Kuponlar (FinPrCouponsScreen) — kod giriş sayfası', () => {
  test('sayfa kaydırılabilir, keyboardShouldPersistTaps="handled", iOS klavye içeriği içeri alır', async () => {
    const FinPrCouponsScreen = require('../../../../modules/profil/ui/screens/FinPrCouponsScreen').default;
    const r = render(<FinPrCouponsScreen onBack={() => {}} />);
    await act(async () => {});
    const sv = r.getByTestId('fin-screen-scroll');
    expect(sv.props.keyboardShouldPersistTaps).toBe('handled');
    expect(sv.props.automaticallyAdjustKeyboardInsets).toBe(true);
  });
});
