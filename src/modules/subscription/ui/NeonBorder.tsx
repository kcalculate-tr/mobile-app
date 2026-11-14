// G53-S1 md.4 · G54-S1 md.7 — Seçili plan kartının kenarında sürekli dolaşan neon lime ışık (Paywall + T1).
//
// G54 düzeltmesi (kök neden neon.ts başında): SVG kartla BİREBİR aynı kutuda — ölçü kartın kendi kutusundan
// (`position:absolute` + kenarlık kadar −inset → kartın kenarlık kutusu; rozetler mutlak konumlu olduğu için
// ölçüye girmez), geometri tek açık yuvarlak dikdörtgen yolu (kartın köşe yarıçapı, çizgi kalınlığının yarısı içe).
// Temel kenar ve ışık AYNI yolu kullanır → iki ayrı çizgi görüntüsü yok; ışık köşelerden dönerek tam çevreyi dolaşır.
// Görünüm: temel kenar 1,5 pt lime %35; ışık 3 katman (geniş yumuşak hale ≈10 pt · orta parlama ≈5 pt · ince
// çekirdek 1,75 pt), çevrenin ~%30'u uzunlukta degrade kuyruk; seçiliyken içe doğru çok hafif lime ışıma.
// Açık temada hale daha az. Hız: tur 7 sn, sabit, kesintisiz (UI thread kare geri çağrısı). Seçim değişince 250 ms
// opaklık geçişi (ortak saat → ışık yeni kartta aynı konumdan sürer). Azaltılmış hareket: dolaşma yok — sabit ince
// kenar + yumuşak hale. Ekran görünmüyorken döngü durur.
import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, type LayoutChangeEvent } from 'react-native';
import * as Nav from '@react-navigation/native';
import * as Reanimated from 'react-native-reanimated';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { CURVE, palette } from '../../../core/design';
import {
  NEON_BASE_OPACITY,
  NEON_BLEED,
  NEON_STROKE,
  NEON_SWITCH_MS,
  neonDashOffset,
  neonGeometry,
  neonLayers,
  neonMode,
  neonProgressAt,
  roundRectPath,
  type NeonLayer,
  type NeonMode,
} from './neon';

export type NeonPalette = {
  /** Sabit temel kenar rengi (opaklık NEON_BASE_OPACITY ile). */
  base: string;
  core: string;
  hot: string;
  glow: string;
  /** Hale gücü 0..1 (açık temada daha az). */
  glowOpacity: number;
  /** İçe doğru hafif ışıma opaklığı (yalnız seçiliyken). */
  inner: number;
  /** Azaltılmış harekette sabit kenar rengi. */
  solid: string;
};

/** 14 Kas (İlter referansı): neon tüp ışığı — parlak beyaza yakın çekirdek + doygun elektrik yeşili hale. */
export const NEON_GREEN = '#5CFF2A';
const NEON_CORE = '#C9FFAE';
const NEON_HOT = '#F4FFEE';
const NEON_LINE_LIGHT = '#2FBF0F';

/** Paywall kartı (beyaz / koyu gri). Açık temada temel kenar koyu neon yeşili (açık zeminde okunur). */
export function neonPaywallPalette(isDark: boolean): NeonPalette {
  return isDark
    ? { base: NEON_GREEN, core: NEON_CORE, hot: NEON_HOT, glow: NEON_GREEN, glowOpacity: 1, inner: 0.08, solid: NEON_GREEN }
    : { base: NEON_LINE_LIGHT, core: NEON_GREEN, hot: '#E9FFD9', glow: NEON_GREEN, glowOpacity: 0.7, inner: 0.05, solid: NEON_LINE_LIGHT };
}

/** T1 kayıt teklifi. Koyu temada seçili kart lime dolgulu (çekirdek beyaz, hale neon yeşili dışarı taşar);
 *  açık temada dolgu YOK → paywall paletiyle aynı. */
export function neonOnLimePalette(isDark: boolean): NeonPalette {
  return isDark
    ? { base: '#FFFFFF', core: NEON_HOT, hot: '#FFFFFF', glow: NEON_GREEN, glowOpacity: 1, inner: 0.1, solid: NEON_CORE }
    : neonPaywallPalette(false);
}

// Kare geri çağrısı resmi jest taklidinde yok → modül düzeyinde (her render'da aynı) yedek. Üretimde gerçek kanca.
type FrameCb = (cb: (f: { timestamp: number }) => void, autostart?: boolean) => { setActive: (on: boolean) => void };
const useFrameCb: FrameCb =
  ((Reanimated as unknown as { useFrameCallback?: FrameCb }).useFrameCallback as FrameCb | undefined) ?? (() => ({ setActive: () => {} }));
// Odak: navigasyon bağlamı (yoksa — vitrin/test — "görünür" kabul edilir). useIsFocused bağlam yokken hata attığı
// için bağlam doğrudan okunur ve focus/blur olaylarına abone olunur.
type NavLike = { isFocused?: () => boolean; addListener?: (e: 'focus' | 'blur', cb: () => void) => () => void };
const FallbackNavContext = React.createContext<NavLike | undefined>(undefined);
const NavContext: React.Context<NavLike | undefined> =
  ((Nav as unknown as { NavigationContext?: React.Context<NavLike | undefined> }).NavigationContext as React.Context<NavLike | undefined> | undefined) ??
  FallbackNavContext;

function useFocused(): boolean {
  const nav = React.useContext(NavContext);
  const [focused, setFocused] = useState(() => nav?.isFocused?.() ?? true);
  useEffect(() => {
    if (!nav?.addListener) return;
    setFocused(nav.isFocused?.() ?? true);
    const offFocus = nav.addListener('focus', () => setFocused(true));
    const offBlur = nav.addListener('blur', () => setFocused(false));
    return () => {
      offFocus?.();
      offBlur?.();
    };
  }, [nav]);
  return focused;
}

/** Ekran görünür mü: odakta + uygulama ön planda. */
export function useNeonVisible(): boolean {
  const focused = useFocused();
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return focused && active;
}

/**
 * Ortak ilerleme saati (0..1). `running` false iken kare döngüsü durur (değer son konumda kalır).
 * Plan kartlarının hepsi aynı saati paylaşır → seçim değişince ışık yeni kartta kaldığı yerden sürer.
 */
export function useNeonClock(running: boolean): SharedValue<number> {
  const p = useSharedValue(0);
  const fc = useFrameCb((f) => {
    'worklet';
    p.value = neonProgressAt(f.timestamp);
  }, false);
  useEffect(() => {
    fc.setActive(running);
    return () => fc.setActive(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  return p;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function NeonBorder({
  selected,
  radius,
  borderWidth = 0,
  colors,
  clock,
  reduced,
  visible,
  testID,
}: {
  selected: boolean;
  /** Kartın köşe yarıçapı (dış kenar). */
  radius: number;
  /** Kartın kendi borderWidth'i (mutlak konum dolgu kutusuna göre → kenarlık kutusuna hizalamak için). */
  borderWidth?: number;
  colors: NeonPalette;
  clock: SharedValue<number>;
  reduced: boolean;
  visible: boolean;
  testID?: string;
}) {
  const mode: NeonMode = neonMode({ selected, reduced, visible });
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Söndükten sonra 250 ms daha çiz (opaklık geçişi bitsin), sonra katmanları kaldır.
  const [drawn, setDrawn] = useState(selected);
  const op = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    op.value = withTiming(selected ? 1 : 0, { duration: NEON_SWITCH_MS, easing: CURVE.standard });
    if (selected) {
      setDrawn(true);
      return;
    }
    const id = setTimeout(() => setDrawn(false), NEON_SWITCH_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  const fade = useAnimatedStyle(() => ({ opacity: op.value }));

  // Kartın kenarlık kutusu (rozetler hariç) — ölçü buradan.
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  const g = neonGeometry(size.w, size.h, radius);
  const layers = neonLayers(colors.glowOpacity);
  const toneColor = (l: NeonLayer) => (l.tone === 'halo' || l.tone === 'mid' ? colors.glow : l.tone === 'hot' ? colors.hot : colors.core);
  // İç ışıma: kenardan 3 pt içeride, 5 pt kalınlık (yalnız kartın içine düşer).
  const innerD = size.w > 8 && size.h > 8 ? roundRectPath(NEON_BLEED + 3, NEON_BLEED + 3, size.w - 6, size.h - 6, Math.max(0, radius - 3)) : '';

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={onLayout}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID={testID ? `${testID}-neon-${mode}` : undefined}
      style={[styles.layer, { left: -borderWidth, top: -borderWidth, right: -borderWidth, bottom: -borderWidth }, fade]}
    >
      {drawn && g.perimeter > 0 ? (
        <Svg width={g.svgW} height={g.svgH} style={{ position: 'absolute', left: -NEON_BLEED, top: -NEON_BLEED }} testID={testID ? `${testID}-neon-svg` : undefined}>
          {innerD ? <Path d={innerD} fill="none" stroke={colors.glow} strokeWidth={5} strokeOpacity={colors.inner} /> : null}
          {reduced ? (
            // Azaltılmış hareket: sabit ince kenar + yumuşak hale (hareket yok).
            <>
              <Path d={g.d} fill="none" stroke={colors.glow} strokeWidth={8} strokeOpacity={0.1 * colors.glowOpacity} />
              <Path d={g.d} fill="none" stroke={colors.glow} strokeWidth={4} strokeOpacity={0.18 * colors.glowOpacity} />
              <Path d={g.d} fill="none" stroke={colors.solid} strokeWidth={NEON_STROKE} testID={testID ? `${testID}-neon-solid` : undefined} />
            </>
          ) : (
            <>
              <Path d={g.d} fill="none" stroke={colors.base} strokeOpacity={NEON_BASE_OPACITY} strokeWidth={NEON_STROKE} testID={testID ? `${testID}-neon-base` : undefined} />
              {layers.map((l, i) => (
                <SegLayer key={i} d={g.d} layer={l} color={toneColor(l)} perimeter={g.perimeter} clock={clock} />
              ))}
            </>
          )}
        </Svg>
      ) : null}
    </Animated.View>
  );
}

function SegLayer({ d, layer, color, perimeter, clock }: { d: string; layer: NeonLayer; color: string; perimeter: number; clock: SharedValue<number> }) {
  const len = layer.len * perimeter;
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: neonDashOffset(clock.value, perimeter, layer.len) }));
  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={layer.w}
      strokeOpacity={layer.opacity}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={[len, Math.max(0.001, perimeter - len)]}
      animatedProps={animatedProps}
    />
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', zIndex: 0 },
});
