import React from 'react';
import { Text, TextProps } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { type as typeScale, TypeScaleKey, role as roleScale, RoleKey } from '../typography';

/**
 * Yeni tasarımın metin bileşeni.
 *
 * - Ölçek iki yoldan seçilir:
 *     • `variant` — genel ölçek kademesi (display/title/heading/body/caption).
 *     • `role` — FinComponents EKRAN rolü (screenTitle/section/sheetTitle/body/
 *       bodySm/helper, 24/20/20/17/15/13). `role` verilirse `variant`'ı ezer.
 * - Rengi temadan gelir (`ink` varsayılan; secondary/onAccent/accentLine/danger),
 *   ekran hex yazmaz.
 * - Dynamic Type: `allowFontScaling` açık + her kademeye özel
 *   `maxFontSizeMultiplier` tavanı (typography.ts). Başlıklarda satır kırılır,
 *   gövde serbest sarar.
 *
 * Mevcut ekranlardaki `Text`'lere DOKUNMAZ; yalnız yeni tasarım kullanır.
 */
export function AppText({
  variant = 'body',
  textRole,
  tone = 'ink',
  style,
  ...rest
}: TextProps & {
  variant?: TypeScaleKey;
  /** FinComponents EKRAN rolü — RN'in ARIA `role` prop'uyla çakışmasın diye `textRole`. */
  textRole?: RoleKey;
  tone?: 'ink' | 'secondary' | 'onAccent' | 'accentLine' | 'danger';
}) {
  const t = useTheme();
  const entry = textRole ? roleScale[textRole] : typeScale[variant];
  const color =
    tone === 'secondary'
      ? t.color.secondary
      : tone === 'onAccent'
        ? t.color.onAccent
        : tone === 'accentLine'
          ? t.color.accentLine
          : tone === 'danger'
            ? t.color.danger
            : t.color.ink;

  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={entry.scaleCap}
      style={[entry.style, { color }, style]}
      {...rest}
    />
  );
}
