// G42-S1 md.3/md.10 — Kayıt akışı temel parçaları: zemin (3 katman bulanık ışık), maskot (süzülme + göz
// kırpma + tepki), üst çubuk (geri + ilerleme halkası), soru balonu, ana düğme (yükleme hâli), segment.
// Dokunma alanları ≥ 44 pt, VoiceOver etiketleri, Dynamic Type tavanı, azaltılmış harekette sabit.
// G44-S1: görsel dil AYNI; yalnız hareket/seçim hâli: balon 200 ms fade (harf harf yok), ışık paralaksı yarı
// genlik + yavaş, maskot (kayıt) yarı genlik + cevapta tek baş sallama, düğme/segment/kutu basışta 0,98 +
// 120 ms, seçim hâli 160 ms renk geçişi; azaltılmış harekette hepsi anlık.
// G45-S1: sağ üstteki sayılı halka → geri düğmesinin sağında ince ilerleme çubuğu (3 pt, 250 ms ease-out);
// balon yazısı ~%10 küçük + dar ekranda (< 360 pt) küçük maskot → en çok 2 satır; K1/E1/E2 `compact` (~%15 küçük);
// büyük yazılarda açık satır yüksekliği (AppText varsayılanı 24 pt kırpıyordu); `KText` f+i/f+l bitişik harfini
// U+200C ile kapatır (Fabric iOS `fontVariant: no-common-ligatures` desteklemiyor).
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
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
import { AppText, CURVE, DURATION, SPRING, haptic, useReducedMotion } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { CaretLeft, Check } from '../../../components/icons';
import { K_MOTION, useK } from './theme';
import { PressScale, mixColor, useSelectTween } from './motion';

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

/** G48 md.0 — giriş katmanı ölçeği (AuthSheet, K1, E1/E2 giriş düğmeleri): tek font Plus Jakarta Sans. */
export const AUTH_BTN = { height: 50, radius: 25, gap: 10, font: FONT.medium, size: 15, line: 20 } as const;
export const AUTH_TITLE = { font: FONT.semi, size: 20, line: 26 } as const;

// ─── Metin: bitişik harf kapatma ──────────────────────────────────────────────
/**
 * G45 md.1: Plus Jakarta Sans `liga` (fi, fl, ff, ffi, ffl) Türkçe "fi"yi "fı" gibi gösterir; Bricolage 800'de `liga`
 * yok ama başlık kuralı aynı. RN 0.81 Fabric iOS `fontVariant: ['no-common-ligatures']` değerini yok sayıyor →
 * f ile i / l / f arasına U+200C (sıfır genişlikli birleştirmeyen) eklenir. Görünmez; VoiceOver okumaz;
 * erişilebilirlik etiketleri ham metinle kalır.
 */
export const ZWNJ = '\u200C';
export function noLig(s: string): string {
  return s.replace(/f(?=[fil])/g, `f${ZWNJ}`);
}
function mapLig(c: React.ReactNode): React.ReactNode {
  if (typeof c === 'string') return noLig(c);
  if (Array.isArray(c)) return c.map((x) => (typeof x === 'string' ? noLig(x) : x));
  return c;
}
/** Kayıt ekranlarının metin bileşeni: AppText + bitişik harf kapatma. */
export function KText({ children, ...rest }: React.ComponentProps<typeof AppText>) {
  return <AppText {...rest}>{mapLig(children)}</AppText>;
}

// ─── Zemin ────────────────────────────────────────────────────────────────────
/**
 * Degrade zemin + 3 katman bulanık ışık lekesi; `shift` değişince katmanlar farklı hızda kayar (paralaks).
 * G44: paralaks genliği yarıya (çarpan ve sarma aralığı ½), geçiş yavaş (700 ms); azaltılmışta sabit.
 */
export function KBackdrop({ shift = 0, children, style }: { shift?: number; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const P = useK();
  const reduced = useReducedMotion();
  const x = useSharedValue(shift);
  useEffect(() => {
    x.value = reduced ? shift : withTiming(shift, { duration: K_MOTION.parallax, easing: CURVE.standard });
  }, [shift, reduced, x]);
  const l1 = useAnimatedStyle(() => ({ transform: [{ translateX: -((x.value * 9) % 60) }] }));
  const l2 = useAnimatedStyle(() => ({ transform: [{ translateX: -((x.value * 17) % 80) }] }));
  const l3 = useAnimatedStyle(() => ({ transform: [{ translateX: (x.value * 6) % 45 }] }));
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
/** Onboarding maskot zıplaması — G42 değerleri (DURATION.instant + SPRING.bouncy) sabitlendi; onboarding AYNI. */
const ONB_HOP_UP = DURATION.instant;
const ONB_HOP_SPRING = SPRING.bouncy;
/**
 * kcalAI Koç maskotu (assets/coach). Sürekli süzülme (3,2 sn) + 4–6 sn'de göz kırpma. Azaltılmış harekette sabit.
 * - `motion="onboarding"` (onboarding 1–5'in tam ekran katmanı, `fill`): G42 ile AYNI — ±7 pt süzülme, `react`
 *   değişince küçük zıplama.
 * - `motion="kayit"` (diğer her yer, varsayılan): G44 — süzülme yarı genlik (±3,5 pt), her cevapta zıplama yerine
 *   tek küçük baş sallama (≤ 300 ms, yay yok); art arda değişimlerde (cetvel çentikleri) sallama tekrar etmez.
 */
export function Mascot({
  size = 96,
  fill = false,
  react,
  calm = false,
  label,
  style,
  motion,
}: {
  size?: number;
  fill?: boolean;
  react?: unknown;
  calm?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
  motion?: 'onboarding' | 'kayit';
}) {
  const reduced = useReducedMotion();
  const { t } = useT();
  const mode = motion ?? (fill ? 'onboarding' : 'kayit');
  const y = useSharedValue(0);
  const hop = useSharedValue(0);
  const nod = useSharedValue(0);
  const lastNod = useRef(0);
  const [blink, setBlink] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (reduced) {
      cancelAnimation(y);
      y.value = 0;
      return;
    }
    const base = mode === 'onboarding' ? K_MOTION.floatAmp : K_MOTION.floatAmpKayit;
    const amp = calm ? base / 2 : base;
    y.value = withRepeat(
      withSequence(
        withTiming(-amp, { duration: K_MOTION.floatHalf, easing: CURVE.standard }),
        withTiming(0, { duration: K_MOTION.floatHalf, easing: CURVE.standard }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(y);
  }, [reduced, calm, y, mode]);

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
    if (mode === 'onboarding') {
      hop.value = withSequence(withTiming(-10, { duration: ONB_HOP_UP, easing: CURVE.enter }), withSpring(0, ONB_HOP_SPRING));
      return;
    }
    // Baş sallama: −6° → +4° → 0 (toplam 290 ms). Önceki sallama bitmeden gelen değişim yok sayılır.
    const now = Date.now();
    if (now - lastNod.current < K_MOTION.nod) return;
    lastNod.current = now;
    const ease = { easing: CURVE.standard };
    nod.value = withSequence(
      withTiming(-6, { duration: K_MOTION.nodIn, ...ease }),
      withTiming(4, { duration: K_MOTION.nodMid, ...ease }),
      withTiming(0, { duration: K_MOTION.nodOut, ...ease }),
    );
  }, [react, reduced, hop, nod, mode]);

  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value + hop.value }, { rotate: `${nod.value}deg` }] }));
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

// ─── İlerleme çubuğu ──────────────────────────────────────────────────────────
/**
 * G45 md.4: 3 pt, yuvarlak uçlu ince çubuk; dolgu koyu yeşil (koyu temada lime), iz yarı saydam beyaz. Oran = görünen
 * soru sayısına göre (progressOf). Dolma 250 ms ease-out; azaltılmışta anlık.
 */
/** Çubuk dolumu: ease-out = token `CURVE.enter` (0.05, 0.7, 0.1, 1 — hızlı başlar, yavaşlayarak oturur; aşma yok). */
const BAR_EASE = CURVE.enter;

export function ProgressBar({ index, total }: { index: number; total: number }) {
  const P = useK();
  const { t } = useT();
  const reduced = useReducedMotion();
  const ratio = total > 0 ? Math.min(1, Math.max(0, index / total)) : 0;
  const v = useSharedValue(ratio);
  useEffect(() => {
    v.value = reduced ? ratio : withTiming(ratio, { duration: K_MOTION.bar, easing: BAR_EASE });
  }, [ratio, reduced, v]);
  const fill = useAnimatedStyle(() => ({ width: `${v.value * 100}%` as `${number}%` }));
  return (
    <View
      testID="kayit-progress"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('kayit.q.progress', { index, total })}
      accessibilityValue={{ min: 0, max: total, now: index }}
      style={styles.barHit}
    >
      <View style={[styles.bar, { backgroundColor: P.barTrack }]}>
        <Animated.View testID="kayit-progress-fill" style={[styles.barFill, { backgroundColor: P.barFill }, fill]} />
      </View>
    </View>
  );
}

// ─── Üst çubuk ────────────────────────────────────────────────────────────────
export function CircleButton({ onPress, label, children, testID, disabled }: { onPress: () => void; label: string; children: React.ReactNode; testID?: string; disabled?: boolean }) {
  const P = useK();
  return (
    <PressScale
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={6}
      style={[styles.circleBtn, { backgroundColor: P.circle, opacity: disabled ? 0.5 : 1 }]}
    >
      {children}
    </PressScale>
  );
}

/**
 * Üst çubuk: geri düğmesi + (sorularda) sağında ekran genişliğine yayılan ince ilerleme çubuğu. G45: sayılı halka yok;
 * L1, L2, K1, E1, E2'de çubuk verilmez. `right`: L1 maskotu gibi sağ öğe.
 */
export function TopBar({ onBack, progress, right }: { onBack?: (() => void) | null; progress?: { index: number; total: number } | null; right?: React.ReactNode }) {
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
      {progress ? <ProgressBar index={progress.index} total={progress.total} /> : <View style={{ flex: 1 }} />}
      {right ?? null}
    </View>
  );
}

// ─── Soru balonu ──────────────────────────────────────────────────────────────
/** G44: harf harf yazma kaldırıldı — balon metni `text` değişince 200 ms fade ile gelir; azaltılmışta anlık. */
function FadeText({ text, children }: { text: string; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      o.value = 1;
      return;
    }
    o.value = 0;
    o.value = withTiming(1, { duration: K_MOTION.bubbleFade, easing: CURVE.standard });
  }, [text, reduced, o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

export type BubbleLayout = 'left' | 'right' | 'title';

/** G45 md.8: bu genişliğin altında (320 pt sınıfı) maskot küçülür + balon iç boşluğu daralır → başlık ≤ 2 satır. */
export const NARROW_W = 360;

/**
 * Maskot + soru. `left`: maskot solda, balon sağda (P2, P4…); `right`: balon solda, maskot sağda (P3, P5…);
 * `title`: büyük başlık + sağda maskot (P1, L2). G44: metin 200 ms fade (`fade={false}` → anlık; K1/E1/E2).
 * G45: balon 22 pt (önce 24), `compact` (K1/E1/E2) 20 pt (~%15 küçük); dar ekranda maskot 64 pt. Varsayılan yazı
 * boyutunda balon en çok 2 satır (dar ekranda 21 pt; yine sığmazsa en çok %15 küçülür); büyük yazıda (Dynamic Type) satır
 * kırılır, kırpılmaz.
 */
export function QuestionHead({ title, layout, react, fade = true, mascotSize = 104, compact = false, testID }: { title: string; layout: BubbleLayout; react?: unknown; fade?: boolean; mascotSize?: number; compact?: boolean; testID?: string }) {
  const P = useK();
  const { width, fontScale } = useWindowDimensions();
  const narrow = width < NARROW_W;
  const mSize = narrow ? Math.min(mascotSize, 64) : mascotSize;
  const fit = layout !== 'title' && fontScale <= 1;
  const label = (
    <KText
      testID={testID}
      maxFontSizeMultiplier={1.35}
      numberOfLines={fit ? 2 : undefined}
      adjustsFontSizeToFit={fit}
      minimumFontScale={0.85}
      style={[layout === 'title' ? styles.titleBig : compact ? styles.bubbleCompact : narrow ? styles.bubbleTextNarrow : styles.bubbleText, { color: P.ink }]}
    >
      {title}
    </KText>
  );
  const text = (
    <View accessible accessibilityRole="header" accessibilityLabel={title} style={{ flexShrink: 1 }}>
      {fade ? <FadeText text={title}>{label}</FadeText> : label}
    </View>
  );
  if (layout === 'title') {
    return (
      <View style={styles.headTitle}>
        <View style={{ flex: 1, paddingTop: 8 }}>{text}</View>
        <Mascot size={mSize * 0.9} react={react} style={{ marginTop: 48 }} />
      </View>
    );
  }
  const bubble = <View style={[styles.bubble, narrow && styles.bubbleNarrow, { backgroundColor: P.bubble, borderColor: P.bubbleEdge }]}>{text}</View>;
  return (
    <View style={[styles.headRow, narrow && styles.headRowNarrow]}>
      {layout === 'left' ? <Mascot size={mSize} react={react} /> : null}
      {bubble}
      {layout === 'right' ? <Mascot size={mSize} react={react} /> : null}
    </View>
  );
}

// ─── Ana düğme ────────────────────────────────────────────────────────────────
/**
 * Lime hap (56 pt). Devre dışı: dolgu + yazı rengiyle ayrılır (yalnız opaklık değil). `loading`: 54 pt daireye
 * daralır + halka. G44: basışta 0,98 + 120 ms geri dönüş, hafif seçim titreşimi (seçim kartlarıyla aynı).
 */
export function KButton({ label, onPress, disabled, loading, testID, variant = 'primary', size = 'default' }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean; testID?: string; variant?: 'primary' | 'ghost'; /** G48 md.0: giriş düğmeleri (E1/E2) — 50 pt, 15 pt 600, AuthSheet ile aynı ölçek. */ size?: 'default' | 'auth' }) {
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
        <PressScale
          testID={testID}
          disabled={off || !!loading}
          onPress={() => {
            if (off || loading) return;
            haptic('selection');
            onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ disabled: off || !!loading, busy: !!loading }}
          style={[
            styles.btn,
            size === 'auth' ? styles.btnAuth : null,
            ghost
              ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: P.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(16,48,29,0.25)' }
              : { backgroundColor: off ? P.disabled : P.accent },
          ]}
        >
          {loading ? (
            <ActivityIndicator color={P.onAccent} />
          ) : (
            <KText numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.btnText, size === 'auth' ? styles.btnTextAuth : null, { color: ghost ? P.ink : off ? P.disabledText : P.onAccent }]}>
              {label}
            </KText>
          )}
        </PressScale>
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
    x.value = reduced ? idx : withTiming(idx, { duration: K_MOTION.select, easing: CURVE.standard });
  }, [idx, reduced, x]);
  const seg = (width - 8) / options.length;
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * seg }] }));
  const dark = tone === 'onDark' || P.isDark;
  return (
    <View testID={testID} accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.seg, { width, backgroundColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(16,48,29,0.08)' }]}>
      <Animated.View style={[styles.segThumb, { width: seg, backgroundColor: P.accent }, thumb]} />
      {options.map((o) => (
        <SegItem
          key={o.key}
          testID={testID ? `${testID}-${o.key}` : undefined}
          label={o.label}
          on={o.key === value}
          offColor={dark ? '#FFFFFF' : P.ink}
          onPress={() => {
            if (o.key !== value) haptic('selection');
            onChange(o.key);
          }}
        />
      ))}
    </View>
  );
}

/** Segment öğesi: kaydırıcı 160 ms'de kayarken yazı rengi aynı saatle değişir; basışta 0,98. */
function SegItem({ label, on, offColor, onPress, testID }: { label: string; on: boolean; offColor: string; onPress: () => void; testID?: string }) {
  const P = useK();
  const k = useSelectTween(on);
  return (
    <PressScale outer={styles.segItemOuter} testID={testID} onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label} style={styles.segItem}>
      <KText numberOfLines={1} maxFontSizeMultiplier={1.25} style={[styles.segText, { color: mixColor(offColor, P.limeInk, k) }]}>
        {label}
      </KText>
    </PressScale>
  );
}

// ─── Onay kutusu satırı ───────────────────────────────────────────────────────
export function CheckBoxRow({ checked, onToggle, label, note, testID, disabled }: { checked: boolean; onToggle: () => void; label: string; note?: string | null; testID?: string; disabled?: boolean }) {
  const P = useK();
  const k = useSelectTween(checked);
  const edgeOff = P.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(16,48,29,0.35)';
  return (
    <PressScale
      testID={testID}
      onPress={() => {
        haptic('selection');
        onToggle();
      }}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      accessibilityLabel={label}
      accessibilityHint={note ?? undefined}
      style={[styles.checkRow, { backgroundColor: P.card, borderColor: P.cardEdge }]}
    >
      <View style={[styles.box, { borderColor: mixColor(edgeOff, P.accent, k), backgroundColor: mixColor('transparent', P.accent, k) }]}>
        {k > 0 ? (
          <View style={{ opacity: k }}>
            <Check size={16} color={P.limeInk} weight="bold" />
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <KText maxFontSizeMultiplier={1.4} style={[styles.checkText, { color: P.ink }]}>
          {label}
        </KText>
        {note ? (
          <KText maxFontSizeMultiplier={1.4} style={[styles.checkNote, { color: P.sec }]}>
            {note}
          </KText>
        ) : null}
      </View>
    </PressScale>
  );
}

/** Uyarı / bilgi kartı (ağ yok, iptal, kod yanlış…). tone: info nötr, error hata rengi. */
export function NoticeCard({ title, sub, tone = 'info', action, testID }: { title: string; sub?: string; tone?: 'info' | 'error'; action?: { label: string; onPress: () => void }; testID?: string }) {
  const P = useK();
  return (
    <View testID={testID} accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: tone === 'error' ? P.dangerBg : P.infoBg }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <KText maxFontSizeMultiplier={1.4} style={[styles.noticeTitle, { color: tone === 'error' ? P.danger : P.ink }]}>
          {title}
        </KText>
        {sub ? (
          <KText maxFontSizeMultiplier={1.4} style={[styles.noticeSub, { color: P.sec }]}>
            {sub}
          </KText>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" accessibilityLabel={action.label} style={styles.noticeBtn}>
          <KText maxFontSizeMultiplier={1.3} style={[styles.noticeAction, { color: P.ink }]}>
            {action.label}
          </KText>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Giriş: tek seferlik 10 pt yukarı + fade, 240 ms (G44); kademe gecikmesi en çok 150 ms'ye kırpılır.
 * Azaltılmış harekette anlık (hareket de fade de yok).
 */
export function Rise({ delay = 0, children, style, dy = K_MOTION.enterDy, duration = K_MOTION.enter }: { delay?: number; children: React.ReactNode; style?: StyleProp<ViewStyle>; dy?: number; duration?: number }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      v.value = 1;
      return;
    }
    v.value = withDelay(Math.min(delay, K_MOTION.staggerMax), withTiming(1, { duration, easing: CURVE.enter }));
    // tek seferlik: yalnız bağlanırken
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const st = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: reduced ? 0 : (1 - v.value) * dy }] }));
  return <Animated.View style={[st, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  blob: { position: 'absolute' },
  barHit: { flex: 1, minHeight: 44, justifyContent: 'center', marginLeft: 16 },
  bar: { height: 3, borderRadius: 1.5, overflow: 'hidden' },
  barFill: { height: 3, borderRadius: 1.5 },
  circleBtn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, minHeight: 56 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20 },
  headRowNarrow: { gap: 10, paddingHorizontal: 16 },
  headTitle: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 24, gap: 8 },
  bubble: { flex: 1, borderRadius: 26, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 16, justifyContent: 'center', minHeight: 68 },
  bubbleNarrow: { paddingHorizontal: 16 },
  bubbleText: { fontFamily: FONT.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  /** 320 pt sınıfı: 21 pt → TR/EN tüm balonlar 180 pt metin alanında ≤ 2 satır (font metriğiyle ölçüldü). */
  bubbleTextNarrow: { fontFamily: FONT.display, fontSize: 21, lineHeight: 27, letterSpacing: -0.4 },
  bubbleCompact: { fontFamily: FONT.display, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  titleBig: { fontFamily: FONT.display, fontSize: 31, lineHeight: 38, letterSpacing: -0.7 },
  btn: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnText: { fontFamily: FONT.bold, fontSize: 17, lineHeight: 22 },
  btnAuth: { height: AUTH_BTN.height, borderRadius: AUTH_BTN.radius },
  btnTextAuth: { fontFamily: AUTH_BTN.font, fontSize: AUTH_BTN.size, lineHeight: AUTH_BTN.line },
  seg: { height: 52, borderRadius: 26, padding: 4, flexDirection: 'row', alignSelf: 'center' },
  segThumb: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 22 },
  segItemOuter: { flex: 1 },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  segText: { fontFamily: FONT.bold, fontSize: 15, lineHeight: 20 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 16, minHeight: 64 },
  box: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkText: { fontFamily: FONT.body, fontSize: 14, lineHeight: 20 },
  checkNote: { fontFamily: FONT.body, fontSize: 12, lineHeight: 17 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 14 },
  noticeTitle: { fontFamily: FONT.semi, fontSize: 15, lineHeight: 20 },
  noticeSub: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18 },
  noticeBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  noticeAction: { fontFamily: FONT.bold, fontSize: 14, lineHeight: 19, textDecorationLine: 'underline' },
});
