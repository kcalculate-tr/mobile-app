// Keşfet MealCard — gönderiye bağlı tarif/öğün kartı. Tasarım: T20Feed-D1.
// Görsel + ad + "kcal · protein" + P/K/Y çipleri + "N kişi ekledi" + lime
// "Günüme ekle". Lime YALNIZ dolgu; üstündeki metin koyu (onAccent).
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Icon } from './icons';
import type { MealCard as MealCardData } from '../types';

export function MealCard({
  meal,
  addsCount,
  onAddToDay,
}: {
  meal: MealCardData;
  addsCount: number;
  onAddToDay: () => void;
}) {
  const t = useTheme();
  const { t: tr, fmt } = useT();

  const chip = (label: string, value: number) => (
    <View style={[styles.chip, { backgroundColor: t.color.line }]}>
      <AppText variant="caption" style={styles.chipText}>
        {label} {fmt(Math.round(value))}
      </AppText>
    </View>
  );

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: t.color.surface, borderColor: t.color.line },
      ]}
    >
      <View style={styles.top}>
        <View style={[styles.thumb, { backgroundColor: t.color.line }]}>
          {meal.photo_url ? (
            <Image
              source={{ uri: meal.photo_url }}
              style={styles.thumbImg}
              contentFit="cover"
              transition={120}
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
        <View style={styles.info}>
          <AppText variant="caption" style={styles.name} numberOfLines={1}>
            {meal.name}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {tr('kesfet.ui.meal_card.macro', {
              kcal: fmt(meal.kcal),
              protein: fmt(Math.round(meal.protein_g)),
            })}
          </AppText>
          <View style={styles.chips}>
            {chip('P', meal.protein_g)}
            {chip('K', meal.carbs_g)}
            {chip('Y', meal.fat_g)}
          </View>
        </View>
      </View>

      <View style={[styles.actionRow, { borderTopColor: t.color.line }]}>
        <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.added}>
          {tr('kesfet.ui.meal_card.added', { count: addsCount })}
        </AppText>
        <Pressable
          onPress={onAddToDay}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfet.ui.sheet.add') + ' · ' + meal.name}
          hitSlop={6}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: t.color.accent, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Icon name="plus" size={14} color={t.color.onAccent} />
          <AppText variant="caption" style={[styles.addText, { color: t.color.onAccent }]}>
            {tr('kesfet.add_to_day')}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 10, paddingHorizontal: 8, paddingTop: 8, borderRadius: 16, borderWidth: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImg: { width: 52, height: 52, borderRadius: 10 },
  info: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontWeight: '700' },
  chips: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  chip: { minHeight: 20, paddingHorizontal: 6, borderRadius: 6, justifyContent: 'center' },
  chipText: { fontWeight: '600', fontSize: 11 },
  actionRow: {
    marginTop: 6,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  added: { flex: 1 },
  addBtn: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addText: { fontWeight: '700' },
});
