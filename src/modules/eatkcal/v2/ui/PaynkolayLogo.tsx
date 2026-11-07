// G17-S1 md.8 — Resmî PaynKolay logosu (eski uygulamadaki varlık:
// assets/payment/paynkolay-logo.png, 245×48; eski CheckoutScreen'de 82×16).
// Oran korunur. Koyu temada lacivert logo koyu zeminde okunmadığından beyaz
// küçük bir rozet içinde durur (logo renkleri değişmez).
// `PaynkolayText`: metindeki "PaynKolay" sözcüğünün yerine satır içi logo koyar;
// erişilebilirlik etiketi metnin tamamıdır.
import React from 'react';
import { Image, StyleProp, StyleSheet, TextStyle, View } from 'react-native';
import { FinText as Text } from '../../../../core/design/components/FinText';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../../../../assets/payment/paynkolay-logo.png');
const RATIO = 245 / 48;

export function PaynkolayLogo({ height = 16, isDark }: { height?: number; isDark: boolean }) {
  const img = (
    <Image
      source={LOGO}
      style={{ width: Math.round(height * RATIO), height }}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="PaynKolay"
    />
  );
  if (!isDark) return img;
  return <View style={styles.chip}>{img}</View>;
}

const WORD = /PaynKolay|Paynkolay|PAYNKOLAY/;

export function PaynkolayText({
  text,
  style,
  isDark,
  logoHeight = 13,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  isDark: boolean;
  logoHeight?: number;
}) {
  const m = WORD.exec(text);
  if (!m) return <Text style={style}>{text}</Text>;
  const before = text.slice(0, m.index);
  const after = text.slice(m.index + m[0].length);
  return (
    <Text style={style} accessibilityLabel={text}>
      {before}
      <PaynkolayLogo height={logoHeight} isDark={isDark} />
      {after}
    </Text>
  );
}

const styles = StyleSheet.create({
  chip: { backgroundColor: '#FFFFFF', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
});
