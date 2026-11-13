// TabBarR3 — yeni kabuğun cam sekme çubuğu (G11-S2 · G12-S1 son hâli).
//
// Tasarım: `design/final/FinTabBar-rest|mid|min.dc.html` (bu paneller gerçek
// TabBarR3'ü render eder) + hareket `FinMoMap` / `FinMoLogA`:
//   · Cam hap (blur + iç kenar highlight), 4 sekme, aktif gösterge (bubble).
//   · Aktif gösterge STROKE'SUZ (yalnız cam dolgu) — FinComponents v2.
//   · "Ana sayfa ↔ eatkcal" geçişinde JÖLE uzama (scaleX 1→1.6→1, fast 200).
//   · Sağda AYRIK yuvarlak "Tara" düğmesi (yalnız `ai_tarama` açıkken).
//   · Durumlar: rest / mid / min (aşağı kaydırınca hap tek daireye iner).
//   · "Logla izi A": başka sekmeden loglanınca (kcal:logFlight) uçan görsel
//     Ana sayfa sekmesine iner (slow 500, hafif aşma), "+N" rozeti bouncy
//     yayla açılır (stroke'suz), "…loglandı · Geri al" toast'ı görünür.
//     "Geri al" / kcal:logUndo rozeti azaltır. Azaltılmışta uçuş YOK —
//     yalnız rozet + toast 200 ms opaklık (FinMoMap).
//
// Hareket (yalnız core/design/motion token'ları + usePop + haptic):
//   · İlk açılış: bar aşağıdan yükselir (SPRING.ai).
//   · Aktif gösterge: nokta → hap morfu + sekme değişiminde kayar (G17-S2: 200 standard;
//     yarı saydam gri hap, ikon/etiket mürekkep).
//   · Tara: basışta usePop + haptic. Küçülme/büyüme: base 300 (collapsed SV).
//   · Azaltılmış harekette: yalnız opaklık/kısa timing (REDUCED).
// Sekme İÇERİĞİ arasında geçiş animasyonu YOK (AppNavigator 24.09 kararı).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { FinText as Text } from '../../core/design/components/FinText';
import { CountPill } from '../../core/design/components/CountPill';
import Animated, {
  interpolate,
  runOnJS,
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
  CURVE,
  DURATION,
  PREMIUM,
  REDUCED,
  SPRING,
  TIMING,
  haptic,
  useReducedMotion,
  usePop,
} from '../../core/design/motion';
import { useFeature } from '../../core/flags';
import { useCartStore } from '../../store/cartStore';
import { TAB_BAR_R3, tabBarBottomOffset } from './layout';
import { SELECTED_PILL } from './selectedPill';
import { useTabBarCollapsedValue } from './scroll';
import { resolveShellTabs, shouldShowScan, type ShellTabDef } from './tabs';
import { TAB_ICON_BY_KIND, ScanIcon } from './icons';
import { badgeText, emitLogBadge, onLogBadge, setHomeTabNode, setHomeTabTarget } from './logTrace';
import { useOrientTarget } from '../onboarding/first/orient/useOrientTarget'; // G18-S1 temas
import { palette } from '../../core/design/tokens';

/** R3 cam token'ları — tasarımın tokens() çıktısı (light/dark) birebir. */
function glassTokens(dark: boolean) {
  if (dark) {
    return {
      ink: '#F5F5F5',
      // FinTabBar: seçili olmayan sekme ikincil metin rengi.
      sec: '#A1A1A6',
      dotBg: palette.lime,
      dotFg: '#0A0A0A',
      glass: 'rgba(44,44,46,0.55)',
      edge: 'rgba(255,255,255,0.14)',
      hi: 'rgba(255,255,255,0.10)',
      // G17-S2 md.5: seçili sekme — Instagram gibi YARI SAYDAM gri hap;
      // ikon/etiket normal mürekkep (G17-S1'deki ters renkli hap geri alındı).
      bubble: SELECTED_PILL.dark.bubble,
      bubbleEdge: 'rgba(255,255,255,0.10)',
      activeInk: SELECTED_PILL.dark.activeInk,
      cut: '#2C2C2E',
      accent: '#C6FF3A',
      tint: 'dark' as const,
    };
  }
  return {
    ink: '#0A0A0A',
    sec: '#6B6B70',
    dotBg: '#4A6B00',
    dotFg: '#FFFFFF',
    glass: 'rgba(255,255,255,0.58)',
    edge: 'rgba(10,10,10,0.08)',
    hi: 'rgba(255,255,255,0.7)',
    // G17-S2 md.5: seçili sekme — yarı saydam gri hap, ikon/etiket mürekkep.
    bubble: SELECTED_PILL.light.bubble,
    bubbleEdge: 'rgba(10,10,10,0.06)',
    activeInk: SELECTED_PILL.light.activeInk,
    cut: '#FFFFFF',
    accent: '#8AD400',
    tint: 'light' as const,
  };
}

export function TabBarR3({ state, navigation, descriptors }: BottomTabBarProps) {
  const theme = useTheme();
  const g = glassTokens(theme.isDark);
  const i18n = useT();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width: winW, height: winH } = useWindowDimensions();

  const aiTarama = useFeature('ai_tarama');
  const showScan = shouldShowScan({ ai_tarama: aiTarama });
  const orientScan = useOrientTarget('scan', { ready: state.routes[state.index]?.name === 'Tracker' }); // G18-S1 temas: Orient1
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
  // "+N" rozeti Ana sayfa (Tracker) sekmesinde durur.
  const anaIndex = visibleTabs.findIndex((d) => d.route === 'Tracker');

  // ── Geometri ──────────────────────────────────────────────────────────────
  const containerW = winW - 2 * TAB_BAR_R3.SIDE_INSET;
  const scanFull = showScan ? TAB_BAR_R3.SCAN_SIZE : 0;
  const scanGap = showScan ? TAB_BAR_R3.SCAN_GAP : 0;
  const pillFullW = containerW - scanGap - scanFull;
  const nTabs = Math.max(visibleTabs.length, 1);
  const tabW = (pillFullW - 2 * TAB_BAR_R3.BUBBLE_PAD) / nTabs;

  // G16-S2: barın alt kenarı home indicator'ın hemen üstünde (insets + 4; insets 0 → 8).
  const bottomOffset = tabBarBottomOffset(insets.bottom);
  // Kabuk kök View'ının ekrandaki yüksekliği (uçuş koordinat dönüşümü için).
  const rootHeight = TAB_BAR_R3.PILL_HEIGHT + bottomOffset;

  // ── "Logla izi" rozeti (G28-S1 md.1) ─────────────────────────────────────────
  // Uçuş + toast kökteki LogTraceHost'ta (yığın ekranlarının da üstünde). Çubuk yalnız
  // "+N" rozetini çizer (varışta +1, Geri al −1, en fazla 9+) ve Ana sayfa sekmesinin
  // ekrandaki hedef noktasını bildirir.
  const [badge, setBadge] = useState(0);
  // G30-S1 md.1 (FinMoLogA lal-bdg2): giriş ölçek 0 → 1 bouncy base 300, opaklık ANINDA 1;
  // silinirken ölçek sabit, opaklık 1 → 0 fast 200 exit. Azaltılmış: yalnız 200 ms opaklık.
  const badgeScale = useSharedValue(0);
  const badgeOpacity = useSharedValue(0);
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const popBadge = useCallback(() => {
    if (reducedRef.current) {
      badgeScale.value = 1;
      badgeOpacity.value = 0;
      badgeOpacity.value = withTiming(1, { duration: REDUCED.duration });
      return;
    }
    badgeOpacity.value = 1;
    badgeScale.value = 0;
    badgeScale.value = withSpring(1, SPRING.bouncy);
  }, [badgeScale, badgeOpacity]);

  useEffect(() => {
    const sub = onLogBadge(({ delta }) => {
      if (delta === 'clear') {
        badgeOpacity.value = withTiming(
          0,
          reducedRef.current ? { duration: REDUCED.duration } : { duration: DURATION.fast, easing: CURVE.exit },
          (fin) => {
            if (fin) runOnJS(setBadge)(0);
          },
        );
        return;
      }
      setBadge((n) => {
        const next = Math.max(0, n + delta);
        if (delta === 1 && n === 0) popBadge();
        return next;
      });
    });
    return () => sub.remove();
  }, [popBadge, badgeOpacity]);

  // G30-S1 md.1: uçuş hedefi = Ana sayfa ikonunun ÖLÇÜLEN konumu (LogTraceHost ölçer).
  const homeIconRef = useRef<View | null>(null);
  useEffect(() => () => setHomeTabNode(null), []);
  const setHomeIcon = useCallback((node: View | null) => {
    homeIconRef.current = node;
    setHomeTabNode(node);
  }, []);

  // Ana sayfa sekmesi ikon merkezi (ekran koordinatı) → LogTraceHost uçuş hedefi.
  useEffect(() => {
    if (anaIndex < 0) {
      setHomeTabTarget(null);
      return;
    }
    setHomeTabTarget({
      x: TAB_BAR_R3.SIDE_INSET + TAB_BAR_R3.BUBBLE_PAD + tabW * (anaIndex + 0.5),
      y: winH - rootHeight + TAB_BAR_R3.PILL_HEIGHT / 2,
    });
  }, [anaIndex, tabW, winH, rootHeight]);

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ scale: badgeScale.value }],
  }));

  // ── Hareket: açılışta yükselme ──────────────────────────────────────────────
  const enter = useSharedValue(0);
  const rise = TAB_BAR_R3.PILL_HEIGHT + bottomOffset;
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

  // ── Hareket: aktif gösterge (nokta → hap morfu + kayma + jöle uzama) ─────────
  const appeared = useSharedValue(0); // 0 nokta, 1 hap
  const posX = useSharedValue(0); // bubble sol konumu (px)
  const stretch = useSharedValue(1); // jöle uzama (scaleX çarpanı)
  useEffect(() => {
    if (activeIndex < 0) return;
    const target = TAB_BAR_R3.BUBBLE_PAD + activeIndex * tabW;
    if (appeared.value === 0) {
      posX.value = target; // ilk konum sıçramasız
      appeared.value = reduced
        ? withTiming(1, { duration: REDUCED.duration })
        : withTiming(1, { duration: TIMING.enter }); // nokta→hap
    } else {
      // G17-S2 md.5: seçili hap geçişi 200 standard (yay/jöle yok); azaltılmış
      // harekette de aynı süre (yalnız konum, uzama yok).
      posX.value = withTiming(target, {
        duration: reduced ? REDUCED.duration : PREMIUM.tab.duration,
        easing: CURVE.standard,
      });
      stretch.value = 1;
    }
  }, [activeIndex, tabW, reduced, appeared, posX, stretch]);

  const bubbleStyle = useAnimatedStyle(() => {
    const sx = interpolate(appeared.value, [0, 1], [0.18, 1]) * stretch.value;
    return {
      opacity: activeIndex < 0 ? 0 : appeared.value,
      transform: [{ translateX: posX.value }, { scaleX: sx }],
    };
  });

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
  // FinTabBar-min: Tara ikonu 22 → 18 (ölçek; yalnız transform).
  const scanIconStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          collapsedShared?.value ?? 0,
          [0, 1],
          [1, TAB_BAR_R3.SCAN_ICON_MINI / TAB_BAR_R3.SCAN_ICON],
        ),
      },
    ],
  }));

  // Tara basış pop'u
  const scanPop = usePop();

  // ── Davranış ────────────────────────────────────────────────────────────────
  const clearBadge = useCallback(() => emitLogBadge('clear'), []);

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
    // Ana sayfa'ya geçince "+N" rozeti temizlenir (kayıtlar görüldü).
    if (routeName === 'Tracker') clearBadge();
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
        : withTiming(0, { duration: DURATION.base });
    }
  };

  const onCartPress = () => {
    const cartRoute = state.routes.find((r) => r.name === 'Cart');
    if (!cartRoute) return;
    haptic('selection');
    // G15-S5: `yeni_siparis` açıkken v2 rotaları kökte kayıtlı → v2 sepet (FinEkCart);
    // kapalıyken (EkCart kayıtlı değil) bugünkü gizli Cart sekmesi AYNEN.
    const root = navigation.getParent?.();
    if (root?.getState?.()?.routeNames?.includes('EkCart')) {
      root.navigate('EkCart' as never);
      return;
    }
    navigation.navigate('Cart' as never);
  };

  const activeDef = activeIndex >= 0 ? visibleTabs[activeIndex] : undefined;
  const MiniIcon = activeDef ? TAB_ICON_BY_KIND[activeDef.kind] : TAB_ICON_BY_KIND.eat;

  // G16-S2: sekme içinde yığın gibi açılan alt ekranlar (Profil › Ayarlar alt
  // ekranları vb.) `navigation.setOptions({ tabBarStyle: { display: 'none' } })`
  // ile barı gizler — o ekranlarda bar ve bar boşluğu YOK, yalnız insets.bottom.
  const focusedKey = state.routes[state.index]?.key;
  const focusedBarStyle = focusedKey
    ? StyleSheet.flatten(descriptors?.[focusedKey]?.options?.tabBarStyle as never)
    : undefined;
  if ((focusedBarStyle as { display?: string } | undefined)?.display === 'none') return null;

  return (
    <View
      style={[styles.root, { paddingBottom: bottomOffset }]}
      pointerEvents="box-none"
    >
      {/* Sepet hapı — yalnız eatkcal sekmesinde + sepette ürün varken. G18-S3 (temas): yeni_siparis
          açıkken (EkCart kayıtlı) yerini FinEkHome'un lime sepet çubuğu alır → hap çizilmez. */}
      {onEat && cartCount > 0 && !navigation.getParent?.()?.getState?.()?.routeNames?.includes('EkCart') ? (
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
                  { width: tabW, backgroundColor: g.bubble },
                  bubbleStyle,
                ]}
              />
            ) : null}
            <View style={styles.tabsInner} pointerEvents="box-none" accessibilityRole="tablist">
              {visibleTabs.map((def, i) => {
                const route = state.routes.find((r) => r.name === def.route);
                const isActive = i === activeIndex;
                const Icon = TAB_ICON_BY_KIND[def.kind];
                const label = i18n.t(def.labelKey);
                const showBadge = i === anaIndex && badge > 0;
                return (
                  <Pressable
                    key={def.route}
                    style={styles.tab}
                    onPress={() => route && handleTabPress(def.route, route.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={
                      showBadge
                        ? `${label}, ${i18n.t('shell.logged_badge', { count: badge })}`
                        : label
                    }
                  >
                    <View ref={i === anaIndex ? setHomeIcon : undefined} collapsable={false}>
                      <Icon
                        size={TAB_BAR_R3.ICON_SIZE}
                        color={isActive ? g.activeInk : g.sec}
                        filled={isActive}
                        cutColor={g.cut}
                      />
                      {showBadge ? (
                        <Animated.View
                          pointerEvents="none"
                          style={[styles.badge, { backgroundColor: g.dotBg }, badgeStyle]}
                        >
                          <Text maxFontSizeMultiplier={1} style={[styles.badgeText, { color: g.dotFg }]} numberOfLines={1}>
                            {badgeText(badge)}
                          </Text>
                        </Animated.View>
                      ) : null}
                    </View>
                    {/* G22-S2 md.2 (İlter 10 Kas): sekme YAZILARI kalktı, yalnız ikon.
                        Ad VoiceOver'da `accessibilityLabel` ile TR/EN okunur; dokunma
                        alanı sekme hücresinin tamamı (≈ 70 × 62 pt ≥ 44). Tara yazısı kalır. */}
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
              {/* G15 — flex:1: ikon dairenin ortasında (önce üstte kalıyordu). */}
              <View style={[styles.miniCenter, styles.fill1]}>
                {/* FinTabBar-min: seçili 44'lük iç daire (G17-S2 gri hap istisnası) + 22 ikon. */}
                <View style={[styles.miniInner, { backgroundColor: g.bubble }]}>
                  <MiniIcon size={TAB_BAR_R3.MINI_ICON} color={g.activeInk} filled cutColor={g.cut} />
                </View>
              </View>
            </Pressable>
          </Animated.View>
        </Animated.View>

        {/* Ayrık Tara dairesi */}
        {showScan ? (
          <Animated.View style={scanPop.style} {...orientScan}>
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
                <Animated.View style={scanIconStyle}>
                  <ScanIcon size={TAB_BAR_R3.SCAN_ICON} color={g.ink} />
                </Animated.View>
                <Text maxFontSizeMultiplier={1} style={[styles.scanLabel, { color: g.ink }]}>{i18n.t('shell.scan')}</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

/**
 * LogFlight — "logla izi" uçan öğesi. Mount'ta kaynak konumdan Ana sayfa
 * sekmesine iner (slow 500 · enter — FinMoTokens eşlemesi; yerel eğri yok), varışta `onArrive` (rozet/toast/haptik), sonra solup
 * `onDone` ile kapanır. Kabuk kök View'ı kırpmadığından bar üstünde çizilir.
 */
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
        accessibilityLabel={i18n.t('shell.cart_count', { count })}
        hitSlop={4}
        testID="shell-cart-pill"
      >
        {/* G38 md.4: "Sepet (1)" yerine "Sepet" + sayı hapı (pop sayaçta). */}
        <View style={styles.cartPillInner}>
          <Text style={[styles.cartPillText, { color: glass.cut }]}>{i18n.t('shell.cart')}</Text>
          <Animated.View style={popStyle}>
            <CountPill count={count} bg={glass.cut} fg={glass.ink} testID="shell-cart-count" />
          </Animated.View>
        </View>
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
    // STROKE'SUZ (FinComponents v2): yalnız cam dolgu, kenarlık yok.
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minWidth: TAB_BAR_R3.MIN_TOUCH,
    minHeight: TAB_BAR_R3.MIN_TOUCH,
  },
  // FinTabBar: rozet sekme üstünden 6, ortanın 8 sağında (ikona göre −4 / 20).
  badge: {
    position: 'absolute',
    top: -4,
    left: 20,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    // STROKE'SUZ rozet (FinMoLogA).
  },
  badgeText: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  flight: {
    position: 'absolute',
    borderRadius: 14,
    overflow: 'hidden',
    zIndex: 20,
  },
  flightImg: {
    width: '100%',
    height: '100%',
  },
  flightDot: {
    flex: 1,
    borderRadius: 999,
  },
  toastRow: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  miniCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill1: { flex: 1 },
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
  miniInner: {
    width: TAB_BAR_R3.MINI_INNER,
    height: TAB_BAR_R3.MINI_INNER,
    borderRadius: TAB_BAR_R3.MINI_INNER / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanLabel: {
    fontSize: TAB_BAR_R3.LABEL_SIZE,
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
  cartPillInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cartPillText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
