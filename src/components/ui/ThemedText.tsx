import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';

const WEIGHT_MAP: Record<string, string> = {
  '400': 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
  'normal': 'PlusJakartaSans_400Regular',
  'bold':   'PlusJakartaSans_700Bold',
};

export function ThemedText({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten(style);
  const weight = String(flat?.fontWeight ?? '400');
  const fontFamily = flat?.fontFamily ?? WEIGHT_MAP[weight] ?? 'PlusJakartaSans_400Regular';
  return <Text style={[{ fontFamily }, style]} {...props} />;
}
