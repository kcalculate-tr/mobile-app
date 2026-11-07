// G17-S2 md.2 — FinMoScan "çek → analiz" katmanı (aynı ekranda, canlı vizörün üstünde).
//
// FinMoScan zamanlaması: deklanşör instant 100 (ShutterButton) → flaş fast 200
// (beyaz 0.8 → 0) → çekilen kare donar → çerçeve daralır (base 300 standard) →
// tarama çizgisi (TIMING.sweep) + lime nokta nefesi (slow 500 ↔, gerçek işlem
// sürdükçe döngü) + "Analiz ediliyor" etiketi ve üç nokta. Sonuç YALNIZ gerçek
// yanıttan sonra gelir (ScanScreen → FinPhotoResult, sheet AI 260/24).
// Azaltılmış hareket: flaş yok, çerçeve daralmaz, çizgi yok, nokta sabit; giriş
// 200 ms opaklık.
import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText, CURVE, DURATION, REDUCED, TIMING, useReducedMotion } from '../../../../core/design';
import { useT } from '../../../../core/i18n';

const LIME = '#C6F04F';
/** Analizde çerçeve bu orana daralır (FinMoScan: kare tabağa kilitlenir). */
export const ANALYZE_FRAME_SCALE = 0.86;

export default function FinScanAnalyzing({
  photoUri,
  frameWidth,
  frameHeight,
  cornerColor = '#FFFFFF',
}: {
  photoUri: string | null;
  frameWidth: number;
  frameHeight: number;
  cornerColor?: string;
}) {
  const reduced = useReducedMotion();
  const { t } = useT();

  const enter = useSharedValue(0);
  const flash = useSharedValue(0);
  const shrink = useSharedValue(0);
  const breath = useSharedValue(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      enter.value = withTiming(1, { duration: REDUCED.duration });
      shrink.value = 0;
      breath.value = 1;
      return;
    }
    enter.value = withTiming(1, { duration: DURATION.instant, easing: CURVE.standard });
    flash.value = withSequence(withTiming(0.8, { duration: 0 }), withTiming(0, { duration: DURATION.fast, easing: CURVE.standard }));
    shrink.value = withDelay(DURATION.fast, withTiming(1, { duration: DURATION.base, easing: CURVE.standard }));
    breath.value = withDelay(
      DURATION.fast,
      withRepeat(withTiming(1, { duration: DURATION.slow, easing: CURVE.standard }), -1, true),
    );
    sweep.value = withDelay(
      DURATION.fast + DURATION.base,
      withRepeat(withTiming(1, { duration: TIMING.sweep, easing: CURVE.standard }), -1, true),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const enterStyle = useAnimatedStyle(() => ({ opacity: enter.value }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));
  const frameStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(shrink.value, [0, 1], [1, ANALYZE_FRAME_SCALE]) }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 1 : interpolate(breath.value, [0, 1], [1, 0.7]),
    transform: [{ scale: reduced ? 1 : interpolate(breath.value, [0, 1], [1, 0.8]) }],
  }));
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 0 : interpolate(shrink.value, [0.6, 1], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(sweep.value, [0, 1], [10, frameHeight - 10]) }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, enterStyle]}
      pointerEvents="none"
      testID="fin-scan-analyzing"
      accessibilityLiveRegion="polite"
      accessibilityLabel={t('ai_scan.analyzing')}
    >
      {photoUri ? <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />

      <View style={styles.center}>
        <Animated.View style={[{ width: frameWidth, height: frameHeight }, frameStyle]}>
          <View style={[styles.corner, styles.tl, { borderColor: cornerColor }]} />
          <View style={[styles.corner, styles.tr, { borderColor: cornerColor }]} />
          <View style={[styles.corner, styles.bl, { borderColor: cornerColor }]} />
          <View style={[styles.corner, styles.br, { borderColor: cornerColor }]} />
          <Animated.View style={[styles.sweep, sweepStyle]} />
          <View style={styles.dotWrap}>
            <Animated.View style={[styles.dot, dotStyle]} />
            <AppText style={styles.label}>{t('ai_scan.analyzing')}</AppText>
            <View style={styles.dots}>
              {[0, 1, 2].map((i) => (
                <TrailDot key={i} index={i} reduced={reduced} />
              ))}
            </View>
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
    </Animated.View>
  );
}

/** Etiket altındaki üç nokta — sırayla yanıp söner (azaltılmışta sabit). */
function TrailDot({ index, reduced }: { index: number; reduced: boolean }) {
  const v = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      v.value = 1;
      return;
    }
    v.value = withDelay(
      DURATION.fast + index * 150,
      withRepeat(withTiming(1, { duration: DURATION.slow, easing: CURVE.standard }), -1, true),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  const s = useAnimatedStyle(() => ({ opacity: interpolate(v.value, [0, 1], [0.3, 1]) }));
  return <Animated.View style={[styles.trail, s]} />;
}

const CORNER = 36;
const THICK = 3;

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(0,0,0,0.28)' },
  flash: { backgroundColor: '#FFFFFF' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: CORNER, height: CORNER },
  tl: { top: 0, left: 0, borderTopWidth: THICK, borderLeftWidth: THICK, borderTopLeftRadius: 12 },
  tr: { top: 0, right: 0, borderTopWidth: THICK, borderRightWidth: THICK, borderTopRightRadius: 12 },
  bl: { bottom: 0, left: 0, borderBottomWidth: THICK, borderLeftWidth: THICK, borderBottomLeftRadius: 12 },
  br: { bottom: 0, right: 0, borderBottomWidth: THICK, borderRightWidth: THICK, borderBottomRightRadius: 12 },
  sweep: { position: 'absolute', left: 8, right: 8, top: 0, height: 2, borderRadius: 1, backgroundColor: LIME },
  dotWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 24, height: 24, borderRadius: 12, backgroundColor: LIME },
  label: { marginTop: 14, color: '#FFFFFF', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  dots: { marginTop: 8, flexDirection: 'row', gap: 6 },
  trail: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FFFFFF' },
});
