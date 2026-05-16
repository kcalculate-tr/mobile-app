import React from 'react';
import { Pressable, Text, View, StyleSheet, PressableProps } from 'react-native';
import { sportive } from '../../theme/sportive';

interface Props extends PressableProps {
  label: string;
  icon?: React.ReactNode;
}

export const GlassButton: React.FC<Props> = ({ label, icon, ...rest }) => (
  <Pressable
    style={({ pressed }) => [
      styles.btn,
      pressed && { backgroundColor: sportive.colors.glassActive },
    ]}
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
    backgroundColor: sportive.colors.glassBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: sportive.colors.glassBorder,
    borderRadius: sportive.radius.button,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  icon: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  label: { ...sportive.type.button, color: sportive.colors.textPrimary },
});
