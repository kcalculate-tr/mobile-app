// G18-S1 — FinTbHow "Nasıl hesaplanır?" sheet'i panodaki çerçeveyle birebir: iç boşluk
// 8/20/32, üst köşe 28, yarı saydam yüzey (açık rgba(255,255,255,0.86) · koyu karşılığı),
// 36×5 tutamaç (alt 6), başlık Bricolage 700/20 + sağda 44 pt X, %32 karartma.
// Ortak `Sheet` (S4) farklı başlık/alt boşluk çizdiği için bu ekrana özel; yalnız
// FinMoTokens: açılış base 300 enter, kapanış fast 200 exit; azaltılmış 200 ms opaklık.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { BlurView } from 'expo-blur';

import { AppText } from '../../../core/design/components/AppText';
import { CURVE, DURATION, REDUCED, useReducedMotion } from '../../../core/design/motion';
import { useOnb } from '../components/onbTheme';

const X_D =
  'M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z';

export function HowSheet({
  visible,
  title,
  closeLabel,
  onClose,
  children,
  footer,
}: {
  visible: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const P = useOnb();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const o = useSharedValue(0);
  const y = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reduced) {
        y.value = 0;
        o.value = withTiming(1, { duration: REDUCED.duration });
      } else {
        o.value = withTiming(1, { duration: DURATION.base, easing: CURVE.enter });
        y.value = withTiming(0, { duration: DURATION.base, easing: CURVE.enter });
      }
    } else if (mounted) {
      const end = () => setMounted(false);
      if (reduced) {
        o.value = withTiming(0, { duration: REDUCED.duration }, (ok) => ok && runOnJS(end)());
      } else {
        o.value = withTiming(0, { duration: DURATION.fast, easing: CURVE.exit });
        y.value = withTiming(1, { duration: DURATION.fast, easing: CURVE.exit }, (ok) => ok && runOnJS(end)());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: o.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: reduced ? o.value : 1,
    transform: [{ translateY: y.value * 600 }],
  }));

  if (!mounted) return null;
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} />
      </Animated.View>
      <View style={styles.wrap} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              borderColor: P.isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.9)',
            },
            sheetStyle,
          ]}
          testID="fin-tb-how-sheet"
        >
          {/* Pano: backdrop-filter blur(28px) saturate(160%) — yüzeyin arkası bulanık. */}
          <BlurView intensity={60} tint={P.isDark ? 'dark' : 'light'} style={[StyleSheet.absoluteFill, styles.blur]} />
          <View style={[StyleSheet.absoluteFill, styles.blur, { backgroundColor: P.isDark ? 'rgba(28,28,30,0.94)' : 'rgba(255,255,255,0.86)' }]} />
          <View style={[styles.handle, { backgroundColor: P.line2 }]} />
          <View style={styles.head}>
            <AppText style={[styles.title, { color: P.ink }]} accessibilityRole="header">
              {title}
            </AppText>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} style={styles.x}>
              <Svg width={22} height={22} viewBox="0 0 256 256">
                <Path d={X_D} fill={P.ink} />
              </Svg>
            </Pressable>
          </View>
          {children}
          {footer}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(10,10,10,0.32)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 32,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  blur: { borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  handle: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 6 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 20, lineHeight: 25, flex: 1 },
  x: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
