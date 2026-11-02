import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../ThemeProvider';
import { CURVE, TIMING, useReducedMotion } from '../motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * DailyRing — günlük halka: **tek çizgi üçe ayrılır**.
 *
 * `split` 0→1: 0'da üç yay bitişik ve eşit opaklıkta (tek sürekli halka gibi
 * görünür); 1'de aralarında boşluk açılır ve üç ayrı parçaya (ör. protein /
 * karbonhidrat / yağ) döner. Her parçanın boyu ve dönüşü UI thread'de (worklet)
 * sürülür. Tek hue, üç opaklık → tema-güvenli.
 *
 * `playToken` değişince tekrar ayrışır. Azaltılmışta akış yok, anında ayrışmış
 * hâle oturur.
 */
export function DailyRing({
  playToken = 0,
  size = 150,
  strokeWidth = 14,
  style,
}: {
  playToken?: number;
  size?: number;
  strokeWidth?: number;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const split = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      split.value = 1;
      return;
    }
    split.value = 0;
    split.value = withTiming(1, { duration: TIMING.dailyRing, easing: CURVE.out });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playToken, reduced]);

  return (
    <View style={[{ width: size, height: size }, style]}>
      <RingArc split={split} index={0} opacityMax={1} size={size} strokeWidth={strokeWidth} />
      <RingArc split={split} index={1} opacityMax={0.7} size={size} strokeWidth={strokeWidth} />
      <RingArc split={split} index={2} opacityMax={0.45} size={size} strokeWidth={strokeWidth} />
    </View>
  );
}

function RingArc({
  split,
  index,
  opacityMax,
  size,
  strokeWidth,
}: {
  split: SharedValue<number>;
  index: number;
  opacityMax: number;
  size: number;
  strokeWidth: number;
}) {
  const t = useTheme();
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const maxGapDeg = 16; // tam ayrışmada her iki yay arası boşluk

  const animatedProps = useAnimatedProps(() => {
    const gap = interpolate(split.value, [0, 1], [0, maxGapDeg]);
    const arcDeg = 120 - gap;
    const len = (arcDeg / 360) * circumference;
    return { strokeDasharray: `${len} ${circumference}` };
  });

  const wrapStyle = useAnimatedStyle(() => {
    const gap = interpolate(split.value, [0, 1], [0, maxGapDeg]);
    // Her yay kendi 120°'lik yuvasının ortasında; başı −90° (üst) + yuva + boşluk/2.
    const rotate = index * 120 + gap / 2 - 90;
    const opacity = interpolate(split.value, [0, 1], [1, opacityMax]);
    return { transform: [{ rotate: `${rotate}deg` }], opacity };
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, wrapStyle]}>
      <Svg width={size} height={size}>
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={t.color.accent}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          animatedProps={animatedProps}
        />
      </Svg>
    </Animated.View>
  );
}
