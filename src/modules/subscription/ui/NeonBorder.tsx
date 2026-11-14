// G53-S1 md.4 · G54-S1 md.7 · 15 Kas — Seçili plan kartının neon kenarı (Paywall + T1).
//
// 15 Kas (İlter: "neon hâlâ istediğim gibi değil; olmayacaksa yapmayalım, olacaksa düzgün yap"): dolaşan SVG ışık
// kaldırıldı (kenarı birebir izlemedi). Şimdi kartın kenarlık kutusunu birebir kaplayan katman: 2 pt marka lime kenar
// + yerel boxShadow neon hale (dışa yumuşak, içe ince). Kutu kartın kendisi → hizalama kayamaz, köşeler kartla aynı.
// Hale yavaşça nefes alır (UI thread, withRepeat); azaltılmış harekette ve ekran görünmezken sabit. Seçim değişince
// 250 ms opaklık geçişi.
import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import * as Nav from '@react-navigation/native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import { CURVE, palette } from '../../../core/design';
import { NEON_BREATH_MIN, NEON_BREATH_MS, NEON_STROKE, NEON_SWITCH_MS, neonMode, neonShadow, type NeonMode } from './neon';

export type NeonPalette = {
  /** Kenar rengi. */
  line: string;
  /** Hale rengi. */
  glow: string;
  /** Hale gücü 0..1 (açık temada daha az). */
  glowOpacity: number;
  /** İçe ışıma opaklığı. */
  inner: number;
};

/** Marka lime (#B9EF14) — kenar ve hale aynı yeşil. */
export const NEON_GREEN = palette.lime;

/** Paywall kartı (beyaz / koyu gri). */
export function neonPaywallPalette(isDark: boolean): NeonPalette {
  return isDark ? { line: NEON_GREEN, glow: NEON_GREEN, glowOpacity: 1, inner: 0.22 } : { line: NEON_GREEN, glow: NEON_GREEN, glowOpacity: 0.85, inner: 0.28 };
}

/** T1 kayıt teklifi. Koyu temada seçili kart lime dolgulu → kenar beyaza yakın, hale lime; açık temada paywall ile aynı. */
export function neonOnLimePalette(isDark: boolean): NeonPalette {
  return isDark ? { line: '#F1FFC2', glow: NEON_GREEN, glowOpacity: 1, inner: 0 } : neonPaywallPalette(false);
}

// Odak: navigasyon bağlamı (yoksa — vitrin/test — "görünür" kabul edilir).
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

export function NeonBorder({
  selected,
  radius,
  borderWidth = 0,
  colors,
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
  /** Eski dolaşan ışığın ortak saati — artık kullanılmıyor (geriye uyum). */
  clock?: SharedValue<number>;
  reduced: boolean;
  visible: boolean;
  testID?: string;
}) {
  const mode: NeonMode = neonMode({ selected, reduced, visible });
  const op = useSharedValue(selected ? 1 : 0);
  const breath = useSharedValue(1);
  useEffect(() => {
    op.value = withTiming(selected ? 1 : 0, { duration: NEON_SWITCH_MS, easing: CURVE.standard });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);
  useEffect(() => {
    if (mode !== 'run') return;
    breath.value = 1;
    breath.value = withRepeat(withTiming(NEON_BREATH_MIN, { duration: NEON_BREATH_MS, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => {
      cancelAnimation(breath);
      breath.value = 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);
  const fade = useAnimatedStyle(() => ({ opacity: op.value }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: breath.value }));
  const box = { left: -borderWidth, top: -borderWidth, right: -borderWidth, bottom: -borderWidth, borderRadius: radius };

  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID={testID ? `${testID}-neon-${mode}` : undefined}
      style={[styles.layer, box, fade]}
    >
      <Animated.View
        testID={testID ? `${testID}-neon-glow` : undefined}
        style={[StyleSheet.absoluteFill, { borderRadius: radius, boxShadow: neonShadow(colors.glow, colors.glowOpacity, colors.inner) }, glowStyle]}
      />
      <View testID={testID ? `${testID}-neon-line` : undefined} style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: NEON_STROKE, borderColor: colors.line }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', zIndex: 0 },
});
