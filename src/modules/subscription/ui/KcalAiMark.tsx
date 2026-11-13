// G39-S1 md.3 — "kcalAI" işareti: kcalculate logosu + yanında ayrı "AI".
//  • "AI" Bricolage Grotesque Bold; BÜYÜK HARF yüksekliği logo yüksekliğine eşit:
//    font cap-height 660/1000 (OS/2 sCapHeight, BricolageGrotesque_700Bold.ttf) →
//    fontSize = height / 0.66. Taban çizgisi logonun alt kenarına oturur (logo kırpılmış
//    viewBox, inişsiz harfler): satır yüksekliği = ascender+descender (1,2 em), alt
//    boşluk = descender (0,27 em) negatif kenar boşluğuyla geri alınır.
//  • Arada küçük boşluk (yüksekliğin %25'i). Renk tema metin rengi (Light siyah · Dark beyaz).
//  • Logo ölçeklenmediği için "AI" da Dynamic Type ile büyümez (ikisi tek bir marka imi).
//  • VoiceOver: tek öğe, "kcalAI".
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { BrandLogo, useTheme } from '../../../core/design';

const CAP = 0.66;
const ASC = 0.93;
const DESC = 0.27;

export function kcalAiMetrics(height: number) {
  const fontSize = Math.round((height / CAP) * 10) / 10;
  return {
    fontSize,
    lineHeight: Math.round(fontSize * (ASC + DESC) * 10) / 10,
    marginBottom: -Math.round(fontSize * DESC * 10) / 10,
    gap: Math.round(height * 0.25 * 10) / 10,
  };
}

export function KcalAiMark({
  height = 16,
  color,
  label,
  style,
  testID = 'kcalai-mark',
}: {
  height?: number;
  color?: string;
  /** VoiceOver etiketi (varsayılan "kcalAI"). */
  label?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const t = useTheme();
  const ink = color ?? t.color.ink;
  const m = kcalAiMetrics(height);
  return (
    <View
      style={[styles.row, { gap: m.gap }, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label ?? 'kcalAI'}
      testID={testID}
    >
      <BrandLogo name="kcalculate" height={height} color={ink} decorative testID={`${testID}-logo`} />
      <Text
        allowFontScaling={false}
        style={[styles.ai, { color: ink, fontSize: m.fontSize, lineHeight: m.lineHeight, marginBottom: m.marginBottom }]}
        testID={`${testID}-ai`}
      >
        AI
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  ai: { fontFamily: 'BricolageGrotesque_700Bold', includeFontPadding: false },
});
