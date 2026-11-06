// "Ben de yaptım · süreyi düzelt" — Final FinActivityCard kare 2. Etkinlik
// gönderisinde "Ben de yaptım"a basınca açılır: tür + "<Ad> ile aynı etkinlik",
// Süre adımlayıcısı (− 30 dk +), "Mesafe isteğe bağlı · ~N kcal tahmini" (süre
// değiştikçe istemci aynası `estimateActivityKcal` ile güncellenir; kayıttaki
// yetkili değer sunucudan gelir) ve siyah "Ekle". Ekle → çağıranın onAdd(minutes)
// yolu (KesfetScreen.onDidIt → store.didIt). Yalnız `kesfet` bayrağı arkasında.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, fontFamily, useTheme, haptic } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { estimateActivityKcal } from '../activity';
import { BottomSheet } from './BottomSheet';
import { Icon } from './icons';
import { RunnerIcon } from './ActivityCard';
import type { ActivityCard as ActivityCardData } from '../types';

const STEP = 5;
const MIN = 5;
const MAX = 600;

export function DidItSheet({
  visible,
  activity,
  authorName,
  initialMinutes,
  onClose,
  onAdd,
}: {
  visible: boolean;
  activity: ActivityCardData | null;
  authorName: string;
  /** Başlangıç süresi (Final örneği 30 dk); yoksa gönderideki süre. */
  initialMinutes?: number;
  onClose: () => void;
  onAdd: (minutes: number) => void;
}) {
  const t = useTheme();
  const { t: tr, fmt } = useT();
  const start = initialMinutes ?? activity?.minutes ?? 30;
  const [minutes, setMinutes] = useState(start);

  // Her açılışta gönderinin süresine dön.
  useEffect(() => {
    if (visible) setMinutes(start);
  }, [visible, start]);

  const type = activity?.type ?? 'diger';
  const kcal = estimateActivityKcal(type, minutes);
  const change = (d: number) => {
    haptic('selection');
    setMinutes((m) => Math.min(MAX, Math.max(MIN, m + d)));
  };
  const onInk = t.isDark ? '#0A0A0A' : '#FFFFFF';

  return (
    <BottomSheet visible={visible} onClose={onClose} accessibilityLabel={tr('kesfet.activity.did_it')}>
      <View style={styles.head}>
        <View style={[styles.tile, { backgroundColor: t.color.line }]}>
          <RunnerIcon size={28} color={t.color.ink} />
        </View>
        <View style={styles.headText}>
          <AppText textRole="sheetTitle" numberOfLines={1}>
            {tr(`kesfet.activity.type.${type}`)}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={1} style={styles.sub}>
            {authorName
              ? tr('kesfet.activity.same_as', { name: authorName })
              : tr('kesfet.activity.same_as_generic')}
          </AppText>
        </View>
      </View>

      <AppText variant="caption" tone="secondary" style={styles.label}>
        {tr('kesfet.activity.duration')}
      </AppText>
      <View style={[styles.stepper, { backgroundColor: t.color.surface, borderColor: t.color.line }]}>
        <Pressable
          onPress={() => change(-STEP)}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfet.activity.decrease')}
          style={[styles.round, { backgroundColor: t.color.line }]}
        >
          <AppText style={styles.minus}>−</AppText>
        </Pressable>
        <View style={styles.valueRow} accessibilityLiveRegion="polite">
          <AppText textRole="screenTitle" style={styles.value}>
            {fmt(minutes)}
          </AppText>
          <AppText variant="body" tone="secondary" style={styles.unit}>
            {' '}
            {tr('kesfet.activity.minutes', { n: '' }).trim()}
          </AppText>
        </View>
        <Pressable
          onPress={() => change(STEP)}
          accessibilityRole="button"
          accessibilityLabel={tr('kesfet.activity.increase')}
          style={[styles.round, { backgroundColor: t.color.line }]}
        >
          <Icon name="plus" size={20} color={t.color.ink} />
        </Pressable>
      </View>

      <AppText variant="caption" tone="secondary" style={styles.hint}>
        {tr('kesfet.activity.sheet_hint', { kcal: tr('kesfet.activity.kcal_est', { kcal: fmt(kcal) }) })}
      </AppText>

      <Pressable
        onPress={() => {
          haptic('success');
          onAdd(minutes);
        }}
        accessibilityRole="button"
        accessibilityLabel={tr('kesfet.activity.sheet_add')}
        style={({ pressed }) => [styles.cta, { backgroundColor: t.color.ink }, pressed && { opacity: 0.88 }]}
      >
        <AppText variant="body" style={[styles.ctaLabel, { color: onInk }]}>
          {tr('kesfet.activity.sheet_add')}
        </AppText>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  tile: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1, minWidth: 0 },
  sub: { fontSize: 13 },
  label: { marginTop: 16, fontSize: 13, fontFamily: fontFamily.bodySemibold },
  stepper: {
    marginTop: 6,
    height: 64,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  minus: { fontSize: 22, fontFamily: fontFamily.bodySemibold, lineHeight: 26 },
  valueRow: { flexDirection: 'row', alignItems: 'baseline' },
  value: { fontSize: 28, lineHeight: 34 },
  unit: { fontSize: 15 },
  hint: { marginTop: 10, fontSize: 14 },
  cta: { marginTop: 18, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  ctaLabel: { fontFamily: fontFamily.bodySemibold },
});
