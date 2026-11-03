// RollingNumber — sayı yuvarlanması (HAREKET kitabı §3): her HANE kendi SABİT
// GENİŞLİKLİ slotunda dikey kayar; en sağdaki en çok döner (hane başına ufak
// gecikme). Binlik ayıracı TR `1.840` / EN `1,840` (groupDigits). Değer değişince
// yeni rakamlara akar.
//
// Motor `core/design/motion.tsx`'in token'larıyla beslenir (DURATION, CURVE,
// STAGGER, useReducedMotion); yeni süre/eğri icat edilmez (RULES "Hareket").
// Azaltılmış hareket: akış yok, değer anında oturur.
import React from 'react';
import { StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { CURVE, DURATION, STAGGER, useReducedMotion } from '../../../core/design';
import { groupDigits, type NumLang } from '../motion';

export interface RollingNumberProps {
  value: number;
  lang?: NumLang;
  fontSize?: number;
  weight?: TextStyle['fontWeight'];
  color?: string;
  style?: ViewStyle;
  /** Erişilebilirlik etiketi (hane kolonları okunmasın diye). */
  accessibilityLabel?: string;
}

export function RollingNumber({
  value,
  lang = 'tr',
  fontSize = 34,
  weight = '700',
  color = '#0A0A0A',
  style,
  accessibilityLabel,
}: RollingNumberProps) {
  const text = groupDigits(value, lang);
  const lineHeight = Math.round(fontSize * 1.2);
  const slotWidth = Math.ceil(fontSize * 0.62);
  const chars = text.split('');

  // En sağdaki hanenin index'i (gecikme sırası sağdan sola artar → sağ en çok döner).
  const lastDigitIndex = (() => {
    for (let i = chars.length - 1; i >= 0; i -= 1) {
      if (chars[i] >= '0' && chars[i] <= '9') return i;
    }
    return -1;
  })();

  const textStyle: TextStyle = { fontSize, lineHeight, fontWeight: weight, color, textAlign: 'center' };

  return (
    <View
      style={[styles.row, style]}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? text}
    >
      {chars.map((ch, i) => {
        if (ch >= '0' && ch <= '9') {
          // Sağdan uzaklığa göre gecikme: en sağdaki 0 ms, sola doğru STAGGER.list.
          const fromRight = lastDigitIndex - i;
          const delay = Math.max(0, fromRight) * STAGGER.list;
          return (
            <DigitColumn
              key={i}
              digit={Number(ch)}
              delay={delay}
              lineHeight={lineHeight}
              slotWidth={slotWidth}
              textStyle={textStyle}
            />
          );
        }
        // Ayıraç / işaret — sabit (dar) slot, kaymaz.
        return (
          <View key={i} style={{ height: lineHeight, justifyContent: 'center' }}>
            <Text style={textStyle} allowFontScaling={false}>
              {ch}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function DigitColumn({
  digit,
  delay,
  lineHeight,
  slotWidth,
  textStyle,
}: {
  digit: number;
  delay: number;
  lineHeight: number;
  slotWidth: number;
  textStyle: TextStyle;
}) {
  const reduced = useReducedMotion();
  const target = -digit * lineHeight;
  const y = useSharedValue(target);

  React.useEffect(() => {
    if (reduced) {
      y.value = target;
      return;
    }
    const t = withTiming(target, { duration: DURATION.standard, easing: CURVE.out });
    y.value = delay > 0 ? withDelay(delay, t) : t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduced]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View style={{ height: lineHeight, width: slotWidth, overflow: 'hidden' }}>
      <Animated.View style={animStyle}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <Text key={d} style={[textStyle, { height: lineHeight, width: slotWidth }]} allowFontScaling={false}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
