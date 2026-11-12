// G38 md.4 — Sayı hapı (rozet). Sayıyı parantez içinde ("Sepet (1)") göstermek yerine etiketin
// yanında küçük bir hap. Görsel olarak tek başına bilgi taşımaz: sayının sesli karşılığı ebeveyn
// düğmenin `accessibilityLabel`'ında verilir, hap VoiceOver'dan gizlidir (çift okunmasın).
// Dynamic Type: metin ölçeklenir (üst sınır 1,4), hap yüksekliği `minHeight` ile büyür, kırpılmaz.
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { FinText as Text } from './FinText';
import { fontFamily } from '../typography';

export function formatCount(n: number, max = 99): string {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  return v > max ? `${max}+` : String(v);
}

export function CountPill({
  count,
  bg,
  fg,
  max = 99,
  style,
  testID,
}: {
  count: number;
  /** Hap zemini. */
  bg: string;
  /** Sayı rengi. */
  fg: string;
  /** Üst sınır ("99+"). */
  max?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View
      style={[styles.pill, { backgroundColor: bg }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}
    >
      <Text style={[styles.text, { color: fg }]} numberOfLines={1} maxFontSizeMultiplier={1.4}>
        {formatCount(count, max)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minWidth: 22,
    minHeight: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: fontFamily.bodyBold,
    fontSize: 13,
    lineHeight: 17,
    fontVariant: ['tabular-nums'],
  },
});
