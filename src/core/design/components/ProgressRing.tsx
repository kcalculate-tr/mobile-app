import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../ThemeProvider';
import { CURVE, TIMING, useReducedMotion } from '../motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * ProgressRing — animasyonlu ilerleme halkası (react-native-svg).
 *
 * `progress` 0..1. Değer değişince halka dolumu TIMING.dailyRing (900 ms)
 * içinde akar. Dolum `strokeDashoffset` üzerinden gider.
 *
 * ⚠️ PERFORMANS / REANIMATED: `strokeDashoffset` bir SVG prop'u; React Native
 * Animated bunu NATIVE DRIVER'da süremez (yalnız opacity/transform native).
 * Yani bu animasyon JS thread'de çalışır (useNativeDriver: false). Küçük tek
 * bir halka için sorun değil; ama "seri anı" gibi yoğun çizim animasyonlarıyla
 * birlikte bu, Reanimated'a taşınması gereken işlerden biri (bkz. FOUNDATION
 * raporu → "Reanimated gerektirenler").
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

  const anim = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    if (reduced) {
      anim.setValue(clamped);
      return;
    }
    Animated.timing(anim, {
      toValue: clamped,
      duration: TIMING.dailyRing,
      easing: CURVE.out,
      useNativeDriver: false, // strokeDashoffset native driver desteklemez
    }).start();
  }, [clamped, reduced, anim]);

  const strokeDashoffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

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
          strokeDashoffset={strokeDashoffset}
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
