// TabBarR3 ikonları — tasarımın (t20/TabBarR3.dc.html) SVG yolları BİREBİR,
// react-native-svg ile (G11-S2). Mevcut ikon seti (phosphor) bu dört sekme +
// Tara için tam eşleşmediğinden tasarım yolları doğrudan çizilir.
//
// Model: her ikonun çizgisi daima `color` (ink) ile; AKTİF sekmede içi dolar
// (`filled`). Keşfet pusulasının iğnesi aktifken `cutColor` (hapın rengi) ile
// "oyulmuş" görünür. Aktif vurgusu asıl olarak altındaki cam bubble'dan gelir.

import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export interface TabIconProps {
  size?: number;
  /** Çizgi rengi (ve aktifken dolgu). */
  color: string;
  /** Aktif sekmede içi dolu. */
  filled?: boolean;
  /** Keşfet iğnesinin aktifken oyulduğu renk (cam bubble rengi). */
  cutColor?: string;
}

const SW = 1.75;

export function HomeIcon({ size = 24, color, filled }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 10.5 12 3.5l8.5 7v9.5a.5.5 0 0 1-.5.5h-5.5v-6h-5v6H4a.5.5 0 0 1-.5-.5Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ExploreIcon({ size = 24, color, filled, cutColor = '#FFFFFF' }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} fill={filled ? color : 'none'} stroke={color} strokeWidth={SW} />
      <Path
        d="M15.5 8.5l-2 5-5 2 2-5Z"
        fill={filled ? cutColor : 'none'}
        stroke={filled ? cutColor : color}
        strokeWidth={SW}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function EatIcon({ size = 24, color, filled }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 7.5h16l-1.2 12.5H5.2Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8.5 7.5a3.5 3.5 0 0 1 7 0"
        fill="none"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ProfileIcon({ size = 24, color, filled }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8.5} r={4} fill={filled ? color : 'none'} stroke={color} strokeWidth={SW} />
      <Path
        d="M4 20.5c1.6-3 4.6-4.5 8-4.5s6.4 1.5 8 4.5Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Ayrık "Tara" dairesindeki ikon — tarama çerçevesi + yaprak/ay. */
export function ScanIcon({ size = 22, color }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
      <Path
        d="M16.92 11.13A5 5 0 1 1 13.71 7.3A2.6 2.6 0 0 0 16.92 11.13Z"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export const TAB_ICON_BY_KIND = {
  home: HomeIcon,
  explore: ExploreIcon,
  eat: EatIcon,
  profile: ProfileIcon,
} as const;
