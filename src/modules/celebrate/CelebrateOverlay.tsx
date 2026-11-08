import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AppText, CURVE, TIMING, haptic, useReducedMotion, useTheme } from '../../core/design';
import { useT } from '../../core/i18n';
import { X, Export } from '../../components/icons';
import { GlassObject } from './GlassObject';
import { celebrateContent, type CelebrateMoment } from './types';
import { useOverlayGate } from '../onboarding/first/overlayGate';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Paylasim karti tasarim sabitleri (bilerek sabit — kart koyu/lime "marka" ani).
const CARD_BG = '#0A0A0A';
const CARD_TRACK = '#2C2C2E';
const LIME = '#C6F04F';
const CARD_SUB = '#A1A1A6';
const RING = 132;
const RING_STROKE = 10;

/**
 * FinCelebrate — tam ekran kutlama paneli. Koyu paylasim karti (-3° egik),
 * halka + buyuk sayi, uzerinde cam nesne, lime "mark"li baslik, Paylas/Devam.
 *
 * Mount'ta (visible) bir kez success haptik (hero). Azaltilmis harekette halka
 * ve konfeti animasyonsuz son haline oturur.
 */
export function CelebrateOverlay({
  visible,
  moment,
  dateLabel,
  cardTitle,
  cardSub,
  whyText,
  onShare,
  onDone,
}: {
  visible: boolean;
  moment: CelebrateMoment;
  dateLabel: string;
  cardTitle: string;
  cardSub: string;
  whyText?: string;
  onShare: () => void;
  onDone: () => void;
}) {
  const t = useTheme();
  const { t: tt } = useT();
  const reduced = useReducedMotion();
  const content = celebrateContent(moment);
  useOverlayGate(visible); // G18-S1 temas: açıkken oryantasyon ipucu beklesin

  // Giriste bir kez hero haptik.
  useEffect(() => {
    if (visible) haptic('success');
  }, [visible]);

  // Halka dolumu 0 -> ringProgress.
  const r = (RING - RING_STROKE) / 2;
  const circ = 2 * Math.PI * r;
  const ring = useSharedValue(reduced ? content.ringProgress : 0);
  useEffect(() => {
    if (!visible) {
      ring.value = 0;
      return;
    }
    if (reduced) {
      ring.value = content.ringProgress;
      return;
    }
    ring.value = 0;
    ring.value = withDelay(
      TIMING.enter,
      withTiming(content.ringProgress, { duration: TIMING.dailyRing, easing: CURVE.out }),
    );
  }, [visible, reduced, content.ringProgress, ring]);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - ring.value),
  }));

  // Konfeti: hafif nabiz (opacity). Azaltilmista sabit.
  const pulse = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: TIMING.glow / 2, easing: CURVE.move }),
      -1,
      true,
    );
  }, [reduced, pulse]);
  const confettiStyle = useAnimatedStyle(() => ({ opacity: 0.4 + pulse.value * 0.5 }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDone} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: t.color.bg }]}>
        {/* Sol ust kapat (x). */}
        <Pressable
          onPress={onDone}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel={tt('celebrate.close')}
          hitSlop={8}
        >
          <X size={24} color={t.color.ink} weight="bold" />
        </Pressable>

        {/* Dekoratif konfeti (lime noktalar + kivilcim cizgileri). */}
        <Animated.View style={[styles.confetti, confettiStyle]} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Circle cx="12%" cy="18%" r={5} fill={LIME} />
            <Circle cx="86%" cy="14%" r={4} fill={LIME} />
            <Circle cx="78%" cy="32%" r={3} fill={LIME} />
            <Circle cx="18%" cy="40%" r={3} fill={LIME} />
            <Circle cx="90%" cy="52%" r={5} fill={LIME} />
            <Circle cx="8%" cy="58%" r={4} fill={LIME} />
          </Svg>
        </Animated.View>

        {/* Paylasim karti (-3° egik) + ustunde cam nesne. */}
        <View style={styles.cardWrap}>
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <AppText variant="body" style={styles.cardBrand}>
                kcal.
              </AppText>
              <AppText variant="caption" style={styles.cardDate}>
                {dateLabel}
              </AppText>
            </View>

            {/* Halka + merkez buyuk sayi. */}
            <View style={styles.ringCenter}>
              <Svg width={RING} height={RING}>
                <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={CARD_TRACK} strokeWidth={RING_STROKE} fill="none" />
                <AnimatedCircle
                  cx={RING / 2}
                  cy={RING / 2}
                  r={r}
                  stroke={LIME}
                  strokeWidth={RING_STROKE}
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  animatedProps={ringProps}
                  // 12 yonunden baslasin.
                  transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                />
              </Svg>
              <View style={styles.ringLabel} pointerEvents="none">
                <AppText variant="display" style={styles.bigNum}>
                  {content.big}
                </AppText>
                <AppText variant="caption" style={styles.bigSub}>
                  {tt(`celebrate.sub_${content.bigSub}`)}
                </AppText>
              </View>
            </View>

            <View style={styles.cardBottom}>
              <AppText variant="heading" style={styles.cardTitle} numberOfLines={1}>
                {cardTitle}
              </AppText>
              <AppText variant="caption" style={styles.cardSub} numberOfLines={1}>
                {cardSub}
              </AppText>
            </View>
          </View>

          {/* Cam nesne — kartin sag ustunde, pop + glow. */}
          <View style={styles.glassOnCard} pointerEvents="none">
            <GlassObject name={content.glass} size={92} glow pop />
          </View>
        </View>

        {/* Baslik blogu: title1 <mark>mark</mark> title2. */}
        <View style={styles.titleBlock}>
          <AppText variant="title" tone="ink" style={styles.h1} accessibilityRole="header">
            {tt(`celebrate.${moment}_title1`)}
            {' '}
            <AppText style={[styles.mark, { color: t.color.onAccent, backgroundColor: LIME }]}>
              {` ${tt(`celebrate.${moment}_mark`)} `}
            </AppText>
            {' '}
            {tt(`celebrate.${moment}_title2`)}
          </AppText>

          <AppText variant="body" tone="ink" style={styles.body}>
            {tt(`celebrate.${moment}_body`)}
          </AppText>

          {moment !== 'first' && whyText ? (
            <AppText variant="caption" tone="secondary" style={styles.why}>
              {whyText}
            </AppText>
          ) : null}
        </View>

        {/* Alt butonlar. */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              haptic('selection');
              onShare();
            }}
            accessibilityRole="button"
            accessibilityLabel={tt('celebrate.share')}
            style={[styles.btn, { backgroundColor: t.color.accent }]}
          >
            <Export size={20} color={t.color.onAccent} weight="bold" />
            <AppText variant="body" tone="onAccent" style={styles.btnText}>
              {tt('celebrate.share')}
            </AppText>
          </Pressable>

          <Pressable
            onPress={onDone}
            accessibilityRole="button"
            accessibilityLabel={tt('celebrate.done')}
            style={[styles.btnOutline, { borderColor: t.isDark ? '#48484A' : '#C3C7CC' }]}
          >
            <AppText variant="body" tone="ink" style={styles.btnText}>
              {tt('celebrate.done')}
            </AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const CARD_W = 240;
const CARD_H = 300;

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center' },
  close: {
    position: 'absolute',
    top: 56,
    right: 16, // G17-S1 md.7: modal → X sağda
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  confetti: { ...StyleSheet.absoluteFillObject },
  cardWrap: { marginTop: 110, width: CARD_W, height: CARD_H, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: CARD_BG,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#333',
    padding: 20,
    transform: [{ rotate: '-3deg' }],
    justifyContent: 'space-between',
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardBrand: { color: '#FFFFFF', fontWeight: '700' },
  cardDate: { color: CARD_SUB },
  ringCenter: { alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  ringLabel: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  bigNum: { color: '#FFFFFF', fontSize: 34, lineHeight: 40 },
  bigSub: { color: CARD_SUB, marginTop: 2 },
  cardBottom: { gap: 2 },
  cardTitle: { color: '#FFFFFF', fontSize: 18 },
  cardSub: { color: CARD_SUB, fontSize: 13 },
  glassOnCard: { position: 'absolute', top: -46, right: -22, zIndex: 5 },
  titleBlock: { position: 'absolute', top: 470, left: 24, right: 24, alignItems: 'center', gap: 10 },
  h1: { fontSize: 28, lineHeight: 36, textAlign: 'center' },
  mark: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 28, lineHeight: 36, borderRadius: 8, overflow: 'hidden' },
  body: { textAlign: 'center', maxWidth: 330 },
  why: { textAlign: 'center' },
  actions: { position: 'absolute', bottom: 40, left: 24, right: 24, gap: 12 },
  btn: {
    minHeight: 52,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnOutline: {
    minHeight: 52,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontWeight: '700' },
});
