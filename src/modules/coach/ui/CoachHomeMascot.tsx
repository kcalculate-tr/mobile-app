// G39-S1 md.5 — Ana sayfa kcalAI Koç kartının maskotu (kartın sağ kenarı, ~-15° çapraz, kısmen taşar/kırpılır).
//  • Arkada yumuşak siyah bulanık ışıma: radyal degrade (merkez siyah %32 → kenar %0), maskottan geniş.
//  • Hareket (Reanimated, UI thread): yavaş süzülme ±6 pt dikey + ±3° dönüş, 3,5 sn döngü (yarım 1750 ileri,
//    1750 geri), ease-in-out (sinüs). 3–5 sn'de bir göz kırpma: `koc-acik` → `koc-kapali` 90 ms → açık.
//  • Ekran odakta değilken (sekme/yığın blur) ve uygulama arka plandayken hareket DURUR.
//  • Azaltılmış hareket: süzülme ve kırpma YOK, yalnız statik maskot (-15°).
//  • Dekoratif → VoiceOver'da gizli (kartın metni ve düğmesi okunur).
import React, { useContext, useEffect, useRef, useState } from 'react';
import { AppState, Image, StyleSheet, View } from 'react-native';
import * as RNav from '@react-navigation/native';
import Animated, { cancelAnimation, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { COACH_MASCOT_MOTION, useReducedMotion } from '../../../core/design';
import { KOC_ACIK, KOC_KAPALI } from './mascot';

export { COACH_MASCOT_MOTION };

type FocusNav = { isFocused?: () => boolean; addListener?: (e: 'focus' | 'blur', cb: () => void) => () => void };
const NavCtx = (RNav as { NavigationContext?: React.Context<unknown> }).NavigationContext ?? React.createContext<unknown>(undefined);

/** Ekran odakta mı (navigatör yoksa — izole test — odakta sayılır) + uygulama ön planda mı. */
export function useMascotActive(): boolean {
  const nav = useContext(NavCtx) as FocusNav | undefined;
  const [focused, setFocused] = useState(() => (nav?.isFocused ? nav.isFocused() : true));
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    if (!nav?.addListener) return;
    const offF = nav.addListener('focus', () => setFocused(true));
    const offB = nav.addListener('blur', () => setFocused(false));
    return () => {
      offF?.();
      offB?.();
    };
  }, [nav]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setForeground(s === 'active'));
    return () => sub.remove();
  }, []);
  return focused && foreground;
}

/** Sonraki göz kırpma gecikmesi (3–5 sn, düzgün dağılım). */
export function nextBlinkDelay(rand: () => number = Math.random): number {
  const { blinkMin, blinkMax } = COACH_MASCOT_MOTION;
  return Math.round(blinkMin + rand() * (blinkMax - blinkMin));
}

export function CoachHomeMascot({ cardHeight }: { cardHeight: number }) {
  const reduced = useReducedMotion();
  const active = useMascotActive();
  const animate = active && !reduced;
  const size = Math.round(cardHeight * COACH_MASCOT_MOTION.sizeRatio);
  const glow = Math.round(size * 1.5);

  const f = useSharedValue(0);
  useEffect(() => {
    if (!animate) {
      cancelAnimation(f);
      f.value = 0.5; // orta nokta = 0 pt, -15° (statik poz)
      return;
    }
    f.value = 0.5;
    f.value = withRepeat(
      withTiming(1, { duration: COACH_MASCOT_MOTION.halfPeriod, easing: COACH_MASCOT_MOTION.easing }),
      -1,
      true,
    );
    return () => cancelAnimation(f);
  }, [animate, f]);
  const floatStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(f.value, [0, 1], [-COACH_MASCOT_MOTION.floatAmp, COACH_MASCOT_MOTION.floatAmp]) },
      { rotate: `${interpolate(f.value, [0, 1], [COACH_MASCOT_MOTION.tilt - COACH_MASCOT_MOTION.rotateAmp, COACH_MASCOT_MOTION.tilt + COACH_MASCOT_MOTION.rotateAmp])}deg` },
    ],
  }));

  // Göz kırpma: JS zamanlayıcı (90 ms kapalı kare). Hareket kapalıyken hiç kurulmaz.
  const [closed, setClosed] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    if (!animate) {
      setClosed(false);
      return;
    }
    let alive = true;
    const schedule = () => {
      const t1 = setTimeout(() => {
        if (!alive) return;
        setClosed(true);
        const t2 = setTimeout(() => {
          if (!alive) return;
          setClosed(false);
          schedule();
        }, COACH_MASCOT_MOTION.blinkClosed);
        timers.current.push(t2);
      }, nextBlinkDelay());
      timers.current.push(t1);
    };
    schedule();
    return () => {
      alive = false;
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [animate]);

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { width: size, height: size, right: -Math.round(size * 0.04), top: Math.round((cardHeight - size) / 2) }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="coach-home-mascot"
    >
      <Svg
        width={glow}
        height={glow}
        style={{ position: 'absolute', left: (size - glow) / 2, top: (size - glow) / 2 }}
        testID="coach-home-glow"
      >
        <Defs>
          <RadialGradient id="coachGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#000000" stopOpacity={COACH_MASCOT_MOTION.glowOpacity} />
            <Stop offset="0.55" stopColor="#000000" stopOpacity={COACH_MASCOT_MOTION.glowOpacity * 0.45} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={glow} height={glow} fill="url(#coachGlow)" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, animate ? floatStyle : styles.staticPose]} testID={animate ? 'coach-home-mascot-float' : 'coach-home-mascot-static'}>
        <Image source={KOC_ACIK} style={[StyleSheet.absoluteFill, { opacity: closed ? 0 : 1 }]} resizeMode="contain" testID="coach-home-mascot-open" />
        <Image source={KOC_KAPALI} style={[StyleSheet.absoluteFill, { opacity: closed ? 1 : 0 }]} resizeMode="contain" testID="coach-home-mascot-closed" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  staticPose: { transform: [{ rotate: `${COACH_MASCOT_MOTION.tilt}deg` }] },
});
