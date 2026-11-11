// G33-S1 md.1 — Profil › Abonelik satırının ÖZEL yeşil cam ikonu (05-profil-paywall-koc "Abonelik").
// Cam dili: lime gövde (dikey degrade) + üst-sol parlama + ince koyu-lime kenar. Hareketsiz.
import React from 'react';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useTheme } from '../../../core/design';

const STAR = 'M12 1.5c.5 4.9 2.6 9 9.5 10.5-6.9 1.5-9 5.6-9.5 10.5-.5-4.9-2.6-9-9.5-10.5C9.4 10.5 11.5 6.4 12 1.5Z';
const SHINE = 'M11.2 5.2c-.4 2.4-1.5 4.4-4 5.6 1.6-.1 3.4-1.3 4-5.6Z';

export function GlassSparkle({ size = 20 }: { size?: number }) {
  const t = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="glass-sparkle">
      <Defs>
        <LinearGradient id="gsBody" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#E4FA9E" />
          <Stop offset="0.55" stopColor="#C6F04F" />
          <Stop offset="1" stopColor="#8DBB1E" />
        </LinearGradient>
      </Defs>
      <Path d={STAR} fill="url(#gsBody)" stroke={t.isDark ? '#C6F04F' : '#4A6B00'} strokeOpacity={0.55} strokeWidth={0.8} />
      <Path d={SHINE} fill="#FFFFFF" fillOpacity={0.75} />
    </Svg>
  );
}
