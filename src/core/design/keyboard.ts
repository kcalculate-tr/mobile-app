import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Keyboard, Platform, type KeyboardEvent, type LayoutChangeEvent } from 'react-native';
import { DURATION, RN_CURVE, useReducedMotion } from './motion';

/**
 * G16-S2 — Android uyumu: klavye. TEK KAYNAK.
 *
 * Expo SDK 54 Android'de kenar-kenar (edge-to-edge) varsayılan AÇIK
 * (@expo/prebuild-config withEdgeToEdge; Android 16'da kapatılamaz). Kenar-kenar
 * pencerede `adjustResize` pencereyi küçültmez → `behavior={ios ? 'padding' :
 * undefined}` olan ekranlarda giriş alanı (adres, not, kod) klavyenin altında
 * kalıyordu. Ekran (Modal OLMAYAN) KeyboardAvoidingView'ları iki platformda da
 * 'padding' kullanır (iOS'ta değer zaten 'padding' → iOS AYNEN). Modal içindeki
 * katmanlar (sheet) bunu KULLANMAZ → aşağıdaki `useSheetKeyboard`.
 */
export const SCREEN_KEYBOARD_BEHAVIOR = 'padding' as const;

/**
 * G27-S1 md.1 — Her ScrollView / FlatList / SectionList bunu yayar (`{...SCROLL_KEYBOARD}`).
 * - `handled`: listedeki öğeye dokunma öğeyi açar (ilk dokunma klavyeyi kapatmakla
 *   harcanmaz); klavyeyi kök `KeyboardDismissRoot` kapatır.
 * - Kaydırınca kapanır: iOS `interactive` (klavye parmağı izler, sistem hareketi),
 *   Android `on-drag`.
 * Kaynak bekçi testi: g27KeyboardDismiss (yeni kaydırma kabı bunu taşımazsa düşer).
 */
export const KEYBOARD_DISMISS_MODE: 'interactive' | 'on-drag' = Platform.OS === 'ios' ? 'interactive' : 'on-drag';
export const SCROLL_KEYBOARD = {
  keyboardShouldPersistTaps: 'handled',
  keyboardDismissMode: KEYBOARD_DISMISS_MODE,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// G21-S1 md.10 — ALTTAN AÇILAN KATMANLAR (sheet) için klavye kaçınma. TEK KAYNAK.
//
// Kök neden (Sepet › "Kupon kodu ekle" ve aynı desendeki bütün katmanlar):
//  1. Ortak `Sheet` (core/design) ve Keşfet `BottomSheet` RN `Modal` içinde çizilir
//     ve HİÇ klavye dinlemiyordu. iOS'ta Modal penceresi klavyeyle küçülmez →
//     katman ekranın dibinde, klavyenin ALTINDA kalıyordu.
//  2. Katman `position: 'absolute', bottom: 0`. RN 0.74+ Yoga'da mutlak konumlu
//     çocuk ebeveynin padding'ini YOK SAYAR → dışarıya `KeyboardAvoidingView
//     behavior="padding"` sarmak bile katmanı kaldırmaz (WaitlistFormSheet).
//  3. Android'de `behavior={undefined}` + kenar-kenar pencere: Modal penceresi
//     her cihazda yeniden boyutlanmıyor → aynı sonuç.
//
// Çözüm: klavyenin ÜST kenarı (ekran koordinatı) ile katmanı taşıyan tam ekran
// kabın ALT kenarı karşılaştırılır; fark kadar katman yukarı kaydırılır (native
// sürücü, klavyenin kendi süresiyle). Pencere zaten küçüldüyse (Android
// adjustResize) kabın onLayout'u küçülür → fark 0 → ÇİFT kaldırma yok. Kap, Modal
// kökündeki tam ekran görünüm olmalı (`statusBarTranslucent` → pencere ekranın
// tepesinden başlar, kap koordinatı = ekran koordinatı).
// ─────────────────────────────────────────────────────────────────────────────

/** iOS: klavye animasyonuyla AYNI anda ("will"); Android: yalnız "did" olayları var. */
export const SHEET_KEYBOARD_EVENTS =
  Platform.OS === 'ios'
    ? ({ show: 'keyboardWillShow', hide: 'keyboardWillHide' } as const)
    : ({ show: 'keyboardDidShow', hide: 'keyboardDidHide' } as const);

/** Klavye açıkken katmanın üstünde kalan en az boşluk (durum çubuğu ~47–59 + nefes). */
export const SHEET_TOP_GAP = 64;

/** Katmanın kalkması gereken miktar (pt). Saf — birim testli. */
export function keyboardLift(containerBottom: number, keyboardTop: number | null): number {
  if (keyboardTop == null || !Number.isFinite(keyboardTop)) return 0;
  return Math.max(0, Math.round(containerBottom - keyboardTop));
}

/** Klavye olayından klavyenin üst kenarı (ekran koordinatı); kapalıysa null. */
export function keyboardTopFromEvent(
  e: Pick<KeyboardEvent, 'endCoordinates'> | null | undefined,
  windowHeight: number,
): number | null {
  const end = e?.endCoordinates;
  if (!end || !(end.height > 0)) return null;
  return typeof end.screenY === 'number' && end.screenY > 0 ? end.screenY : windowHeight - end.height;
}

/** Katmanın en çok yüksekliği: klavye kapalıyken kap × oran; açıkken kap − klavye − üst boşluk ile sınırlı. */
export function sheetMaxHeight(containerHeight: number, ratio: number, lift: number, topGap = SHEET_TOP_GAP): number {
  const base = containerHeight * ratio;
  if (lift <= 0) return base;
  return Math.max(0, Math.min(base, containerHeight - lift - topGap));
}

/**
 * Alttan açılan katman klavye kancası. Dönen `translateY` katmanın transform'una
 * eklenir (native sürücü), `onLayout` Modal kökündeki tam ekran kaba verilir,
 * `lift` (state) yükseklik sınırı / alt boşluk hesapları içindir.
 * Azaltılmış harekette kayma animasyonsuz (anında) uygulanır.
 */
export function useSheetKeyboard(enabled = true) {
  const reduced = useReducedMotion();
  const liftValue = useRef(new Animated.Value(0)).current;
  const translateY = useRef(Animated.multiply(liftValue, -1)).current;
  const [lift, setLift] = useState(0);
  const [containerHeight, setContainerHeight] = useState(() => Dimensions.get('window').height);
  const containerBottom = useRef(Dimensions.get('window').height);
  const kbTop = useRef<number | null>(null);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const apply = useCallback(
    (kbDuration?: number) => {
      const v = enabled ? keyboardLift(containerBottom.current, kbTop.current) : 0;
      setLift(v);
      const d = reducedRef.current || !kbDuration ? 0 : kbDuration;
      if (d === 0) {
        liftValue.setValue(v);
        return;
      }
      Animated.timing(liftValue, { toValue: v, duration: d, easing: RN_CURVE.standard, useNativeDriver: true }).start();
    },
    [enabled, liftValue],
  );

  useEffect(() => {
    if (!enabled) return undefined;
    const onShow = (e: KeyboardEvent) => {
      kbTop.current = keyboardTopFromEvent(e, Dimensions.get('window').height);
      apply(e?.duration || DURATION.base);
    };
    const onHide = (e: KeyboardEvent) => {
      kbTop.current = null;
      apply(e?.duration || DURATION.base);
    };
    const a = Keyboard.addListener(SHEET_KEYBOARD_EVENTS.show, onShow);
    const b = Keyboard.addListener(SHEET_KEYBOARD_EVENTS.hide, onHide);
    // Katman, klavye zaten açıkken açıldıysa (ör. alan odaktayken sheet).
    const m = typeof Keyboard.metrics === 'function' ? Keyboard.metrics() : undefined;
    if (m && m.height > 0) {
      kbTop.current = keyboardTopFromEvent({ endCoordinates: m } as KeyboardEvent, Dimensions.get('window').height);
      apply();
    }
    return () => {
      a.remove();
      b.remove();
    };
  }, [enabled, apply]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { y, height } = e.nativeEvent.layout;
      containerBottom.current = y + height;
      setContainerHeight(height);
      if (kbTop.current != null) apply();
    },
    [apply],
  );

  return { translateY, lift, onLayout, containerHeight };
}
