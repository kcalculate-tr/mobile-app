import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  findNodeHandle,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../ThemeProvider';
import { AppText } from './AppText';
import { X as XIcon } from '../../../components/icons';
import { haptic, REDUCED, RN_CURVE, SHEET, useReducedMotion } from '../motion';
import { sheetMaxHeight, useSheetKeyboard } from '../keyboard';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Alttan açılan sayfa (Sheet) — FinComponents: 28 üst köşe · tutamaç · kapat
 * 44×44 · scrim · dialog. FinMoTokens premium geçiş seti: açılış base 300
 * enter · kapanış fast 200 exit · scrim aynı sürede 0→0.4. `product="ai"` zamanlı
 * (Kcalculate sheet'leri yay değil); `"eat"` eatkcal 200/28 yayı.
 *
 * Erişilebilirlik: içerik `accessibilityViewIsModal` (iOS — arka plan okunmaz);
 * açılınca odak başlığa/tutamağa taşınır; `onRequestClose` (Android geri / scrim)
 * kapatır. Azaltılmış hareket: yalnız opaklık, 200 ms (kayma yok).
 *
 * G21-S1 md.10 — KLAVYE: katman klavyenin üstüne kalkar (`useSheetKeyboard`,
 * core/design/keyboard.ts); klavye açıkken yükseklik ekran − klavye − üst boşlukla
 * sınırlanır. `scroll` verilirse gövde kaydırılabilir (`keyboardShouldPersistTaps
 * ="handled"`: klavye açıkken "Uygula" gibi düğmeye ilk dokunuş çalışır). Giriş
 * alanlı her katman `scroll` kullanır; FlatList taşıyan katmanlar kullanmaz.
 */
export function Sheet({
  visible,
  onClose,
  title,
  product = 'ai',
  children,
  footer,
  maxHeightRatio = 0.9,
  contentStyle,
  testID,
  scroll = false,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  product?: 'ai' | 'eat';
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeightRatio?: number;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
  /** Gövdeyi ScrollView yap (giriş alanlı katmanlar). İçinde FlatList varsa verme. */
  scroll?: boolean;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const cfg = SHEET[product];

  const [mounted, setMounted] = useState(visible);
  const scrim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const sheetRef = useRef<View>(null);
  const kb = useSheetKeyboard(mounted);
  // Açılış/kapanış kayması + klavye kaldırması tek transform'da (ikisi de native sürücü).
  const sheetY = useRef(Animated.add(translateY, kb.translateY)).current;

  const focusSheet = useCallback(() => {
    const node = findNodeHandle(sheetRef.current);
    if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      if (reduced) {
        scrim.setValue(cfg.scrimTo);
        translateY.setValue(0);
        Animated.timing(opacity, {
          toValue: 1,
          duration: REDUCED.duration,
          useNativeDriver: true,
        }).start(() => focusSheet());
      } else {
        opacity.setValue(1);
        Animated.parallel([
          Animated.timing(scrim, {
            toValue: cfg.scrimTo,
            duration: cfg.openDuration,
            easing: RN_CURVE.enter,
            useNativeDriver: true,
          }),
          cfg.spring
            ? Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                stiffness: cfg.spring.stiffness,
                damping: cfg.spring.damping,
                mass: cfg.spring.mass,
              })
            : Animated.timing(translateY, {
                toValue: 0,
                duration: cfg.openDuration,
                easing: RN_CURVE.enter,
                useNativeDriver: true,
              }),
        ]).start(() => focusSheet());
      }
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(scrim, {
          toValue: 0,
          duration: reduced ? REDUCED.duration : cfg.closeDuration,
          useNativeDriver: true,
        }),
        reduced
          ? Animated.timing(opacity, {
              toValue: 0,
              duration: REDUCED.duration,
              useNativeDriver: true,
            })
          : Animated.timing(translateY, {
              toValue: SCREEN_HEIGHT,
              duration: cfg.closeDuration,
              easing: RN_CURVE.exit,
              useNativeDriver: true,
            }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduced]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.fill} onLayout={kb.onLayout} testID={testID ? `${testID}-root` : 'sheet-root'}>
        <Animated.View
          style={[styles.scrim, { backgroundColor: '#000', opacity: scrim }]}
          pointerEvents="auto"
        >
          <Pressable
            style={styles.fill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
          />
        </Animated.View>

        <Animated.View
          ref={sheetRef}
          accessibilityViewIsModal
          accessibilityLabel={title}
          needsOffscreenAlphaCompositing
          style={[
            styles.sheet,
            {
              backgroundColor: t.color.surface,
              borderTopLeftRadius: t.radius.xl, // 28
              borderTopRightRadius: t.radius.xl,
              maxHeight: sheetMaxHeight(kb.containerHeight || SCREEN_HEIGHT, maxHeightRatio, kb.lift),
              // Klavye açıkken alt boşluk küçülür (klavye zaten ev göstergesini örter).
              paddingBottom: kb.lift > 0 ? t.space.md : t.space['2xl'],
              opacity,
              transform: [{ translateY: sheetY }],
            },
          ]}
          testID={testID}
        >
          {/* Tutamaç */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: t.color.line }]} />
          </View>

          {/* Başlık + kapat (44×44) */}
          <View style={[styles.header, { paddingHorizontal: t.space['2xl'] }]}>
            {title ? (
              <AppText textRole="sheetTitle" style={styles.title} numberOfLines={1}>
                {title}
              </AppText>
            ) : (
              <View style={styles.title} />
            )}
            <Pressable
              onPress={() => {
                haptic(cfg.detentHaptic);
                onClose();
              }}
              style={styles.close}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Kapat"
            >
              <XIcon size={22} color={t.color.ink} />
            </Pressable>
          </View>

          {scroll ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[styles.body, contentStyle]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              showsVerticalScrollIndicator={false}
              testID={testID ? `${testID}-scroll` : 'sheet-scroll'}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.body, styles.shrink, contentStyle]}>{children}</View>
          )}
          {footer ? <View style={{ paddingHorizontal: t.space['2xl'] }}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    ...(Platform.OS === 'ios'
      ? { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 24, shadowOffset: { width: 0, height: -6 } }
      : { elevation: 24 }),
  },
  handleRow: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  handle: { width: 40, height: 5, borderRadius: 999 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 44, marginBottom: 4 },
  title: { flex: 1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 24 },
  shrink: { flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
});
