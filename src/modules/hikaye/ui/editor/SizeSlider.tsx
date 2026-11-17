// G59-S1 — Çizim "Boyut" kaydırıcısı (tasarım `.range`: iz 4 pt, başparmak 28 pt beyaz + gölge, 44 pt yükseklik,
// 2–24 pt). Yeni paket yok → PanResponder. VoiceOver: `adjustable` (yukarı/aşağı kaydır = ±1 pt).
import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';

export function SizeSlider({
  value,
  min = 2,
  max = 24,
  onChange,
  track,
  label,
  valueText,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  track: string;
  label: string;
  valueText: string;
}) {
  const [w, setW] = useState(1);
  const startV = useRef(value);
  const cur = useRef(value);
  cur.current = value;
  const clamp = (v: number) => Math.round(Math.min(max, Math.max(min, v)));
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const x = e.nativeEvent.locationX;
          const v = clamp(min + (x / Math.max(1, w)) * (max - min));
          startV.current = v;
          onChange(v);
        },
        onPanResponderMove: (_e, gs) => onChange(clamp(startV.current + (gs.dx / Math.max(1, w)) * (max - min))),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [w, min, max, onChange],
  );
  const pct = (value - min) / (max - min);
  return (
    <View
      {...responder.panHandlers}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value, text: valueText }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(clamp(cur.current + (e.nativeEvent.actionName === 'increment' ? 1 : -1)))}
      style={{ flex: 1, minWidth: 0, height: 44, justifyContent: 'center' }}
    >
      <View style={{ height: 4, borderRadius: 2, backgroundColor: track }} />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: Math.max(0, pct * (w - 28)),
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: '#FFFFFF',
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 1 },
          elevation: 3,
        }}
      />
    </View>
  );
}
