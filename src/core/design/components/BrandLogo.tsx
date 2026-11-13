// G39-S1 md.1 — Marka logosu: "kcal." · "eatkcal" · "kcalculate".
//
// Kaynak `assets/brand/*-logo.svg` (kırpılmış viewBox, fill=currentColor). SVG transformer
// yok → yol verisi `brandLogoPaths.ts`'te, react-native-svg <Path> ile çizilir.
//  • `height` verilir, genişlik viewBox en-boy oranından (kcal 2,81 · eatkcal 4,57 · kcalculate 6,43).
//  • Renk varsayılanı tema metin rengi (Light siyah · Dark beyaz); `color` ile değişir.
//  • Erişilebilirlik: tek "image" öğesi, etiket marka adı (ya da `accessibilityLabel`, ör. "Keşfet").
//    `decorative` → VoiceOver'da gizli (yanında aynı adı okuyan metin/başlık varsa).
import React from 'react';
import { View, type AccessibilityRole, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../ThemeProvider';
import { BRAND_LOGO_PATHS } from './brandLogoPaths';
import { BRAND_LABEL, brandLogoWidth, type BrandName } from './brandLogoMarkup';

export type { BrandName };
export { BRAND_LABEL, brandAspect, brandLogoWidth, brandLogoSvgMarkup } from './brandLogoMarkup';

export function BrandLogo({
  name,
  height,
  color,
  accessibilityLabel,
  accessibilityRole = 'image',
  decorative = false,
  style,
  testID,
}: {
  name: BrandName;
  height: number;
  color?: string;
  /** Varsayılan marka adı. Başlık yerine duran logoda başlığın adı verilir (ör. "Keşfet"). */
  accessibilityLabel?: string;
  /** Başlık yerine duruyorsa 'header'. */
  accessibilityRole?: AccessibilityRole;
  decorative?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const t = useTheme();
  const fill = color ?? t.color.ink;
  const { viewBox, paths } = BRAND_LOGO_PATHS[name];
  const width = brandLogoWidth(name, height);
  return (
    <View
      style={[{ width, height }, style]}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : accessibilityRole}
      accessibilityLabel={decorative ? undefined : accessibilityLabel ?? BRAND_LABEL[name]}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      testID={testID ?? `brand-logo-${name}`}
    >
      <Svg width={width} height={height} viewBox={viewBox} fill={fill} testID={`${testID ?? `brand-logo-${name}`}-svg`}>
        {paths.map((d, i) => (
          <Path key={i} d={d} fill={fill} />
        ))}
      </Svg>
    </View>
  );
}
