// G24-S1 md.3 — kcalAI Koç ortak parçaları: koç maskotu (G39-S1 md.4; önce kase + alev), hak hapı, yazıyor noktaları,
// akan yanıt (FinMoCoach), geri bildirim satırı, "Koç tıbbi tavsiye vermez." satırı.
import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AppText, CURVE, DURATION, REDUCED, haptic, useReducedMotion, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Sparkle, ThumbsDown, ThumbsUp } from '../../../components/icons';
import { streamPlan } from '../model';
import { KOC_ACIK } from './mascot';
import { palette } from '../../../core/design/tokens';

/* eslint-disable @typescript-eslint/no-require-imports */
export const BOWL = require('../../../../assets/glass/bowl.png');
/* eslint-enable @typescript-eslint/no-require-imports */

export const LIME = palette.lime;
export const LIME_INK = '#0A0A0A';

/** Tasarım (FinCoachChat) ek tonları — tema rolleri dışındaki ikincil çizgi/çip yüzeyleri. */
export function useCoachTones() {
  const t = useTheme();
  const d = t.isDark;
  return {
    t,
    bg: t.color.bg,
    card: d ? '#1C1C1E' : '#FFFFFF',
    text: t.color.ink,
    sec: t.color.secondary,
    line: t.color.line,
    line2: d ? '#48484A' : '#C3C7CC',
    chip: d ? '#2C2C2E' : '#E9EBEE',
    nested: d ? '#2C2C2E' : '#F3F4F6',
    red: d ? '#FF6961' : '#D70015',
    glow: d ? 'rgba(185,239,20,0.22)' : 'rgba(185,239,20,0.55)',
    barOff: d ? '#636366' : '#B7BBC1',
  };
}

/**
 * Koç maskotu (FinCoachIntro / Empty / Upsell). G39-S1 md.4: kase + alev yerine maskot (gözler açık),
 * arkasında aynı yumuşak lime ışıma. Dekoratif → VoiceOver'da gizli. Ad geriye uyum için korunuyor.
 */
export function CoachGlass({ size = 120 }: { size?: number }) {
  const c = useCoachTones();
  return (
    <View style={{ width: size * 1.3, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="coach-mascot">
      <View style={{ position: 'absolute', width: size * 1.1, height: size * 1.1, borderRadius: size, backgroundColor: c.glow, opacity: 0.6 }} />
      <Image source={KOC_ACIK} style={{ width: size * 0.92, height: size * 0.92 }} resizeMode="contain" />
    </View>
  );
}

/** Küçük avatar (mesaj satırı). */
export function CoachAvatar({ size = 32 }: { size?: number }) {
  const c = useCoachTones();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.card, borderColor: c.line }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={KOC_ACIK} style={{ width: size * 0.8, height: size * 0.8 }} resizeMode="contain" testID="coach-avatar-mascot" />
    </View>
  );
}

/** Hak hapı: "Bugün N/30" + Balance rozeti · "Deneme N/3". Değişince 220 crossfade. */
export function QuotaPill({ label, a11y, balance }: { label: string; a11y: string; balance: boolean }) {
  const c = useCoachTones();
  const reduced = useReducedMotion();
  return (
    <View style={[styles.pill, { backgroundColor: c.card, shadowColor: '#000' }]} accessible accessibilityLabel={a11y} testID="coach-pill">
      <Sparkle size={16} color={c.text} />
      <Animated.View key={label} entering={FadeIn.duration(reduced ? REDUCED.duration : DURATION.fast)}>
        <AppText style={[styles.pillText, { color: c.text }]}>{label}</AppText>
      </Animated.View>
      {balance ? (
        <View style={styles.badge}>
          <AppText style={styles.badgeText}>Balance</AppText>
        </View>
      ) : null}
    </View>
  );
}

/** Yazıyor: 3 nokta opaklık 0.35 → 1, 110 kademe, 990 döngü (azaltılmışta sabit). */
export function TypingDots() {
  const { t: tr } = useT();
  const c = useCoachTones();
  const reduced = useReducedMotion();
  return (
    <View style={styles.typingRow} accessible accessibilityLabel={tr('coach.typing')} accessibilityLiveRegion="polite" testID="coach-typing">
      <CoachAvatar />
      <View style={[styles.typingBubble, { backgroundColor: c.card, borderColor: c.line }]}>
        {[0, 1, 2].map((i) => (
          <Dot key={i} i={i} reduced={reduced} color={c.sec} />
        ))}
        <AppText style={[styles.typingText, { color: c.sec }]}>{tr('coach.typing')}</AppText>
      </View>
    </View>
  );
}
function Dot({ i, reduced, color }: { i: number; reduced: boolean; color: string }) {
  const o = useSharedValue(reduced ? 1 : 0.35);
  useEffect(() => {
    if (reduced) {
      o.value = 1;
      return;
    }
    o.value = withDelay(
      i * DURATION.instant,
      // Döngü: iki yarım slow (550 + 550) — tasarımın 990 döngüsüne en yakın token (aritmetik yok).
      withRepeat(withSequence(withTiming(1, { duration: DURATION.slow, easing: CURVE.standard }), withTiming(0.35, { duration: DURATION.slow, easing: CURVE.standard })), -1),
    );
    return () => cancelAnimation(o);
  }, [reduced, i, o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, st]} />;
}

/**
 * Akan yanıt: SSE yok — metin istemcide FinMoCoach temposunda açılır (parça başına ≤ 45 ms,
 * toplam ≤ 2200 ms; parça 110 ms opaklıkla belirir). Azaltılmışta parçalar anında, imleç sabit.
 * `animate` false → metin bütün gelir (geçmiş mesajlar). Ekran okuyucu tam metni okur.
 */
export function StreamText({ text, animate, onDone, style }: { text: string; animate: boolean; onDone?: () => void; style?: object }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(animate ? 0 : Number.MAX_SAFE_INTEGER);
  const plan = useRef(streamPlan(text));
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    if (!animate) return;
    plan.current = streamPlan(text);
    const { chunks, interval } = plan.current;
    if (!chunks.length) {
      doneRef.current?.();
      return;
    }
    let i = 0;
    const id = setInterval(() => {
      i += reduced ? 3 : 1;
      setShown(i);
      if (i >= chunks.length) {
        clearInterval(id);
        doneRef.current?.();
      }
    }, reduced ? interval * 3 : interval);
    return () => clearInterval(id);
  }, [animate, text, reduced]);
  const chunks = plan.current.chunks;
  const streaming = animate && shown < chunks.length;
  const visible = streaming ? chunks.slice(0, shown).join('') : text;
  return (
    <AppText style={style} accessibilityLabel={text}>
      {visible}
      {streaming ? <Cursor reduced={reduced} /> : null}
    </AppText>
  );
}
function Cursor({ reduced }: { reduced: boolean }) {
  // İmleç: metin içi karakter (Animated.Text iç içe metinde çalışmaz) — yanıp sönme yerine sabit.
  return <AppText style={{ opacity: reduced ? 0.6 : 0.8 }}>▍</AppText>;
}

/** "Bu yanıt yararlı mı?" — seçilen düğme lime dolar, "Teşekkürler" 220'de belirir; tekrar dokunma geri alır. */
export function FeedbackRow({ value, onChange }: { value: -1 | 1 | null; onChange: (v: -1 | 1 | null) => void }) {
  const { t: tr } = useT();
  const c = useCoachTones();
  const reduced = useReducedMotion();
  const press = (v: -1 | 1) => {
    haptic('selection');
    onChange(value === v ? null : v);
  };
  return (
    <View style={styles.fbRow} testID="coach-feedback">
      <AppText style={[styles.fbQ, { color: c.sec }]}>{tr('coach.fb_q')}</AppText>
      <Pressable
        onPress={() => press(1)}
        accessibilityRole="button"
        accessibilityLabel={tr('coach.fb_up')}
        accessibilityState={{ selected: value === 1 }}
        style={[styles.fbBtn, value === 1 ? { backgroundColor: LIME } : null]}
        testID="coach-fb-up"
      >
        <ThumbsUp size={20} color={value === 1 ? LIME_INK : c.text} />
      </Pressable>
      <Pressable
        onPress={() => press(-1)}
        accessibilityRole="button"
        accessibilityLabel={tr('coach.fb_down')}
        accessibilityState={{ selected: value === -1 }}
        style={[styles.fbBtn, value === -1 ? { backgroundColor: c.chip } : null]}
        testID="coach-fb-down"
      >
        <ThumbsDown size={20} color={c.text} />
      </Pressable>
      {value != null ? (
        <Animated.View entering={FadeIn.duration(reduced ? REDUCED.duration : DURATION.fast).easing(CURVE.standard)}>
          <AppText style={[styles.fbThanks, { color: c.sec }]} accessibilityLiveRegion="polite">
            {tr('coach.fb_thanks')}
          </AppText>
        </Animated.View>
      ) : null}
    </View>
  );
}

export function Disclaimer() {
  const { t: tr } = useT();
  const c = useCoachTones();
  return (
    <AppText style={[styles.disclaimer, { color: c.sec }]} testID="coach-disclaimer">
      {tr('coach.disclaimer')}
    </AppText>
  );
}

const styles = StyleSheet.create({
  avatar: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    maxWidth: '92%',
    flexWrap: 'wrap',
    minHeight: 36,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  pillText: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
  badge: { backgroundColor: LIME, borderRadius: 12, paddingHorizontal: 8, minHeight: 22, justifyContent: 'center' },
  badgeText: { fontSize: 12, fontWeight: '700', color: LIME_INK },
  typingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 16 },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, minHeight: 44 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  typingText: { marginLeft: 6, fontSize: 15 },
  fbRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  fbQ: { fontSize: 13, marginRight: 4 },
  fbBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  fbThanks: { fontSize: 13, fontWeight: '600', marginLeft: 4 },
  disclaimer: { fontSize: 12, textAlign: 'center' },
});
