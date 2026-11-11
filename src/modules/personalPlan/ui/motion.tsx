// G34-S1 · Tur 26o — Kişisel plan akışı hareketi (06-akis-hareketi.png, BİREBİR).
// FinMoTokens ×1,1: 110 / 220 / 330 / 550 / 990. Eğriler standard / enter / exit; AI yayı 260/24.
// Azaltılmış hareket: yalnız opaklık 220 ms; haptikler AYNI. Bu dosya akış ekranlarının
// animasyon motoruna tek kapısıdır (ekranlar doğrudan reanimated çağırmaz).
import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View, type LayoutChangeEvent, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { CURVE, DURATION, REDUCED, SPRING, STAGGER, haptic, useReducedMotion } from '../../../core/design/motion';

export const PP_MOTION = {
  /** Adım itme: yeni adım sağdan x %100 → 0, eski 0 → −%100. */
  stepPush: { duration: DURATION.base, curve: CURVE.enter },
  /** Jest bırakınca kalan yol. */
  gestureSettle: { duration: DURATION.fast, curve: CURVE.standard },
  /** İlerleme çubuğu dolgusu: AI yayı (~440 ms'de yerleşir); etiket 220 crossfade. */
  progress: SPRING.ai,
  label: DURATION.fast,
  /** Seçim kartı: basınca 1 → 0,96 (110 standard); bırakınca AI yayı; dolgu 220. */
  press: { scale: 0.96, duration: DURATION.instant },
  fill: DURATION.fast,
  /** Hedef tarihi eğrisi: morph 330 standard; tarih etiketi 220 crossfade. */
  curve: DURATION.base,
  /** Hesaplama: satır 330 enter, 550 arayla; halka 5 × 550 standard; alev nabzı 990. */
  calcRow: DURATION.base,
  /** Zincirin ilk satırı fast (220) sonra başlar. */
  calcStart: DURATION.fast,
  calcGap: DURATION.slow,
  calcRingStep: DURATION.slow,
  pulse: DURATION.story,
  /** Sonuç sayısı 0 → hedef 550 standard; çipler 110 kademe, 220. */
  count: DURATION.slow,
  chipStagger: DURATION.instant,
  /** "Nasıl hesapladık?": açılış 330 standard, kapanış 220 exit; satırlar 110 gecikme. */
  expandOpen: DURATION.base,
  expandClose: DURATION.fast,
  /** Kilitli gün açılışı 550; check-in grafiği 990; kaldığın yerden 220. */
  unlock: DURATION.slow,
  chart: DURATION.story,
  resume: DURATION.fast,
  reduced: REDUCED.duration,
  /** Kilitli gün kademe aralığı (55 ≈ instant/2 yerine STAGGER.list). */
  unlockStagger: STAGGER.list,
} as const;

/** Adım içeriği geçişi: yalnız içerik kayar; Geri + ilerleme çubuğu sabit kalır. */
export function StepTransition({
  stepKey,
  dir,
  children,
  onSwipeBack,
  swipeEnabled = true,
  onProgress,
}: {
  stepKey: string;
  dir: 1 | -1;
  children: React.ReactNode;
  /** Sol kenardan kaydırma tamamlanınca. */
  onSwipeBack?: () => void;
  swipeEnabled?: boolean;
  /** Jest sırasında 0..1 (çubuk oranla geri iner). */
  onProgress?: (p: number) => void;
}) {
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  const o = useSharedValue(1);
  const width = useRef(390);
  const first = useRef(true);
  // PanResponder bir kez kurulur → güncel geri çağrılar ref'ten okunur (eski kapanış yok).
  const cb = useRef({ onSwipeBack, onProgress, swipeEnabled });
  cb.current = { onSwipeBack, onProgress, swipeEnabled };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced) {
      x.value = 0;
      o.value = 0;
      o.value = withTiming(1, { duration: PP_MOTION.reduced, easing: CURVE.standard });
      return;
    }
    x.value = dir * width.current;
    o.value = 1;
    x.value = withTiming(0, { duration: PP_MOTION.stepPush.duration, easing: PP_MOTION.stepPush.curve });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepKey]);

  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateX: x.value }] }));

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (e, g) => cb.current.swipeEnabled && !!cb.current.onSwipeBack && e.nativeEvent.pageX - g.dx < 24 && g.dx > 8 && Math.abs(g.dy) < 20,
      onPanResponderMove: (_e, g) => {
        const p = Math.max(0, Math.min(1, g.dx / width.current));
        if (reduced) o.value = 1 - p * 0.6;
        else x.value = Math.max(0, g.dx);
        cb.current.onProgress?.(p);
      },
      onPanResponderRelease: (_e, g) => {
        const p = g.dx / width.current;
        const done = p > 0.5 || g.vx > 0.8;
        const finish = () => {
          cb.current.onProgress?.(0);
          if (done) cb.current.onSwipeBack?.();
        };
        if (reduced) {
          o.value = withTiming(done ? 0 : 1, { duration: PP_MOTION.reduced }, (f) => {
            if (f) runOnJS(finish)();
          });
          return;
        }
        x.value = withTiming(done ? width.current : 0, { duration: PP_MOTION.gestureSettle.duration, easing: PP_MOTION.gestureSettle.curve }, (f) => {
          if (f) runOnJS(finish)();
        });
      },
      onPanResponderTerminate: () => {
        x.value = withTiming(0, { duration: PP_MOTION.gestureSettle.duration });
        o.value = 1;
        cb.current.onProgress?.(0);
      },
    }),
  ).current;

  return (
    <Animated.View
      style={[styles.fill, style]}
      onLayout={(e: LayoutChangeEvent) => {
        width.current = e.nativeEvent.layout.width || 390;
      }}
      {...pan.panHandlers}
    >
      {children}
    </Animated.View>
  );
}

/** İlerleme çubuğu: dolgu yeni orana AI yayıyla; jestte oranla geri iner. */
export function ProgressFill({ ratio, color, track, height = 4 }: { ratio: number; color: string; track: string; height?: number }) {
  const reduced = useReducedMotion();
  const w = useSharedValue(ratio);
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      w.value = ratio;
      o.value = 0.4;
      o.value = withTiming(1, { duration: PP_MOTION.reduced });
    } else {
      w.value = withSpring(ratio, PP_MOTION.progress);
    }
  }, [ratio, reduced, w, o]);
  const s = useAnimatedStyle(() => ({ width: `${Math.max(0, Math.min(1, w.value)) * 100}%`, opacity: o.value }));
  return (
    <View style={[styles.track, { height, backgroundColor: track, borderRadius: height / 2 }]}>
      <Animated.View style={[{ height, backgroundColor: color, borderRadius: height / 2 }, s]} />
    </View>
  );
}

/** Metin değişince 220 crossfade (ilerleme etiketi, tarih etiketi). */
export function Crossfade({ k, children, style }: { k: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    o.value = 0;
    o.value = withTiming(1, { duration: PP_MOTION.label, easing: CURVE.standard });
  }, [k, o]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[s, style]}>{children}</Animated.View>;
}

/** Seçim kartı basma: 1 → 0,96 (110), bırakınca AI yayı; hafif haptik parmak kalkınca. */
export function PressCard({
  children,
  style,
  onPress,
  disabled,
  hapticKind = 'light',
  ...rest
}: PressableProps & { children: React.ReactNode; style?: StyleProp<ViewStyle>; hapticKind?: 'light' | 'selection' | null }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[a, style ? { alignSelf: (StyleSheet.flatten(style) as ViewStyle)?.alignSelf } : null]}>
      <Pressable
        {...rest}
        disabled={disabled}
        style={style}
        onPressIn={(e) => {
          if (!reduced && !disabled) s.value = withTiming(PP_MOTION.press.scale, { duration: PP_MOTION.press.duration, easing: CURVE.standard });
          rest.onPressIn?.(e);
        }}
        onPressOut={(e) => {
          if (!reduced) s.value = withSpring(1, SPRING.ai);
          rest.onPressOut?.(e);
        }}
        onPress={(e) => {
          if (disabled) return;
          if (hapticKind) haptic(hapticKind);
          onPress?.(e);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** Sayaç: 0 → değer (550 standard), tabular rakam. Azaltılmışta doğrudan değer. */
export function useCountUp(target: number, run = true, delay = 0): number {
  const reduced = useReducedMotion();
  const [v, setV] = useState(reduced || !run ? target : 0);
  useEffect(() => {
    if (reduced || !run) {
      setV(target);
      return;
    }
    let raf = 0;
    const start = Date.now() + delay;
    const tick = () => {
      const t = Math.min(1, Math.max(0, (Date.now() - start) / PP_MOTION.count));
      // standard (0.2,0,0,1) yaklaşık: ease-out kübik
      const e = 1 - Math.pow(1 - t, 3);
      setV(Math.round(target * e));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, reduced, delay]);
  return v;
}

/** Giriş: opaklık + 8 pt kayma (enter), gecikmeli. Azaltılmış: 220 opaklık. */
export function Rise({ delay = 0, duration = DURATION.base, children, style, play = true }: { delay?: number; duration?: number; children: React.ReactNode; style?: StyleProp<ViewStyle>; play?: boolean }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(play ? 0 : 1);
  useEffect(() => {
    if (!play) return;
    p.value = 0;
    p.value = withDelay(delay, withTiming(1, { duration: reduced ? PP_MOTION.reduced : duration, easing: reduced ? CURVE.standard : CURVE.enter }));
  }, [play, delay, duration, reduced, p]);
  const s = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: reduced ? 0 : (1 - p.value) * 8 }] }));
  return <Animated.View style={[s, style]}>{children}</Animated.View>;
}

/** Açılır bölüm: yükseklik 0 → içerik (330 standard), kapanış 220 exit; içerik ölçülür. */
export function Expand({ open, children }: { open: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const h = useSharedValue(0);
  const o = useSharedValue(open ? 1 : 0);
  const measured = useRef(0);
  const [, force] = useState(0);
  useEffect(() => {
    const target = open ? measured.current : 0;
    if (reduced) {
      h.value = target;
      o.value = withTiming(open ? 1 : 0, { duration: PP_MOTION.reduced });
      return;
    }
    h.value = withTiming(target, { duration: open ? PP_MOTION.expandOpen : PP_MOTION.expandClose, easing: open ? CURVE.standard : CURVE.exit });
    o.value = withTiming(open ? 1 : 0, { duration: open ? PP_MOTION.expandOpen : PP_MOTION.expandClose });
  }, [open, reduced, h, o]);
  const s = useAnimatedStyle(() => ({ height: h.value, opacity: o.value, overflow: 'hidden' }));
  return (
    <Animated.View style={s}>
      <View
        style={styles.measure}
        onLayout={(e) => {
          const nh = e.nativeEvent.layout.height;
          if (Math.abs(nh - measured.current) > 0.5) {
            measured.current = nh;
            if (open) h.value = nh;
            force((n) => n + 1);
          }
        }}
      >
        {children}
      </View>
    </Animated.View>
  );
}

/** Ok 180° döner (330 / 220). */
export function Rotator({ open, children }: { open: boolean; children: React.ReactNode }) {
  const r = useSharedValue(open ? 1 : 0);
  const reduced = useReducedMotion();
  useEffect(() => {
    r.value = reduced ? (open ? 1 : 0) : withTiming(open ? 1 : 0, { duration: open ? PP_MOTION.expandOpen : PP_MOTION.expandClose, easing: CURVE.standard });
  }, [open, reduced, r]);
  const s = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 180}deg` }] }));
  return <Animated.View style={s}>{children}</Animated.View>;
}

/** Alev nabzı: 1 → 1,05 → 1 (tam döngü story 990, sinüs); bitince 1 → 1,14 → 1 (AI yayı). */
export function Pulse({ active, done, children }: { active: boolean; done: boolean; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const loop = useSharedValue(0);
  const peak = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      loop.value = 0;
      peak.value = 1;
      return;
    }
    if (done) {
      loop.value = 0;
      peak.value = withSequence(withTiming(1.14, { duration: DURATION.fast, easing: CURVE.enter }), withSpring(1, SPRING.ai));
    } else if (active) {
      loop.value = 0;
      loop.value = withRepeat(withTiming(1, { duration: PP_MOTION.pulse, easing: CURVE.standard }), -1, false);
    }
  }, [active, done, reduced, loop, peak]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: peak.value * (1 + 0.05 * Math.sin(loop.value * Math.PI)) }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

const APath = Animated.createAnimatedComponent(Path);

/** Halka: her satırda beşte bir dolar (550 standard). `progress` 0..1. */
export function RingProgress({ size, stroke, progress, color, track }: { size: number; stroke: number; progress: number; color: string; track: string }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(progress);
  useEffect(() => {
    p.value = reduced ? progress : withTiming(progress, { duration: PP_MOTION.calcRingStep, easing: CURVE.standard });
  }, [progress, reduced, p]);
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const arc = `M ${c} ${stroke / 2} A ${r} ${r} 0 1 1 ${c - 0.01} ${stroke / 2}`;
  const props = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - Math.max(0, Math.min(1, p.value))) }));
  return (
    <Svg width={size} height={size}>
      <Path d={arc} stroke={track} strokeWidth={stroke} fill="none" />
      <APath d={arc} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circ} ${circ}`} animatedProps={props} />
    </Svg>
  );
}

/** Çizgi soldan sağa çizilir (990 standard). Azaltılmış: çizim yok, 220 opaklık. */
export function DrawPath({ d, length, color, width = 2, dashed = false, play = true }: { d: string; length: number; color: string; width?: number; dashed?: boolean; play?: boolean }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(play && !reduced ? 0 : 1);
  useEffect(() => {
    if (!play) return;
    if (reduced) {
      p.value = 1;
      return;
    }
    p.value = 0;
    p.value = withTiming(1, { duration: PP_MOTION.chart, easing: CURVE.standard });
  }, [d, play, reduced, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - p.value) }));
  if (dashed) return <Path d={d} stroke={color} strokeWidth={width} fill="none" strokeDasharray="4 4" />;
  return <APath d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${length} ${length}`} animatedProps={props} />;
}

/** Değer değişince eski solar, yeni 220 belirir (eğri morph yerine opaklık geçişi + 330 kayma). */
export function MorphSwap({ k, children }: { k: string; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    o.value = reduced ? 0 : 0.25;
    o.value = withTiming(1, { duration: reduced ? PP_MOTION.reduced : PP_MOTION.curve, easing: CURVE.standard });
  }, [k, reduced, o]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={s}>{children}</Animated.View>;
}

/** Kilitli gün açılışı: örtü (bulanıklık / azaltılmış saydamlıkta düz örtü) 1 → 0 (550), 55 kademe. */
export function UnlockFade({ locked, index, children, cover }: { locked: boolean; index: number; children: React.ReactNode; cover: React.ReactNode }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(locked ? 1 : 0);
  useEffect(() => {
    if (locked) {
      o.value = 1;
      return;
    }
    o.value = reduced ? withTiming(0, { duration: PP_MOTION.reduced }) : withDelay(index * PP_MOTION.unlockStagger, withTiming(0, { duration: PP_MOTION.unlock, easing: CURVE.standard }));
  }, [locked, index, reduced, o]);
  const s = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <View>
      {children}
      <Animated.View pointerEvents={locked ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, s]}>
        {cover}
      </Animated.View>
    </View>
  );
}

export { interpolate };

const styles = StyleSheet.create({
  fill: { flex: 1 },
  track: { width: '100%', overflow: 'hidden' },
  measure: { position: 'absolute', left: 0, right: 0, top: 0 },
});
