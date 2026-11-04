// Keşfet bildirimi — tasarım Final FinAddToast. Koyu zemin (ink) üstünde bir
// mesaj + en çok iki eylem: "Geri al" (metin düğme) ve "Gör" (lime dolgu düğme,
// üstünde koyu metin). Loglama sonrası: "Öğle'ye loglandı · Geri al · Gör".
// Şikayet/engelle/kopyala için eylemsiz mesaj. Birkaç saniyede kendiliğinden
// kapanır; ekranın altında, tab barın üstünde durur (bottom ≈ güvenli alan + 96).
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, useTheme } from '../../../core/design';

export interface ToastState {
  message: string;
  /** "Gör" gibi birincil eylem — lime dolgu düğme, üstünde koyu metin. */
  actionLabel?: string;
  onAction?: () => void;
  /** "Geri al" gibi ikincil eylem — düz metin düğme (loglamayı geri alır). */
  undoLabel?: string;
  onUndo?: () => void;
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
        <AppText variant="body" style={[styles.msg, { color: t.color.surface }]} numberOfLines={2}>
          {toast.message}
        </AppText>
        {toast.undoLabel && toast.onUndo ? (
          <Pressable
            onPress={() => {
              toast.onUndo?.();
              onDismiss();
            }}
            accessibilityRole="button"
            accessibilityLabel={toast.undoLabel}
            style={styles.undoBtn}
          >
            <AppText variant="body" style={[styles.undo, { color: t.color.surface }]}>
              {toast.undoLabel}
            </AppText>
          </Pressable>
        ) : null}
        {toast.actionLabel && toast.onAction ? (
          <Pressable
            onPress={() => {
              toast.onAction?.();
              onDismiss();
            }}
            accessibilityRole="button"
            accessibilityLabel={toast.actionLabel}
            style={[styles.actionBtn, { backgroundColor: t.color.accent }]}
          >
            <AppText variant="body" style={[styles.action, { color: t.color.onAccent }]}>
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
  // Final: min-h 56, radius 28, sol 16 metin + sağ 6 düğme yuvası.
  toast: {
    maxWidth: 520,
    width: '100%',
    minHeight: 56,
    borderRadius: 28,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  msg: { flex: 1, fontWeight: '600', fontSize: 15 },
  // "Geri al": en az 44 dokunma, düz metin.
  undoBtn: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  undo: { fontWeight: '600', fontSize: 15 },
  // "Gör": lime dolgu, 44 yükseklik, radius 22.
  actionBtn: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  action: { fontWeight: '700', fontSize: 15 },
});
