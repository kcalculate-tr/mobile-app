// G18-S1 md.1 — FinOpen + FinMoOpen: ilk açılış imzası (yalnız ilk kullanım).
//
// Tabak → cam kase → Enerji halkası dolar, kase halka merkezinde ALEVE döner (Tur 26f) → lime nokta "kcal." logosuna oturur →
// katman Karşılama'ya erir. Toplam 2300 ms = enter 900 → standard 500 → exit 900.
// Eğriler kanonik FinMoTokens (SON_HAL İstisna 2: FinOpen'daki yerel eğriler
// CURVE.enter/standard/exit'e çevrildi). Haptik/ses yok. Boşta döngü yok.
//
// Splash'ten kesintisiz geçiş: ilk karede native splash'in birebir kopyası (siyah
// zemin + icon.png 170 pt, ortada) çizilir; açılış bayrağı okunurken o kalır,
// sonra 300 ms enter ile açılış zeminine erir → siyah/beyaz flaş yok.
// "Atla": ilk kareden, 44 pt; o karede keser, 200 ms opaklıkla söner; görüldü sayılır.
// Azaltılmış: tabak/kase/halka yok; durağan "kcal." 900 ms, sonra 200 ms opaklık.
import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../../core/design/components/AppText';
import { CURVE, DURATION, useReducedMotion } from '../../../core/design/motion';
import { useT } from '../../../core/i18n';
import { useOnb } from '../components/onbTheme';
import { OPEN_T } from './state';
import { markOpenSeen, readOpenSeen } from './store';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const DESIGN_W = 393;
const LIME = '#C6F04F';
const SPLASH_BG = '#000000';
const SPLASH_ICON = 170;
const R = 120;
const CIRC = 2 * Math.PI * R; // ≈ 754

// Süreç başına bir kez: Karşılama'ya geri dönüşte imza/örtü yeniden çizilmez.
let handledThisProcess = false;
/** YALNIZ test/vitrin. */
export function __resetOpenSignature() {
  handledThisProcess = false;
}

type Phase = 'cover' | 'play' | 'gone';

export function OpenSignature({
  forcePlay,
  frozenAt,
}: {
  /** Vitrin: bayrağa bakmadan oynat. */
  forcePlay?: boolean;
  /** Vitrin: belirli bir ms karesinde dondur (FinMoOpen kare kare). */
  frozenAt?: number;
} = {}) {
  const P = useOnb();
  const i18n = useT();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const s = W / DESIGN_W;
  const [phase, setPhase] = useState<Phase>(() => (handledThisProcess && !forcePlay ? 'gone' : 'cover'));
  const skippedRef = useRef(false);

  const cover = useSharedValue(1);
  const layer = useSharedValue(1);
  const plateO = useSharedValue(0);
  const plateS = useSharedValue(0.92);
  const trackO = useSharedValue(0);
  const bowlO = useSharedValue(0);
  const bowlS = useSharedValue(0.9);
  const flameO = useSharedValue(0);
  const flameS = useSharedValue(0.85);
  const arc = useSharedValue(0);
  const arcO = useSharedValue(0);
  const spin = useSharedValue(0);
  const dotO = useSharedValue(0);
  const groupO = useSharedValue(1);
  const groupS = useSharedValue(1);
  const travel = useSharedValue(0);
  const wordO = useSharedValue(0);
  const wordY = useSharedValue(6);
  const all: SharedValue<number>[] = [
    cover, layer, plateO, plateS, trackO, bowlO, bowlS, flameO, flameS, arc, arcO, spin, dotO, groupO, groupS, travel, wordO, wordY,
  ];

  const finish = () => {
    handledThisProcess = true;
    setPhase('gone');
  };

  // Açılış bayrağı → oynat ya da örtüyü erit.
  useEffect(() => {
    if (phase !== 'cover') return;
    let alive = true;
    (async () => {
      const seen = forcePlay ? false : await readOpenSeen();
      if (!alive) return;
      if (seen) {
        cover.value = withTiming(0, { duration: DURATION.fast, easing: CURVE.exit }, (ok) => {
          if (ok) runOnJS(finish)();
        });
        return;
      }
      if (!forcePlay) markOpenSeen();
      setPhase('play');
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Zaman çizelgesi.
  useEffect(() => {
    if (phase !== 'play') return;
    const T = OPEN_T;
    const done = (ok?: boolean) => {
      'worklet';
      if (ok) runOnJS(finish)();
    };
    if (frozenAt != null) {
      applyFrame(frozenAt, reduced);
      return;
    }
    if (reduced) {
      // Durağan logo: nokta yerinde, kelime görünür; 900 ms sonra 200 ms opaklık.
      cover.value = withTiming(0, { duration: REDUCED_FADE, easing: CURVE.standard });
      groupO.value = 0;
      travel.value = 1;
      dotO.value = 1;
      wordO.value = 1;
      wordY.value = 0;
      layer.value = withDelay(T.reducedHold, withTiming(0, { duration: T.reducedFade, easing: CURVE.standard }, done));
      return;
    }
    // Splash örtüsü → açılış zemini (0–300, enter).
    cover.value = withTiming(0, { duration: T.plateIn, easing: CURVE.enter });
    // 1 · 0–900 enter: tabak + halka izi belirir; cam kase tabağın yerine geçer.
    plateO.value = withSequence(
      withTiming(1, { duration: T.plateIn, easing: CURVE.enter }),
      withTiming(0, { duration: T.enterEnd - T.plateIn, easing: CURVE.enter }),
    );
    plateS.value = withSequence(
      withTiming(1, { duration: T.plateIn, easing: CURVE.enter }),
      withTiming(1.04, { duration: T.enterEnd - T.plateIn, easing: CURVE.enter }),
    );
    trackO.value = withTiming(1, { duration: T.plateIn, easing: CURVE.enter });
    bowlO.value = withSequence(
      withDelay(T.plateIn, withTiming(1, { duration: T.enterEnd - T.plateIn, easing: CURVE.enter })),
      withTiming(0, { duration: T.flameIn - T.enterEnd, easing: CURVE.standard }),
    );
    bowlS.value = withSequence(
      withDelay(T.plateIn, withTiming(1, { duration: T.enterEnd - T.plateIn, easing: CURVE.enter })),
      withTiming(0.8, { duration: T.flameIn - T.enterEnd, easing: CURVE.standard }),
    );
    // Tur 26f: kase → halka merkezinde alev (1150–1400 enter).
    flameO.value = withDelay(T.flameIn, withTiming(1, { duration: T.ringEnd - T.flameIn, easing: CURVE.enter }));
    flameS.value = withDelay(T.flameIn, withTiming(1, { duration: T.ringEnd - T.flameIn, easing: CURVE.enter }));
    // 2 · 900–1400 standard: Enerji halkası dolar, nokta halkanın ucunda döner.
    arcO.value = withDelay(T.enterEnd, withTiming(1, { duration: T.dotIn, easing: CURVE.standard }));
    arc.value = withDelay(T.enterEnd, withTiming(1, { duration: T.ringEnd - T.enterEnd, easing: CURVE.standard }));
    spin.value = withDelay(T.enterEnd, withTiming(1, { duration: T.ringEnd - T.enterEnd, easing: CURVE.standard }));
    dotO.value = withDelay(T.enterEnd, withTiming(1, { duration: T.dotIn, easing: CURVE.standard }));
    // 3 · 1400–2300 exit: kase+halka 0.6'ya küçülüp söner; nokta logoya oturur
    // (enter 500); "kcal" belirir (standard 300); katman Karşılama'ya erir (exit 300).
    groupO.value = withDelay(T.ringEnd, withTiming(0, { duration: T.shrinkEnd - T.ringEnd, easing: CURVE.exit }));
    groupS.value = withDelay(T.ringEnd, withTiming(0.6, { duration: T.shrinkEnd - T.ringEnd, easing: CURVE.exit }));
    travel.value = withDelay(T.ringEnd, withTiming(1, { duration: T.shrinkEnd - T.ringEnd, easing: CURVE.enter }));
    wordO.value = withDelay(T.wordStart, withTiming(1, { duration: T.shrinkEnd - T.wordStart, easing: CURVE.standard }));
    wordY.value = withDelay(T.wordStart, withTiming(0, { duration: T.shrinkEnd - T.wordStart, easing: CURVE.standard }));
    layer.value = withDelay(T.outStart, withTiming(0, { duration: T.total - T.outStart, easing: CURVE.exit }, done));
    return () => all.forEach((v) => cancelAnimation(v));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Vitrin: tek kareyi doğrudan uygula (FinMoOpen storyboard).
  function applyFrame(ms: number, rm: boolean) {
    const T = OPEN_T;
    const k = (a: number, b: number) => Math.min(1, Math.max(0, (ms - a) / (b - a)));
    cover.value = 0;
    if (rm) {
      groupO.value = 0;
      travel.value = 1;
      dotO.value = 1;
      wordO.value = 1;
      wordY.value = 0;
      return;
    }
    // CURVE.* = Reanimated Easing.bezier fabrikası → JS'te çağrılabilir fonksiyon.
    const ease = (f: unknown) => (f as { factory?: () => (x: number) => number }).factory?.() ?? ((x: number) => x);
    const en = ease(CURVE.enter);
    const st = ease(CURVE.standard);
    const ex = ease(CURVE.exit);
    const a = k(0, T.plateIn);
    const b = k(T.plateIn, T.enterEnd);
    plateO.value = ms < T.plateIn ? en(a) : 1 - en(b);
    plateS.value = ms < T.plateIn ? 0.92 + 0.08 * en(a) : 1 + 0.04 * en(b);
    trackO.value = en(a);
    const bf = k(T.enterEnd, T.flameIn);
    const fi = k(T.flameIn, T.ringEnd);
    bowlO.value = ms < T.enterEnd ? en(b) : 1 - st(bf);
    bowlS.value = ms < T.enterEnd ? 0.9 + 0.1 * en(b) : 1 - 0.2 * st(bf);
    flameO.value = en(fi);
    flameS.value = 0.85 + 0.15 * en(fi);
    arcO.value = ms >= T.enterEnd ? 1 : 0;
    arc.value = st(k(T.enterEnd, T.ringEnd));
    spin.value = st(k(T.enterEnd, T.ringEnd));
    dotO.value = st(k(T.enterEnd, T.enterEnd + T.dotIn));
    const c = k(T.ringEnd, T.shrinkEnd);
    groupO.value = 1 - ex(c);
    groupS.value = 1 - 0.4 * ex(c);
    travel.value = en(c);
    const w = st(k(T.wordStart, T.shrinkEnd));
    wordO.value = w;
    wordY.value = 6 * (1 - w);
    layer.value = 1 - ex(k(T.outStart, T.total));
  }

  const skip = () => {
    if (skippedRef.current) return;
    skippedRef.current = true;
    if (!forcePlay) markOpenSeen();
    all.forEach((v) => cancelAnimation(v));
    cover.value = withTiming(0, { duration: OPEN_T.skipFade, easing: CURVE.standard });
    layer.value = withTiming(0, { duration: OPEN_T.skipFade, easing: CURVE.standard }, (ok) => {
      if (ok) runOnJS(finish)();
    });
  };

  // ── Stiller ────────────────────────────────────────────────────────────────
  const cx = W / 2;
  const cy = 372 * s;
  const layerStyle = useAnimatedStyle(() => ({ opacity: layer.value }));
  const coverStyle = useAnimatedStyle(() => ({ opacity: cover.value }));
  const groupStyle = useAnimatedStyle(() => ({ opacity: groupO.value, transform: [{ scale: groupS.value }] }));
  const plateStyle = useAnimatedStyle(() => ({ opacity: plateO.value, transform: [{ scale: plateS.value }] }));
  const trackStyle = useAnimatedStyle(() => ({ opacity: trackO.value }));
  const bowlStyle = useAnimatedStyle(() => ({ opacity: bowlO.value, transform: [{ scale: bowlS.value }] }));
  const flameStyle = useAnimatedStyle(() => ({ opacity: flameO.value, transform: [{ scale: flameS.value }] }));
  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRC * (1 - arc.value),
    strokeOpacity: arcO.value,
  }));
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const travelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: 58 * s * travel.value }, { translateY: 131 * s * travel.value }],
  }));
  const dotStyle = useAnimatedStyle(() => ({ opacity: dotO.value }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: wordO.value, transform: [{ translateY: wordY.value * s }] }));

  if (phase === 'gone') return null;

  const plateEdge = P.isDark ? '#2C2C2E' : '#E9EBEE';
  const plate = P.isDark ? '#1C1C1E' : '#FFFFFF';
  const track = P.isDark ? '#2C2C2E' : '#E9EBEE';
  const chip = P.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(10,10,10,0.06)';
  const ringBox = 254 * s;
  const showScene = phase === 'play' && !reduced;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.layer, { backgroundColor: P.bg }, layerStyle]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={i18n.t('onboarding.open.a11y')}
      testID="fin-open"
    >
      {showScene ? (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, groupStyle, { transformOrigin: [cx, cy, 0] } as object]}
        >
          {/* Tabak (beyaz daire + iç kenar halkaları). */}
          <Animated.View
            style={[
              styles.abs,
              {
                left: cx - 98 * s,
                top: cy - 98 * s,
                width: 196 * s,
                height: 196 * s,
                borderRadius: 98 * s,
                backgroundColor: plate,
                borderWidth: 1,
                borderColor: plateEdge,
                alignItems: 'center',
                justifyContent: 'center',
              },
              plateStyle,
            ]}
          >
            <View
              style={{
                width: 196 * s - 44 * s,
                height: 196 * s - 44 * s,
                borderRadius: (196 * s - 44 * s) / 2,
                borderWidth: 1,
                borderColor: plateEdge,
              }}
            />
          </Animated.View>
          {/* Halka izi + Enerji halkası (lime). */}
          <Animated.View style={[styles.abs, { left: cx - ringBox / 2, top: cy - ringBox / 2 }, trackStyle]}>
            <Svg width={ringBox} height={ringBox} viewBox="0 0 254 254">
              <Circle cx={127} cy={127} r={R} fill="none" stroke={track} strokeWidth={14} />
            </Svg>
          </Animated.View>
          <View style={[styles.abs, { left: cx - ringBox / 2, top: cy - ringBox / 2 }]}>
            <Svg width={ringBox} height={ringBox} viewBox="0 0 254 254">
              <AnimatedCircle
                cx={127}
                cy={127}
                r={R}
                fill="none"
                stroke={LIME}
                strokeWidth={14}
                strokeLinecap="round"
                strokeDasharray={`${CIRC} ${CIRC}`}
                transform="rotate(-90 127 127)"
                animatedProps={arcProps}
              />
            </Svg>
          </View>
          {/* Cam kase. */}
          <Animated.View
            style={[styles.abs, { left: cx - 100 * s, top: cy - 74 * s, width: 200 * s, height: 149 * s }, bowlStyle]}
          >
            <Image source={require('../../../../assets/glass/bowl.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          </Animated.View>
          {/* Tur 26f: halka merkezinde cam alev (kaseden devralır). */}
          <Animated.View
            testID="fin-open-flame"
            style={[styles.abs, { left: cx - 48 * s, top: cy - 59 * s, width: 96 * s, height: 118 * s }, flameStyle]}
          >
            <Image source={require('../../../../assets/glass/flame.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          </Animated.View>
        </Animated.View>
      ) : null}

      {/* "kcal" kelimesi (lime nokta logoda yerine oturur). */}
      <Animated.View pointerEvents="none" style={[styles.abs, { right: 146 * s, top: 342 * s }, phase === 'play' ? wordStyle : { opacity: 0 }]}>
        <AppText style={[styles.word, { color: P.ink, fontSize: 56 * s, lineHeight: 56 * s }]} allowFontScaling={false}>
          kcal
        </AppText>
      </Animated.View>
      {phase === 'play' ? (
        <Animated.View pointerEvents="none" style={[styles.abs, { left: 0, top: 0 }, travelStyle]}>
          <Animated.View style={[styles.abs, { left: cx, top: cy, width: 0, height: 0 }, spinStyle]}>
            <Animated.View
              style={[
                styles.abs,
                {
                  left: -7 * s,
                  top: -127 * s,
                  width: 14 * s,
                  height: 14 * s,
                  borderRadius: 7 * s,
                  backgroundColor: LIME,
                  borderWidth: 1.5,
                  borderColor: P.ink,
                },
                dotStyle,
              ]}
            />
          </Animated.View>
        </Animated.View>
      ) : null}

      {/* Splash kopyası (ilk kare = native splash). */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cover, coverStyle]}>
        <Image
          source={require('../../../../assets/icon.png')}
          style={{ width: SPLASH_ICON, height: SPLASH_ICON, position: 'absolute', left: (W - SPLASH_ICON) / 2, top: (H - SPLASH_ICON) / 2 }}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Atla — ilk kareden, 44 pt. */}
      <Pressable
        onPress={skip}
        accessibilityRole="button"
        accessibilityLabel={i18n.t('onboarding.open.skip_a11y')}
        style={[styles.skip, { top: insets.top + 3 }]}
        hitSlop={4}
        testID="fin-open-skip"
      >
        <View style={[styles.chip, { backgroundColor: chip }]}>
          <AppText style={[styles.chipText, { color: P.ink }]}>{i18n.t('onboarding.open.skip')}</AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const REDUCED_FADE = 200;

const styles = StyleSheet.create({
  layer: { zIndex: 50 },
  abs: { position: 'absolute' },
  cover: { backgroundColor: SPLASH_BG },
  word: { fontFamily: 'BricolageGrotesque_700Bold', letterSpacing: -1 },
  skip: {
    position: 'absolute',
    right: 12,
    height: 44,
    minWidth: 64,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
  },
  chip: { height: 32, paddingHorizontal: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: 15, lineHeight: 20, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
