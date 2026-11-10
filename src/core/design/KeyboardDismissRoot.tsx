import React, { useCallback, useRef } from 'react';
import { Keyboard, StyleSheet, TextInput, View, type GestureResponderEvent } from 'react-native';
import { consumeKeepKeyboard, distance, shouldDismissOnTap } from './keyboardDismiss';

/**
 * G27-S1 md.1 — Uygulama kökünde "dışarı dokununca klavye kapanır".
 *
 * Eski global "Kapat" barının (KeyboardToolbar) yerine geçer. Kök yalnız ham
 * dokunma olaylarını DİNLER (onTouchStart/Move/End) — responder olmaz, dokunmayı
 * çalmaz; bu yüzden düğme / liste öğesi kendi onPress'ini alır, kök de klavyeyi
 * kapatır. React ağacı üzerinden kabardığı için Modal'lar, sheet'ler (Elle gir,
 * not, adres) ve portal içerikleri dahil her yeri kapsar. Erişilebilirlik ağacına
 * girmez (düz View, accessible değil). Karar mantığı: keyboardDismiss.ts.
 */

type Start = { x: number; y: number; focused: unknown; target: unknown; moved: number };

type TextInputStateLike = {
  currentlyFocusedInput?: () => unknown;
  isTextInput?: (t: unknown) => boolean;
};

function inputState(): TextInputStateLike {
  return ((TextInput as unknown as { State?: TextInputStateLike }).State ?? {}) as TextInputStateLike;
}

export function KeyboardDismissRoot({ children }: { children: React.ReactNode }) {
  const start = useRef<Start | null>(null);

  const onTouchStart = useCallback((e: GestureResponderEvent) => {
    const keep = consumeKeepKeyboard();
    const ne = e.nativeEvent;
    if (keep || (ne.touches && ne.touches.length > 1)) {
      start.current = null;
      return;
    }
    const focused = inputState().currentlyFocusedInput?.() ?? null;
    start.current = focused ? { x: ne.pageX, y: ne.pageY, focused, target: e.target, moved: 0 } : null;
  }, []);

  const onTouchMove = useCallback((e: GestureResponderEvent) => {
    const s = start.current;
    if (!s) return;
    s.moved = Math.max(s.moved, distance(s.x, s.y, e.nativeEvent.pageX, e.nativeEvent.pageY));
  }, []);

  const onTouchEnd = useCallback(() => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const st = inputState();
    // Dokunma sırasında alan kendiliğinden kapandıysa (ör. gönderim) yapacak iş yok.
    if (!st.currentlyFocusedInput?.()) return;
    const targetIsTextInput = !!(s.target && typeof s.target !== 'number' && st.isTextInput?.(s.target));
    if (shouldDismissOnTap({ focused: s.focused, target: s.target, targetIsTextInput, movedPx: s.moved, keep: false })) {
      Keyboard.dismiss();
    }
  }, []);

  const onTouchCancel = useCallback(() => {
    // Native kaydırma dokunmayı devraldı → karar kaydırma kabının keyboardDismissMode'unda.
    start.current = null;
  }, []);

  return (
    <View
      style={styles.fill}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      testID="keyboard-dismiss-root"
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });

export default KeyboardDismissRoot;
