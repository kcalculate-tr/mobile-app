/**
 * G29-S1 md.1 — FinMoSticker "Çıkartma kalkar" (T18F1 Tara sonucu → çıkartma).
 *
 * Pano zamanlaması (4000 ms döngünün ilk 1200 ms'i, tek sefer oynar):
 *   0–400   fotoğraf
 *   400     çıkartma fotoğrafın ÜSTÜNE birebir oturur (opaklık instant 100) +
 *           karartma 0 → 0,55 (base 300, standard)
 *   400→    kalkış: translateY −8, ölçek 1,04 (AI yayı) + gölge (aşağı 14, ölçek 1,04, opaklık 0,4)
 *   ~780    haptik light
 *   800     eşleşme hapı girer (base 300, enter; aşağıdan 6) — FinPhotoResult
 * Azaltılmış hareket: kalkış YOK; çıkartma + gölge + karartma 200 ms opaklık (REDUCED).
 *
 * Çıkartma yoksa bu bileşen hiç çizilmez (normal fotoğraf). Görsel dekoratif (VoiceOver'a kapalı);
 * dokunmayı engellemez.
 */
import React, { useEffect, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { CURVE, DURATION, REDUCED, SPRING, haptic } from '../../../../core/design';
import { coverRect, type Sticker } from '../../../../lib/sticker/subjectLift';

/** Pano: fotoğraf 0–400 ms, kesim 400'de başlar. */
export const LIFT_DELAY_MS = 400;
/** Pano: eşleşme hapı 800'de girer (kalkıştan 400 ms sonra). */
export const LIFT_CHIP_DELAY_MS = 800;
/** Pano: haptik ~780 ms (kalkıştan ~380 ms sonra, yay oturmaya yakın). */
export const LIFT_HAPTIC_MS = 780;
export const LIFT_DIM = 0.55;
export const LIFT_SHIFT = -8;
export const LIFT_SCALE = 1.04;
export const LIFT_SHADOW_SHIFT = 14;
export const LIFT_SHADOW_OPACITY = 0.4;

export default function StickerLift({
  sticker,
  container,
  reduced,
  stickerRef,
  testID = 'sticker-lift',
}: {
  sticker: Sticker;
  /** Fotoğrafın `cover` ile çizildiği kabın boyutu. */
  container: { width: number; height: number } | null;
  reduced: boolean;
  /** Logla izi uçuşu çıkartmadan başlar (ölçülür). */
  stickerRef?: React.RefObject<View | null>;
  testID?: string;
}) {
  const rect = container ? coverRect(container, sticker) : null;
  const shown = useSharedValue(0); // çıkartma opaklığı
  const dim = useSharedValue(0);
  const lift = useSharedValue(0); // 0 → 1 (yay)
  const shadow = useSharedValue(0);
  const started = useRef(false);

  useEffect(() => {
    if (!rect || started.current) return;
    started.current = true;
    if (reduced) {
      const t = { duration: REDUCED.duration, easing: CURVE.standard };
      shown.value = withDelay(LIFT_DELAY_MS, withTiming(1, t));
      dim.value = withDelay(LIFT_DELAY_MS, withTiming(LIFT_DIM, t));
      shadow.value = withDelay(LIFT_DELAY_MS, withTiming(LIFT_SHADOW_OPACITY, t));
    } else {
      shown.value = withDelay(LIFT_DELAY_MS, withTiming(1, { duration: DURATION.instant, easing: CURVE.standard }));
      dim.value = withDelay(LIFT_DELAY_MS, withTiming(LIFT_DIM, { duration: DURATION.base, easing: CURVE.standard }));
      lift.value = withDelay(LIFT_DELAY_MS, withSpring(1, SPRING.ai));
      shadow.value = withDelay(LIFT_DELAY_MS, withTiming(LIFT_SHADOW_OPACITY, { duration: DURATION.base, easing: CURVE.standard }));
    }
    // Pano "Haptik: light" — azaltılmış harekette de (dokunsal hareket değildir).
    const h = setTimeout(() => haptic('light'), LIFT_HAPTIC_MS);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect != null]);

  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value }));
  const stickerStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: LIFT_SHIFT * lift.value }, { scale: 1 + (LIFT_SCALE - 1) * lift.value }],
  }));
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: shadow.value,
    transform: [{ translateY: LIFT_SHADOW_SHIFT * lift.value }, { scale: 1 + (LIFT_SCALE - 1) * lift.value }],
  }));

  if (!rect) return null;
  const box = { left: rect.x, top: rect.y, width: rect.width, height: rect.height };
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" testID={testID} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, dimStyle]} testID={`${testID}-dim`} />
      <Animated.View style={[styles.abs, box, shadowStyle]} testID={`${testID}-shadow`}>
        <Image source={{ uri: sticker.uri }} style={[styles.img, styles.tint]} resizeMode="stretch" blurRadius={10} />
      </Animated.View>
      <Animated.View ref={stickerRef} collapsable={false} style={[styles.abs, box, stickerStyle]} testID={`${testID}-sticker`}>
        <Image source={{ uri: sticker.uri }} style={styles.img} resizeMode="stretch" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: '#000000' },
  abs: { position: 'absolute' },
  img: { width: '100%', height: '100%' },
  tint: { tintColor: '#000000' },
});
