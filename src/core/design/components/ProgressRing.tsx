import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '../ThemeProvider';
import { CURVE, TIMING, useReducedMotion } from '../motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * ProgressRing — animasyonlu ilerleme halkası (react-native-svg + Reanimated).
 *
 * `progress` 0..1. Değer değişince halka dolumu TIMING.dailyRing (900 ms)
 * içinde akar. Dolum `strokeDashoffset` üzerinden gider.
 *
 * ✅ UI THREAD (G3-S3): Dolum artık **Reanimated** `useAnimatedProps` ile UI
 * thread'de (worklet) sürülür. Önceki temel `Animated` + `useNativeDriver:false`
 * ile JS thread'de çalışıyordu (strokeDashoffset native driver desteklemez);
 * birden çok halka aynı anda dolunca JS thread yük alıyordu. Worklet'te bu yük
 * yok — JS thread bloklansa bile dolum akıcı kalır.
 *
 * Azaltılmış hareket: dolum anında son değere oturur (akış yok). Halka bir
 * HEDEF değerini gösterir; kural gereği hedef değeri "sayılarak" canlandırılmaz,
 * yalnız dolum çizgisi akar — azaltılmışta o da kapalı.
 */
export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 12,
  color,
  trackColor,
  children,
  style,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  /** Dolan yay rengi; verilmezse temanın vurgu çizgisi (açık zeminde okunur lime). */
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, progress));

  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  // 0..1 ilerleme SharedValue. interpolate ile strokeDashoffset'e çevrilir.
  const p = useSharedValue(clamped);

  useEffect(() => {
    if (reduced) {
      p.value = clamped;
      return;
    }
    p.value = withTiming(clamped, {
      duration: TIMING.dailyRing,
      easing: CURVE.out,
    });
  }, [clamped, reduced, p]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(p.value, [0, 1], [circumference, 0]),
  }));

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={trackColor ?? t.color.line}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? t.color.accentLine}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          // Üstten başlasın diye -90°.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children ? <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
