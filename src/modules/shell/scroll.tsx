// Kaydırınca tab barı küçültme — bağlam + hook (G11-S2).
//
// Tasarım (TabBarR3.dc.html, "min" durumu): aşağı kaydırınca cam hap tek bir
// 52x52 daireye iner, Tara dairesi 62→52 küçülür; yukarı kaydırınca geri açılır.
//
// S2 YALNIZ bağlamı + hook'u verir; LİSTELERE bağlamak S6'nın işi
// (Keşfet ve Tracker). Hareket yalnız core/design/motion token'larıyla beslenir.
//
// Akış:
//   TabBarCollapseProvider → bir `collapsed` SharedValue (0 tam, 1 küçük) tutar.
//   Ekran:  const scrollY = useSharedValue(0); useTabBarCollapse(scrollY);
//           <Animated.FlatList onScroll={scrollHandler(scrollY)} .../>
//   TabBarR3: useTabBarCollapsedValue() ile aynı SharedValue'yu okur, boyutları
//             ondan interpolasyonla türetir (tek animatör — çift yay yok).

import React, { createContext, useContext, useMemo } from 'react';
import {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedReaction,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { DURATION } from '../../core/design/motion';

type CollapseContext = {
  /** 0 = tam (hap), 1 = küçük (daire). Animasyonlu. */
  collapsed: SharedValue<number>;
};

const TabBarCollapseContext = createContext<CollapseContext | null>(null);

// YALNIZ __DEV__ ekran vitrini (FinTabBar-mid/min): kabuk bu daralma değeriyle
// açılır. Üretimde daima 0 (setter __DEV__ dışında no-op).
let devInitialCollapse = 0;
export function setDevInitialCollapse(v: number): void {
  if (__DEV__) devInitialCollapse = v;
}

/** R3 tab navigatörünü sarmalar; `collapsed` SharedValue'yu üretir. */
export function TabBarCollapseProvider({ children }: { children: React.ReactNode }) {
  const collapsed = useSharedValue(__DEV__ ? devInitialCollapse : 0);
  const value = useMemo<CollapseContext>(() => ({ collapsed }), [collapsed]);
  return (
    <TabBarCollapseContext.Provider value={value}>{children}</TabBarCollapseContext.Provider>
  );
}

/** TabBarR3 bunu okur; provider yoksa null (tek başına test/preview). */
export function useTabBarCollapsedValue(): SharedValue<number> | null {
  return useContext(TabBarCollapseContext)?.collapsed ?? null;
}

/** Yön değişimini algılamak için eşik (px). Küçük titremeler tetiklemez. */
const COLLAPSE_DELTA = 24;

/**
 * Bir ekranın dikey kaydırma offset'ini (SharedValue) tab barın küçülmesine
 * bağlar. Aşağı kaydırma → küçül (1), yukarı kaydırma veya tepe → aç (0).
 * Hareket "Orta" ağırlıkta (DURATION.emphasis). Provider yoksa no-op.
 */
export function useTabBarCollapse(scrollY: SharedValue<number>): void {
  const ctx = useContext(TabBarCollapseContext);
  const anchor = useSharedValue(0); // son yön değişimi referansı

  useAnimatedReaction(
    () => scrollY.value,
    (cur, prev) => {
      if (!ctx || prev == null) return;
      // Tepeye yakınken daima açık.
      if (cur <= 4) {
        anchor.value = cur;
        if (ctx.collapsed.value !== 0) {
          ctx.collapsed.value = withTiming(0, { duration: DURATION.emphasis });
        }
        return;
      }
      const dy = cur - anchor.value;
      if (dy > COLLAPSE_DELTA) {
        // aşağı: küçült. Çapa kaydırmayı takip etsin (yukarı dönüş algılanabilsin).
        if (ctx.collapsed.value !== 1) {
          ctx.collapsed.value = withTiming(1, { duration: DURATION.emphasis });
        }
        anchor.value = cur;
      } else if (dy < -COLLAPSE_DELTA) {
        // yukarı: aç.
        if (ctx.collapsed.value !== 0) {
          ctx.collapsed.value = withTiming(0, { duration: DURATION.emphasis });
        }
        anchor.value = cur;
      }
    },
  );
}

/**
 * Büyük başlık daralması (FinMoMap "Büyük başlık daralması": kaydırmaya bağlı ·
 * bitişte base 300 · standard). Kaydırma offset'ini 0..1 ilerlemeye çevirir
 * (0 = tam başlık, 1 = daralmış/çubuk başlık). Hareket parmağa bağlıdır — ayrı
 * animatör yoktur; `progress`'ı başlık ölçeği/opaklığı için interpolasyonla kullan.
 *
 * Ekran (S2 Keşfet / S3 Tracker — S6 bağlar):
 *   const scrollY = useSharedValue(0);
 *   const { progress } = useHeaderCollapse(scrollY);
 *   const titleStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
 */
export function useHeaderCollapse(
  scrollY: SharedValue<number>,
  opts?: { maxOffset?: number },
): { progress: SharedValue<number> } {
  const maxOffset = opts?.maxOffset ?? 96;
  const progress = useDerivedValue(() =>
    interpolate(scrollY.value, [0, maxOffset], [0, 1], Extrapolation.CLAMP),
  );
  return { progress };
}
