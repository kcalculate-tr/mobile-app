import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { type as typeScale, TypeScaleKey } from '../typography';

/**
 * Yeni tasarımın metin bileşeni.
 *
 * - Ölçeği `variant` ile seçilir (display/title/heading/body/caption).
 * - Rengi temadan gelir (`ink` varsayılan, `tone="secondary"` ya da
 *   `tone="onAccent"`), ekran hex yazmaz.
 * - Dynamic Type: `allowFontScaling` açık + her kademeye özel
 *   `maxFontSizeMultiplier` tavanı (typography.ts). Başlıklarda satır kırılır,
 *   gövde serbest sarar.
 *
 * Mevcut ekranlardaki `Text`'lere DOKUNMAZ; yalnız yeni tasarım kullanır.
 */
export function AppText({
  variant = 'body',
  tone = 'ink',
  style,
  ...rest
}: TextProps & {
  variant?: TypeScaleKey;
  tone?: 'ink' | 'secondary' | 'onAccent';
}) {
  const t = useTheme();
  const entry = typeScale[variant];
  const color =
    tone === 'secondary' ? t.color.secondary : tone === 'onAccent' ? t.color.onAccent : t.color.ink;

  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={entry.scaleCap}
      style={[entry.style, { color }, style]}
      {...rest}
    />
  );
}
