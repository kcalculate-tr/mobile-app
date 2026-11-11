import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { AppText } from './AppText';
import { haptic, REDUCED, RN_CURVE, TRANSITION, useReducedMotion } from '../motion';
import { useT } from '../../i18n';

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
 * G25-S1 md.10 (A13): düğme metinleri ve VoiceOver etiketleri i18n (`common.undo` / `common.view`;
 * EN'de "Undo" / "View"). md.9 (A12): isteğe bağlı `onRetry` → "Tekrar dene" (`common.retry`),
 * hata toast'ı için `tone="error"` (nokta ikincil renk, kendiliğinden kapanmaz).
 *
 * NOT: Bu yeni tasarımın Toast'u; mevcut `src/core/ui/Toast.tsx`'e dokunmadan
 * ayrı dosyadır. Hiçbir ekrana bağlı değildir.
 */
/** FinMoLogA toast: alttan 16 pt. */
export const TOAST_BOTTOM_OFFSET = 16;
const TOAST_ENTER = RN_CURVE.enter;
const TOAST_EXIT = RN_CURVE.exit;

export function Toast({
  visible,
  message,
  onUndo,
  onView,
  onRetry,
  onDismiss,
  tone = 'default',
  autoHideMs = tone === 'error' ? 0 : 4000,
  testID,
  from = 'top',
}: {
  visible: boolean;
  message: string;
  onUndo?: () => void;
  onView?: () => void;
  /** G25-S1 md.9: "Tekrar dene" (hata toast'ı). */
  onRetry?: () => void;
  onDismiss?: () => void;
  tone?: 'default' | 'error';
  autoHideMs?: number;
  testID?: string;
  /**
   * G30-S1 md.1: giriş yönü. 'bottom' = FinMoLogA logla toast'ı (sekme çubuğunun üstünde):
   * 16 → 0 alttan, giriş base 300 enter, çıkış fast 200 exit (alta kayarak solar).
   */
  from?: 'top' | 'bottom';
}) {
  const t = useTheme();
  const { t: tr } = useT();
  const reduced = useReducedMotion();
  const p = useRef(new Animated.Value(0)).current; // 0 gizli, 1 görünür
  const offset = reduced
    ? REDUCED.maxShift
    : from === 'bottom'
      ? TOAST_BOTTOM_OFFSET
      : TRANSITION.toast.offset;

  useEffect(() => {
    Animated.timing(p, {
      toValue: visible ? 1 : 0,
      duration: reduced
        ? REDUCED.duration
        : visible
          ? TRANSITION.toast.inDuration
          : TRANSITION.toast.outDuration,
      // 'bottom': pano eğrileri (giriş enter · çıkış exit); 'top' eskisi gibi (varsayılan eğri).
      ...(from === 'bottom' && !reduced ? { easing: visible ? TOAST_ENTER : TOAST_EXIT } : null),
      useNativeDriver: true,
    }).start();

    if (visible && autoHideMs > 0) {
      const timer = setTimeout(() => onDismiss?.(), autoHideMs);
      return () => clearTimeout(timer);
    }
  }, [visible, reduced, autoHideMs, onDismiss, p, from]);

  const translateY = p.interpolate({ inputRange: [0, 1], outputRange: [from === 'bottom' ? offset : -offset, 0] });

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
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
      testID={testID}
    >
      <View style={styles.dot}>
        <View style={[styles.dotInner, { backgroundColor: tone === 'error' ? t.color.secondary : t.color.accent }]} />
      </View>
      <AppText variant="body" style={styles.msg} numberOfLines={tone === 'error' ? undefined : 2}>
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
          accessibilityLabel={tr('common.undo')}
        >
          <AppText variant="caption" style={{ color: t.color.accentLine }}>
            {tr('common.undo')}
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
          accessibilityLabel={tr('common.view')}
        >
          <AppText variant="caption" style={{ color: t.color.ink }}>
            {tr('common.view')}
          </AppText>
        </Pressable>
      ) : null}
      {onRetry ? (
        <Pressable
          onPress={() => {
            haptic('selection');
            onRetry();
          }}
          style={styles.action}
          accessibilityRole="button"
          accessibilityLabel={tr('common.retry')}
          testID={testID ? `${testID}-retry` : undefined}
        >
          <AppText variant="caption" style={{ color: t.color.ink }}>
            {tr('common.retry')}
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
