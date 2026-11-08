// G18-S1 md.6 — FinOrient1–4: gerçek ekran üstünde 4 atlanabilir ipucu (FinFeedTip
// balon dili). Tam ekran tanıtım YOK. Kök seviyede bir kez bağlanır (AppNavigator);
// hedefler `useOrientTarget(id)` ile kaydolur. Adım seçimi `nextOrientStep` (saf).
//
// Hareket (panolar): örtü fast 200 opaklık; balon base 300 (opaklık + 6 pt yukarı),
// 100 ms sonra — enter. Kapanış fast 200 exit. Azaltılmış: ikisi de 200 ms opaklık.
// Örtü dokunuşları yutar (ipucu açıkken ekran kaymaz); seçim yalnız balondan.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '../../../../core/design/components/AppText';
import { useTheme } from '../../../../core/design/ThemeProvider';
import { CURVE, DURATION, REDUCED, haptic, useReducedMotion } from '../../../../core/design/motion';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { useFeature } from '../../../../core/flags';
import { nextOrientStep, type OrientStep, type OrientTargetId } from '../state';
import { useOnbFirst } from '../store';
import { useGateStore } from '../overlayGate';
import { useOrientTargets } from './useOrientTarget';
import { ARROW, TIP_W, holeFor, placeTip, scrimPath, type Hole } from './geometry';

/** Ekran geçişi/yerleşme payı (hedef ölçülmeden önce). */
const SETTLE = DURATION.slow;

interface Shown {
  step: OrientStep;
  id: OrientTargetId;
  hole: Hole;
}

export function OrientHost({ vitrin }: { /** YALNIZ vitrin: verilen adımı doğrudan göster. */ vitrin?: OrientStep } = {}) {
  const enabled = useFeature('yeni_onboarding');
  const { user } = useAuth();
  const hydrate = useOnbFirst((s) => s.hydrate);
  const hydrated = useOnbFirst((s) => s.hydrated);
  const orient = useOnbFirst((s) => s.synced.orient);
  const celebrating = useOnbFirst((s) => s.celebrate != null);
  const gate = useGateStore((s) => s.open);
  const targets = useOrientTargets((s) => s.targets);
  const { width: W, height: H } = useWindowDimensions();
  const [shown, setShown] = useState<Shown | null>(null);

  useEffect(() => {
    if (enabled && user?.id) void hydrate(user.id);
  }, [enabled, user?.id, hydrate]);

  const available = useMemo(() => new Set(Object.values(targets).map((t) => t!.step)), [targets]);
  const forced = __DEV__ ? vitrin : undefined;
  const step: OrientStep | null =
    forced ??
    (enabled && hydrated && !celebrating && gate === 0 ? nextOrientStep(orient, available) : null);
  const entry = step != null ? Object.values(targets).find((t) => t!.step === step) : undefined;

  useEffect(() => {
    if (step == null || !entry) {
      setShown(null);
      return;
    }
    const id = setTimeout(() => {
      entry.ref.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) setShown({ step, id: entry.id, hole: holeFor(entry.id, { x, y, w, h }, W) });
      });
    }, SETTLE);
    return () => clearTimeout(id);
  }, [step, entry, W]);

  if (!shown) return null;
  return <OrientTip key={shown.step} shown={shown} screen={{ w: W, h: H }} vitrin={forced != null} />;
}

function OrientTip({ shown, screen, vitrin }: { shown: Shown; screen: { w: number; h: number }; vitrin: boolean }) {
  const t = useTheme();
  const i18n = useT();
  const reduced = useReducedMotion();
  const seen = useOnbFirst((s) => s.seen);
  const skip = useOnbFirst((s) => s.skip);
  const { step, id, hole } = shown;
  const tipBg = t.isDark ? '#F5F5F5' : '#0A0A0A';
  const tipFg = t.isDark ? '#0A0A0A' : '#FFFFFF';
  const scrim = t.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(10,10,10,0.48)';
  const place = placeTip(id, hole, screen);
  const last = step === 4;

  const so = useSharedValue(0);
  const to = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      so.value = withTiming(1, { duration: REDUCED.duration });
      to.value = withTiming(1, { duration: REDUCED.duration });
      return;
    }
    so.value = withTiming(1, { duration: DURATION.fast, easing: CURVE.enter });
    to.value = withDelay(DURATION.instant, withTiming(1, { duration: DURATION.base, easing: CURVE.enter }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const scrimStyle = useAnimatedStyle(() => ({ opacity: so.value }));
  const tipStyle = useAnimatedStyle(() => ({
    opacity: to.value,
    transform: [{ translateY: reduced ? 0 : 6 * (1 - to.value) }],
  }));

  const close = (then: () => void) => {
    haptic('selection');
    if (vitrin) return;
    const d = reduced ? REDUCED.duration : DURATION.fast;
    so.value = withTiming(0, { duration: d, easing: CURVE.exit });
    to.value = withTiming(0, { duration: d, easing: CURVE.exit }, (ok) => {
      if (ok) runOnJS(then)();
    });
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} testID={`fin-orient-${step}`}>
      <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]} pointerEvents="none">
        <Svg width={screen.w} height={screen.h}>
          <Path d={scrimPath(screen, hole)} fill={scrim} fillRule="evenodd" />
        </Svg>
      </Animated.View>
      {/* Örtü dokunuşu yutar (seçim balondan). */}
      <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={() => {}} />
      <Animated.View
        accessibilityViewIsModal
        accessibilityRole="alert"
        accessibilityLabel={i18n.t('onboarding.orient.a11y', { n: step })}
        style={[
          styles.tip,
          { backgroundColor: tipBg, left: place.left },
          place.above ? { bottom: place.bottom } : { top: place.top },
          tipStyle,
        ]}
      >
        <AppText style={[styles.title, { color: tipFg }]}>{i18n.t(`onboarding.orient.t${step}`)}</AppText>
        <AppText style={[styles.body, { color: tipFg }]}>{i18n.t(`onboarding.orient.b${step}`)}</AppText>
        <View style={styles.foot}>
          <AppText style={[styles.count, { color: tipFg }]}>{i18n.t('onboarding.orient.count', { n: step })}</AppText>
          <View style={styles.actions}>
            {last ? (
              <Pressable onPress={() => close(() => seen(4))} accessibilityRole="button" style={styles.act} testID="fin-orient-done">
                <AppText style={[styles.next, { color: tipFg }]}>{i18n.t('onboarding.orient.done')}</AppText>
              </Pressable>
            ) : (
              <>
                <Pressable onPress={() => close(skip)} accessibilityRole="button" style={styles.act} testID="fin-orient-skip">
                  <AppText style={[styles.skip, { color: tipFg }]}>{i18n.t('onboarding.orient.skip')}</AppText>
                </Pressable>
                <Pressable onPress={() => close(() => seen(step))} accessibilityRole="button" style={styles.act} testID="fin-orient-next">
                  <AppText style={[styles.next, { color: tipFg }]}>{i18n.t('onboarding.orient.next')}</AppText>
                </Pressable>
              </>
            )}
          </View>
        </View>
        <View
          pointerEvents="none"
          style={[
            styles.arrow,
            { backgroundColor: tipBg, left: place.arrowLeft },
            place.above ? { bottom: -ARROW / 2 } : { top: -ARROW / 2 },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: 1000, elevation: 1000 },
  tip: {
    position: 'absolute',
    width: TIP_W,
    paddingTop: 12,
    paddingRight: 8,
    paddingBottom: 4,
    paddingLeft: 14,
    borderRadius: 18,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: { fontSize: 14, lineHeight: 19, fontFamily: 'PlusJakartaSans_600SemiBold' },
  body: { fontSize: 13, lineHeight: 18, opacity: 0.7, paddingRight: 6 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontSize: 13, lineHeight: 18, opacity: 0.7 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  act: { minHeight: 44, paddingHorizontal: 8, justifyContent: 'center' },
  skip: { fontSize: 13, lineHeight: 18, fontFamily: 'PlusJakartaSans_600SemiBold' },
  next: { fontSize: 13, lineHeight: 18, fontFamily: 'PlusJakartaSans_700Bold', textDecorationLine: 'underline' },
  arrow: { position: 'absolute', width: ARROW, height: ARROW, borderRadius: 2, transform: [{ rotate: '45deg' }] },
});
