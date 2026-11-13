// T20Scan — cam tarama çerçevesi: 4 köşe ayracı ürüne "kilitlenir" (STAGGER.scanCorners
// ile sırayla belirir) + analiz sırasında tarama çizgisi (TIMING.sweep) gider gelir.
// Hareket yalnız core/design/motion token'larıyla; azaltılmış harekette köşeler
// anında, çizgi kapalı.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { CURVE, DURATION, STAGGER, TIMING, useReducedMotion } from '../../../../core/design';
import { palette } from '../../../../core/design/tokens';

const SIZE = 260;
const CORNER = 36;
const THICK = 3;

export default function ScanFrame({
  active,
  color,
  width = SIZE,
  height = SIZE,
  style,
}: {
  active: boolean;
  /** G15-S2 (FinScanR2): açık temada koyu köşeler. Verilmezse beyaz (eski yol aynı). */
  color?: string;
  width?: number;
  height?: number;
  style?: object;
}) {
  const reduced = useReducedMotion();
  const tint = color ? { borderColor: color } : null;

  return (
    <View style={[styles.wrap, style]} pointerEvents="none">
      <View style={{ width, height }}>
        <Corner index={0} reduced={reduced} style={[styles.tl, tint]} />
        <Corner index={1} reduced={reduced} style={[styles.tr, tint]} />
        <Corner index={2} reduced={reduced} style={[styles.bl, tint]} />
        <Corner index={3} reduced={reduced} style={[styles.br, tint]} />
        {active ? <Sweep reduced={reduced} h={height} /> : null}
      </View>
    </View>
  );
}

function Corner({ index, reduced, style }: { index: number; reduced: boolean; style: object | object[] }) {
  const p = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      p.value = 1;
      return;
    }
    p.value = 0;
    p.value = withDelay(index * STAGGER.scanCorners, withTiming(1, { duration: DURATION.standard, easing: CURVE.enter }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  const anim = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scale: interpolate(p.value, [0, 1], [0.7, 1]) }],
  }));
  return <Animated.View style={[styles.corner, style, anim]} />;
}

function Sweep({ reduced, h = SIZE }: { reduced: boolean; h?: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    y.value = 0;
    y.value = withRepeat(withTiming(1, { duration: TIMING.sweep, easing: CURVE.move }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  const anim = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(y.value, [0, 1], [8, h - 8]) }],
  }));
  if (reduced) return null;
  return <Animated.View style={[styles.sweep, anim]} />;
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#FFFFFF',
  },
  tl: { top: 0, left: 0, borderTopWidth: THICK, borderLeftWidth: THICK, borderTopLeftRadius: 12 },
  tr: { top: 0, right: 0, borderTopWidth: THICK, borderRightWidth: THICK, borderTopRightRadius: 12 },
  bl: { bottom: 0, left: 0, borderBottomWidth: THICK, borderLeftWidth: THICK, borderBottomLeftRadius: 12 },
  br: { bottom: 0, right: 0, borderBottomWidth: THICK, borderRightWidth: THICK, borderBottomRightRadius: 12 },
  sweep: {
    position: 'absolute',
    left: 6,
    right: 6,
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.lime,
  },
});
