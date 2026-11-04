import React, { useRef } from 'react';
import {
  AccessibilityRole,
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../ThemeProvider';
import { AppText } from './AppText';
import { haptic, type HapticKind } from '../motion';
import { PRESS_SCALE } from '../../../constants/motion';

/**
 * Buton — FinComponents ölçüleri:
 *  - `primary`  : 52 yükseklik, dolgu.
 *  - `secondary`: 44 yükseklik, çerçeve.
 *  - `text`     : 44 dokunma alanı, yalnız metin.
 * Dokunma alanı her zaman ≥ 44×44 (FinComponents "Dokunma").
 *
 * Renk TEMADAN: `tone="accent"` lime dolgu + koyu metin (marka birincil);
 * `tone="ink"` mürekkep dolgu + yüzey metni (nötr birincil). secondary/text
 * çizgi/accentLine kullanır. Yeni renk sistemi kurulmaz.
 *
 * Basılı ölçek PRESS_SCALE (0.97) — zıplama yok. Varsayılan haptik `selection`.
 */
export function Button({
  label,
  onPress,
  variant = 'primary',
  tone = 'accent',
  disabled = false,
  haptic: hapticKind = 'selection',
  style,
  accessibilityLabel,
  accessibilityRole = 'button',
  testID,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'text';
  tone?: 'accent' | 'ink';
  disabled?: boolean;
  haptic?: HapticKind | null;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  testID?: string;
}) {
  const t = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const springTo = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 20, bounciness: 0 }).start();

  const height = variant === 'primary' ? 52 : 44;
  const isFilled = variant === 'primary';
  const fill = tone === 'accent' ? t.color.accent : t.color.ink;
  const onFill = tone === 'accent' ? t.color.onAccent : t.color.surface;

  const containerStyle: ViewStyle = isFilled
    ? { backgroundColor: disabled ? t.color.line : fill }
    : variant === 'secondary'
      ? { borderWidth: t.stroke.regular, borderColor: t.color.line, backgroundColor: 'transparent' }
      : { backgroundColor: 'transparent' };

  const labelColor = isFilled
    ? disabled
      ? t.color.secondary
      : onFill
    : variant === 'secondary'
      ? t.color.ink
      : t.color.accentLine;

  const handlePress = () => {
    if (disabled) return;
    if (hapticKind) haptic(hapticKind);
    onPress?.();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => !disabled && springTo(PRESS_SCALE)}
        onPressOut={() => springTo(1)}
        disabled={disabled}
        accessibilityRole={accessibilityRole}
        accessibilityState={{ disabled }}
        accessibilityLabel={accessibilityLabel ?? label}
        testID={testID}
        style={[
          styles.base,
          { minHeight: height, borderRadius: t.radius.lg, paddingHorizontal: t.space['2xl'] },
          containerStyle,
          disabled && variant !== 'primary' ? { opacity: 0.5 } : null,
        ]}
      >
        <AppText textRole="body" style={[styles.label, { color: labelColor }]} numberOfLines={1}>
          {label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  label: { fontWeight: '600' },
});
