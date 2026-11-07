// Etkinlik kartı — Final FinActivityCard. post_type='etkinlik' gönderilerde
// MealCard yerine çizilir: gri ikon karesi + "Etkinlik" + tür + "45 dk · 8,2 km ·
// ~N kcal" (tahmini); ince çizginin altında "N kişi yaptı" + lime "✓ Ben de
// yaptım" hapı (G15: basınca süre sayfası açılır — DidItSheet). Eklendiyse hap
// gri "✓ Yaptın" olur. Yalnız `kesfet` bayrağı arkasında.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { AppText, fontFamily, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { haptic } from '../../../core/design';
import { Icon } from './icons';
import type { ActivityCard as ActivityCardData } from '../types';

// Final'deki koşan kişi (Phosphor PersonSimpleRun, regular) — kart ve süre sayfası.
const RUNNER =
  'M152,88a32,32,0,1,0-32-32A32,32,0,0,0,152,88Zm0-48a16,16,0,1,1-16,16A16,16,0,0,1,152,40Zm67.31,100.68c-.61.28-7.49,3.28-19.67,3.28-13.85,0-34.55-3.88-60.69-20a169.31,169.31,0,0,1-15.41,32.34,104.29,104.29,0,0,1,31.31,15.81C173.92,186.65,184,207.35,184,232a8,8,0,0,1-16,0c0-41.7-34.69-56.71-54.14-61.85-.55.7-1.12,1.41-1.69,2.1-19.64,23.8-44.25,36.18-71.63,36.18A92.29,92.29,0,0,1,31.2,208,8,8,0,0,1,32.8,192c25.92,2.58,48.47-7.49,67-30,12.49-15.14,21-33.61,25.25-47C86.13,92.35,61.27,111.63,61,111.84A8,8,0,1,1,51,99.36c1.5-1.2,37.22-29,89.51,6.57,45.47,30.91,71.93,20.31,72.18,20.19a8,8,0,1,1,6.63,14.56Z';

export function RunnerIcon({ size = 30, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" accessible={false}>
      <Path d={RUNNER} fill={color} />
    </Svg>
  );
}

export function ActivityCard({
  activity,
  didItCount,
  onDidIt,
  done = false,
}: {
  activity: ActivityCardData;
  didItCount: number;
  onDidIt?: () => void;
  /** Bu oturumda "Ben de yaptım" eklendi → "✓ Yaptın". */
  done?: boolean;
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
        <View style={[styles.tile, { backgroundColor: t.color.line }]}>
          <RunnerIcon size={30} color={t.color.ink} />
        </View>
        <View style={styles.info}>
          <AppText variant="caption" tone="secondary" style={styles.caption} numberOfLines={1}>
            {tr('kesfet.activity.caption')}
          </AppText>
          <AppText variant="caption" style={styles.title} numberOfLines={1}>
            {typeLabel}
          </AppText>
          <AppText variant="caption" tone="secondary" style={styles.meta} numberOfLines={1}>
            {parts.join(', ')}
          </AppText>
        </View>
      </View>

      <View style={[styles.footer, { borderTopColor: t.color.line }]}>
        <AppText variant="caption" tone="secondary" style={styles.count} numberOfLines={1}>
          {didItCount > 0 ? tr('kesfet.activity.did_count', { n: fmt(didItCount) }) : ''}
        </AppText>
        {onDidIt ? (
          <Pressable
            onPress={() => {
              if (done) return;
              haptic('light');
              onDidIt();
            }}
            disabled={done}
            accessibilityRole="button"
            accessibilityState={{ disabled: done }}
            accessibilityLabel={done ? tr('kesfet.activity.did_done') : tr('kesfet.activity.did_it')}
            hitSlop={6}
            style={({ pressed }) => [
              styles.pill,
              { backgroundColor: done ? t.color.line : t.color.accent },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Icon name="check" size={14} color={done ? t.color.ink : t.color.onAccent} />
            <AppText
              variant="caption"
              style={[styles.pillLabel, { color: done ? t.color.ink : t.color.onAccent }]}
              numberOfLines={1}
            >
              {done ? tr('kesfet.activity.did_done') : tr('kesfet.activity.did_it')}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 10, borderRadius: 16, borderWidth: 1, padding: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tile: { width: 56, height: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0, gap: 3 },
  caption: { fontSize: 13, fontFamily: fontFamily.bodySemibold },
  title: { fontSize: 15, lineHeight: 20, fontFamily: fontFamily.bodyBold },
  meta: { fontSize: 13 },
  footer: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  count: { flexShrink: 1, fontSize: 13 },
  pill: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pillLabel: { fontSize: 13, fontFamily: fontFamily.bodyBold },
});
