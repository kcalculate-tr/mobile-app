// HomePendingScans — FinScanOffline (G16-S1): çevrimdışıyken Tara ile çekilen
// "bekleyen fotoğraflar" Ana sayfada görünür.
//  • çevrimdışıysa üstte "Çevrimdışısın · fotoğrafın bağlanınca analiz edilecek" bandı
//  • her bekleyen fotoğraf: küçük foto + saat rozeti, "Bağlanınca eklenecek",
//    "<Öğün> · bekleyen fotoğraf · SS:DD"
//  • "Elle gir": bekleyen kuyruğu boşaltır (tek kayıt kuralı) + elle giriş formunu açar
// Kuyruk boşsa HİÇ çizilmez. Bağlantı gelince `drainPendingScans` sırayla analiz
// eder; sonuç `onPendingDrained` ile liste yenilenir. Yalnız yeni_kabuk + ai_tarama.
import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect } from '@react-navigation/native';

import { AppText, useTheme } from '../../core/design';
import { useT } from '../../core/i18n';
import { useAuth } from '../../core/AuthContext';
import { Clock, WifiSlash } from '../../components/icons';
import { getPendingScanQueue, clearPendingScanPhoto, type PendingScanPhoto } from '../../modules/ai/scan/offlineQueue';
import { drainPendingScans, onPendingDrained } from '../../modules/ai/scan/drainPending';

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function HomePendingScans({ onManual, forceOffline = false }: { onManual: () => void; /** YALNIZ __DEV__ vitrini. */ forceOffline?: boolean }) {
  const t = useTheme();
  const { t: tr } = useT();
  const { user } = useAuth();
  const [queue, setQueue] = useState<PendingScanPhoto[]>([]);
  const [online, setOnline] = useState(true);

  const refresh = useCallback(() => {
    getPendingScanQueue()
      .then(setQueue)
      .catch(() => {});
  }, []);

  useFocusEffect(refresh);

  useEffect(() => {
    const unsubNet = NetInfo.addEventListener((s) => {
      const on = s.isConnected !== false;
      setOnline(on);
      if (on && user?.id && !forceOffline) void drainPendingScans(user.id);
    });
    const unsubDone = onPendingDrained(refresh);
    return () => {
      unsubNet();
      unsubDone();
    };
  }, [user?.id, refresh, forceOffline]);

  if (queue.length === 0) return null;
  const showOffline = forceOffline || !online;

  const surface = t.isDark ? '#1C1C1E' : '#FFFFFF';
  return (
    <View style={styles.wrap} testID="home-pending-scans">
      {showOffline ? (
        <View style={[styles.banner, { backgroundColor: t.color.surface }]} accessibilityRole="alert">
          <WifiSlash size={20} color={t.color.ink} />
          <AppText style={[styles.bannerText, { color: t.color.ink }]}>{tr('ai_scan.offline_banner')}</AppText>
        </View>
      ) : null}
      {queue.map((e) => (
        <View key={e.id} style={[styles.row, { backgroundColor: surface }]}>
          <View style={[styles.thumb, { backgroundColor: t.color.surface }]}>
            <Image source={{ uri: e.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={[styles.badge, { backgroundColor: surface }]}>
              <Clock size={12} color={t.color.ink} />
            </View>
          </View>
          <View style={styles.rowText}>
            <AppText style={[styles.title, { color: t.color.ink }]} numberOfLines={1}>
              {tr('ai_scan.pending_title')}
            </AppText>
            <AppText style={[styles.sub, { color: t.color.secondary }]} numberOfLines={1}>
              {`${tr(`meal.${e.mealType}`)}, ${tr('ai_scan.pending_sub')}, ${hhmm(e.queuedAt)}`}
            </AppText>
          </View>
        </View>
      ))}
      <Pressable
        onPress={() => {
          void clearPendingScanPhoto().then(() => {
            setQueue([]);
            onManual();
          });
        }}
        accessibilityRole="button"
        style={[styles.manual, { backgroundColor: t.color.ink }]}
      >
        <AppText style={[styles.manualText, { color: t.color.bg }]}>{tr('ai_scan.manual_entry')}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 },
  bannerText: { flex: 1, fontSize: 15, lineHeight: 20, fontFamily: 'PlusJakartaSans_500Medium' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 12 },
  thumb: { width: 54, height: 54, borderRadius: 14, overflow: 'hidden' },
  badge: { position: 'absolute', right: 2, bottom: 2, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 2 },
  title: { fontSize: 15, lineHeight: 20, fontFamily: 'PlusJakartaSans_700Bold' },
  sub: { fontSize: 13, lineHeight: 18, fontFamily: 'PlusJakartaSans_500Medium' },
  manual: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  manualText: { fontSize: 17, lineHeight: 22, fontFamily: 'PlusJakartaSans_700Bold' },
});
