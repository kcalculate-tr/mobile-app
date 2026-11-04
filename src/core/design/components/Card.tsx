import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '../ThemeProvider';

/**
 * Kart — FinComponents: 20 köşe · 14 iç boşluk · OPAK yüzey.
 * "Cam yalnız yüzen katmanlarda" kuralı gereği akış içi kartlar opaktır (cam
 * değil). Çerçeve ince çizgi; açık temada hafif gölge.
 */
export function Card({
  children,
  style,
  padded = true,
  testID,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** false → iç boşluk yok (ör. kartın içinde tam-genişlik görsel). */
  padded?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: t.color.surface,
          borderColor: t.color.line,
          borderWidth: t.stroke.hairline,
          borderRadius: t.radius.lg, // 20
          padding: padded ? 14 : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
