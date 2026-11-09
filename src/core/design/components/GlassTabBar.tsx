import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useTheme } from '../ThemeProvider';
import { AppText } from './AppText';
import { CURVE, DURATION, REDUCED, SPRING, haptic, useReducedMotion } from '../motion';

const TABS = ['Ana sayfa', 'Keşfet', 'eatkcal', 'Profil'] as const;
const INDICATOR_W = 18;

/**
 * GlassTabBar — vitrin için "cam" (expo-blur) sekme çubuğu.
 *
 * Ana sayfa · Keşfet · eatkcal · Profil + sağda ayrı **Tara** butonu. Aktif
 * sekmenin altında lime bir nokta; sekme değişince nokta hedefe kayarken kısa
 * bir **kurdeleye uzar** (scaleX) ve varışta toparlanır. Konum yay (withSpring,
 * velocity carry) ile sürülür; tüm hareket UI thread'de.
 *
 * ⚠️ YALNIZCA VİTRİN. Uygulamanın gerçek tab bar'ına (src/navigation) dokunmaz.
 *
 * Azaltılmışta: nokta kısa bir timing ile hedefe gider, kurdele uzaması yok.
 */
export function GlassTabBar({ style }: { style?: ViewStyle }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [barWidth, setBarWidth] = useState(0);

  const pos = useSharedValue(0); // aktif sekme indeksi (kesirli, animasyonlu)
  const stretch = useSharedValue(0); // 0→1→0 geçişte kurdele uzaması
  const scanPulse = useSharedValue(0);

  const tabWidth = barWidth / TABS.length;

  const onLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);

  const selectTab = (i: number) => {
    if (i === active) return;
    haptic('selection');
    setActive(i);
    if (reduced) {
      pos.value = withTiming(i, { duration: REDUCED.duration });
      return;
    }
    pos.value = withSpring(i, SPRING.ai);
    stretch.value = withSequence(
      withTiming(1, { duration: DURATION.instant, easing: CURVE.standard }),
      withTiming(0, { duration: DURATION.fast, easing: CURVE.standard }),
    );
  };

  const onScan = () => {
    haptic('medium');
    if (reduced) return;
    scanPulse.value = withSequence(
      withTiming(1, { duration: DURATION.instant, easing: CURVE.standard }),
      withTiming(0, { duration: DURATION.fast, easing: CURVE.standard }),
    );
  };

  const indicatorStyle = useAnimatedStyle(() => {
    if (!tabWidth) return { opacity: 0 };
    const center = tabWidth * (pos.value + 0.5);
    return {
      opacity: 1,
      transform: [
        { translateX: center - INDICATOR_W / 2 },
        { scaleX: 1 + stretch.value * 2.4 },
      ],
    };
  });

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(scanPulse.value, [0, 1], [1, 0.9]) }],
  }));

  return (
    <View style={[styles.row, style]}>
      <View style={styles.barWrap}>
        <BlurView
          intensity={40}
          tint={t.isDark ? 'dark' : 'light'}
          style={[styles.bar, { borderColor: t.color.line, backgroundColor: t.isDark ? 'rgba(28,28,30,0.55)' : 'rgba(255,255,255,0.55)' }]}
          onLayout={onLayout}
        >
          {TABS.map((label, i) => (
            <Pressable
              key={label}
              style={styles.tab}
              onPress={() => selectTab(i)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active === i }}
              accessibilityLabel={label}
            >
              <AppText variant="caption" tone={active === i ? 'ink' : 'secondary'} numberOfLines={1}>
                {label}
              </AppText>
            </Pressable>
          ))}
          {/* Aktif nokta / kurdele */}
          <Animated.View
            style={[styles.indicator, { width: INDICATOR_W, backgroundColor: t.color.accent }, indicatorStyle]}
            pointerEvents="none"
          />
        </BlurView>
      </View>

      {/* Ayrı Tara butonu */}
      <Animated.View style={scanStyle}>
        <Pressable
          onPress={onScan}
          style={[styles.scan, { backgroundColor: t.color.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Tara"
        >
          <ScanGlyph color={t.color.onAccent} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** Basit tarama çerçevesi (dört köşe) — ikon paketi gerekmeden. */
function ScanGlyph({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 8V5a1 1 0 0 1 1-1h3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M20 8V5a1 1 0 0 0-1-1h-3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M4 16v3a1 1 0 0 0 1 1h3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M20 16v3a1 1 0 0 1-1 1h-3" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M3 12h18" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  barWrap: { flex: 1, borderRadius: 999, overflow: 'hidden' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  indicator: {
    position: 'absolute',
    left: 0,
    bottom: 7,
    height: 5,
    borderRadius: 3,
  },
  scan: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
