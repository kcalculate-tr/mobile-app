import React from 'react';
import { Pressable, Text, StyleSheet, PressableProps, View } from 'react-native';
import { ArrowRight } from 'phosphor-react-native';
import { sportive } from '../../theme/sportive';

interface Props extends PressableProps {
  label: string;
  showArrow?: boolean;
  loading?: boolean;
}

export const PrimaryCTA: React.FC<Props> = ({ label, showArrow, loading, disabled, ...rest }) => (
  <Pressable
    style={({ pressed }) => [
      styles.btn,
      (pressed || disabled) && { backgroundColor: sportive.colors.accentDark },
      disabled && { opacity: 0.5 },
    ]}
    disabled={disabled || loading}
    {...rest}
  >
    <Text style={styles.label}>{loading ? 'Yükleniyor…' : label}</Text>
    {showArrow && !loading && (
      <View style={{ marginLeft: 6 }}>
        <ArrowRight size={16} color={sportive.colors.accentText} weight="bold" />
      </View>
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: sportive.colors.accent,
    borderRadius: sportive.radius.button,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  label: { ...sportive.type.button, color: sportive.colors.accentText },
});
