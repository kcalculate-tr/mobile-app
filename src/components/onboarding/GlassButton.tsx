import React from 'react';
import { Pressable, Text, View, StyleSheet, PressableProps } from 'react-native';
import { sportive } from '../../theme/sportive';

interface Props extends PressableProps {
  label: string;
  icon?: React.ReactNode;
}

export const GlassButton: React.FC<Props> = ({ label, icon, disabled, ...rest }) => (
  <Pressable
    style={({ pressed }) => [
      styles.btn,
      pressed && { backgroundColor: sportive.colors.glassActive },
      disabled && { opacity: 0.5 },
    ]}
    disabled={disabled}
    {...rest}
  >
    {icon && <View style={styles.icon}>{icon}</View>}
    <Text style={styles.label}>{label}</Text>
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
  // Apple'ın resmi AppleAuthenticationButton'ı (SocialAuthButtons) kendi
  // logosunu optik olarak biraz küçük çiziyor (Apple'ın stil kuralı,
  // özelleştirilemez) — Google "G" ikonu 18x18 olunca yanında büyük
  // duruyordu, 16x16 ile görsel ağırlık dengelendi.
  icon: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  label: { ...sportive.type.button, color: sportive.colors.textPrimary },
});
