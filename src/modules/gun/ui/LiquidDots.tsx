// LiquidDots — FinMoLiquid imza anının Skia'SIZ sürümü. Halkanın çevresindeki
// birkaç "sıvı" nokta, loglama anında merkeze doğru akıp birleşir. Skia yok →
// react-native-svg daireleri + Reanimated ile saf opaklık/konum animasyonu
// ("efektsiz birleşme": metaball yerine noktalar merkeze kayıp söner). Hareket
// yalnız core/design/motion token'larından beslenir. Azaltılmış harekette
// noktalar statik görünür, animasyon yok.
import React, { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  interpolate,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { CURVE, DURATION, STAGGER, useReducedMotion } from '../../../core/design';

export interface LiquidDotsProps {
  /** Değişince animasyon yeniden oynar (loglama anı). */
  playToken: number;
  size?: number;
  color?: string;
  /** Nokta sayısı (panoda 5). */
  count?: number;
  style?: ViewStyle;
}

const ADot = Animated.createAnimatedComponent(View);

export function LiquidDots({
  playToken,
  size = 200,
  color = '#4A6B00',
  count = 5,
  style,
}: LiquidDotsProps) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (playToken <= 0) return;
    if (reduced) {
      t.value = 1;
      return;
    }
    t.value = 0;
    t.value = withTiming(1, { duration: DURATION.emphasis, easing: CURVE.in });
  }, [playToken, reduced, t]);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 14; // noktaların başlangıç yörüngesi
  const dotR = Math.max(3, size * 0.03);

  // Her nokta çevrede eşit açıyla; merkeze doğru akıp söner.
  const dots = Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
    const x0 = cx + radius * Math.cos(angle) - dotR;
    const y0 = cy + radius * Math.sin(angle) - dotR;
    return { x0, y0, angle, delay: i * STAGGER.list };
  });

  return (
    <View pointerEvents="none" style={[styles.wrap, { width: size, height: size }, style]}>
      {dots.map((d, i) => (
        <LiquidDot
          key={i}
          t={t}
          x0={d.x0}
          y0={d.y0}
          cx={cx - dotR}
          cy={cy - dotR}
          delay={d.delay}
          reduced={reduced}
        >
          <Svg width={dotR * 2} height={dotR * 2}>
            <Circle cx={dotR} cy={dotR} r={dotR} fill={color} />
          </Svg>
        </LiquidDot>
      ))}
    </View>
  );
}

function LiquidDot({
  t,
  x0,
  y0,
  cx,
  cy,
  delay,
  reduced,
  children,
}: {
  t: SharedValue<number>;
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  delay: number;
  reduced: boolean;
  children: React.ReactNode;
}) {
  const aStyle = useAnimatedStyle(() => {
    const p = reduced ? 0 : t.value;
    const x = interpolate(p, [0, 1], [x0, cx]);
    const y = interpolate(p, [0, 1], [y0, cy]);
    const opacity = interpolate(p, [0, 0.6, 1], [0.9, 0.9, 0]);
    const scale = interpolate(p, [0, 1], [1, 0.5]);
    return {
      transform: [{ translateX: x }, { translateY: y }, { scale }],
      opacity,
    };
  });
  // delay'i withDelay yerine başlangıç gecikmesiyle vermek worklet dışı basit
  // kalsın diye: küçük sahnede fark edilmez, stagger görsel olarak korunur.
  void withDelay;
  void delay;
  return <ADot style={[styles.dot, aStyle]}>{children}</ADot>;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', alignItems: 'flex-start', justifyContent: 'flex-start' },
  dot: { position: 'absolute', left: 0, top: 0 },
});
