// G18-S2 md.6 — FinHomeR3 "Bugünkü etkinlikler" bölümü (yeni kabuk, `etkinlik` bayrağı).
// Kart zemin + üst/alt çizgi; başlık 52 (Bricolage 600/20) + gün toplamı "45 dk, ~320 kcal"
// (yalnız kayıt varsa); her kayıt 60'lık satır: 40'lık ikon kutusu, tür adı (15/600) +
// saat (13), sağda "45 dk, ~210 kcal" (13/600). Altta "+ Etkinlik ekle" (mevcut G8 sheet'i
// — TrackerActivityEntry `variant="home"`). Veri: mevcut get_my_day_activity (salt okuma).
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '../../../core/design/components/AppText';
import { useT } from '../../../core/i18n';
import { getKesfetClient } from '../../kesfet';
import type { DayActivity } from '../../kesfet/types';
import { ComposeIcon, type ComposeIconName } from '../../kesfet/ui/compose/icons';
import { TrackerActivityEntry, type ActivityLogged } from '../../kesfet/ui/TrackerActivityEntry';
import { BRICOLAGE_SEMI, useHomeTokens } from '../../onboarding/first/homeTokens';
import { istanbulHHMM } from '../track/dayClock';

// G19-S2 md.1: saat İstanbul (öğün satırlarıyla aynı kural, track/dayClock).
const hhmm = istanbulHHMM;

// G19-S2 md.3: `onLogged` → Ana sayfa "Etkinlik eklendi · Geri al" toast'ı;
// `refreshKey` değişince (geri al / gece yarısı / ön plan) liste yeniden okunur.
// G49-S1 md.3: `openSignal` artınca "Etkinlik ekle" sheet'i açılır (profilsiz Ana sayfa eylemi → kayıt → dönüş).
export function HomeActivitySection({ onLogged, refreshKey = 0, openSignal = 0 }: { onLogged?: (r?: ActivityLogged) => void; refreshKey?: number; openSignal?: number } = {}) {
  const k = useHomeTokens();
  const { t: tt, fmt } = useT();
  const [day, setDay] = useState<DayActivity | null>(null);
  const refresh = useCallback(() => {
    getKesfetClient()
      .getMyDayActivity()
      .then(setDay)
      .catch(() => setDay(null));
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const items = day?.items ?? [];
  const has = items.length > 0;
  return (
    <View
      style={[styles.section, { backgroundColor: k.card, borderColor: k.line }]}
      accessibilityLabel={tt('home.acts')}
      testID="home-activities"
    >
      <View style={styles.head}>
        <AppText accessibilityRole="header" style={[styles.h2, { color: k.text }]}>
          {tt('home.acts')}
        </AppText>
        {has ? (
          <AppText style={[styles.sum, { color: k.sec }]}>
            {tt('home.acts_sum', { min: fmt(day!.total_minutes), kcal: fmt(Math.round(day!.total_kcal_est)) })}
          </AppText>
        ) : null}
      </View>
      {items.map((a) => (
        <View key={a.id} style={[styles.row, { borderTopColor: k.line }]}>
          <View style={[styles.icon, { backgroundColor: k.line }]}>
            <ComposeIcon name={a.type as ComposeIconName} size={22} color={k.text} />
          </View>
          <View style={styles.flex}>
            <AppText numberOfLines={1} style={[styles.name, { color: k.text }]}>
              {tt(`kesfet.activity.type.${a.type}`)}
            </AppText>
            <AppText numberOfLines={1} style={[styles.small, { color: k.sec }]}>
              {hhmm(a.logged_at)}
            </AppText>
          </View>
          <AppText style={[styles.dur, { color: k.text }]}>
            {tt('home.acts_sum', { min: fmt(a.minutes), kcal: fmt(Math.round(a.kcal_est)) })}
          </AppText>
        </View>
      ))}
      <View style={[styles.add, { borderTopColor: k.line }]}>
        <TrackerActivityEntry
          variant="home"
          openSignal={openSignal}
          onLogged={(r) => {
            refresh();
            onLogged?.(r);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24, borderTopWidth: 1, borderBottomWidth: 1 },
  head: { height: 52, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h2: { fontFamily: BRICOLAGE_SEMI, fontSize: 20, lineHeight: 26 },
  sum: { fontSize: 13, lineHeight: 17, fontFamily: 'PlusJakartaSans_600SemiBold' },
  row: { minHeight: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, lineHeight: 20, fontFamily: 'PlusJakartaSans_600SemiBold' },
  small: { fontSize: 13, lineHeight: 17 },
  dur: { fontSize: 13, lineHeight: 17, fontFamily: 'PlusJakartaSans_600SemiBold' },
  add: { paddingTop: 10, paddingHorizontal: 16, paddingBottom: 14, borderTopWidth: 1 },
});
