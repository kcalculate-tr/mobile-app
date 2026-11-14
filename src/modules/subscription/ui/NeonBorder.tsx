// G53-S1 md.4 — Seçili plan kartının kenarında sürekli dolaşan neon lime ışık (Paywall + T1 kayıt teklifi).
//
// Çizim: kartın üstüne (ilk çocuk; rozetler üstte kalır) dokunulmaz bir SVG katmanı. Kartın yuvarlak kenarı
// boyunca 2 pt yarı saydam lime temel kenar + üstünde kenarı gezen parlak parça (çevrenin ~%25'i). Parça, aynı
// merkezli üst üste kesik çizgilerden oluşur (kısa olan daha opak → yumuşak uçlar; geniş + soluk katmanlar →
// dış parlama). Hareket `strokeDashoffset` ile UI thread'de (reanimated kare geri çağrısı; JS'e köprü yok);
// tur 2,8 sn, sabit hız, kesintisiz (zaman mod periyot).
// Kipler (neon.ts → neonMode): seçili değil = yok · azaltılmış hareket = sabit 2 pt lime + hafif glow, döngü YOK ·
// ekran görünmüyor (arka plan / üstte başka ekran) = döngü DURUR. Seçim değişince eski kart söner, yeni kart
// 200 ms'de yanar (ilerleme ortak saat → ışık yeni kartta aynı konumdan devam eder).
import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, type LayoutChangeEvent } from 'react-native';
import * as Nav from '@react-navigation/native';
import * as Reanimated from 'react-native-reanimated';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { CURVE, palette } from '../../../core/design';
import {
  NEON_BLEED,
  NEON_STROKE,
  NEON_SWITCH_MS,
  neonDashOffset,
  neonLayers,
  neonMode,
  neonProgressAt,
  roundRectPerimeter,
  type NeonLayer,
  type NeonMode,
} from './neon';

export type NeonPalette = {
  /** 2 pt temel kenar (yarı saydam). */
  base: string;
  core: string;
  hot: string;
  glow: string;
  /** Koyu kontur (açık temada lime'ı açık zeminde okutur). */
  edge: string;
  withEdge: boolean;
  /** Parlama gücü 0..1 (açık temada daha az). */
  glowOpacity: number;
  /** Azaltılmış harekette sabit kenar rengi. */
  solid: string;
};

/** Paywall (beyaz / koyu gri kart). */
export function neonPaywallPalette(isDark: boolean): NeonPalette {
  return isDark
    ? { base: 'rgba(185,239,20,0.38)', core: palette.lime, hot: '#F1FFC2', glow: palette.lime, edge: palette.limeLineOnLight, withEdge: false, glowOpacity: 1, solid: palette.lime }
    : { base: 'rgba(74,107,0,0.38)', core: palette.lime, hot: '#E6FF8F', glow: palette.lime, edge: palette.limeLineOnLight, withEdge: true, glowOpacity: 0.5, solid: palette.limeLineOnLight };
}

/** T1 kayıt teklifi: seçili kart tam lime dolgulu → parça açık lime/beyaz çekirdekli, parlama dışa taşar. */
export function neonOnLimePalette(isDark: boolean): NeonPalette {
  return isDark
    ? { base: 'rgba(241,255,194,0.55)', core: '#F1FFC2', hot: '#FFFFFF', glow: palette.lime, edge: palette.limeLineOnLight, withEdge: false, glowOpacity: 1, solid: '#F1FFC2' }
    : { base: 'rgba(74,107,0,0.38)', core: '#F1FFC2', hot: '#FFFFFF', glow: palette.lime, edge: palette.limeLineOnLight, withEdge: true, glowOpacity: 0.5, solid: palette.limeLineOnLight };
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

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export function NeonBorder({
  selected,
  radius,
  borderWidth = NEON_STROKE,
  colors,
  clock,
  reduced,
  visible,
  testID,
}: {
  selected: boolean;
  /** Kartın köşe yarıçapı (dış kenar). */
  radius: number;
  /** Kartın kendi borderWidth'i (mutlak konum dolgu kutusuna göre → dış kenara hizalamak için). */
  borderWidth?: number;
  colors: NeonPalette;
  clock: SharedValue<number>;
  reduced: boolean;
  visible: boolean;
  testID?: string;
}) {
  const mode: NeonMode = neonMode({ selected, reduced, visible });
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Söndükten sonra 200 ms daha çiz (opaklık geçişi bitsin), sonra katmanları kaldır.
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

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };

  const inset = NEON_BLEED + NEON_STROKE / 2;
  const rw = Math.max(0, size.w - inset * 2);
  const rh = Math.max(0, size.h - inset * 2);
  const rx = Math.max(0, radius - NEON_STROKE / 2);
  const perimeter = roundRectPerimeter(rw, rh, rx);
  const rect = { x: inset, y: inset, width: rw, height: rh, rx, ry: rx };
  const layers = neonLayers(colors.glowOpacity, colors.withEdge);
  const toneColor = (l: NeonLayer) => (l.tone === 'glow' ? colors.glow : l.tone === 'edge' ? colors.edge : l.tone === 'hot' ? colors.hot : colors.core);

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={onLayout}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID={testID ? `${testID}-neon-${mode}` : undefined}
      style={[styles.layer, { left: -(NEON_BLEED + borderWidth), top: -(NEON_BLEED + borderWidth), right: -(NEON_BLEED + borderWidth), bottom: -(NEON_BLEED + borderWidth) }, fade]}
    >
      {drawn && perimeter > 0 ? (
        <Svg width={size.w} height={size.h}>
          {reduced ? (
            // Azaltılmış hareket: sabit kenar + hafif glow (hareket yok).
            <>
              <Rect {...rect} fill="none" stroke={colors.glow} strokeWidth={7} strokeOpacity={0.14 * colors.glowOpacity} />
              <Rect {...rect} fill="none" stroke={colors.glow} strokeWidth={4} strokeOpacity={0.24 * colors.glowOpacity} />
              <Rect {...rect} fill="none" stroke={colors.solid} strokeWidth={NEON_STROKE} testID={testID ? `${testID}-neon-solid` : undefined} />
            </>
          ) : (
            <>
              <Rect {...rect} fill="none" stroke={colors.base} strokeWidth={NEON_STROKE} />
              {layers.map((l, i) => (
                <SegLayer key={i} rect={rect} layer={l} color={toneColor(l)} perimeter={perimeter} clock={clock} />
              ))}
            </>
          )}
        </Svg>
      ) : null}
    </Animated.View>
  );
}

function SegLayer({
  rect,
  layer,
  color,
  perimeter,
  clock,
}: {
  rect: { x: number; y: number; width: number; height: number; rx: number; ry: number };
  layer: NeonLayer;
  color: string;
  perimeter: number;
  clock: SharedValue<number>;
}) {
  const len = layer.len * perimeter;
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: neonDashOffset(clock.value, perimeter, layer.len) }));
  return (
    <AnimatedRect
      {...rect}
      fill="none"
      stroke={color}
      strokeWidth={layer.w}
      strokeOpacity={layer.opacity}
      strokeLinecap="round"
      strokeDasharray={[len, Math.max(0.001, perimeter - len)]}
      animatedProps={animatedProps}
    />
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', zIndex: 0 },
});
