// G21-S1 md.9 — sayfa içi bölüm sekmeleri (Keşfet "Senin için / Takip", Profil
// "Tabaklar / Gönderiler", FinSegmented kullanan Makro/Destek/Kuponlar).
//
// Sekme değişince: içerik yatay kayarak gelir (sağdaki sekmeye → sağdan), gösterge
// (alt çizgi / hap) yeni sekmeye kayar. Süre/eğri FinMoTokens'tan (PREMIUM.push ·
// CURVE). Azaltılmış hareket: kayma yok, 200 ms opaklık (REDUCED).
import React, { useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { CURVE, PREMIUM, REDUCED, useReducedMotion } from './motion';
import { indicatorFrame, sectionEnterOffset, type IndicatorOpts } from './sectionSlideMath';

export { indicatorFrame, sectionEnterOffset, SECTION_SHIFT_RATIO } from './sectionSlideMath';

/** İçerik kapsayıcısı: `index` değişince yeni bölüm yatay kayarak (azaltılmışta opaklıkla) girer. */
export function SectionSlide({
  index,
  children,
  style,
  testID,
}: {
  index: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const reduced = useReducedMotion();
  const tx = useSharedValue(0);
  const op = useSharedValue(1);
  const prev = useRef(index);
  const width = useRef(0);
  useEffect(() => {
    if (prev.current === index) return;
    const from = sectionEnterOffset(prev.current, index, width.current);
    prev.current = index;
    if (reduced) {
      tx.value = 0;
      op.value = 0;
      op.value = withTiming(1, { duration: REDUCED.duration });
      return;
    }
    tx.value = from;
    op.value = 0;
    tx.value = withTiming(0, { duration: PREMIUM.push.enter, easing: CURVE.enter });
    op.value = withTiming(1, { duration: PREMIUM.tab.duration, easing: PREMIUM.tab.curve });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, reduced]);
  const anim = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateX: tx.value }] }));
  return (
    <Animated.View
      testID={testID}
      style={[style, anim]}
      onLayout={(e: LayoutChangeEvent) => {
        width.current = e.nativeEvent.layout.width;
      }}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Sekme satırının ölçülen genişliği. Satıra `onLayout` verilir; gösterge buna göre
 * konumlanır (ölçülmeden gösterge çizilmez → açılışta soldan kayma yok).
 */
export function useRowWidth(): [number, (e: LayoutChangeEvent) => void] {
  const [w, setW] = useState(0);
  return [w, (e: LayoutChangeEvent) => {
    const next = e.nativeEvent.layout.width;
    setW((cur) => (cur === next ? cur : next));
  }];
}

/**
 * Kayan gösterge (alt çizgi ya da hap). Satırın içinde mutlak konumlu çizilir;
 * dokunmayı engellemez. İlk ölçümde animasyonsuz yerleşir.
 */
export function SlidingIndicator({
  index,
  count,
  containerWidth,
  style,
  testID,
  ...opts
}: IndicatorOpts & {
  index: number;
  count: number;
  containerWidth: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const reduced = useReducedMotion();
  const frame = indicatorFrame(index, count, containerWidth, opts);
  const x = useSharedValue(frame.x);
  const op = useSharedValue(1);
  const placed = useRef(false);
  const prevIndex = useRef(index);
  useEffect(() => {
    if (!(containerWidth > 0)) return;
    const changed = prevIndex.current !== index;
    prevIndex.current = index;
    if (!placed.current || !changed) {
      // İlk yerleşim / yalnız genişlik değişimi: atlamadan yerine otur.
      placed.current = true;
      x.value = frame.x;
      return;
    }
    if (reduced) {
      x.value = frame.x;
      op.value = 0;
      op.value = withTiming(1, { duration: REDUCED.duration });
      return;
    }
    x.value = withTiming(frame.x, { duration: PREMIUM.push.enter, easing: CURVE.standard });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, containerWidth, frame.x, reduced]);
  const anim = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateX: x.value }] }));
  if (!(containerWidth > 0)) return null;
  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, width: frame.width }, style, anim]}
    />
  );
}
