// Keşfet hareket hook'ları (G11-S3). Motor TEK KAYNAK `core/design/motion.tsx`;
// burada yalnız onun dışa verdiği TOKEN'larla (TIMING, DURATION, CURVE, SPRING,
// STAGGER, REDUCED) BESLENEN, Keşfet'e özgü birkaç hook tanımlanır. Ekranlar bu
// hook'ları çağırır; sabit süre/eğri yazmaz. Azaltılmış harekete (useReducedMotion)
// her hook uyar: giriş/döngü yerine yalnız opaklık + en fazla REDUCED.maxShift px.
//
// NEDEN AYRI DOSYA: motion.tsx paralel aşamada DONUK (G11 RULES). Yeni imza gerek
// olduğunda sözleşme "kendi modülünde yaz, yalnız bu token'larla besle" diyor.
import { useEffect } from 'react';
import {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  CURVE,
  DURATION,
  REDUCED,
  SPRING,
  PREMIUM,
  listEnterDelay,
  useReducedMotion,
} from '../../core/design';

type AnyStyle = ReturnType<typeof useAnimatedStyle>;

/**
 * Akış kartı girişi — FinMoTokens "Liste girişi" (PREMIUM.list): fast 200 enter ·
 * kademe instant 100 · yalnız ilk 4 öğe · kayma 8 pt · toplam ≤ 500 ms.
 * Azaltılmışta: yalnız 200 ms opaklık.
 */
export function useFeedCardEnter(index: number): { style: AnyStyle } {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(p);
    p.value = 0;
    p.value = withDelay(
      reduced ? 0 : listEnterDelay(index),
      withTiming(1, {
        duration: reduced ? REDUCED.duration : PREMIUM.list.duration,
        easing: PREMIUM.list.curve,
      }),
    );
    return () => cancelAnimation(p);
    // reduced değişiminde doğru süreyle yeniden kurulur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const style = useAnimatedStyle(() => {
    const shift = reduced ? 0 : interpolate(p.value, [0, 1], [PREMIUM.list.shift, 0]);
    return { opacity: p.value, transform: [{ translateY: shift }] };
  });
  return { style };
}

/**
 * Hafif ikon sıçraması (pop) — beğen/kaydet ikonu tek nefes 1→1.12→1 (TIMING.pop).
 * Haptik İÇERMEZ: success haptiği hero'ya ayrılı (motion.tsx; günde en fazla 3),
 * beğeni gibi sık anlar için çağıran `haptic('light')` verir. Azaltılmışta: sıçrama yok.
 */
export function useIconPop(): { style: AnyStyle; pop: () => void } {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const pop = () => {
    if (reduced) return;
    cancelAnimation(s);
    s.value = withSequence(
      withTiming(1.12, { duration: DURATION.instant, easing: CURVE.standard }),
      withSpring(1, SPRING.bouncy),
    );
  };
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return { style, pop };
}

/**
 * Nokta izi (burst) — kaydet anında ikonun yanında beliren küçük lime nokta:
 * opaklık 0→1→0 + ölçek 0.4→1.4 (micro). "Her öğe bir noktadan doğar" (motion §2).
 * Azaltılmışta: yalnız kısa bir opaklık nefesi.
 */
export function useDotBurst(): { style: AnyStyle; burst: () => void } {
  const reduced = useReducedMotion();
  const b = useSharedValue(0);
  const burst = () => {
    cancelAnimation(b);
    b.value = 0;
    b.value = withSequence(
      withTiming(1, { duration: DURATION.micro, easing: CURVE.out }),
      withTiming(0, { duration: DURATION.standard, easing: CURVE.in }),
    );
  };
  const style = useAnimatedStyle(() => ({
    opacity: b.value,
    transform: [{ scale: reduced ? 1 : interpolate(b.value, [0, 1], [0.4, 1.4]) }],
  }));
  return { style, burst };
}

/**
 * Sayı yuvarlanması (Orta) — sayaç değiştiğinde yeni değer alttan kısaca kayıp
 * oturur (opaklık 0.3→1 + 8→0 px). Gerçek odometre değil, "yuvarlanıp yerine
 * oturma" hissi (motion §3 "sayı yuvarlanması"). Azaltılmışta: anında.
 */
export function useCountRoll(value: number): { style: AnyStyle } {
  const reduced = useReducedMotion();
  const p = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      p.value = 1;
      return;
    }
    cancelAnimation(p);
    p.value = 0;
    p.value = withTiming(1, { duration: DURATION.emphasis, easing: CURVE.out });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const style = useAnimatedStyle(() => {
    if (reduced) return { opacity: 1, transform: [{ translateY: 0 }] };
    return {
      opacity: interpolate(p.value, [0, 1], [0.3, 1]),
      transform: [{ translateY: interpolate(p.value, [0, 1], [8, 0]) }],
    };
  });
  return { style };
}

/**
 * Alttan açılan sayfa (sheet) yükselişi — PREMIUM.sheet: base 300 enter (Kcalculate
 * sheet'leri yay değil, süre tokeni); arka
 * plan kararması eş zamanlı solarak gelir (motion.tsx TRANSITION.sheet). Panel
 * yüksekliği onLayout ile ölçülür; görünür olunca p 0→1 yay, kapanınca 1→0.
 * Azaltılmışta: yay yerine kısa timing. Kapanış animasyonu Modal'ın kendi
 * kapanışıyla çakışmasın diye yalnız AÇILIŞ animasyonludur.
 */
export function useSheetRise(visible: boolean): {
  panelStyle: AnyStyle;
  backdropStyle: AnyStyle;
  onLayout: (e: { nativeEvent: { layout: { height: number } } }) => void;
} {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  const h = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(p);
    if (visible) {
      p.value = reduced
        ? withTiming(1, { duration: REDUCED.duration, easing: CURVE.out })
        : withTiming(1, { duration: PREMIUM.sheet.enter, easing: CURVE.enter });
    } else {
      p.value = 0;
    }
  }, [visible, reduced, p]);

  const onLayout = (e: { nativeEvent: { layout: { height: number } } }) => {
    const next = e.nativeEvent.layout.height;
    if (next > 0) h.value = next;
  };

  const panelStyle = useAnimatedStyle(() => {
    const rest = h.value > 0 ? h.value : 320;
    return { transform: [{ translateY: (1 - p.value) * rest }] };
  });
  const backdropStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  return { panelStyle, backdropStyle, onLayout };
}
