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
  DeviceEventEmitter,
  Image,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { FinText as Text } from '../../core/design/components/FinText';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
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
  REDUCED,
  SPRING,
  TIMING,
  haptic,
  useReducedMotion,
  usePop,
} from '../../core/design/motion';
import { Toast } from '../../core/design/components/Toast';
import { useFeature } from '../../core/flags';
import { useCartStore } from '../../store/cartStore';
import { TAB_BAR_R3, tabBarBottomOffset } from './layout';
import { SELECTED_PILL, SELECTED_PILL_MS } from './selectedPill';
import { useTabBarCollapsedValue } from './scroll';
import { resolveShellTabs, shouldShowScan, type ShellTabDef } from './tabs';
import { TAB_ICON_BY_KIND, ScanIcon } from './icons';
import {
  LOG_FLIGHT_EVENT,
  LOG_UNDO_EVENT,
  type LogFlightPayload,
  type LogUndoPayload,
} from './logEvents';
import { useOrientTarget } from '../onboarding/first/orient/useOrientTarget'; // G18-S1 temas

/** R3 cam token'ları — tasarımın tokens() çıktısı (light/dark) birebir. */
function glassTokens(dark: boolean) {
  if (dark) {
    return {
      ink: '#F5F5F5',
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

/** Uçan öğenin iç durumu (payload + çözülmüş kaynak/konum). */
interface FlightState {
  payload: LogFlightPayload;
  /** Kabuk-yerel başlangıç (sol, üst) px. */
  startX: number;
  startY: number;
  /** Hedef merkez (Ana sayfa sekmesi ikonu) — kabuk-yerel px. */
  targetX: number;
  targetY: number;
  /** Retrigger anahtarı. */
  key: number;
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
  const scanGap = showScan ? TAB_BAR_R3.GAP : 0;
  const pillFullW = containerW - scanGap - scanFull;
  const nTabs = Math.max(visibleTabs.length, 1);
  const tabW = (pillFullW - 2 * TAB_BAR_R3.BUBBLE_PAD) / nTabs;

  // G16-S2: barın alt kenarı home indicator'ın hemen üstünde (insets + 4; insets 0 → 8).
  const bottomOffset = tabBarBottomOffset(insets.bottom);
  // Kabuk kök View'ının ekrandaki yüksekliği (uçuş koordinat dönüşümü için).
  const rootHeight = TAB_BAR_R3.PILL_HEIGHT + bottomOffset;

  // ── "Logla izi" durumu ──────────────────────────────────────────────────────
  const [badge, setBadge] = useState(0);
  const [flight, setFlight] = useState<FlightState | null>(null);
  const [toast, setToast] = useState<{ id: string; message: string } | null>(null);
  const badgePop = useSharedValue(0); // 0 gizli, 1 açık (bouncy)
  const flightKey = useRef(0);
  // Olay dinleyicisi mount'ta bir kez kurulur; en güncel geometri/ayar ref'ten.
  const geomRef = useRef({ reduced, rootHeight, tabW, anaIndex, winH });
  geomRef.current = { reduced, rootHeight, tabW, anaIndex, winH };

  const popBadge = useCallback(() => {
    badgePop.value = withSequence(
      withTiming(0, { duration: 0 }),
      withSpring(1, SPRING.bouncy),
    );
  }, [badgePop]);

  // Rozet + toast + haptik (uçuş varışında VEYA azaltılmışta doğrudan).
  const arrive = useCallback(
    (payload: LogFlightPayload) => {
      haptic('success');
      setBadge((n) => {
        if (n === 0) popBadge();
        return n + 1;
      });
      const id = payload.id ?? `log-${flightKey.current}`;
      const message = payload.mealLabel
        ? i18n.t('shell.logged', { meal: payload.mealLabel })
        : i18n.t('shell.logged_generic');
      setToast({ id, message });
    },
    [i18n, popBadge],
  );

  useEffect(() => {
    const onFlight = (raw: LogFlightPayload) => {
      const geom = geomRef.current;
      if (geom.reduced || geom.anaIndex < 0) {
        // Uçuş yok — doğrudan rozet + toast (FinMoMap: "Uçuş yok").
        arrive(raw);
        return;
      }
      flightKey.current += 1;
      const targetX =
        TAB_BAR_R3.BUBBLE_PAD + geom.tabW * (geom.anaIndex + 0.5);
      const targetY = TAB_BAR_R3.PILL_HEIGHT / 2;
      // Ekran (sayfa) koordinatı → kabuk-yerel koordinat.
      const startX = raw.x - TAB_BAR_R3.SIDE_INSET;
      const startY = raw.y - (geom.winH - geom.rootHeight);
      setFlight({ payload: raw, startX, startY, targetX, targetY, key: flightKey.current });
    };
    const onUndo = (_raw: LogUndoPayload) => {
      setBadge((n) => Math.max(0, n - 1));
      setToast(null);
    };
    const subF = DeviceEventEmitter.addListener(LOG_FLIGHT_EVENT, onFlight);
    const subU = DeviceEventEmitter.addListener(LOG_UNDO_EVENT, onUndo);
    return () => {
      subF.remove();
      subU.remove();
    };
  }, [arrive]);

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgePop.value,
    transform: [{ scale: interpolate(badgePop.value, [0, 1], [0.4, 1]) }],
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
        duration: reduced ? REDUCED.duration : SELECTED_PILL_MS,
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

  // Tara basış pop'u
  const scanPop = usePop();

  // ── Davranış ────────────────────────────────────────────────────────────────
  const clearBadge = useCallback(() => {
    setBadge(0);
    badgePop.value = withTiming(0, { duration: REDUCED.duration });
  }, [badgePop]);

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

  const onToastUndo = useCallback(() => {
    if (toast) DeviceEventEmitter.emit(LOG_UNDO_EVENT, { id: toast.id } as LogUndoPayload);
    setBadge((n) => Math.max(0, n - 1));
    setToast(null);
  }, [toast]);

  const onToastView = useCallback(() => {
    setToast(null);
    clearBadge();
    navigation.navigate('Tracker' as never);
  }, [navigation, clearBadge]);

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
      {/* "Logla izi" uçan öğesi (yalnız azaltılmamış harekette) */}
      {flight ? (
        <LogFlight
          key={flight.key}
          flight={flight}
          accent={g.accent}
          onArrive={() => arrive(flight.payload)}
          onDone={() => setFlight(null)}
        />
      ) : null}

      {/* Logla toast'ı — barın üstünde */}
      {toast ? (
        <View style={[styles.toastRow, { bottom: bottomOffset + TAB_BAR_R3.PILL_HEIGHT + 8 }]} pointerEvents="box-none">
          <Toast
            visible
            message={toast.message}
            onUndo={onToastUndo}
            onView={onToastView}
            onDismiss={() => setToast(null)}
          />
        </View>
      ) : null}

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
                        ? `${label} · ${i18n.t('shell.logged_badge', { count: badge })}`
                        : label
                    }
                  >
                    <View>
                      <Icon
                        size={TAB_BAR_R3.ICON_SIZE}
                        color={isActive ? g.activeInk : g.ink}
                        filled={isActive}
                        cutColor={g.cut}
                      />
                      {showBadge ? (
                        <Animated.View
                          pointerEvents="none"
                          style={[styles.badge, { backgroundColor: g.accent }, badgeStyle]}
                        >
                          <Text maxFontSizeMultiplier={1} style={[styles.badgeText, { color: g.cut }]} numberOfLines={1}>
                            +{badge}
                          </Text>
                        </Animated.View>
                      ) : null}
                    </View>
                    {/* G15-S2 (FinHomeXL/FinStressXL): sabit yükseklikli cam çubukta
                        etiket en büyük yazıda kırpılıyordu ("An…") → ölçek sabit;
                        erişilebilirlik etiketi + Large Content Viewer metni taşır. */}
                    <Text
                      numberOfLines={1}
                      maxFontSizeMultiplier={1}
                      style={[
                        styles.label,
                        { color: isActive ? g.activeInk : g.ink, fontFamily: isActive ? 'PlusJakartaSans_600SemiBold' : 'PlusJakartaSans_500Medium' },
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
              {/* G15 — flex:1: ikon dairenin ortasında (önce üstte kalıyordu). */}
              <View style={[styles.miniCenter, styles.fill1]}>
                <MiniIcon size={TAB_BAR_R3.ICON_SIZE} color={g.ink} filled cutColor={g.cut} />
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
                <ScanIcon size={22} color={g.ink} />
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
 * sekmesine yay çizerek iner (slow 500, hafif aşma cubic-bezier 0.3,1.15,0.4,1
 * — FinMoLogA fly1), varışta `onArrive` (rozet/toast/haptik), sonra solup
 * `onDone` ile kapanır. Kabuk kök View'ı kırpmadığından bar üstünde çizilir.
 */
function LogFlight({
  flight,
  accent,
  onArrive,
  onDone,
}: {
  flight: FlightState;
  accent: string;
  onArrive: () => void;
  onDone: () => void;
}) {
  const p = useSharedValue(0);
  const w = Math.max(flight.payload.w, 16);
  const h = Math.max(flight.payload.h, 16);

  useEffect(() => {
    p.value = withTiming(
      1,
      { duration: TIMING.logTrail, easing: Easing.bezier(0.3, 1.15, 0.4, 1) },
      (fin) => {
        if (fin) {
          runOnJS(onArrive)();
          runOnJS(onDone)();
        }
      },
    );
    // yalnız mount'ta; key değişince yeni örnek oluşur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => {
    const dx = flight.targetX - (flight.startX + w / 2);
    const dy = flight.targetY - (flight.startY + h / 2);
    return {
      opacity: interpolate(p.value, [0, 0.85, 1], [1, 1, 0]),
      transform: [
        { translateX: interpolate(p.value, [0, 1], [0, dx]) },
        { translateY: interpolate(p.value, [0, 1], [0, dy]) },
        { scale: interpolate(p.value, [0, 1], [1, 0.08]) },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.flight,
        { left: flight.startX, top: flight.startY, width: w, height: h },
        style,
      ]}
    >
      {flight.payload.imageUri ? (
        <Image source={{ uri: flight.payload.imageUri }} style={styles.flightImg} />
      ) : (
        <View style={[styles.flightDot, { backgroundColor: accent }]} />
      )}
    </Animated.View>
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
        accessibilityLabel={`${i18n.t('shell.cart')} (${count})`}
      >
        <Animated.Text style={[styles.cartPillText, { color: glass.cut }, popStyle]}>
          {`${i18n.t('shell.cart')} (${count})`}
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
    // STROKE'SUZ (FinComponents v2): yalnız cam dolgu, kenarlık yok.
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
  badge: {
    position: 'absolute',
    top: -6,
    left: 12,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    // STROKE'SUZ rozet (FinMoLogA).
  },
  badgeText: {
    fontSize: 11,
    lineHeight: 13,
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
