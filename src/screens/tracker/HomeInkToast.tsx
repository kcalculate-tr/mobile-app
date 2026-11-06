// HomeInkToast — FinHomeDelivered alt toast'ı (yeni kabuk, G15-S2 m.2):
// mürekkep zemin 52 yükseklik, 26 köşe, 16 kenar; "Akşam’a loglandı" + "Geri al"
// + lime "Gör" hapı. İsteğe bağlı üstünde kase cam nesnesi (teslim anı).
// Su hızlı eklemede de aynı toast ("250 ml su eklendi · Geri al").
// Hareket: yalnız core/design token'ları (DURATION/CURVE/REDUCED).
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { AppText, CURVE, DURATION, REDUCED, haptic, useReducedMotion, useTheme } from '../../core/design';
import { useT } from '../../core/i18n';
import { GlassObject } from '../../modules/celebrate';

export function HomeInkToast({
  visible,
  message,
  bottom,
  bowl = false,
  dot = false,
  onUndo,
  onView,
  onDismiss,
  autoHideMs = 4000,
}: {
  visible: boolean;
  message: string;
  /** Alt kenardan uzaklık (sekme çubuğunun üstü). */
  bottom: number;
  /** Teslim anı: kase cam nesnesi toast'ın üstünde. */
  bowl?: boolean;
  onUndo?: () => void;
  onView?: () => void;
  /** FinCollectEntry: solda lime nokta. */
  dot?: boolean;
  onDismiss: () => void;
  autoHideMs?: number;
}) {
  const t = useTheme();
  const { t: tt } = useT();
  const reduced = useReducedMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withTiming(visible ? 1 : 0, {
      duration: reduced ? REDUCED.duration : visible ? DURATION.base : DURATION.fast,
      easing: CURVE.out,
    });
    if (!visible || autoHideMs <= 0) return;
    const id = setTimeout(onDismiss, autoHideMs);
    return () => clearTimeout(id);
  }, [visible, reduced, autoHideMs, onDismiss, p]);

  const style = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * (reduced ? REDUCED.maxShift : 16) }],
  }));

  return (
    <Animated.View pointerEvents={visible ? 'box-none' : 'none'} style={[styles.layer, { bottom }, style]}>
      {bowl && visible ? (
        <View pointerEvents="none" style={styles.bowl}>
          <GlassObject name="bowl" size={148} pop />
        </View>
      ) : null}
      <View
        accessibilityLiveRegion="polite"
        style={[styles.bar, { backgroundColor: t.color.ink }]}
      >
        {dot ? <View style={[styles.dot, { backgroundColor: t.color.accent }]} /> : null}
        <AppText style={[styles.msg, { color: t.color.bg }]} numberOfLines={1}>
          {message}
        </AppText>
        {onUndo ? (
          <Pressable
            onPress={() => {
              haptic('selection');
              onUndo();
            }}
            accessibilityRole="button"
            style={styles.undo}
          >
            <AppText style={[styles.act, { color: t.color.bg }]}>{tt('gun.undo')}</AppText>
          </Pressable>
        ) : null}
        {onView ? (
          <Pressable
            onPress={() => {
              haptic('selection');
              onView();
            }}
            accessibilityRole="button"
            style={[styles.view, { backgroundColor: t.color.accent }]}
          >
            <AppText style={[styles.act, { color: t.color.onAccent }]}>{tt('gun.view')}</AppText>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 16, right: 16, zIndex: 31 },
  bowl: { position: 'absolute', bottom: 34, left: 0, right: 0, alignItems: 'center' },
  bar: {
    height: 52,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
    paddingRight: 8,
  },
  msg: { flex: 1, fontSize: 14, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  undo: { minWidth: 44, height: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  view: { minWidth: 44, height: 44, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  act: { fontSize: 14, fontWeight: '600' },
});
