// Günüme ekle sayfası — tasarım T20AddSheet. Öğün (Kahvaltı/Öğle/Akşam/Ara
// öğün → MealType breakfast|lunch|dinner|snack) ve porsiyon (0,5/1/1,5/2)
// seçilir; kcal ve P/K/Y porsiyona göre CANLI güncellenir. "Ekle" → store
// addToDay (idempotent, çağıran yönetir). Varsayılan öğün: Öğle (tasarım).
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { haptic } from '../../../core/design';
import { BottomSheet } from './BottomSheet';
import { Avatar } from './Avatar';
import { MEAL_OPTIONS, PORTION_OPTIONS, scaleMacros } from './format';
import type { MealCard, MealType } from '../types';

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={styles.chipTouch}
    >
      <View
        style={[
          styles.chip,
          {
            backgroundColor: selected ? t.color.ink : 'transparent',
            borderColor: selected ? t.color.ink : t.color.line,
          },
        ]}
      >
        <AppText
          variant="caption"
          style={{ fontWeight: '600', color: selected ? t.color.surface : t.color.ink }}
        >
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

function MacroCell({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.macroCell, !last && { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: t.color.line }]}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText variant="heading" style={styles.macroValue}>
        {value}
      </AppText>
    </View>
  );
}

export function AddToDaySheet({
  visible,
  onClose,
  meal,
  authorHandle,
  defaultMeal = 'lunch',
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  meal: MealCard | null;
  authorHandle: string;
  defaultMeal?: MealType;
  onAdd: (mealType: MealType, portion: number) => void;
}) {
  const t = useTheme();
  const { t: tr, fmt } = useT();
  const [mealType, setMealType] = useState<MealType>(defaultMeal);
  const [portion, setPortion] = useState<number>(1);

  if (!meal) return null;
  const macros = scaleMacros(meal, portion);

  const confirm = () => {
    haptic('light');
    onAdd(mealType, portion);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel={tr('kesfet.add_to_day')}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Başlık */}
        <View style={styles.header}>
          <View style={[styles.headThumb, { backgroundColor: t.color.surface }]}>
            <Avatar name={meal.name} url={meal.photo_url} official={false} size={56} />
          </View>
          <View style={styles.headInfo}>
            <AppText variant="heading" numberOfLines={2}>
              {meal.name}
            </AppText>
            <AppText variant="caption" tone="secondary" numberOfLines={1}>
              @{authorHandle}
            </AppText>
          </View>
        </View>

        {/* Öğün */}
        <AppText variant="caption" tone="secondary" style={styles.sectionLabel}>
          {tr('kesfet.ui.sheet.meal')}
        </AppText>
        <View style={styles.chipRow} accessibilityRole="radiogroup">
          {MEAL_OPTIONS.map((m) => (
            <Chip
              key={m}
              label={tr(`meal.${m}`)}
              selected={mealType === m}
              onPress={() => setMealType(m)}
            />
          ))}
        </View>

        {/* Porsiyon */}
        <AppText variant="caption" tone="secondary" style={styles.sectionLabel}>
          {tr('kesfet.ui.sheet.portion')}
        </AppText>
        <View style={styles.chipRow} accessibilityRole="radiogroup">
          {PORTION_OPTIONS.map((p) => (
            <Chip
              key={p}
              label={fmt(p, { precision: 1 })}
              selected={portion === p}
              onPress={() => setPortion(p)}
            />
          ))}
        </View>

        {/* Makro ızgarası (canlı) */}
        <View style={[styles.macroGrid, { backgroundColor: t.color.surface, borderColor: t.color.line }]}>
          <MacroCell label={tr('kesfet.ui.sheet.kcal')} value={fmt(macros.kcal)} />
          <MacroCell label={tr('kesfet.ui.sheet.protein')} value={`${fmt(macros.protein_g, { precision: 1 })} g`} />
          <MacroCell label={tr('kesfet.ui.sheet.carbs')} value={`${fmt(macros.carbs_g, { precision: 1 })} g`} />
          <MacroCell label={tr('kesfet.ui.sheet.fat')} value={`${fmt(macros.fat_g, { precision: 1 })} g`} last />
        </View>

        {/* Ekle */}
        <Pressable
          onPress={confirm}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfet.ui.sheet.add')}
          style={({ pressed }) => [styles.addBtn, { backgroundColor: t.color.ink, opacity: pressed ? 0.9 : 1 }]}
        >
          <AppText variant="body" style={{ color: t.color.surface, fontWeight: '600' }}>
            {tr('kesfet.ui.sheet.add')}
          </AppText>
        </Pressable>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headThumb: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  headInfo: { flex: 1, minWidth: 0 },
  sectionLabel: { marginTop: 14, marginBottom: 6, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipTouch: { minHeight: 44, justifyContent: 'center' },
  chip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  macroGrid: { marginTop: 14, flexDirection: 'row', borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  macroCell: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
  macroValue: { marginTop: 0 },
  addBtn: { marginTop: 16, minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
});
