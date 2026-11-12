// G21-S1 md.10 — Modal içindeki, kendi kabuğunu çizen alttan katmanlar için
// `KeyboardAvoidingView behavior={ios ? 'padding' : undefined}` yerine geçen ortak
// sarmalayıcı. Mantık core/design/keyboard.ts `useSheetKeyboard` (ortak Sheet ve
// Keşfet BottomSheet ile AYNI): klavyenin üst kenarı ile bu görünümün alt kenarı
// karşılaştırılır, fark kadar yukarı kaydırılır (native sürücü). İki platformda
// aynı davranış; Android'de pencere zaten küçüldüyse fark 0 (çift kaldırma yok).
//
// Kullanım: görünüm, Modal kökündeki tam ekran kabın (flex-end) altına oturan
// panel ya da kabın kendisi olmalı (`statusBarTranslucent` Modal → koordinatlar
// ekranla aynı). `children` işlev verilirse klavye açıkken kalkma miktarı (pt)
// gelir — alt güvenli alan boşluğunu klavye açıkken kaldırmak için.
import React from 'react';
import { Animated, Dimensions, type StyleProp, type ViewStyle } from 'react-native';
import { sheetMaxHeight, useSheetKeyboard } from '../keyboard';

export function KeyboardLiftView({
  children,
  style,
  enabled = true,
  limitHeight = false,
  testID,
}: {
  children: React.ReactNode | ((lift: number) => React.ReactNode);
  style?: StyleProp<ViewStyle>;
  enabled?: boolean;
  /** Klavye açıkken yüksekliği ekran − klavye − üst boşlukla sınırla (panel sarmalarken). */
  limitHeight?: boolean;
  testID?: string;
}) {
  const kb = useSheetKeyboard(enabled);
  const maxHeight =
    limitHeight && kb.lift > 0 ? sheetMaxHeight(Dimensions.get('window').height, 1, kb.lift) : undefined;
  return (
    <Animated.View
      onLayout={kb.onLayout}
      testID={testID ?? 'keyboard-lift'}
      style={[style, maxHeight != null ? { maxHeight } : null, { transform: [{ translateY: kb.translateY }] }]}
    >
      {typeof children === 'function' ? children(kb.lift) : children}
    </Animated.View>
  );
}
