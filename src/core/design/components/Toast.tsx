import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { AppText } from './AppText';
import { haptic, REDUCED, TRANSITION, useReducedMotion } from '../motion';

/**
 * Toast — "Öğle'ye loglandı · Geri al · Gör".
 *
 * Üstten iner (TRANSITION.toast), bir süre bekler, çıkar. İki eylem:
 *  - Geri al (`onUndo`): yıkıcı değil ama GERİ ALMA; kurala göre geri al
 *    ETKİSİ animasyonsuz uygulanır (burada yalnız toast kendisi animasyonlu,
 *    eylemin kendisi anında). selection haptik.
 *  - Gör (`onView`): ilgili yere götürür. selection haptik.
 *
 * Azaltılmış hareket: yalnız opaklık + en fazla 8 px kayma, en fazla 200 ms.
 *
 * NOT: Bu yeni tasarımın Toast'u; mevcut `src/core/ui/Toast.tsx`'e dokunmadan
 * ayrı dosyadır. Hiçbir ekrana bağlı değildir.
 */
export function Toast({
  visible,
  message,
  onUndo,
  onView,
  onDismiss,
  autoHideMs = 4000,
}: {
  visible: boolean;
  message: string;
  onUndo?: () => void;
  onView?: () => void;
  onDismiss?: () => void;
  autoHideMs?: number;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const p = useRef(new Animated.Value(0)).current; // 0 gizli, 1 görünür
  const offset = reduced ? REDUCED.maxShift : TRANSITION.toast.offset;

  useEffect(() => {
    Animated.timing(p, {
      toValue: visible ? 1 : 0,
      duration: reduced
        ? REDUCED.duration
        : visible
          ? TRANSITION.toast.inDuration
          : TRANSITION.toast.outDuration,
      useNativeDriver: true,
    }).start();

    if (visible && autoHideMs > 0) {
      const timer = setTimeout(() => onDismiss?.(), autoHideMs);
      return () => clearTimeout(timer);
    }
  }, [visible, reduced, autoHideMs, onDismiss, p]);

  const translateY = p.interpolate({ inputRange: [0, 1], outputRange: [-offset, 0] });

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.wrap,
        {
          backgroundColor: t.color.surfaceRaised,
          borderColor: t.color.line,
          borderRadius: t.radius.lg,
          opacity: p,
          transform: [{ translateY }],
          ...t.elevation.md,
        },
      ]}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.dot}>
        <View style={[styles.dotInner, { backgroundColor: t.color.accent }]} />
      </View>
      <AppText variant="body" style={styles.msg} numberOfLines={2}>
        {message}
      </AppText>
      {onUndo ? (
        <Pressable
          onPress={() => {
            haptic('selection');
            onUndo();
          }}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel="Geri al"
        >
          <AppText variant="caption" style={{ color: t.color.accentLine }}>
            Geri al
          </AppText>
        </Pressable>
      ) : null}
      {onView ? (
        <Pressable
          onPress={() => {
            haptic('selection');
            onView();
          }}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel="Gör"
        >
          <AppText variant="caption" style={{ color: t.color.ink }}>
            Gör
          </AppText>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  dotInner: { width: 8, height: 8, borderRadius: 4 },
  msg: { flex: 1 },
  action: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
