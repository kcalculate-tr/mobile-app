import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../ThemeProvider';
import { AppText } from './AppText';
import { CURVE, DURATION, REDUCED, TIMING, haptic, useReducedMotion } from '../motion';

/**
 * LogTrail — "logla izi". Bir öğün öğesi dokununca küçülüp noktaya iner ve
 * hedefe (günlük halka) **yay çizerek** uçar; varışta light haptik + hedef
 * nabzı. Spec'teki kavisli yol artık UI thread'de (worklet) bir quadratic
 * yaklaşımla çiziliyor — JS thread bloklansa bile akıcı.
 *
 * `playToken` her değiştiğinde iz baştan oynar (vitrin düğmesi bunu kullanır).
 *
 * Azaltılmış hareket: yay yok; öğe en fazla 8 px kayar + solar, haptik aynı.
 */
export function LogTrail({
  playToken = 0,
  width = 300,
  height = 140,
  label = 'Izgara tavuk',
  style,
}: {
  playToken?: number;
  width?: number;
  height?: number;
  label?: string;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();

  // Başlangıç (sol-alt öğe) ve hedef (sağ-üst halka) konumları.
  const startX = 12;
  const startY = height - 52;
  const endX = width - 56;
  const endY = 12;
  const arcHeight = height * 0.55;

  const p = useSharedValue(0); // 0 = öğede, 1 = hedefte
  const pulse = useSharedValue(0); // hedef nabzı

  useEffect(() => {
    if (playToken === 0) return;
    pulse.value = 0;
    if (reduced) {
      p.value = 0;
      p.value = withTiming(1, { duration: REDUCED.duration, easing: CURVE.out }, (fin) => {
        if (fin) runOnJS(haptic)('light');
      });
      return;
    }
    p.value = 0;
    p.value = withTiming(1, { duration: TIMING.logTrail, easing: CURVE.enter }, (fin) => {
      if (fin) runOnJS(haptic)('light');
    });
    pulse.value = withDelay(
      TIMING.logTrail,
      withSequence(
        withTiming(1, { duration: DURATION.instant, easing: CURVE.enter }),
        withTiming(0, { duration: DURATION.fast, easing: CURVE.exit }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playToken]);

  const flyStyle = useAnimatedStyle(() => {
    if (reduced) {
      const x = interpolate(p.value, [0, 1], [0, REDUCED.maxShift]);
      return {
        transform: [{ translateX: startX + x }, { translateY: startY }, { scale: 1 }],
        opacity: interpolate(p.value, [0, 0.6, 1], [1, 1, 0]),
      };
    }
    const x = interpolate(p.value, [0, 1], [startX, endX]);
    const baseY = interpolate(p.value, [0, 1], [startY, endY]);
    const lift = Math.sin(p.value * Math.PI) * arcHeight;
    const scale = interpolate(p.value, [0, 1], [1, 0.22]);
    const opacity = interpolate(p.value, [0, 0.08, 0.85, 1], [1, 1, 1, 0.5]);
    return { transform: [{ translateX: x }, { translateY: baseY - lift }, { scale }], opacity };
  });

  const targetStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.5]) }],
    opacity: interpolate(pulse.value, [0, 1], [0.5, 1]),
  }));

  return (
    <View style={[{ width, height }, style]}>
      {/* Hedef: günlük halka noktası (sağ-üst). */}
      <Animated.View
        style={[
          styles.target,
          { left: endX, top: endY, backgroundColor: t.color.accent },
          targetStyle,
        ]}
      />
      {/* Uçan öğe → noktaya küçülür. */}
      <Animated.View style={[styles.chip, { backgroundColor: t.color.accent }, flyStyle]}>
        <AppText variant="caption" tone="onAccent" numberOfLines={1}>
          {label}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  target: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  chip: {
    position: 'absolute',
    left: 0,
    top: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    maxWidth: 180,
  },
});
