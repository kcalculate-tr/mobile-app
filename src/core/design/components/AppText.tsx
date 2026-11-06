import React, { createContext, useContext } from 'react';
import { StyleSheet, Text, TextProps, TextStyle } from 'react-native';
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

  const flat = StyleSheet.flatten([entry.style, { color }, style]) as TextStyle;
  const weighted = withWeightFamily(flat);
  const cap = Math.min(entry.scaleCap, useContext(TextScaleCapContext));

  return <Text allowFontScaling maxFontSizeMultiplier={cap} style={weighted} {...rest} />;
}

/**
 * G15-S2 — Ekran bazında Dynamic Type tavanı (ör. Ana sayfa en büyük yazıda
 * başlık/etiket kırpılmasın; FinHomeXL ≈ 1.3×). Varsayılan sınırsız → AppText
 * kendi kademesinin tavanını kullanır (davranış değişmez).
 */
export const TextScaleCapContext = createContext<number>(Number.POSITIVE_INFINITY);

const JAKARTA: Record<string, string> = {
  '400': 'PlusJakartaSans_400Regular',
  normal: 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  bold: 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
};
const BRICOLAGE: Record<string, string> = {
  '400': 'BricolageGrotesque_400Regular',
  normal: 'BricolageGrotesque_400Regular',
  '500': 'BricolageGrotesque_500Medium',
  '600': 'BricolageGrotesque_600SemiBold',
  '700': 'BricolageGrotesque_700Bold',
  bold: 'BricolageGrotesque_700Bold',
  '800': 'BricolageGrotesque_800ExtraBold',
};

/**
 * G15-S2 — Özel fontlarda `fontWeight` iOS'ta yok sayılır (tek ağırlıklı aile
 * dosyası). Stil `fontWeight` veriyorsa aynı ailenin o ağırlıktaki dosyasına
 * geçilir ("Bugün henüz boş" 600, halka yüzdeleri 600 …). SAF; test edilir.
 */
export function withWeightFamily(s: TextStyle): TextStyle {
  const fam = s.fontFamily;
  const w = s.fontWeight != null ? String(s.fontWeight) : null;
  if (!fam || !w) return s;
  const table = fam.startsWith('PlusJakartaSans_') ? JAKARTA : fam.startsWith('BricolageGrotesque_') ? BRICOLAGE : null;
  const next = table?.[w];
  if (!next || next === fam) return s;
  const { fontWeight: _drop, ...restStyle } = s;
  return { ...restStyle, fontFamily: next };
}
