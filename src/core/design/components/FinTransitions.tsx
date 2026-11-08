// G18-S4 md.1 — Premium geçiş setinin ortak bileşenleri (FinMoTokens · FinMoMap).
// Ekranlar süre/eğri yazmaz; bu sarmalayıcıları kullanır. Hepsi yalnız transform +
// opacity; azaltılmış harekette yer değiştirme/ölçek yok, 200 ms opaklık.
//
//  · FinLoadSwap   — Yükleniyor → içerik: fast 200 crossfade, AYNI yerleşim (iskelet
//                    ve içerik aynı kutuda üst üste; hiçbir şey zıplamaz).
//  · FinListEnter  — Liste girişi: fast 200 enter · kademe instant 100 · yalnız ilk 4
//                    öğe · kayma 8 pt · toplam ≤ 500 ms.
//  · FinPressScale — Basma: instant 100 · ölçek 0.98 · bırakınca AI 260/24 yayı.
//  · FinErrorReveal— Hata: mesaj ilgili alanın altında fast 200 (opaklık + y 4→0).
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { PREMIUM, REDUCED, listEnterDelay, useReducedMotion } from '../motion';

export function FinLoadSwap({
  loading,
  skeleton,
  children,
  style,
}: {
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const p = useSharedValue(loading ? 0 : 1); // 0 = iskelet, 1 = içerik
  // İskelet, crossfade bitene kadar içerikle aynı kutuda kalır.
  const [showSkeleton, setShowSkeleton] = useState(loading);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (loading) {
      setShowSkeleton(true);
      p.value = 0;
      return;
    }
    p.value = withTiming(1, { duration: PREMIUM.load.duration, easing: PREMIUM.load.curve });
    const id = setTimeout(() => setShowSkeleton(false), PREMIUM.load.duration);
    return () => clearTimeout(id);
  }, [loading, p]);

  const contentStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  const skeletonStyle = useAnimatedStyle(() => ({ opacity: 1 - p.value }));

  return (
    <Animated.View style={style}>
      {!loading ? <Animated.View style={[styles.fill, contentStyle]}>{children}</Animated.View> : null}
      {showSkeleton ? (
        <Animated.View
          pointerEvents="none"
          style={[loading ? styles.fill : StyleSheet.absoluteFill, skeletonStyle]}
        >
          {skeleton}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

export function FinListEnter({
  index,
  children,
  style,
}: {
  index: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(
      reduced ? 0 : listEnterDelay(index),
      withTiming(1, {
        duration: reduced ? REDUCED.duration : PREMIUM.list.duration,
        easing: PREMIUM.list.curve,
      }),
    );
    // yalnız ilk yüklemede (mount) — sonraki güncellemelerde öğe yerinde kalır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const a = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: reduced ? 0 : (1 - p.value) * PREMIUM.list.shift }],
  }));
  return <Animated.View style={[a, style]}>{children}</Animated.View>;
}

export function FinPressScale({
  children,
  style,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: PressableProps & { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[a, style]}>
      <Pressable
        {...rest}
        disabled={disabled}
        onPressIn={(e) => {
          if (!reduced && !disabled) {
            s.value = withTiming(PREMIUM.press.scale, {
              duration: PREMIUM.press.duration,
              easing: PREMIUM.press.curve,
            });
          }
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          if (!reduced) s.value = withSpring(1, PREMIUM.press.release);
          onPressOut?.(e);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function FinErrorReveal({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: PREMIUM.error.duration, easing: PREMIUM.error.curve });
  }, [p]);
  const a = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: reduced ? 0 : (1 - p.value) * PREMIUM.error.shift }],
  }));
  return <Animated.View style={[a, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({ fill: { flexGrow: 1 } });
