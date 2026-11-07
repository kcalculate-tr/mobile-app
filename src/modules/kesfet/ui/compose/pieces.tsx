// G15-S3 — Composer parçaları (Final FinCompose): ortak ölçüler + öğün kartı
// önizlemesi + kaynak döşemesi + etkinlik döşemesi. Renkler yalnız tema
// token'larından; Final'in yer tutucu gri tonları (foto kutusu, avatar, çerçeve)
// burada tek yerde.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { AppText, fontFamily, useTheme, type Theme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { ComposeIcon, type ComposeIconName } from './icons';

/** Final'deki tema dışı yer tutucu tonlar (FinCompose / -Dark). */
export function composeTones(t: Theme) {
  return {
    onInk: t.isDark ? t.color.bg : t.color.surface,
    avatar: t.isDark ? t.color.line : '#DCDEE2',
    photoPh: t.isDark ? '#3A3A3C' : '#CFD2D7',
    outline: t.isDark ? '#48484A' : '#C3C7CC',
  };
}

export const F = {
  medium: { fontFamily: fontFamily.bodyMedium },
  semibold: { fontFamily: fontFamily.bodySemibold },
  bold: { fontFamily: fontFamily.bodyBold },
} as const;

/** Öğün kartı kaynağı (Ürün ara / Elle gir / Tara sonucundan) — 64 yüksek döşeme. */
export function SourceTile({
  icon,
  label,
  active,
  onPress,
}: {
  icon: ComposeIconName;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.sourceTile,
        { backgroundColor: t.color.surface, borderColor: active ? t.color.ink : t.color.line, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <ComposeIcon name={icon} size={20} color={t.color.ink} />
      <AppText style={[styles.tileLabel, F.semibold]} numberOfLines={2}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Etkinlik ızgarası döşemesi — seçili: mürekkep dolgu + ters metin. */
export function ActivityTile({
  icon,
  label,
  active,
  onPress,
}: {
  icon: ComposeIconName;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const tone = composeTones(t);
  const fg = active ? tone.onInk : t.color.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.activityTile,
        active
          ? { backgroundColor: t.color.ink, borderColor: t.color.ink }
          : { backgroundColor: t.color.surface, borderColor: t.color.line },
        pressed && { opacity: 0.85 },
      ]}
    >
      <ComposeIcon name={icon} size={22} color={fg} />
      <AppText style={[styles.tileLabel, F.semibold, { color: fg }]} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

export interface MealPreviewData {
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  thumbUri: string | null;
}

/**
 * Öğün kartı önizlemesi — akıştaki MealCard'ın paylaşım öncesi hâli (dokunulmaz):
 * görsel + ad + "kcal · protein" + P/K/Y çipleri + "N kişi logladı" + "+ <Öğün>'ye logla".
 */
export function MealPreview({ data, mealLabel }: { data: MealPreviewData; mealLabel: string }) {
  const t = useTheme();
  const { t: tr, fmt } = useT();
  const chip = (k: string, v: number) => (
    <View key={k} style={[styles.chip, { backgroundColor: t.color.line }]}>
      <AppText style={[styles.chipText, F.semibold]}>
        {k} {fmt(Math.round(v))}
      </AppText>
    </View>
  );
  return (
    <View
      style={[styles.preview, { backgroundColor: t.color.surface, borderColor: t.color.line }]}
      accessible
      accessibilityLabel={`${data.name}, ${fmt(Math.round(data.kcal))} kcal`}
    >
      <View style={styles.previewRow}>
        <View style={[styles.previewThumb, { backgroundColor: t.color.line }]}>
          {data.thumbUri ? <Image source={{ uri: data.thumbUri }} style={styles.previewImg} contentFit="cover" /> : null}
        </View>
        <View style={styles.previewText}>
          <AppText style={[styles.previewName, F.bold]} numberOfLines={1}>
            {data.name}
          </AppText>
          <AppText style={styles.previewSub} tone="secondary" numberOfLines={1}>
            {tr('kesfet.ui.meal_card.macro', { kcal: fmt(Math.round(data.kcal)), protein: fmt(Math.round(data.protein_g)) })}
          </AppText>
          <View style={styles.chips}>
            {chip('P', data.protein_g)}
            {chip('K', data.carbs_g)}
            {chip('Y', data.fat_g)}
          </View>
        </View>
      </View>
      <View style={[styles.previewFoot, { borderTopColor: t.color.line }]}>
        <AppText style={styles.previewSub} tone="secondary" numberOfLines={1}>
          {tr('kesfet.ui.meal_card.logged_count', { count: 0 })}
        </AppText>
        <View style={styles.logWrap}>
          <View style={[styles.logPill, { backgroundColor: t.color.accent }]}>
            <ComposeIcon name="plus" size={14} color={t.color.onAccent} />
            <AppText style={[styles.logText, F.bold, { color: t.color.onAccent }]}>
              {tr('kesfet.ui.meal_card.log_to_meal', { meal: mealLabel })}
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sourceTile: {
    flex: 1,
    minHeight: 64,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  activityTile: {
    flex: 1,
    height: 64,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tileLabel: { fontSize: 13, lineHeight: 17, textAlign: 'center' },
  preview: { marginTop: 10, paddingTop: 8, paddingHorizontal: 8, borderRadius: 16, borderWidth: 1 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  previewThumb: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  previewImg: { width: 52, height: 52, borderRadius: 10 },
  previewText: { flex: 1, minWidth: 0, gap: 3 },
  previewName: { fontSize: 14, lineHeight: 19 },
  previewSub: { fontSize: 13, lineHeight: 18 },
  chips: { flexDirection: 'row', gap: 4 },
  chip: { height: 20, paddingHorizontal: 6, borderRadius: 6, justifyContent: 'center' },
  chipText: { fontSize: 13, lineHeight: 17 },
  previewFoot: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
  },
  logWrap: { height: 44, justifyContent: 'center' },
  logPill: { height: 32, paddingHorizontal: 10, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 4 },
  logText: { fontSize: 13, lineHeight: 17 },
});
