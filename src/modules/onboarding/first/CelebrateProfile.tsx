// G18-S1 md.5 — FinCelebrateProfile ("Profil hazır"): FinCelebrate'in `profile`
// anı. 900 ms TEK sahne: kart girer (opaklık + 16 pt yukarı + 0.96→1, -3° eğik,
// enter) ve halka aynı anda çizilir (standard). Konfeti/cam nesne/Paylaş YOK
// (panoda showFx/showShare kapalı). Azaltılmış: kart 200 ms opaklık, halka dolu.
// "Devam et" ya da X → oryantasyon başlar (çağıran karar verir: onDone).
// [N] = gerçek günlük hedef (Takibe başla sonucu); yoksa sayı satırları gizlenir.
import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../../../core/design/components/AppText';
import { BrandLogo } from '../../../core/design/components/BrandLogo';
import { CURVE, DURATION, REDUCED, haptic, useReducedMotion } from '../../../core/design/motion';
import { useT } from '../../../core/i18n';
import { BRICOLAGE_BOLD, LIME, LIME_INK, useHomeTokens } from './homeTokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const RING = 132;
const RR = 58;
const C = 2 * Math.PI * RR; // 364.4
const X_D = 'M6 6l12 12M18 6L6 18';

function groupKcal(n: number, lang: string): string {
  const s = String(Math.round(n));
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, lang === 'en' ? ',' : '.');
}

export function CelebrateProfile({
  visible,
  kcal,
  onDone,
}: {
  visible: boolean;
  /** Günlük hedef (kcal). null → sayı gösterilmez (uydurma yok). */
  kcal: number | null;
  onDone: () => void;
}) {
  const k = useHomeTokens();
  const i18n = useT();
  const lang = i18n.lang;
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();

  const p = useSharedValue(reduced ? 1 : 0);
  const ring = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!visible) {
      p.value = 0;
      ring.value = 0;
      return;
    }
    haptic('success');
    if (reduced) {
      ring.value = 1;
      p.value = 0;
      p.value = withTiming(1, { duration: REDUCED.duration });
      return;
    }
    p.value = withTiming(1, { duration: DURATION.story, easing: CURVE.enter });
    ring.value = withTiming(1, { duration: DURATION.story, easing: CURVE.standard });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduced]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [
      { translateY: reduced ? 0 : 16 * (1 - p.value) },
      { rotate: '-3deg' },
      { scale: reduced ? 1 : 0.96 + 0.04 * p.value },
    ],
  }));
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - ring.value) }));

  const n = kcal != null && kcal > 0 ? groupKcal(kcal, lang) : null;
  const date = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'tr-TR', { day: 'numeric', month: 'short' });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone} statusBarTranslucent>
      <View
        style={[styles.root, { backgroundColor: k.bg }]}
        accessibilityViewIsModal
        accessibilityLabel={i18n.t('onboarding.celebrate_profile.a11y')}
        testID="fin-celebrate-profile"
      >
        <View style={[styles.header, { top: insets.top + 3 }]}>
          <Pressable
            onPress={onDone}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('onboarding.celebrate_profile.close')}
            style={styles.x}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path d={X_D} stroke={k.text} strokeWidth={1.75} strokeLinecap="round" />
            </Svg>
          </Pressable>
        </View>

        {/* Paylaşılabilir kart (koyu "marka" kartı, -3°). */}
        <Animated.View
          style={[styles.card, { top: 132 - 59 + insets.top, borderColor: k.isDark ? '#2C2C2E' : '#0A0A0A' }, cardStyle]}
          accessibilityLabel={i18n.t('onboarding.celebrate_profile.card_title')}
        >
          <View style={styles.cardTop}>
            <BrandLogo name="kcal" height={16} color="#FFFFFF" />
            <AppText style={styles.date}>{date}</AppText>
          </View>
          <View style={styles.ringBox}>
            <Svg width={RING} height={RING} viewBox="0 0 132 132" style={StyleSheet.absoluteFill}>
              <Circle cx={66} cy={66} r={RR} fill="none" stroke="#2C2C2E" strokeWidth={10} />
              <AnimatedCircle
                cx={66}
                cy={66}
                r={RR}
                fill="none"
                stroke={LIME}
                strokeWidth={10}
                strokeLinecap="round"
                strokeDasharray={`${C} ${C}`}
                transform="rotate(-90 66 66)"
                animatedProps={ringProps}
              />
            </Svg>
            <View style={styles.ringLabel}>
              {n ? <AppText style={styles.big}>{n}</AppText> : null}
              <AppText style={styles.bigSub}>{i18n.t('onboarding.celebrate_profile.ring_sub')}</AppText>
            </View>
          </View>
          <View style={{ gap: 2 }}>
            <AppText style={styles.cardTitle}>{i18n.t('onboarding.celebrate_profile.card_title')}</AppText>
            {n ? (
              <AppText style={styles.cardSub}>{i18n.t('onboarding.celebrate_profile.card_sub', { kcal: n })}</AppText>
            ) : null}
          </View>
        </Animated.View>

        <View style={[styles.section, { top: 470 - 59 + insets.top }]}>
          <AppText style={[styles.h1, { color: k.text }]} accessibilityRole="header">
            {i18n.t('onboarding.celebrate_profile.title')}{' '}
            <AppText style={[styles.h1, styles.mark]}>{` ${i18n.t('onboarding.celebrate_profile.mark')} `}</AppText>
          </AppText>
          <AppText style={[styles.body, { color: k.text }]}>
            {n
              ? i18n.t('onboarding.celebrate_profile.body', { kcal: n })
              : i18n.t('onboarding.celebrate_profile.body_nokcal')}
          </AppText>
        </View>

        <View style={[styles.actions, { bottom: Math.max(34, insets.bottom + 8) }]}>
          <Pressable
            onPress={onDone}
            accessibilityRole="button"
            style={({ pressed }) => [styles.btn, { borderColor: k.line2, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            testID="fin-celebrate-profile-continue"
          >
            <AppText style={[styles.btnText, { color: k.text }]}>{i18n.t('onboarding.celebrate_profile.cta')}</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { position: 'absolute', left: 0, right: 0, height: 44, flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 4, zIndex: 5 },
  x: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: {
    position: 'absolute',
    alignSelf: 'center',
    width: 240,
    height: 300,
    borderRadius: 28,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    padding: 18,
    justifyContent: 'space-between',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 13, lineHeight: 17, color: '#A1A1A6' },
  ringBox: { alignSelf: 'center', width: RING, height: RING },
  ringLabel: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  big: { fontFamily: BRICOLAGE_BOLD, fontSize: 34, lineHeight: 38, color: '#FFFFFF' },
  bigSub: { fontSize: 13, lineHeight: 17, color: '#A1A1A6' },
  cardTitle: { fontFamily: BRICOLAGE_BOLD, fontSize: 18, lineHeight: 22, color: '#FFFFFF' },
  cardSub: { fontSize: 13, lineHeight: 17, color: '#A1A1A6' },
  section: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 10 },
  h1: { fontFamily: BRICOLAGE_BOLD, fontSize: 32, lineHeight: 37, textAlign: 'center' },
  mark: { backgroundColor: LIME, color: LIME_INK, borderRadius: 8, overflow: 'hidden' },
  body: { fontSize: 16, lineHeight: 22, textAlign: 'center', maxWidth: 330 },
  actions: { position: 'absolute', left: 16, right: 16, gap: 8 },
  btn: { height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, lineHeight: 20, fontFamily: 'PlusJakartaSans_600SemiBold' },
});
