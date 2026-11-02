import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../ThemeProvider';
import { CURVE, DURATION, useReducedMotion } from '../motion';

/**
 * NumberRoll — sayı değişimi. Değer değişince eski değer yukarı kayıp solar,
 * yeni değer alttan kayıp belirir (odometre hissi). Geçiş UI thread'de (worklet),
 * DURATION.standard (280 ms) içinde.
 *
 * Azaltılmışta: kaydırma yok, değer anında değişir (kural: ≤200 ms, kayma yok).
 */
export function NumberRoll({
  value,
  fontSize = 34,
  weight = '700',
  color,
  style,
}: {
  value: string | number;
  fontSize?: number;
  weight?: TextStyle['fontWeight'];
  color?: string;
  style?: ViewStyle;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const text = String(value);
  const lineHeight = Math.round(fontSize * 1.25);

  const [prev, setPrev] = useState(text);
  const [curr, setCurr] = useState(text);
  const roll = useSharedValue(1); // 1 = geçiş tamamlanmış (curr yerinde)
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      setCurr(text);
      setPrev(text);
      return;
    }
    if (text === curr) return;
    setPrev(curr);
    setCurr(text);
    if (reduced) {
      roll.value = 1;
      return;
    }
    roll.value = 0;
    roll.value = withTiming(1, { duration: DURATION.standard, easing: CURVE.out });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const currStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(roll.value, [0, 1], [lineHeight, 0]) }],
    opacity: interpolate(roll.value, [0, 0.6, 1], [0, 0.6, 1]),
  }));
  const prevStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(roll.value, [0, 1], [0, -lineHeight]) }],
    opacity: interpolate(roll.value, [0, 0.4, 1], [1, 0.3, 0]),
  }));

  const textStyle: TextStyle = {
    fontSize,
    lineHeight,
    fontWeight: weight,
    color: color ?? t.color.ink,
    textAlign: 'center',
  };

  return (
    <View style={[{ height: lineHeight, justifyContent: 'center' }, style]}>
      <View style={{ height: lineHeight, overflow: 'hidden' }}>
        {prev !== curr ? (
          <Animated.Text style={[styles.abs, textStyle, prevStyle]} numberOfLines={1}>
            {prev}
          </Animated.Text>
        ) : null}
        <Animated.Text style={[textStyle, currStyle]} numberOfLines={1}>
          {curr}
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute', left: 0, right: 0, top: 0 },
});
