// G42-S1 md.3/md.10 — Kayıt akışı temel parçaları: zemin (3 katman bulanık ışık), maskot (süzülme + göz
// kırpma + tepki), üst çubuk (geri + ilerleme halkası), soru balonu (harf harf), ana düğme (yükleme hâli),
// segment. Dokunma alanları ≥ 44 pt, VoiceOver etiketleri, Dynamic Type tavanı, azaltılmış harekette sabit.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { AppText, CURVE, DURATION, REDUCED, SPRING, haptic, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { CaretLeft, Check } from '../../../components/icons';
import { K_MOTION, useK } from './theme';

/* eslint-disable @typescript-eslint/no-require-imports */
const MASCOT_OPEN = require('../../../../assets/coach/koc-acik.png');
const MASCOT_CLOSED = require('../../../../assets/coach/koc-kapali.png');
/* eslint-enable @typescript-eslint/no-require-imports */

export const FONT = {
  display: 'BricolageGrotesque_800ExtraBold',
  bold: 'PlusJakartaSans_800ExtraBold',
  semi: 'PlusJakartaSans_700Bold',
  medium: 'PlusJakartaSans_600SemiBold',
  body: 'PlusJakartaSans_500Medium',
} as const;

// ─── Zemin ────────────────────────────────────────────────────────────────────
/** Degrade zemin + 3 katman bulanık ışık lekesi; `shift` değişince katmanlar farklı hızda kayar (paralaks). */
export function KBackdrop({ shift = 0, children, style }: { shift?: number; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const P = useK();
  const reduced = useReducedMotion();
  const x = useSharedValue(shift);
  useEffect(() => {
    x.value = reduced ? shift : withTiming(shift, { duration: K_MOTION.shared, easing: CURVE.standard });
  }, [shift, reduced, x]);
  const l1 = useAnimatedStyle(() => ({ transform: [{ translateX: -((x.value * 18) % 120) }] }));
  const l2 = useAnimatedStyle(() => ({ transform: [{ translateX: -((x.value * 34) % 160) }] }));
  const l3 = useAnimatedStyle(() => ({ transform: [{ translateX: (x.value * 12) % 90 }] }));
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: P.bgBottom }, style]}>
      <LinearGradient colors={[P.bgTop, P.bgMid, P.bgBottom]} locations={[0, 0.45, 1]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={StyleSheet.absoluteFill} />
      <Animated.View pointerEvents="none" style={[styles.blob, { top: -80, right: -120 }, l1]}>
        <Blob color={P.blobA} opacity={P.isDark ? 0.45 : 0.7} size={360} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.blob, { top: 260, left: -160 }, l2]}>
        <Blob color={P.blobB} opacity={P.isDark ? 0.35 : 0.45} size={340} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.blob, { bottom: -120, right: -60 }, l3]}>
        <Blob color={P.blobA} opacity={P.isDark ? 0.25 : 0.35} size={300} />
      </Animated.View>
      {children}
    </View>
  );
}

function Blob({ color, opacity, size }: { color: string; opacity: number; size: number }) {
  const id = `b${color.replace(/[^a-z0-9]/gi, '')}${size}`;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  );
}

// ─── Maskot ───────────────────────────────────────────────────────────────────
/**
 * kcalAI Koç maskotu (assets/coach). Sürekli süzülme (±7 pt, 3,2 sn) + 4–6 sn'de göz kırpma; `react`
 * anahtarı değişince küçük zıplama (her cevaba tepki). Azaltılmış harekette sabit (kırpma da yok).
 */
export function Mascot({ size = 96, fill = false, react, calm = false, label, style }: { size?: number; fill?: boolean; react?: unknown; calm?: boolean; label?: string; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const { t } = useT();
  const y = useSharedValue(0);
  const hop = useSharedValue(0);
  const [blink, setBlink] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(y);
      y.value = 0;
      return;
    }
    const amp = calm ? K_MOTION.floatAmp / 2 : K_MOTION.floatAmp;
    y.value = withRepeat(
      withSequence(
        withTiming(-amp, { duration: K_MOTION.floatHalf, easing: CURVE.standard }),
        withTiming(0, { duration: K_MOTION.floatHalf, easing: CURVE.standard }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(y);
  }, [reduced, calm, y]);

  useEffect(() => {
    if (reduced) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      const wait = K_MOTION.blinkMin + Math.random() * (K_MOTION.blinkMax - K_MOTION.blinkMin);
      timer = setTimeout(() => {
        if (!alive) return;
        setBlink(true);
        timer = setTimeout(() => {
          if (!alive) return;
          setBlink(false);
          loop();
        }, K_MOTION.blinkHold);
      }, wait);
    };
    loop();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [reduced]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduced || react === undefined) return;
    hop.value = withSequence(withTiming(-10, { duration: DURATION.instant, easing: CURVE.enter }), withSpring(0, SPRING.bouncy));
  }, [react, reduced, hop]);

  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value + hop.value }] }));
  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label ?? t('kayit.onb.mascot')}
      style={[fill ? { width: '100%', height: '100%' } : { width: size, height: size }, st, style]}
    >
      <Image source={blink ? MASCOT_CLOSED : MASCOT_OPEN} style={fill ? { width: '100%', height: '100%' } : { width: size, height: size }} resizeMode="contain" />
    </Animated.View>
  );
}

// ─── İlerleme halkası ─────────────────────────────────────────────────────────
export function ProgressRing({ index, total, size = 52, glow = false, hideNumber = false }: { index: number; total: number; size?: number; glow?: boolean; hideNumber?: boolean }) {
  const P = useK();
  const { t } = useT();
  const reduced = useReducedMotion();
  const stroke = 4;
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const ratio = total > 0 ? Math.min(1, index / total) : 0;
  const prog = useSharedValue(ratio);
  const [dash, setDash] = useState(c * (1 - ratio));
  useEffect(() => {
    // SVG strokeDashoffset JS'te güncellenir (kısa geçiş; azaltılmışta anında).
    if (reduced) {
      setDash(c * (1 - ratio));
      prog.value = ratio;
      return;
    }
    const from = prog.value;
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const k = Math.min(1, (Date.now() - start) / K_MOTION.shared);
      const e = 1 - Math.pow(1 - k, 3);
      const v = from + (ratio - from) * e;
      setDash(c * (1 - v));
      if (k < 1) raf = requestAnimationFrame(tick);
      else prog.value = ratio;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ratio, c, reduced, prog]);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('kayit.q.progress', { index, total })}
      accessibilityValue={{ min: 0, max: total, now: index }}
      style={[styles.ringWrap, { width: size, height: size, backgroundColor: P.circle }, glow && { shadowColor: P.accent, shadowOpacity: 0.8, shadowRadius: 12 }]}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={P.ringTrack} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={P.ringFill}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={dash}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {index > 0 && !hideNumber ? (
        <AppText maxFontSizeMultiplier={1.2} style={[styles.ringNum, { color: P.ink }]}>
          {String(index)}
        </AppText>
      ) : null}
    </View>
  );
}

// ─── Üst çubuk ────────────────────────────────────────────────────────────────
export function CircleButton({ onPress, label, children, testID, disabled }: { onPress: () => void; label: string; children: React.ReactNode; testID?: string; disabled?: boolean }) {
  const P = useK();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={6}
      style={({ pressed }) => [styles.circleBtn, { backgroundColor: P.circle, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

export function TopBar({ onBack, progress, right, glow }: { onBack?: (() => void) | null; progress?: { index: number; total: number; hideNumber?: boolean } | null; right?: React.ReactNode; glow?: boolean }) {
  const P = useK();
  const { t } = useT();
  return (
    <View style={styles.topBar}>
      {onBack ? (
        <CircleButton testID="kayit-back" onPress={onBack} label={t('kayit.q.back')}>
          <CaretLeft size={22} color={P.ink} weight="bold" />
        </CircleButton>
      ) : (
        <View style={{ width: 52 }} />
      )}
      {right ?? (progress ? <ProgressRing index={progress.index} total={progress.total} glow={glow} hideNumber={progress.hideNumber} /> : <View style={{ width: 52 }} />)}
    </View>
  );
}

// ─── Soru balonu ──────────────────────────────────────────────────────────────
/** Harf harf yazılan başlık (~30 ms/karakter); dokununca tamamlanır; azaltılmışta / ekran okuyucuda tam. */
export function useTypewriter(text: string, enabled: boolean): [string, () => void] {
  const [n, setN] = useState(enabled ? 0 : text.length);
  useEffect(() => {
    if (!enabled) {
      setN(text.length);
      return;
    }
    setN(0);
    const id = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(id);
          return v;
        }
        return v + 1;
      });
    }, K_MOTION.typeChar);
    return () => clearInterval(id);
  }, [text, enabled]);
  return [text.slice(0, n), () => setN(text.length)];
}

export type BubbleLayout = 'left' | 'right' | 'title';

/**
 * Maskot + soru. `left`: maskot solda, balon sağda (P2, P4…); `right`: balon solda, maskot sağda (P3, P5…);
 * `title`: büyük başlık + sağda maskot (P1, L2). Balon görünmez metinle ölçülür → yazarken boy oynamaz.
 */
export function QuestionHead({ title, layout, react, typewriter = true, mascotSize = 104, testID }: { title: string; layout: BubbleLayout; react?: unknown; typewriter?: boolean; mascotSize?: number; testID?: string }) {
  const P = useK();
  const reduced = useReducedMotion();
  const [shown, finish] = useTypewriter(title, typewriter && !reduced);
  const text = (
    <Pressable onPress={finish} accessibilityRole="header" accessibilityLabel={title} style={{ flexShrink: 1 }}>
      <View>
        <AppText maxFontSizeMultiplier={1.35} style={[layout === 'title' ? styles.titleBig : styles.bubbleText, { color: P.ink, opacity: 0 }]}>
          {title}
        </AppText>
        <AppText testID={testID} maxFontSizeMultiplier={1.35} style={[layout === 'title' ? styles.titleBig : styles.bubbleText, styles.overlayText, { color: P.ink }]}>
          {shown}
        </AppText>
      </View>
    </Pressable>
  );
  if (layout === 'title') {
    return (
      <View style={styles.headTitle}>
        <View style={{ flex: 1, paddingTop: 8 }}>{text}</View>
        <Mascot size={mascotSize * 0.9} react={react} style={{ marginTop: 48 }} />
      </View>
    );
  }
  const bubble = <View style={[styles.bubble, { backgroundColor: P.bubble, borderColor: P.bubbleEdge }]}>{text}</View>;
  return (
    <View style={styles.headRow}>
      {layout === 'left' ? <Mascot size={mascotSize} react={react} /> : null}
      {bubble}
      {layout === 'right' ? <Mascot size={mascotSize} react={react} /> : null}
    </View>
  );
}

// ─── Ana düğme ────────────────────────────────────────────────────────────────
/** Lime hap (56 pt). Devre dışı: dolgu + yazı rengiyle ayrılır (yalnız opaklık değil). `loading`: 54 pt daireye daralır + halka. */
export function KButton({ label, onPress, disabled, loading, testID, variant = 'primary' }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean; testID?: string; variant?: 'primary' | 'ghost' }) {
  const P = useK();
  const reduced = useReducedMotion();
  const w = useSharedValue(1);
  useEffect(() => {
    w.value = reduced ? (loading ? 0 : 1) : withTiming(loading ? 0 : 1, { duration: K_MOTION.fast, easing: CURVE.standard });
  }, [loading, reduced, w]);
  const st = useAnimatedStyle(() => ({ width: `${16 + w.value * 84}%` as `${number}%`, minWidth: 56 }));
  const off = !!disabled && !loading;
  const ghost = variant === 'ghost';
  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={st}>
        <Pressable
          testID={testID}
          onPress={() => {
            if (off || loading) return;
            haptic('light');
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: off || !!loading, busy: !!loading }}
          style={({ pressed }) => [
            styles.btn,
            ghost
              ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: P.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(16,48,29,0.25)' }
              : { backgroundColor: off ? P.disabled : P.accent },
            pressed && !off ? { transform: [{ scale: 0.98 }] } : null,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={P.onAccent} />
          ) : (
            <AppText numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.btnText, { color: ghost ? P.ink : off ? P.disabledText : P.onAccent }]}>
              {label}
            </AppText>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Segment ──────────────────────────────────────────────────────────────────
export function Segment<T extends string>({
  options,
  value,
  onChange,
  label,
  width = 220,
  tone = 'auto',
  testID,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  width?: number;
  tone?: 'auto' | 'onDark';
  testID?: string;
}) {
  const P = useK();
  const reduced = useReducedMotion();
  const idx = Math.max(0, options.findIndex((o) => o.key === value));
  const x = useSharedValue(idx);
  useEffect(() => {
    x.value = reduced ? idx : withTiming(idx, { duration: K_MOTION.fast, easing: CURVE.standard });
  }, [idx, reduced, x]);
  const seg = (width - 8) / options.length;
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * seg }] }));
  const dark = tone === 'onDark' || P.isDark;
  return (
    <View testID={testID} accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.seg, { width, backgroundColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(16,48,29,0.08)' }]}>
      <Animated.View style={[styles.segThumb, { width: seg, backgroundColor: P.accent }, thumb]} />
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            testID={testID ? `${testID}-${o.key}` : undefined}
            onPress={() => {
              if (!on) haptic('selection');
              onChange(o.key);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
            style={styles.segItem}
          >
            <AppText numberOfLines={1} maxFontSizeMultiplier={1.25} style={[styles.segText, { color: on ? '#10301D' : dark ? '#FFFFFF' : P.ink }]}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Onay kutusu satırı ───────────────────────────────────────────────────────
export function CheckBoxRow({ checked, onToggle, label, note, testID, disabled }: { checked: boolean; onToggle: () => void; label: string; note?: string | null; testID?: string; disabled?: boolean }) {
  const P = useK();
  return (
    <Pressable
      testID={testID}
      onPress={onToggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      accessibilityLabel={label}
      accessibilityHint={note ?? undefined}
      style={[styles.checkRow, { backgroundColor: P.card, borderColor: P.cardEdge }]}
    >
      <View style={[styles.box, { borderColor: checked ? P.accent : P.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(16,48,29,0.35)', backgroundColor: checked ? P.accent : 'transparent' }]}>
        {checked ? <Check size={16} color="#10301D" weight="bold" /> : null}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <AppText maxFontSizeMultiplier={1.4} style={[styles.checkText, { color: P.ink }]}>
          {label}
        </AppText>
        {note ? (
          <AppText maxFontSizeMultiplier={1.4} style={[styles.checkNote, { color: P.sec }]}>
            {note}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Uyarı / bilgi kartı (ağ yok, iptal, kod yanlış…). tone: info nötr, error hata rengi. */
export function NoticeCard({ title, sub, tone = 'info', action, testID }: { title: string; sub?: string; tone?: 'info' | 'error'; action?: { label: string; onPress: () => void }; testID?: string }) {
  const P = useK();
  return (
    <View testID={testID} accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: tone === 'error' ? P.dangerBg : P.infoBg }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText maxFontSizeMultiplier={1.4} style={[styles.noticeTitle, { color: tone === 'error' ? P.danger : P.ink }]}>
          {title}
        </AppText>
        {sub ? (
          <AppText maxFontSizeMultiplier={1.4} style={[styles.noticeSub, { color: P.sec }]}>
            {sub}
          </AppText>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" accessibilityLabel={action.label} style={styles.noticeBtn}>
          <AppText maxFontSizeMultiplier={1.3} style={[styles.noticeAction, { color: P.ink }]}>
            {action.label}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Girişte aşağıdan yükselir (kademeli); azaltılmışta yalnız opaklık. */
export function Rise({ delay = 0, children, style, dy = 18, duration = K_MOTION.shared }: { delay?: number; children: React.ReactNode; style?: StyleProp<ViewStyle>; dy?: number; duration?: number }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withTiming(1, { duration: reduced ? REDUCED.duration : duration, easing: CURVE.enter }));
  }, [delay, reduced, duration, v]);
  const st = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: reduced ? 0 : (1 - v.value) * dy }] }));
  return <Animated.View style={[st, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  blob: { position: 'absolute' },
  ringWrap: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ringNum: { fontFamily: FONT.bold, fontSize: 15 },
  circleBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, minHeight: 56 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  headTitle: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 24, gap: 8 },
  bubble: { flex: 1, borderRadius: 26, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 16, justifyContent: 'center', minHeight: 68 },
  bubbleText: { fontFamily: FONT.display, fontSize: 24, lineHeight: 29, letterSpacing: -0.4 },
  titleBig: { fontFamily: FONT.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.8 },
  overlayText: { position: 'absolute', left: 0, top: 0, right: 0 },
  btn: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnText: { fontFamily: FONT.bold, fontSize: 17 },
  seg: { height: 52, borderRadius: 26, padding: 4, flexDirection: 'row', alignSelf: 'center' },
  segThumb: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 22 },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  segText: { fontFamily: FONT.bold, fontSize: 15 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 16, minHeight: 64 },
  box: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkText: { fontFamily: FONT.body, fontSize: 15, lineHeight: 21 },
  checkNote: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14 },
  noticeTitle: { fontFamily: FONT.semi, fontSize: 15 },
  noticeSub: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18 },
  noticeBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  noticeAction: { fontFamily: FONT.bold, fontSize: 14, textDecorationLine: 'underline' },
});
