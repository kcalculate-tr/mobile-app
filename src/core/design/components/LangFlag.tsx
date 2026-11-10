// G22-S2 md.6 — dil seçici için YEREL küçük bayrak (react-native-svg; ağ/görsel dosyası yok).
// Apple HIG: bayrak yalnız süs; dilin adı her zaman metin olarak yanında yazılır, bu
// yüzden bayrak erişilebilirlik ağacından gizlenir.
import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Polygon, Rect } from 'react-native-svg';
import type { FlagId } from '../../i18n/languages';

const W = 28;
const H = 20;

function star(cx: number, cy: number, r: number, rotDeg: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.382;
    const a = ((rotDeg + i * 36) * Math.PI) / 180;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

/** Türkiye — 3:2 (G = 20): ay 0,5G merkez, iç daire +0,0625G; yıldız bir ucu gönderde. */
function Turkey() {
  return (
    <G>
      <Rect width={30} height={20} fill="#E30A17" />
      <Circle cx={10} cy={10} r={5} fill="#FFFFFF" />
      <Circle cx={11.25} cy={10} r={4} fill="#E30A17" />
      <Polygon points={star(16.6, 10, 2.5, 180)} fill="#FFFFFF" />
    </G>
  );
}

/** Birleşik Krallık — sadeleştirilmiş Union Jack (60×30 tasarım, 30×20'ye ölçekli). */
function UnitedKingdom() {
  return (
    <G transform="scale(0.5 0.6667)">
      <Rect width={60} height={30} fill="#012169" />
      <Path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth={6} />
      <Path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth={2.4} />
      <Path d="M30,0 V30 M0,15 H60" stroke="#FFFFFF" strokeWidth={10} />
      <Path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth={6} />
    </G>
  );
}

const FLAGS: Record<FlagId, () => React.ReactElement> = {
  tr: Turkey,
  gb: UnitedKingdom,
};

export function LangFlag({ flag, borderColor }: { flag: FlagId; borderColor?: string }) {
  const Body = FLAGS[flag];
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{
        width: W,
        height: H,
        borderRadius: 4,
        overflow: 'hidden',
        borderWidth: borderColor ? 0.5 : 0,
        borderColor,
      }}
    >
      <Svg width={W} height={H} viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <ClipPath id={`flag-${flag}`}>
            <Rect width={30} height={20} rx={3} />
          </ClipPath>
        </Defs>
        <G clipPath={`url(#flag-${flag})`}>{Body ? <Body /> : null}</G>
      </Svg>
    </View>
  );
}
