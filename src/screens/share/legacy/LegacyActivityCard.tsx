// G15-S3 — DONDURULMUŞ KOPYA (night14/visual): yalnız `kesfet` KAPALIYKEN derin
// bağlantı ekranı (SharedPostScreen) bunu çizer → bayrak kapalı görünüm bayt bayt
// aynı kalır. Keşfet'teki güncel bileşen modules/kesfet/ui altında. G-TEMİZLİK'te silinir.
// Etkinlik kartı — G8. post_type='etkinlik' gönderilerde MealCard yerine çizilir.
// İkon + tür + süre + (ops.) mesafe + ~kcal (tahmini) satırı, altında "Ben de
// yaptım" düğmesi (etkinliği kendi günlüğüne ekler → did_it). Sayaç gösterilir.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { haptic } from '../../../core/design';
import { Icon } from '../../../modules/kesfet/ui/icons';
import type { ActivityCard as ActivityCardData } from '../../../modules/kesfet/types';

export function ActivityCard({
  activity,
  didItCount,
  onDidIt,
}: {
  activity: ActivityCardData;
  didItCount: number;
  onDidIt?: () => void;
}) {
  const t = useTheme();
  const { t: tr, fmt } = useT();

  const typeLabel = tr(`kesfet.activity.type.${activity.type}`);
  const parts: string[] = [tr('kesfet.activity.minutes', { n: fmt(activity.minutes) })];
  if (activity.distance_km != null && activity.distance_km > 0) {
    parts.push(tr('kesfet.activity.distance', { km: fmt(activity.distance_km, { precision: 1 }) }));
  }
  parts.push(tr('kesfet.activity.kcal_est', { kcal: fmt(activity.kcal_est) }));

  return (
    <View style={[styles.card, { backgroundColor: t.color.surface, borderColor: t.color.line }]}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: t.color.accent }]}>
          <Icon name="run" size={22} color={t.color.onAccent} />
        </View>
        <View style={styles.info}>
          <AppText variant="body" style={styles.title} numberOfLines={1}>
            {typeLabel}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {parts.join(' · ')}
          </AppText>
        </View>
      </View>

      {onDidIt ? (
        <Pressable
          onPress={() => {
            // "Ben de yaptım" bir kutlama anı → hero success haptiği (günde en
            // fazla 3; motion.tsx). Tahmini kcal hapı toast'ta gösterilir (ekran).
            haptic('success');
            onDidIt();
          }}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfet.activity.did_it')}
          hitSlop={8}
          style={({ pressed }) => [styles.didItBtn, { borderColor: t.color.line }, pressed && { opacity: 0.85 }]}
        >
          <Icon name="check" size={16} color={t.color.ink} />
          <AppText variant="caption" style={styles.didItLabel}>
            {tr('kesfet.activity.did_it')}
            {didItCount > 0 ? ` · ${fmt(didItCount)}` : ''}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 10, borderRadius: 16, borderWidth: 1, padding: 12, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0 },
  title: { fontWeight: '700' },
  didItBtn: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 20, borderWidth: 1 },
  didItLabel: { fontWeight: '600' },
});
