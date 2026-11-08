import React, { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../ThemeProvider';
import { CURVE, DURATION, haptic, useReducedMotion } from '../motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// viewBox 100×100. "7" tek sürekli çizgi: üst çubuk + çapraz.
const SEVEN = 'M30 28 L72 28 L46 80';
const SEVEN_LEN = 100; // ~99.4, yuvarlandı
const RING_R = 44;
const RING_LEN = 2 * Math.PI * RING_R; // ~276

/**
 * StreakMoment — "seri anı" kutlaması (HERO, günde en fazla 1).
 *
 * "7" tek bir çizgide yazılır (path strokeDashoffset ile, ~900 ms), ardından
 * etrafına bir **halka döner/çizilir** (~520 ms). success haptik (hero, günde
 * en fazla 3 — haptic() sayacı korur). Tüm çizim UI thread'de (worklet).
 *
 * `playToken` değişince baştan oynar. Azaltılmışta çizim yok: 7 + halka anında
 * görünür, haptik aynı kalır (erişilebilirlik kuralı).
 */
export function StreakMoment({
  playToken = 0,
  size = 150,
  style,
}: {
  playToken?: number;
  size?: number;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const draw = useSharedValue(0);
  const ring = useSharedValue(0);

  useEffect(() => {
    if (playToken === 0) return;
    haptic('success'); // hero — haptik hareketten bağımsız, azaltılmışta da çalar
    if (reduced) {
      draw.value = 1;
      ring.value = 1;
      return;
    }
    draw.value = 0;
    ring.value = 0;
    // Seri anı (FinMoMap): kutlama story 900 tek sahne · ardından halka slow 500.
    draw.value = withTiming(1, { duration: DURATION.story, easing: CURVE.enter });
    ring.value = withDelay(DURATION.story, withTiming(1, { duration: DURATION.slow, easing: CURVE.enter }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playToken]);

  const sevenProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(draw.value, [0, 1], [SEVEN_LEN, 0]),
  }));
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(ring.value, [0, 1], [RING_LEN, 0]),
  }));

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Halka — üstten (-90°) çizilir. */}
        <AnimatedCircle
          cx={50}
          cy={50}
          r={RING_R}
          stroke={t.color.accent}
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${RING_LEN} ${RING_LEN}`}
          animatedProps={ringProps}
          transform="rotate(-90 50 50)"
        />
        {/* "7" tek çizgi. */}
        <AnimatedPath
          d={SEVEN}
          stroke={t.color.ink}
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={`${SEVEN_LEN} ${SEVEN_LEN}`}
          animatedProps={sevenProps}
        />
      </Svg>
    </View>
  );
}
