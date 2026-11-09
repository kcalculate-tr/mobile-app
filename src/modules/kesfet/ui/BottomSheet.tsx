// Alttan açılan sayfa — AddToDaySheet, PostMenu ve yorum alt-sayfasının ortak
// kabuğu. RN Modal (yeni paket yok). Panel SPRING.sheet ile yükselir, arka plan
// kararması eş zamanlı solar (motion token'ları, G11-S3). Arka plana veya
// donanım geri tuşuna basınca kapanır. Alt güvenli alan boşluğu eklenir.
// Azaltılmış harekete useSheetRise içinde uyulur.
//
// G21-S1 md.10 — KLAVYE: panel klavyenin üstüne kalkar (core/design/keyboard
// `useSheetKeyboard`; düzenleme, etkinlik ekleme gibi giriş alanlı katmanlar).
// Klavye açıkken alt güvenli alan boşluğu kalkar (klavye ev göstergesini örter)
// ve panel yüksekliği ekran − klavye − üst boşlukla sınırlanır.
import React from 'react';
import { Animated as RNAnimated, Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../core/design';
import { sheetMaxHeight, useSheetKeyboard } from '../../../core/design/keyboard';
import { useSheetRise } from '../motion';

export function BottomSheet({
  visible,
  onClose,
  children,
  accessibilityLabel,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { panelStyle, backdropStyle, onLayout } = useSheetRise(visible);
  const kb = useSheetKeyboard(visible);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.fill} onLayout={kb.onLayout} testID="kesfet-sheet-root">
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Kapat" accessibilityRole="button" />
        </Animated.View>
        <RNAnimated.View
          testID="kesfet-sheet-lift"
          style={{
            maxHeight: kb.lift > 0 ? sheetMaxHeight(kb.containerHeight, 1, kb.lift) : undefined,
            transform: [{ translateY: kb.translateY }],
          }}
        >
          <Animated.View
            onLayout={onLayout}
            accessibilityViewIsModal
            accessibilityLabel={accessibilityLabel}
            style={[
              styles.sheet,
              panelStyle,
              {
                backgroundColor: t.color.bg,
                paddingBottom: kb.lift > 0 ? 16 : Math.max(insets.bottom, 16) + 8,
              },
            ]}
          >
            <Animated.View style={[styles.handle, { backgroundColor: t.color.line }]} />
            {children}
          </Animated.View>
        </RNAnimated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,10,0.4)' },
  sheet: {
    flexShrink: 1,
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 8, marginBottom: 12 },
});
