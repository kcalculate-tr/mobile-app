import React from 'react';
import { Pressable, Text, View, StyleSheet, PressableProps, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { sportive } from '../../theme/sportive';

interface Props extends PressableProps {
  label: string;
  icon?: React.ReactNode;
  // Varsayılan: koyu "glass" görünümü (tema ile aynı). Apple'ın App Store
  // kuralı gereği zorunlu beyaz-zemin/siyah-metin varyantı gibi durumlar
  // için container/metin/ikon kutusu/basılı-hal rengi override edilebilir —
  // yükseklik/köşe/boşluk/font HER ZAMAN sabit kalır (bkz. styles.btn).
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  iconSize?: number;
  pressedBackgroundColor?: string;
}

export const GlassButton: React.FC<Props> = ({
  label,
  icon,
  disabled,
  style,
  textStyle,
  iconSize = 16,
  pressedBackgroundColor = sportive.colors.glassActive,
  ...rest
}) => (
  <Pressable
    style={({ pressed }) => [
      styles.btn,
      pressed && { backgroundColor: pressedBackgroundColor },
      disabled && { opacity: 0.5 },
      style,
    ]}
    disabled={disabled}
    {...rest}
  >
    {icon && <View style={[styles.icon, { width: iconSize, height: iconSize }]}>{icon}</View>}
    <Text style={[styles.label, textStyle]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    backgroundColor: sportive.colors.glassBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: sportive.colors.glassBorder,
    borderRadius: sportive.radius.button,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  icon: { alignItems: 'center', justifyContent: 'center' },
  label: { ...sportive.type.button, color: sportive.colors.textPrimary },
});
