import React from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { AppText } from './AppText';
import { haptic } from '../motion';

/**
 * Çip — FinComponents üç durum: Seçili · Varsayılan · Pasif.
 *  - Seçili   : mürekkep dolgu + yüzey metni.
 *  - Varsayılan: yüzey + çizgi çerçeve + mürekkep metin.
 *  - Pasif    : soluk, dokunulamaz.
 * Görsel yükseklik ~36; `hitSlop` ile dokunma alanı ≥ 44 (FinComponents "Dokunma").
 */
export function Chip({
  label,
  selected = false,
  disabled = false,
  onPress,
  style,
  testID,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const t = useTheme();

  const bg = selected ? t.color.ink : t.color.surface;
  const border = selected ? t.color.ink : t.color.line;
  const fg = selected ? t.color.surface : t.color.ink;

  const handlePress = () => {
    if (disabled) return;
    haptic('selection');
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      testID={testID}
      style={[
        styles.chip,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: t.stroke.regular,
          borderRadius: t.radius.pill,
          paddingHorizontal: t.space.lg,
        },
        disabled ? { opacity: 0.4 } : null,
        style,
      ]}
    >
      <AppText textRole="helper" style={{ color: fg }} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
});
