import React from 'react';
import { Pressable, Text, View, StyleSheet, PressableProps } from 'react-native';
import { sportive } from '../../theme/sportive';

interface Props extends Omit<PressableProps, 'children'> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  selected?: boolean;
  layout?: 'vertical' | 'horizontal';
}

export const ChoiceCard: React.FC<Props> = ({ icon, title, description, selected, layout = 'vertical', ...rest }) => (
  <Pressable
    style={({ pressed }) => [
      layout === 'vertical' ? styles.cardVertical : styles.cardHorizontal,
      selected && styles.cardActive,
      pressed && !selected && { backgroundColor: 'rgba(255,255,255,0.08)' },
    ]}
    {...rest}
  >
    {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
    <View style={layout === 'horizontal' ? { flex: 1 } : undefined}>
      <Text style={[styles.title, selected && { color: sportive.colors.accent }]}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  cardVertical: {
    flex: 1,
    aspectRatio: 3 / 4,
    backgroundColor: sportive.colors.glassBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: sportive.colors.glassBorder,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 10,
  },
  cardHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: sportive.colors.glassBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: sportive.colors.glassBorder,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  cardActive: {
    backgroundColor: sportive.colors.glassActive,
    borderColor: sportive.colors.borderActive,
  },
  iconWrap: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  title: { ...sportive.type.h3, color: sportive.colors.textPrimary },
  desc: { ...sportive.type.bodySm, color: sportive.colors.textSecondary, marginTop: 2 },
});
