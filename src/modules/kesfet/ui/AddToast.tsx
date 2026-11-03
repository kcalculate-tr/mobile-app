// Keşfet bildirimi — tasarım T20AddToast. Bir mesaj + isteğe bağlı eylem.
// "Günüme eklendi" durumunda mesaj "<Öğün>’ye eklendi", eylem "Günüme paylaş"
// (G6-S3 shareMealToDay). Şikayet/engelle/kopyala için eylemsiz mesaj. Birkaç
// saniye sonra kendiliğinden kapanır. Ekranın altında, tab bar üstünde durur.
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, useTheme } from '../../../core/design';

export interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function AddToast({
  toast,
  onDismiss,
}: {
  toast: ToastState | null;
  onDismiss: () => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) + 96 }]}>
      <View style={[styles.toast, { backgroundColor: t.color.ink }]}>
        <AppText variant="caption" style={[styles.msg, { color: t.color.surface }]} numberOfLines={2}>
          {toast.message}
        </AppText>
        {toast.actionLabel && toast.onAction ? (
          <Pressable
            onPress={() => {
              toast.onAction?.();
              onDismiss();
            }}
            accessibilityRole="button"
            accessibilityLabel={toast.actionLabel}
            hitSlop={8}
          >
            <AppText variant="caption" style={[styles.action, { color: t.color.accent }]}>
              {toast.actionLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    maxWidth: 520,
    width: '100%',
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  msg: { flex: 1, fontWeight: '600' },
  action: { fontWeight: '700' },
});
