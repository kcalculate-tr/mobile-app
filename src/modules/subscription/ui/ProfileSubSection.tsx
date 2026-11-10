// G22-S1 md.4 — FinSubProfileSoon: Profil'de "kcalAI › Abonelik" satırı + "Yakında" satırları
// (Egzersiz ve fitness rehberi · Öğün aboneliği; G24-S1: "AI koç" satırı kalktı — koç artık
// Profil'deki "AI Koç" satırından açılır). Yakında olanlar satın alınamaz,
// hiçbir plana dahil değil (yalnız Profil'de; paywall'da YOK). `abonelik` bayrağı açıkken çizilir.
// G25-S1 md.3 (A4): "Yakında" bloğu (başlık + satırlar + dipnot) yalnız uzak bayrak
// `yakinda_satirlari` AÇIKKEN çizilir (varsayılan KAPALI → 1.1.0 incelemesinde görünmez).
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, useTheme } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { Barbell, ShoppingBag, Sparkle } from '../../../components/icons';
import { FinRow, FinRowGroup, FinSectionLabel } from '../../profil/ui/finUi';
import { useTier } from '../../../lib/subscription/purchases';
import { CoachProfileRow } from '../../coach/ui/entries';
import { useFeature } from '../../../core/flags';

export default function ProfileSubSection({ onOpen }: { onOpen: () => void }) {
  const t = useTheme();
  const { t: tr } = useT();
  const { tier } = useTier();
  const showSoon = useFeature('yakinda_satirlari');
  const value = tier === 'free' ? tr('sub.profile.free_name') : tier === 'fresh' ? 'Fresh' : 'Balance';
  const nested = t.isDark ? '#2C2C2E' : '#F3F4F6';
  const line2 = t.isDark ? '#48484A' : '#C3C7CC';
  const soon: { icon: React.ReactNode; title: string; sub: string; chip: string }[] = [
    { icon: <Barbell size={18} color={t.color.ink} />, title: tr('sub.profile.soon_fitness'), sub: tr('sub.profile.soon_sub'), chip: tr('sub.profile.soon_chip') },
    { icon: <ShoppingBag size={18} color={t.color.ink} />, title: tr('sub.profile.soon_meal'), sub: tr('sub.profile.soon_meal_sub'), chip: tr('sub.profile.soon_chip_very') },
  ];
  return (
    <View style={{ gap: 6 }} testID="profile-sub-section">
      <FinSectionLabel>{tr('sub.profile.section')}</FinSectionLabel>
      <FinRowGroup>
        <FinRow first icon={<Sparkle size={18} color={t.color.ink} weight="fill" />} label={tr('sub.profile.row')} value={value} onPress={onOpen} />
        {/* G24-S1 (FinPrProfile Tur 26k): "AI Koç" satırı + Balance rozeti (`koc` kapalıysa çizilmez). */}
        <CoachProfileRow />
      </FinRowGroup>
      {showSoon ? (
      <>
      <FinSectionLabel>{tr('sub.profile.soon_h')}</FinSectionLabel>
      <FinRowGroup>
        {soon.map((r, i) => (
          <View
            key={r.title}
            accessible
            accessibilityLabel={`${r.title}, ${r.sub}, ${r.chip}`}
            style={[styles.row, i ? { borderTopWidth: 1, borderTopColor: t.color.line } : null]}
          >
            <View style={[styles.icon, { backgroundColor: nested }]}>{r.icon}</View>
            <View style={styles.flex1}>
              <AppText style={styles.title}>{r.title}</AppText>
              <AppText tone="secondary" style={styles.sub}>
                {r.sub}
              </AppText>
            </View>
            <View style={[styles.chip, { borderColor: line2 }]}>
              <AppText style={styles.chipText}>{r.chip}</AppText>
            </View>
          </View>
        ))}
      </FinRowGroup>
      <AppText tone="secondary" style={styles.foot}>
        {tr('sub.profile.soon_foot')}
      </AppText>
      </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '500' },
  sub: { fontSize: 13 },
  chip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, minHeight: 28, justifyContent: 'center' },
  chipText: { fontSize: 13, fontWeight: '600' },
  foot: { fontSize: 13, lineHeight: 18, marginHorizontal: 4, marginTop: 4 },
});
