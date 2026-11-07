// FinScanOffline (G16-S1) — "Ana sayfa · Tara çevrimdışı": çevrimdışı çekilen
// fotoğraf kuyruğa alınınca açılan sade ekran. Üstte çevrimdışı bandı, "Bugün"
// listesi (bugünkü kayıtlar + "Bağlanınca eklenecek" bekleyen fotoğraflar) ve
// "Elle gir". Ana sayfa (halkalar/slotlar) olduğu gibi kalır; bu ek bir durum ekranı.
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, useTheme } from '../../../../core/design';
import { useT } from '../../../../core/i18n';
import { useAuth } from '../../../../core/AuthContext';
import { getSupabaseClient } from '../../../../core/supabase';
import { ArrowLeft, Clock, WifiSlash } from '../../../../components/icons';
import { getPendingScanQueue, clearPendingScanPhoto, type PendingScanPhoto } from '../offlineQueue';
import { drainPendingScans, onPendingDrained } from '../drainPending';
import { normalizeMealType, sourceInfo } from '../../../gun/homeData';

interface Row {
  id: string;
  name: string;
  kcal: number;
  meal: string;
  source: string;
  time: string;
}
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function ScanOfflineScreen() {
  const th = useTheme();
  const { t } = useT();
  const { user } = useAuth();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Row[]>([]);
  const [queue, setQueue] = useState<PendingScanPhoto[]>([]);
  // YALNIZ __DEV__ vitrini: çevrimdışı görünümü sabitle (boşaltma/bant durumu).
  const forceOffline = __DEV__ && (useRoute().params as { vitrinOffline?: boolean } | undefined)?.vitrinOffline === true;
  const [online, setOnline] = useState(false);

  const load = useCallback(async () => {
    setQueue(await getPendingScanQueue().catch(() => []));
    if (!user?.id) return;
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 86400000);
      const { data } = await getSupabaseClient()
        .from('meal_consumptions')
        .select('id,source,name,meal_type,calories,consumed_at')
        .eq('user_id', user.id)
        .gte('consumed_at', start.toISOString())
        .lt('consumed_at', end.toISOString())
        .order('consumed_at', { ascending: true });
      setRows(
        ((data ?? []) as any[]).map((r) => ({
          id: String(r.id),
          name: String(r.name),
          kcal: Math.round(Number(r.calories) || 0),
          meal: normalizeMealType(r.meal_type, r.consumed_at),
          source: sourceInfo(String(r.source)).kind,
          time: hhmm(r.consumed_at),
        })),
      );
    } catch {
      /* çevrimdışı: bugünkü kayıtlar okunamaz, bekleyenler yine görünür */
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
    const unsubNet = NetInfo.addEventListener((s) => {
      const on = s.isConnected !== false;
      if (forceOffline) return;
      setOnline(on);
      if (on && user?.id) void drainPendingScans(user.id);
    });
    const unsubDone = onPendingDrained(() => void load());
    return () => {
      unsubNet();
      unsubDone();
    };
  }, [load, user?.id, forceOffline]);

  const surface = th.isDark ? '#1C1C1E' : '#FFFFFF';
  const manual = async () => {
    await clearPendingScanPhoto();
    nav.navigate('Tabs', { screen: 'Tracker' });
  };

  return (
    <View style={[styles.root, { backgroundColor: th.color.bg, paddingTop: insets.top }]} testID="scan-offline">
      <View style={styles.head}>
        <Pressable onPress={() => nav.goBack()} accessibilityRole="button" accessibilityLabel={t('eatkcal.v2.common.back')} style={styles.back}>
          <ArrowLeft size={24} color={th.color.ink} />
        </Pressable>
        <AppText style={[styles.headTitle, { color: th.color.ink }]} numberOfLines={1}>
          {t('ai_scan.offline_screen_title')}
        </AppText>
      </View>
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        {!online ? (
          <View style={[styles.banner, { backgroundColor: th.color.surface }]} accessibilityRole="alert">
            <WifiSlash size={20} color={th.color.ink} />
            <AppText style={[styles.bannerText, { color: th.color.ink }]}>{t('ai_scan.offline_banner')}</AppText>
          </View>
        ) : null}
        <AppText style={[styles.section, { color: th.color.ink }]}>{t('ai_scan.offline_today')}</AppText>
        {rows.map((r) => (
          <View key={r.id} style={[styles.card, { backgroundColor: surface }]}>
            <View style={[styles.thumb, { backgroundColor: th.color.surface }]} />
            <View style={styles.cardText}>
              <AppText style={[styles.title, { color: th.color.ink }]} numberOfLines={1}>{`${r.name}, ${r.kcal} kcal`}</AppText>
              <AppText style={[styles.sub, { color: th.color.secondary }]} numberOfLines={1}>
                {`${t(`meal.${r.meal}`)}, ${t(`gun.src_${r.source}`)}, ${r.time}`}
              </AppText>
            </View>
          </View>
        ))}
        {queue.map((e) => (
          <View key={e.id} style={[styles.card, { backgroundColor: surface }]}>
            <View style={[styles.thumb, { backgroundColor: th.color.surface }]}>
              <Image source={{ uri: e.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <View style={[styles.badge, { backgroundColor: surface }]}>
                <Clock size={12} color={th.color.ink} />
              </View>
            </View>
            <View style={styles.cardText}>
              <AppText style={[styles.title, { color: th.color.ink }]} numberOfLines={1}>{t('ai_scan.pending_title')}</AppText>
              <AppText style={[styles.sub, { color: th.color.secondary }]} numberOfLines={1}>
                {`${t(`meal.${e.mealType}`)}, ${t('ai_scan.pending_sub')}, ${hhmm(e.queuedAt)}`}
              </AppText>
            </View>
          </View>
        ))}
        <Pressable onPress={manual} accessibilityRole="button" style={[styles.manual, { backgroundColor: th.color.ink }]}>
          <AppText style={[styles.manualText, { color: th.color.bg }]}>{t('ai_scan.manual_entry')}</AppText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 56 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headTitle: { flex: 1, fontSize: 20, lineHeight: 26, fontFamily: 'PlusJakartaSans_800ExtraBold', marginLeft: 4 },
  body: { paddingHorizontal: 16, gap: 12 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  bannerText: { flex: 1, fontSize: 15, lineHeight: 20, fontFamily: 'PlusJakartaSans_500Medium' },
  section: { fontSize: 22, lineHeight: 28, fontFamily: 'PlusJakartaSans_800ExtraBold', marginTop: 4 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 12 },
  thumb: { width: 54, height: 54, borderRadius: 14, overflow: 'hidden' },
  badge: { position: 'absolute', right: 2, bottom: 2, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, gap: 2 },
  title: { fontSize: 15, lineHeight: 20, fontFamily: 'PlusJakartaSans_700Bold' },
  sub: { fontSize: 13, lineHeight: 18, fontFamily: 'PlusJakartaSans_500Medium' },
  manual: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  manualText: { fontSize: 17, lineHeight: 22, fontFamily: 'PlusJakartaSans_700Bold' },
});
