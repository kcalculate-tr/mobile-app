// eatkcal v2 — FinEkProduct seçim grubu: başlık 16 + rozet ("Zorunlu" /
// "İsteğe bağlı · En fazla N"), altında yatay kayan seçenek kutuları. Eksik
// zorunlu grup, kullanıcı eklemeyi denediyse başlık zemini vurgulanır
// (renk animasyonsuz — hata kuralı).
import React from 'react';
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { fontFamily } from '../../../../../core/design';
import { ekType, useEk } from '../kit';
import { OptionCard, type OptionCardModel } from './OptionCard';

export interface OptionGroupModel {
  key: string;
  title: string;
  description?: string;
  required: boolean;
  /** En fazla N (1'den büyükse rozette gösterilir). */
  max: number | null;
  /** En az N (çoklu + zorunlu min). */
  min?: number;
  multi: boolean;
  items: OptionCardModel[];
}

export function OptionGroupSection({
  group,
  highlight,
  onToggle,
  onLayout,
}: {
  group: OptionGroupModel;
  highlight: boolean;
  onToggle: (itemKey: string) => void;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  const { c, t } = useEk();
  const badgeParts: string[] = [group.required ? t('eatkcal.v2.product.required') : t('eatkcal.v2.product.optional')];
  if (group.multi && group.min && group.min > 1) badgeParts.push(t('eatkcal.v2.product.min_n', { n: group.min }));
  if (group.multi && group.max != null && group.max > 1) badgeParts.push(t('eatkcal.v2.product.max_n', { n: group.max }));
  return (
    <View
      style={styles.section}
      onLayout={onLayout}
      accessibilityLabel={group.title}
      testID={`ek-group-${group.key}`}
    >
      <View style={[styles.head, { backgroundColor: highlight ? c.line : 'transparent' }]}>
        <Text style={[styles.title, { color: c.ink }]} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
          {group.title}
        </Text>
        <View style={[styles.badge, { backgroundColor: c.line }]}>
          <Text style={[ekType.c13s, { color: c.secondary }]} numberOfLines={1}>
            {badgeParts.join(' · ')}
          </Text>
        </View>
      </View>
      {group.description ? (
        <Text style={[ekType.c13, { color: c.secondary }]}>{group.description}</Text>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroller}
        contentContainerStyle={styles.row}
        accessibilityRole={group.multi ? undefined : 'radiogroup'}
      >
        {group.items.map((item) => (
          <OptionCard key={item.key} model={item} multi={group.multi} onPress={() => onToggle(item.key)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginHorizontal: -10,
    borderRadius: 12,
  },
  title: { fontFamily: fontFamily.bodyBold, fontSize: 16, lineHeight: 21 },
  badge: { minHeight: 22, paddingHorizontal: 8, borderRadius: 11, justifyContent: 'center' },
  scroller: { marginHorizontal: -16 },
  row: { gap: 10, paddingHorizontal: 16 },
});
