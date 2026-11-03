// Alttan açılan sayfa — AddToDaySheet, PostMenu ve yorum alt-sayfasının ortak
// kabuğu. RN Modal (yeni paket yok). Panel SPRING.sheet ile yükselir, arka plan
// kararması eş zamanlı solar (motion token'ları, G11-S3). Arka plana veya
// donanım geri tuşuna basınca kapanır. Alt güvenli alan boşluğu eklenir.
// Azaltılmış harekete useSheetRise içinde uyulur.
import React from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../core/design';
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

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.fill]}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Kapat" accessibilityRole="button" />
        </Animated.View>
        <Animated.View
          onLayout={onLayout}
          accessibilityViewIsModal
          accessibilityLabel={accessibilityLabel}
          style={[
            styles.sheet,
            panelStyle,
            {
              backgroundColor: t.color.bg,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
        >
          <Animated.View style={[styles.handle, { backgroundColor: t.color.line }]} />
          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,10,10,0.4)' },
  sheet: {
    paddingHorizontal: 16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 8, marginBottom: 12 },
});
