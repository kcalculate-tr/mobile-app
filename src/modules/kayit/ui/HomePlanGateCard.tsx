// G49-S1 md.2 — Profilsiz Ana sayfa kartı (G47 `HomeProfileGateCard`ın yerine).
// Yüzey: bulanık cam + yeşil → beyaz degrade (açık: üst sol lime ışıma, alt sağa doğru beyaz; koyu: koyu yeşilden
// yarı saydam cama). Yarıçap 28, ince iç kenar ışığı. Yeni renk YOK: lime #B9EF14 (palette.lime), koyu lime çizgi
// (palette.limeLineOnLight) ve tema yüzey/metin token'ları. "Saydamlığı azalt" açıkken bulanıklık yerine düz yüzey.
// Cam kupa (hedef) kartın sağ üst köşesinden ~%25 taşar, 4 sn döngüde sağ üst ↔ sol alt 6 pt süzülür + ±3° eğilir;
// azaltılmış harekette SABİT. Kart içinde ÖRNEK analiz önizlemesi (halka · 3 makro çubuğu · 7 günlük sütunlar):
// ilk görünüşte çizilerek gelir (600 ms ease-out, sütunlar ≤ 40 ms kademe); köşede "Örnek" etiketi — gerçek kullanıcı
// verisi gibi sunulmaz (VoiceOver: "Örnek analiz önizlemesi, gerçek verin değil"). Lime "Planımı oluştur" → G47 kayıt
// akışı (çağıranın `onStart`ı, mevcut yönlendirme). Ölçüm: home_plan_card_view (bir kez) · home_plan_card_tap {plan}.
import React, { useEffect } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { AppText } from '../../../core/design/components/AppText';
import { HOME_GATE_MOTION, REDUCED, haptic, useReducedMotion } from '../../../core/design/motion';
import { useTheme } from '../../../core/design/ThemeProvider';
import { palette } from '../../../core/design/tokens';
import { useT } from '../../../core/i18n';
import { track } from '../../../lib/analytics';
import { GLASS } from '../../personalPlan/ui/parts';
import { useReduceTransparency } from '../../personalPlan/bridge';
import { BRICOLAGE_BOLD, HOME_LIGHT } from '../../onboarding/first/homeTokens';
import { devFrozenAt, frozenDraw } from './homeGateDev';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** ÖRNEK değerler (gerçek kullanıcı verisi DEĞİL). */
export const PLAN_SAMPLE = {
  eaten: 1450,
  target: 2100,
  macros: [
    { key: 'protein', k: 0.62 },
    { key: 'carbs', k: 0.74 },
    { key: 'fat', k: 0.48 },
  ],
  week: [0.62, 0.8, 0.55, 0.9, 0.7, 0.85, 0.69],
} as const;

export const CARD_RADIUS = 28;
const RING = 72;
const RING_STROKE = 8;
const COL_H = 48;
const CUP_W = 104;
const CUP_H = Math.round((CUP_W * 415) / 480);

function useCardTokens() {
  const { isDark } = useTheme();
  return isDark
    ? {
        isDark,
        solid: palette.darkSurface,
        glass: 'rgba(28,28,30,0.62)',
        edge: 'rgba(255,255,255,0.14)',
        ink: palette.darkInk,
        // G49 HIG: lime ışıma üstünde #A1A1A6 ≈ 2,0:1 kalıyordu → darkInk %82 (≈ 5,6:1, AA).
        sec: 'rgba(245,245,245,0.82)',
        panel: 'rgba(255,255,255,0.06)',
        panelEdge: 'rgba(255,255,255,0.08)',
        track: 'rgba(255,255,255,0.12)',
        fill: palette.lime,
        col: 'rgba(255,255,255,0.2)',
        tag: 'rgba(255,255,255,0.1)',
        glowTop: 0.22,
        glowEnd: 0,
      }
    : {
        isDark,
        solid: palette.lightSurface,
        glass: 'rgba(255,255,255,0.66)',
        edge: 'rgba(255,255,255,0.95)',
        ink: palette.lightInk,
        sec: HOME_LIGHT.phText,
        panel: 'rgba(255,255,255,0.72)',
        panelEdge: 'rgba(10,10,10,0.05)',
        track: 'rgba(10,10,10,0.08)',
        fill: palette.limeLineOnLight,
        col: 'rgba(10,10,10,0.14)',
        tag: 'rgba(10,10,10,0.06)',
        glowTop: 0.62,
        glowEnd: 0,
      };
}

/** Yüzey: bulanıklık (saydamlık azaltılmadıysa) + yarı saydam cam + lime → beyaz degrade + üst sol ışıma. */
function Surface() {
  const c = useCardTokens();
  const reduceT = useReduceTransparency();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {reduceT ? null : <BlurView intensity={30} tint={c.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: reduceT ? c.solid : c.glass }]} />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="g49Lin" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={palette.lime} stopOpacity={c.glowTop} />
            <Stop offset="0.6" stopColor={c.isDark ? palette.lime : palette.white} stopOpacity={c.isDark ? 0.06 : 0.35} />
            <Stop offset="1" stopColor={c.isDark ? palette.lime : palette.white} stopOpacity={c.isDark ? c.glowEnd : 0.9} />
          </LinearGradient>
          <RadialGradient id="g49Glow" cx="10%" cy="0%" rx="70%" ry="60%">
            <Stop offset="0" stopColor={palette.lime} stopOpacity={c.isDark ? 0.2 : 0.55} />
            <Stop offset="1" stopColor={palette.lime} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#g49Lin)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#g49Glow)" />
      </Svg>
    </View>
  );
}

/** Cam kupa: sağ üst köşeden taşar; sağ üst ↔ sol alt süzülme + eğilme. Azaltılmış harekette sabit. */
export function FloatingCup() {
  const reduced = useReducedMotion();
  const p = useSharedValue(0.5);
  const still = reduced || devFrozenAt() != null;
  useEffect(() => {
    if (still) {
      p.value = 0.5;
      return;
    }
    const M = HOME_GATE_MOTION;
    p.value = 0;
    p.value = withRepeat(withTiming(1, { duration: M.cupHalf, easing: M.cupCurve }), -1, true);
  }, [still, p]);
  const moving = useAnimatedStyle(() => {
    const M = HOME_GATE_MOTION;
    const d = (0.5 - p.value) * M.cupShift; // +3 (sağ üst) … −3 (sol alt)
    return {
      transform: [{ translateX: d * Math.SQRT1_2 }, { translateY: -d * Math.SQRT1_2 }, { rotate: `${(0.5 - p.value) * 2 * M.cupTilt}deg` }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      testID="home-gate-cup"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.cup, still ? null : moving]}
    >
      <Image source={GLASS.trophy} style={{ width: CUP_W, height: CUP_H }} resizeMode="contain" />
    </Animated.View>
  );
}

/** Çizim ilerlemesi (0 → 1, 600 ms ease-out). Azaltılmış harekette anlık (panel opaklıkla gelir). */
function useDraw(delay = 0) {
  const reduced = useReducedMotion();
  const frozen = devFrozenAt();
  const v = useSharedValue(frozen != null ? frozenDraw(frozen, delay) : reduced ? 1 : 0);
  useEffect(() => {
    if (frozen != null) {
      v.value = frozenDraw(frozen, delay);
      return;
    }
    if (reduced) {
      v.value = 1;
      return;
    }
    const M = HOME_GATE_MOTION;
    v.value = withDelay(delay, withTiming(1, { duration: M.draw, easing: M.drawCurve }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  return v;
}

function Ring({ track, fill }: { track: string; fill: string }) {
  const d = useDraw();
  const r = (RING - RING_STROKE) / 2;
  const circ = 2 * Math.PI * r;
  const k = PLAN_SAMPLE.eaten / PLAN_SAMPLE.target;
  const props = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - k * d.value) }));
  return (
    <Svg width={RING} height={RING} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={track} strokeWidth={RING_STROKE} fill="none" />
      <AnimatedCircle
        cx={RING / 2}
        cy={RING / 2}
        r={r}
        stroke={fill}
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={`${circ} ${circ}`}
        animatedProps={props}
        testID="home-gate-ring"
      />
    </Svg>
  );
}

function MacroBar({ label, k, track, fill, sec }: { label: string; k: number; track: string; fill: string; sec: string }) {
  const d = useDraw();
  const st = useAnimatedStyle(() => ({ width: `${Math.round(k * d.value * 1000) / 10}%` }));
  return (
    <View style={styles.macro}>
      <AppText maxFontSizeMultiplier={1.2} numberOfLines={1} style={[styles.macroLabel, { color: sec }]}>
        {label}
      </AppText>
      <View style={[styles.bar, { backgroundColor: track }]}>
        <Animated.View style={[styles.barFill, { backgroundColor: fill }, st]} />
      </View>
    </View>
  );
}

function WeekCol({ i, k, color }: { i: number; k: number; color: string }) {
  const d = useDraw(i * HOME_GATE_MOTION.colStagger);
  const st = useAnimatedStyle(() => ({ height: Math.max(4, COL_H * k * d.value) }));
  return <Animated.View testID="home-gate-col" style={[styles.col, { backgroundColor: color }, st]} />;
}

/** Örnek analiz önizlemesi (gerçek veri değil). */
export function SamplePreview() {
  const c = useCardTokens();
  const { t, fmt } = useT();
  const reduced = useReducedMotion();
  const o = useSharedValue(reduced ? 0 : 1);
  useEffect(() => {
    if (reduced) o.value = withTiming(1, { duration: REDUCED.duration });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const fade = useAnimatedStyle(() => ({ opacity: o.value }));
  const eaten = fmt(PLAN_SAMPLE.eaten);
  const target = fmt(PLAN_SAMPLE.target);
  const last = PLAN_SAMPLE.week.length - 1;
  return (
    <Animated.View
      testID="home-gate-preview"
      accessible
      accessibilityLabel={t('kayit.gate.preview_a11y', { eaten, target })}
      style={[styles.panel, { backgroundColor: c.panel, borderColor: c.panelEdge }, fade]}
    >
      <View style={[styles.tag, { backgroundColor: c.tag }]} testID="home-gate-sample">
        <AppText maxFontSizeMultiplier={1.2} style={[styles.tagText, { color: c.sec }]}>
          {t('kayit.gate.sample')}
        </AppText>
      </View>
      <View style={styles.ringCol}>
        <View>
          <Ring track={c.track} fill={c.fill} />
          <View style={styles.ringCenter}>
            <AppText maxFontSizeMultiplier={1.1} style={[styles.ringNum, { color: c.ink }]}>
              {eaten}
            </AppText>
          </View>
        </View>
        <AppText maxFontSizeMultiplier={1.2} numberOfLines={1} style={[styles.small, { color: c.sec }]}>
          {t('kayit.gate.kcal_of', { target })}
        </AppText>
      </View>
      <View style={styles.macros}>
        {PLAN_SAMPLE.macros.map((m) => (
          <MacroBar key={m.key} label={t(`kayit.gate.${m.key}`)} k={m.k} track={c.track} fill={c.fill} sec={c.sec} />
        ))}
      </View>
      <View style={styles.week}>
        <View style={styles.cols}>
          {PLAN_SAMPLE.week.map((k, i) => (
            <WeekCol key={i} i={i} k={k} color={i === last ? c.fill : c.col} />
          ))}
        </View>
        <AppText maxFontSizeMultiplier={1.2} numberOfLines={1} style={[styles.small, { color: c.sec }]}>
          {t('kayit.gate.week')}
        </AppText>
      </View>
    </Animated.View>
  );
}

export function HomePlanGateCard({ onStart }: { onStart: () => void }) {
  const { t } = useT();
  const c = useCardTokens();
  useEffect(() => {
    track('home_plan_card_view');
  }, []);
  return (
    <View testID="home-profile-gate" style={styles.wrap}>
      <View style={[styles.card, { borderColor: c.edge }]}>
        <Surface />
        <View style={styles.text} accessible accessibilityLabel={`${t('kayit.gate.title')}. ${t('kayit.gate.sub')}`}>
          <AppText accessibilityRole="header" maxFontSizeMultiplier={1.3} style={[styles.title, { color: c.ink }]}>
            {t('kayit.gate.title')}
          </AppText>
          <AppText maxFontSizeMultiplier={1.3} style={[styles.sub, { color: c.sec }]}>
            {t('kayit.gate.sub')}
          </AppText>
        </View>
        <SamplePreview />
        <Pressable
          testID="home-profile-gate-start"
          onPress={() => {
            haptic('light');
            track('home_plan_card_tap', { action: 'plan' });
            onStart();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('kayit.gate.cta')}
          accessibilityHint={t('kayit.gate.sub')}
          style={({ pressed }) => [styles.cta, { transform: [{ scale: pressed ? HOME_GATE_MOTION.pressScale : 1 }] }]}
        >
          <AppText maxFontSizeMultiplier={1.3} style={styles.ctaText}>
            {t('kayit.gate.cta')}
          </AppText>
        </Pressable>
      </View>
      <FloatingCup />
    </View>
  );
}

const styles = StyleSheet.create({
  // Kupa kartın üstünden ~%25 taşar → üstte yer açılır (başlık/üst öğeyle çakışmasın).
  wrap: { marginHorizontal: 16, marginTop: 12 + Math.round(CUP_H * 0.25) },
  card: { borderRadius: CARD_RADIUS, borderWidth: 1, overflow: 'hidden', padding: 18, gap: 14 },
  cup: { position: 'absolute', top: -Math.round(CUP_H * 0.25), right: -Math.round(CUP_W * 0.12) },
  text: { gap: 6, paddingRight: Math.round(CUP_W * 0.62) },
  title: { fontFamily: BRICOLAGE_BOLD, fontSize: 22, lineHeight: 27, letterSpacing: -0.4 },
  sub: { fontFamily: 'PlusJakartaSans_500Medium', fontSize: 14, lineHeight: 20 },
  panel: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 14 },
  tag: { position: 'absolute', top: 8, right: 8, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontFamily: 'PlusJakartaSans_700Bold', fontSize: 11, lineHeight: 14 },
  ringCol: { alignItems: 'center', gap: 4 },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ringNum: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 15, lineHeight: 19, fontVariant: ['tabular-nums'] },
  small: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, lineHeight: 14 },
  macros: { flex: 1, minWidth: 0, gap: 8, paddingBottom: 18 },
  macro: { gap: 3 },
  macroLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 11, lineHeight: 14 },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  week: { alignItems: 'center', gap: 4 },
  cols: { height: COL_H, flexDirection: 'row', alignItems: 'flex-end', gap: 5 },
  col: { width: 8, borderRadius: 4 },
  cta: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, backgroundColor: palette.lime },
  ctaText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, lineHeight: 21, color: palette.limeInk },
});
