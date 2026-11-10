// G24-S1 md.3 — FinCoachHistory: sohbet geçmişi. Hâller: list · delete · empty.
// Soru + ilk yanıt çiftleri gün gün ("Bugün" · "Dün" · tarih). Birine dokun → sohbette o mesaja
// gider (tek akış; "devam et"). Saklama süresi satırı (coach_retention_days, vars. 30).
// "Geçmişi sil" → uyarı (FinCoachDelete) → delete_coach_history → boş hâl + "Geçmiş silindi".
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AppText, Toast } from '../../../core/design';
import { useT } from '../../../core/i18n';
import { ArrowLeft } from '../../../components/icons';
import { deleteCoachHistory, fetchCoachMessages } from '../client';
import { COACH_RETENTION_DAYS, groupHistory, type HistoryGroup } from '../model';
import { CoachGlass, LIME, LIME_INK, useCoachTones } from '../ui/parts';
import { DeleteConfirm } from '../ui/sheets';

type Nav = { goBack: () => void; navigate: (n: string, p?: object) => void };

export default function CoachHistoryScreen() {
  const nav = useNavigation() as unknown as Nav;
  const { t: tr, lang } = useT();
  const c = useCoachTones();
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<HistoryGroup[] | null>(null);
  const [del, setDel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    void fetchCoachMessages(300)
      .then((m) => !off && setGroups(groupHistory(m, new Date(), lang === 'en' ? 'en' : 'tr', tr)))
      .catch(() => !off && setGroups([]));
    return () => {
      off = true;
    };
    // `tr` her render'da yeni olabilir (sağlayıcısız) — yalnız dil değişince yeniden yükle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const confirm = async () => {
    setBusy(true);
    const ok = await deleteCoachHistory();
    setBusy(false);
    setDel(false);
    if (ok) {
      setGroups([]);
      setToast(tr('coach.deleted'));
    } else setToast(tr('coach.del_failed'));
  };

  const empty = groups != null && groups.length === 0;
  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]} testID="coach-history">
      <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
        <Pressable onPress={() => nav.goBack()} accessibilityRole="button" accessibilityLabel={tr('coach.hist_back')} style={styles.icon44} testID="coach-history-back">
          <ArrowLeft size={24} color={c.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <AppText style={[styles.title, { color: c.text }]} accessibilityRole="header">
          {tr('coach.hist_title')}
        </AppText>
        {groups == null ? (
          <View style={styles.loading} accessible accessibilityLabel={tr('coach.loading')}>
            <ActivityIndicator color={c.sec} />
          </View>
        ) : empty ? (
          <View style={styles.empty} testID="coach-history-empty">
            <CoachGlass size={100} />
            <AppText style={[styles.emptyT, { color: c.text }]}>{tr('coach.hist_empty_t')}</AppText>
            <AppText style={[styles.emptyB, { color: c.sec }]}>{tr('coach.hist_empty_b')}</AppText>
            <Pressable onPress={() => nav.navigate('CoachChat')} accessibilityRole="button" style={[styles.cta, { backgroundColor: LIME }]} testID="coach-history-ask">
              <AppText style={styles.ctaText}>{tr('coach.hist_empty_cta')}</AppText>
            </Pressable>
          </View>
        ) : (
          <>
            <AppText style={[styles.keep, { color: c.sec }]}>{tr('coach.hist_keep', { n: COACH_RETENTION_DAYS })}</AppText>
            {groups.map((g) => (
              <View key={g.key} style={styles.group}>
                <AppText style={[styles.groupH, { color: c.sec }]} accessibilityRole="header">
                  {g.label}
                </AppText>
                <View style={[styles.card, { backgroundColor: c.card }]}>
                  {g.items.map((it, i) => (
                    <Pressable
                      key={it.id}
                      onPress={() => nav.navigate('CoachChat', { focusId: it.id })}
                      accessibilityRole="button"
                      accessibilityLabel={tr('coach.hist_item_a11y', { q: it.q, a: it.a, time: it.time })}
                      style={[styles.item, i ? { borderTopWidth: 1, borderTopColor: c.line } : null]}
                      testID={`coach-history-item-${it.id}`}
                    >
                      <View style={styles.flex1}>
                        <AppText style={[styles.q, { color: c.text }]} numberOfLines={2}>
                          {it.q}
                        </AppText>
                        {it.a ? (
                          <AppText style={[styles.a, { color: c.sec }]} numberOfLines={2}>
                            {it.a}
                          </AppText>
                        ) : null}
                      </View>
                      <AppText style={[styles.time, { color: c.sec }]}>{it.time}</AppText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            <Pressable onPress={() => setDel(true)} accessibilityRole="button" style={styles.delBtn} testID="coach-history-delete">
              <AppText style={[styles.delText, { color: c.red }]}>{tr('coach.del_history')}</AppText>
            </Pressable>
          </>
        )}
      </ScrollView>
      <DeleteConfirm visible={del} busy={busy} onCancel={() => setDel(false)} onConfirm={() => void confirm()} />
      <Toast visible={toast != null} message={toast ?? ''} onDismiss={() => setToast(null)} autoHideMs={2200} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex1: { flex: 1 },
  header: { paddingHorizontal: 4 },
  icon44: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 16, gap: 12 },
  title: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 30, lineHeight: 36 },
  keep: { fontSize: 14, lineHeight: 20 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  group: { gap: 6 },
  groupH: { fontSize: 14, fontWeight: '600', marginLeft: 4 },
  card: { borderRadius: 20, overflow: 'hidden' },
  item: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  q: { fontSize: 16, fontWeight: '600', lineHeight: 21 },
  a: { fontSize: 14, lineHeight: 19 },
  time: { fontSize: 13 },
  delBtn: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  delText: { fontSize: 16, fontWeight: '600' },
  empty: { alignItems: 'center', gap: 10, paddingTop: 40 },
  emptyT: { fontSize: 20, fontWeight: '700' },
  emptyB: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
  cta: { minHeight: 52, borderRadius: 26, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  ctaText: { fontSize: 16, fontWeight: '700', color: LIME_INK },
});
