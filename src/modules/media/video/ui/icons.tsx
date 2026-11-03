// Video kontrol ikonları — basit geometrik şekiller (react-native-svg).
// Keşfet'in Phosphor path seti yerine kasıtlı olarak ayrı: media/video
// modülü kesfet'e bağımlı DEĞİL (başka akışlarda da kullanılabilir).
// Görsel ince ayar sonraki tasarım turunda (.claude/night/design/).
import React from 'react';
import Svg, { Path, Polygon, Line } from 'react-native-svg';

export function PlayIcon({ size = 28, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256">
      <Polygon points="76,48 76,208 200,128" fill={color} />
    </Svg>
  );
}

function SpeakerBody({ color }: { color: string }) {
  return <Polygon points="40,96 88,96 140,56 140,200 88,160 40,160" fill={color} />;
}

export function VolumeOnIcon({ size = 22, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256">
      <SpeakerBody color={color} />
      <Path
        d="M168,96 a40,40 0 0 1 0,64"
        stroke={color}
        strokeWidth={14}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M190,72 a72,72 0 0 1 0,112"
        stroke={color}
        strokeWidth={14}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export function VolumeOffIcon({ size = 22, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256">
      <SpeakerBody color={color} />
      <Line x1="172" y1="100" x2="224" y2="156" stroke={color} strokeWidth={14} strokeLinecap="round" />
      <Line x1="224" y1="100" x2="172" y2="156" stroke={color} strokeWidth={14} strokeLinecap="round" />
    </Svg>
  );
}

export function ExpandIcon({ size = 22, color = '#FFFFFF' }: { size?: number; color?: string }) {
  const arm = 44;
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256">
      <Path d={`M40,${40 + arm} L40,40 L${40 + arm},40`} stroke={color} strokeWidth={16} strokeLinecap="round" fill="none" />
      <Path d={`M${216 - arm},40 L216,40 L216,${40 + arm}`} stroke={color} strokeWidth={16} strokeLinecap="round" fill="none" />
      <Path d={`M216,${216 - arm} L216,216 L${216 - arm},216`} stroke={color} strokeWidth={16} strokeLinecap="round" fill="none" />
      <Path d={`M${40 + arm},216 L40,216 L40,${216 - arm}`} stroke={color} strokeWidth={16} strokeLinecap="round" fill="none" />
    </Svg>
  );
}
