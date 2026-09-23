import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { TYPOGRAPHY } from '../constants/theme';

interface MacroRingProps {
  /** 0–1 arasi dolu oran (makronun toplam gram icindeki payi) */
  ratio: number;
  /** Halka rengi (MACRO_COLORS[x].main) */
  color: string;
  /** Halka izi rengi (MACRO_COLORS[x].track) */
  trackColor: string;
  /** Halkanin ortasinda yazan deger, or. "59g" */
  value: string;
  /** Halkanin altinda yazan etiket, or. "Protein" */
  label: string;
  size?: number;
  stroke?: number;
}

/**
 * Tek makro icin halka (donut) gostergesi. Sepet Siparis Ozeti'nde eski
 * dusuk-opakliktaki yesil zeminli yigin-bar bloğunun yerini alir
 * (21.09.2026 tasarim notu): zemin katmani yok, gosterge grafiksel.
 */
export default function MacroRing({
  ratio,
  color,
  trackColor,
  value,
  label,
  size = 62,
  stroke = 6,
}: MacroRingProps) {
  const safeRatio = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * safeRatio;

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={stroke}
            fill="none"
          />
          {safeRatio > 0 ? (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${dash} ${circumference - dash}`}
              // -90deg: dolum saat 12'den baslasin
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ) : null}
        </Svg>
        <View style={[StyleSheet.absoluteFillObject, styles.center]}>
          <Text style={[styles.value, { color }]} numberOfLines={1}>{value}</Text>
        </View>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6 },
  center: { alignItems: 'center', justifyContent: 'center' },
  value: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
  },
  label: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#6B7280',
  },
});
