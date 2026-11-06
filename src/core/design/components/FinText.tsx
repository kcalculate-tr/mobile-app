import React, { forwardRef, useContext } from 'react';
import { Platform, StyleSheet, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { fontFamily } from '../typography';
import { AppTextFamilyContext, withWeightFamily } from './AppText';

/**
 * G16-S2 — Final ekranlarının TEK yazı tipi çözücüsü (Android uyumu).
 *
 * Neden: React 19'da `Text.defaultProps` artık uygulanmıyor (jsx-runtime
 * defaultProps'u yalnız sınıf bileşenlerine uygular). App.tsx'teki global
 * "Plus Jakarta Sans" ataması bu yüzden ÖLÜ: `fontFamily` vermeyen her metin
 * iOS'ta San Francisco'ya, Android'de Roboto'ya düşüyordu. Ayrıca özel fontta
 * `fontWeight` iOS'ta yok sayılır, Android'de sahte kalın üretir (tek dosyalı
 * aile) — her ağırlık kendi `fontFamily` adını kullanmalı.
 *
 * Kurallar (iOS ve Android'de aynı ad):
 *  1. `fontFamily` yoksa ebeveyn metnin ailesi, o da yoksa PlusJakartaSans_400Regular.
 *  2. `fontWeight` varsa aynı ailenin o ağırlıktaki dosyasına geçilir
 *     (PlusJakartaSans_* / BricolageGrotesque_*), `fontWeight` düşer.
 *  3. Android: `includeFontPadding: false` (iOS ile aynı dikey ölçü; Plus Jakarta'nın
 *     yüksek ascent/descent'i Android'de üst/alt boşluk ekleyip metni kayık/küçük
 *     gösteriyordu). Stil açıkça verirse dokunulmaz.
 *
 * Yalnız bayrak arkasındaki Final modülleri kullanır (import `Text` yerine
 * `FinText as Text`). Bayrak kapalı ekranlar RN `Text`'te kalır → bayt bayt aynı.
 */

// Ebeveyn metnin ailesi (AppText de aynı bağlamı sağlar).
const ParentFamilyContext = AppTextFamilyContext;

/** SAF — test edilir. */
export function resolveFinTextStyle(
  style: StyleProp<TextStyle>,
  parentFamily: string | null,
  os: string = Platform.OS,
): TextStyle {
  const flat = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const fam = flat.fontFamily ?? parentFamily ?? fontFamily.bodyRegular;
  let out = withWeightFamily({ ...flat, fontFamily: fam });
  if (os === 'android' && flat.includeFontPadding === undefined) {
    out = { ...out, includeFontPadding: false };
  }
  return out;
}

export const FinText = forwardRef<React.ElementRef<typeof Text>, TextProps>(function FinText(
  { style, ...rest },
  ref,
) {
  const parent = useContext(ParentFamilyContext);
  const resolved = resolveFinTextStyle(style, parent);
  return (
    <ParentFamilyContext.Provider value={resolved.fontFamily ?? null}>
      <Text ref={ref} style={resolved} {...rest} />
    </ParentFamilyContext.Provider>
  );
});
