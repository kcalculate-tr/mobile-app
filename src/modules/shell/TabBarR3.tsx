// TabBarR3 — yeni kabuğun cam sekme çubuğu (G11-S2).
//
// Tasarım: `.claude/night/design/t20/TabBarR3.dc.html` birebir:
//   · Cam hap (blur + iç kenar highlight), 4 sekme, aktif gösterge (bubble).
//   · Sağda AYRIK yuvarlak "Tara" düğmesi (yalnız `ai_tarama` açıkken).
//   · Durumlar: tam / küçük (aşağı kaydırınca hap tek daireye iner).
//   · Açık + koyu tema, TR + EN.
//
// Hareket (yalnız core/design/motion token'ları + usePop + haptic):
//   · İlk açılış: bar aşağıdan yükselir (Ağır, SPRING.ai).
//   · Aktif gösterge: nokta → hap morfu (Orta) + sekme değişiminde kayar (SPRING.ai).
//   · Tara: basışta usePop + haptic.
//   · Küçülme/büyüme: Orta (collapsed SharedValue'dan interpolasyon).
//   · Azaltılmış harekette: yalnız opaklık/kısa timing (REDUCED).
// Sekme İÇERİĞİ arasında geçiş animasyonu YOK (AppNavigator 24.09 kararı).

import React, { useEffect, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import { useTheme } from '../../core/design/ThemeProvider';
import { useT } from '../../core/i18n';
import {
  DURATION,
  REDUCED,
  SPRING,
  TIMING,
  haptic,
  useReducedMotion,
  usePop,
} from '../../core/design/motion';
import { useFeature } from '../../core/flags';
import { useCartStore } from '../../store/cartStore';
import { TAB_BAR_R3 } from './layout';
import { useTabBarCollapsedValue } from './scroll';
import { resolveShellTabs, shouldShowScan, type ShellTabDef } from './tabs';
import { TAB_ICON_BY_KIND, ScanIcon } from './icons';

/** R3 cam token'ları — tasarımın tokens() çıktısı (light/dark) birebir. */
function glassTokens(dark: boolean) {
  if (dark) {
    return {
      ink: '#F5F5F5',
      glass: 'rgba(44,44,46,0.55)',
      edge: 'rgba(255,255,255,0.14)',
      hi: 'rgba(255,255,255,0.10)',
      bubble: 'rgba(255,255,255,0.16)',
      bubbleEdge: 'rgba(255,255,255,0.10)',
      cut: '#2C2C2E',
      tint: 'dark' as const,
    };
  }
  return {
    ink: '#0A0A0A',
    glass: 'rgba(255,255,255,0.58)',
    edge: 'rgba(10,10,10,0.08)',
    hi: 'rgba(255,255,255,0.7)',
    bubble: 'rgba(255,255,255,0.92)',
    bubbleEdge: 'rgba(10,10,10,0.06)',
    cut: '#FFFFFF',
    tint: 'light' as const,
  };
}

export function TabBarR3({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const g = glassTokens(theme.isDark);
  const i18n = useT();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width: winW } = useWindowDimensions();

  const aiTarama = useFeature('ai_tarama');
  const showScan = shouldShowScan({ ai_tarama: aiTarama });
  const cartCount = useCartStore((s) => s.items.reduce((sum, it) => sum + it.quantity, 0));

  // Görünür sekmeler: tasarım sırası + yalnız navigatörde KAYITLI olanlar
  // (KesfetTab, `kesfet` kapalıyken hiç kaydolmaz → burada da çıkmaz).
  const routeNames = useMemo(() => new Set(state.routes.map((r) => r.name)), [state.routes]);
  const visibleTabs = useMemo<ShellTabDef[]>(
    () =>
      resolveShellTabs({ kesfet: routeNames.has('KesfetTab') }).filter((d) =>
        routeNames.has(d.route),
      ),
    [routeNames],
  );

  const activeName = state.routes[state.index]?.name;
  const activeIndex = visibleTabs.findIndex((d) => d.route === activeName);
  const onEat = activeName === 'Home';

  // ── Geometri ──────────────────────────────────────────────────────────────
  const containerW = winW - 2 * TAB_BAR_R3.SIDE_INSET;
  const scanFull = showScan ? TAB_BAR_R3.SCAN_SIZE : 0;
  const scanGap = showScan ? TAB_BAR_R3.GAP : 0;
  const pillFullW = containerW - scanGap - scanFull;
  const nTabs = Math.max(visibleTabs.length, 1);
  const tabW = (pillFullW - 2 * TAB_BAR_R3.BUBBLE_PAD) / nTabs;

  // ── Hareket: açılışta yükselme ──────────────────────────────────────────────
  const enter = useSharedValue(0);
  const rise = TAB_BAR_R3.PILL_HEIGHT + TAB_BAR_R3.BOTTOM_GAP + insets.bottom;
  useEffect(() => {
    enter.value = reduced
      ? withTiming(1, { duration: REDUCED.duration })
      : withSpring(1, SPRING.ai);
    // yalnız ilk açılışta; reduced değişiminde süre doğru kurulsun.
  }, [enter, reduced]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: interpolate(enter.value, [0, 1], [reduced ? REDUCED.maxShift : rise, 0]) },
    ],
  }));

  // ── Hareket: aktif gösterge (nokta → hap morfu + kayma) ─────────────────────
  const appeared = useSharedValue(0); // 0 nokta, 1 hap
  const posX = useSharedValue(0); // bubble sol konumu (px)
  useEffect(() => {
    if (activeIndex < 0) return;
    const target = TAB_BAR_R3.BUBBLE_PAD + activeIndex * tabW;
    if (appeared.value === 0) {
      posX.value = target; // ilk konum sıçramasız
      appeared.value = reduced
        ? withTiming(1, { duration: REDUCED.duration })
        : withTiming(1, { duration: TIMING.enter }); // nokta→hap (Orta)
    } else {
      posX.value = reduced
        ? withTiming(target, { duration: REDUCED.duration })
        : withSpring(target, SPRING.ai); // sekme değişiminde kayar
    }
  }, [activeIndex, tabW, reduced, appeared, posX]);

  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: activeIndex < 0 ? 0 : appeared.value,
    transform: [
      { translateX: posX.value },
      { scaleX: interpolate(appeared.value, [0, 1], [0.18, 1]) },
    ],
  }));

  // ── Hareket: küçülme (collapsed 0→1) ────────────────────────────────────────
  const collapsedShared = useTabBarCollapsedValue();
  const collapseStyle = useAnimatedStyle(() => {
    const c = collapsedShared?.value ?? 0;
    return {
      width: interpolate(c, [0, 1], [pillFullW, TAB_BAR_R3.MINI_SIZE]),
      height: interpolate(c, [0, 1], [TAB_BAR_R3.PILL_HEIGHT, TAB_BAR_R3.MINI_SIZE]),
      borderRadius: interpolate(
        c,
        [0, 1],
        [TAB_BAR_R3.PILL_RADIUS, TAB_BAR_R3.MINI_SIZE / 2],
      ),
    };
  });
  const fullRowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collapsedShared?.value ?? 0, [0, 0.5], [1, 0], 'clamp'),
  }));
  const miniStyle = useAnimatedStyle(() => ({
    opacity: interpolate(collapsedShared?.value ?? 0, [0.5, 1], [0, 1], 'clamp'),
  }));
  const scanSizeStyle = useAnimatedStyle(() => {
    const c = collapsedShared?.value ?? 0;
    const size = interpolate(c, [0, 1], [TAB_BAR_R3.SCAN_SIZE, TAB_BAR_R3.SCAN_SIZE_MINI]);
    return { width: size, height: size, borderRadius: size / 2 };
  });

  // Tara basış pop'u
  const scanPop = usePop();

  // ── Davranış ────────────────────────────────────────────────────────────────
  const handleTabPress = (routeName: string, routeKey: string) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: routeKey,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented && activeName !== routeName) {
      haptic('selection');
      navigation.navigate(routeName as never);
    }
  };

  const onScanPress = () => {
    scanPop.pop(); // usePop + haptik (success, günde 3 ile sınırlı — motion.tsx)
    const parent = navigation.getParent();
    (parent ?? navigation).navigate('AiScan' as never);
  };

  const expand = () => {
    if (collapsedShared) {
      collapsedShared.value = reduced
        ? withTiming(0, { duration: REDUCED.duration })
        : withTiming(0, { duration: DURATION.emphasis });
    }
  };

  const onCartPress = () => {
    const cartRoute = state.routes.find((r) => r.name === 'Cart');
    if (!cartRoute) return;
    haptic('selection');
    navigation.navigate('Cart' as never);
  };

  const activeDef = activeIndex >= 0 ? visibleTabs[activeIndex] : undefined;
  const MiniIcon = activeDef ? TAB_ICON_BY_KIND[activeDef.kind] : TAB_ICON_BY_KIND.eat;

  return (
    <View
      style={[styles.root, { paddingBottom: insets.bottom + TAB_BAR_R3.BOTTOM_GAP }]}
      pointerEvents="box-none"
    >
      {/* Sepet hapı — yalnız eatkcal sekmesinde + sepette ürün varken */}
      {onEat && cartCount > 0 ? (
        <CartPill count={cartCount} glass={g} onPress={onCartPress} reduced={reduced} />
      ) : null}

      <Animated.View style={[styles.row, enterStyle]} pointerEvents="box-none">
        {/* Cam hap */}
        <Animated.View style={[styles.pillWrap, collapseStyle]}>
          <BlurView
            intensity={28}
            tint={g.tint}
            style={[StyleSheet.absoluteFill, { backgroundColor: g.glass }]}
          />
          <View
            style={[StyleSheet.absoluteFill, styles.pillBorder, { borderColor: g.edge }]}
            pointerEvents="none"
          />
          <View style={[styles.pillHighlight, { backgroundColor: g.hi }]} pointerEvents="none" />

          {/* TAM durum — 4 sekme + aktif gösterge */}
          <Animated.View style={[styles.fullRow, fullRowStyle]} pointerEvents="box-none">
            {activeIndex >= 0 ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.bubble,
                  {
                    width: tabW,
                    backgroundColor: g.bubble,
                    borderColor: g.bubbleEdge,
                  },
                  bubbleStyle,
                ]}
              />
            ) : null}
            <View style={styles.tabsInner} pointerEvents="box-none">
              {visibleTabs.map((def, i) => {
                const route = state.routes.find((r) => r.name === def.route);
                const isActive = i === activeIndex;
                const Icon = TAB_ICON_BY_KIND[def.kind];
                const label = i18n.t(def.labelKey);
                return (
                  <Pressable
                    key={def.route}
                    style={styles.tab}
                    onPress={() => route && handleTabPress(def.route, route.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={label}
                  >
                    <Icon size={TAB_BAR_R3.ICON_SIZE} color={g.ink} filled={isActive} cutColor={g.bubble} />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.label,
                        { color: g.ink, fontFamily: isActive ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_500Medium' },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Animated.View>

          {/* KÜÇÜK durum — tek aktif ikon, basınca açılır */}
          <Animated.View style={[StyleSheet.absoluteFill, styles.miniCenter, miniStyle]}>
            <Pressable
              onPress={expand}
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel={i18n.t('shell.expand')}
            >
              <View style={styles.miniCenter}>
                <MiniIcon size={TAB_BAR_R3.ICON_SIZE} color={g.ink} filled cutColor={g.bubble} />
              </View>
            </Pressable>
          </Animated.View>
        </Animated.View>

        {/* Ayrık Tara dairesi */}
        {showScan ? (
          <Animated.View style={scanPop.style}>
            <Animated.View style={[styles.scanWrap, scanSizeStyle]}>
              <BlurView
                intensity={28}
                tint={g.tint}
                style={[StyleSheet.absoluteFill, styles.scanBlur, { backgroundColor: g.glass }]}
              />
              <View
                style={[StyleSheet.absoluteFill, styles.scanBorder, { borderColor: g.edge }]}
                pointerEvents="none"
              />
              <Pressable
                onPress={onScanPress}
                style={styles.scanPress}
                accessibilityRole="button"
                accessibilityLabel={i18n.t('shell.scan')}
              >
                <ScanIcon size={22} color={g.ink} />
                <Text style={[styles.scanLabel, { color: g.ink }]}>{i18n.t('shell.scan')}</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

function CartPill({
  count,
  glass,
  onPress,
  reduced,
}: {
  count: number;
  glass: ReturnType<typeof glassTokens>;
  onPress: () => void;
  reduced: boolean;
}) {
  const i18n = useT();
  // Sayaç pop'u korunur (bugünkü FAB rozetindeki gibi).
  const s = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    s.value = withSpring(1.18, SPRING.ai, () => {
      s.value = withSpring(1, SPRING.ai);
    });
  }, [count, reduced, s]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <View style={styles.cartPillRow} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        style={[styles.cartPill, { backgroundColor: glass.ink }]}
        accessibilityRole="button"
        accessibilityLabel={`${i18n.t('shell.cart')} · ${count}`}
      >
        <Animated.Text style={[styles.cartPillText, { color: glass.cut }, popStyle]}>
          {i18n.t('shell.cart')} · {count}
        </Animated.Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: TAB_BAR_R3.SIDE_INSET,
    right: TAB_BAR_R3.SIDE_INSET,
    bottom: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  pillWrap: {
    height: TAB_BAR_R3.PILL_HEIGHT,
    borderRadius: TAB_BAR_R3.PILL_RADIUS,
    overflow: 'hidden',
  },
  pillBorder: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: TAB_BAR_R3.PILL_RADIUS,
  },
  pillHighlight: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: StyleSheet.hairlineWidth,
  },
  fullRow: {
    flex: 1,
    justifyContent: 'center',
  },
  tabsInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: TAB_BAR_R3.BUBBLE_PAD,
    height: '100%',
  },
  bubble: {
    position: 'absolute',
    top: TAB_BAR_R3.BUBBLE_PAD,
    bottom: TAB_BAR_R3.BUBBLE_PAD,
    left: 0,
    borderRadius: TAB_BAR_R3.BUBBLE_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: '100%',
  },
  label: {
    fontSize: 12,
    lineHeight: 14,
  },
  miniCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanWrap: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBlur: {
    borderRadius: 999,
  },
  scanBorder: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
  },
  scanPress: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  scanLabel: {
    fontSize: 12,
    lineHeight: 13,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  cartPillRow: {
    alignItems: 'center',
    marginBottom: TAB_BAR_R3.GAP,
  },
  cartPill: {
    minHeight: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartPillText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
