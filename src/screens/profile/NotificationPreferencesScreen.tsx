import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretLeft, Bell } from 'phosphor-react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../context/AuthContext';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { supabase } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation/types';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../constants/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Prefs = {
  transactional_enabled: boolean;
  marketing_enabled: boolean;
  reminder_enabled: boolean;
  behavioral_enabled: boolean;
};

const DEFAULT_PREFS: Prefs = {
  transactional_enabled: true,
  marketing_enabled: true,
  reminder_enabled: true,
  behavioral_enabled: true,
};

type RowKey = keyof Prefs;

type RowDef = {
  key: RowKey;
  title: string;
  description: string;
  locked?: string; // kapatılamaz nedeni
};

const ROWS: RowDef[] = [
  {
    key: 'transactional_enabled',
    title: 'Sipariş Bildirimleri',
    description: 'Siparişinin durumu, ödeme ve teslimat bilgilendirmeleri.',
    locked: 'Siparişinizin durumu hakkında sizi bilgilendirmemiz için önerilir.',
  },
  {
    key: 'marketing_enabled',
    title: 'Kampanya ve Fırsatlar',
    description: 'Yeni kampanyalar, indirimler ve özel tekliflerden haberdar ol.',
  },
  {
    key: 'reminder_enabled',
    title: 'Hatırlatıcılar',
    description: 'Teslimat, kupon süresi ve abonelik yenileme hatırlatmaları.',
  },
  {
    key: 'behavioral_enabled',
    title: 'Öneriler ve İpuçları',
    description: 'Sepet hatırlatmaları ve kişisel beslenme önerileri.',
  },
];

export default function NotificationPreferencesScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isAuthenticated, loading: authLoading } = useRequireAuth();

  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<RowKey | null>(null);
  const [systemStatus, setSystemStatus] = useState<'granted' | 'denied' | 'undetermined' | null>(null);

  const loadPrefs = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('transactional_enabled, marketing_enabled, reminder_enabled, behavioral_enabled')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('[NotificationPrefs] load error:', error.message);
      }

      if (data) {
        setPrefs({
          transactional_enabled: data.transactional_enabled ?? true,
          marketing_enabled: data.marketing_enabled ?? true,
          reminder_enabled: data.reminder_enabled ?? true,
          behavioral_enabled: data.behavioral_enabled ?? true,
        });
      } else {
        // Trigger sayesinde satır olmalı; yoksa oluştur
        await supabase
          .from('notification_preferences')
          .insert({ user_id: user.id })
          .select()
          .maybeSingle();
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPrefs();
  }, [loadPrefs]);

  useEffect(() => {
    Notifications.getPermissionsAsync()
      .then((res) => setSystemStatus(res.status as 'granted' | 'denied' | 'undetermined'))
      .catch(() => setSystemStatus(null));
  }, []);

  const handleToggle = async (key: RowKey, next: boolean) => {
    if (!user?.id) return;
    setPrefs((p) => ({ ...p, [key]: next }));
    setSaving(key);
    try {
      const { error } = await supabase
        .from('notification_preferences')
        .update({ [key]: next })
        .eq('user_id', user.id);
      if (error) {
        setPrefs((p) => ({ ...p, [key]: !next }));
        Alert.alert('Hata', 'Tercih güncellenemedi. Lütfen tekrar deneyin.');
      }
    } finally {
      setSaving(null);
    }
  };

  const handleLockedRowTap = (row: RowDef) => {
    Alert.alert(row.title, row.locked ?? 'Bu bildirim kategorisi kapatılamaz.');
  };

  const openSystemSettings = () => {
    Linking.openSettings().catch(() => {
      Alert.alert('Hata', 'Ayarlar açılamadı.');
    });
  };

  if (authLoading) return null;
  if (!isAuthenticated) return null;

  const showSystemDisabledBanner = systemStatus === 'denied';

  return (
    <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: COLORS.background }}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          hitSlop={8}
        >
          <CaretLeft size={22} color={COLORS.text.primary} weight="bold" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bildirim Tercihleri</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        {showSystemDisabledBanner && (
          <View style={styles.banner}>
            <Bell size={20} color="#92400E" weight="fill" />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Bildirimler cihazda kapalı</Text>
              <Text style={styles.bannerBody}>
                Bildirim alabilmek için cihaz ayarlarından KCAL bildirimlerine izin verin.
              </Text>
            </View>
            <TouchableOpacity style={styles.bannerBtn} onPress={openSystemSettings} activeOpacity={0.8}>
              <Text style={styles.bannerBtnText}>Ayarlar</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.sectionHint}>
          Hangi bildirimleri almak istediğini yönet. Kritik sipariş durumlarını kapatmanı
          önermiyoruz.
        </Text>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={COLORS.brand.green} />
          </View>
        ) : (
          <View style={styles.card}>
            {ROWS.map((row, idx) => {
              const value = prefs[row.key];
              const isLocked = Boolean(row.locked);
              return (
                <View
                  key={row.key}
                  style={[styles.row, idx > 0 && styles.rowBorder]}
                >
                  <TouchableOpacity
                    style={styles.rowText}
                    activeOpacity={isLocked ? 0.7 : 1}
                    onPress={isLocked ? () => handleLockedRowTap(row) : undefined}
                    disabled={!isLocked}
                  >
                    <View style={styles.rowTitleLine}>
                      <Text style={styles.rowTitle}>{row.title}</Text>
                      {isLocked && (
                        <View style={styles.recommendedBadge}>
                          <Text style={styles.recommendedText}>Önerilen</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.rowDesc}>{row.description}</Text>
                  </TouchableOpacity>
                  <Switch
                    value={value}
                    onValueChange={(next) => {
                      if (isLocked && !next) {
                        Alert.alert(
                          row.title,
                          `${row.locked}\n\nYine de kapatmak istiyor musunuz?`,
                          [
                            { text: 'Vazgeç', style: 'cancel' },
                            {
                              text: 'Kapat',
                              style: 'destructive',
                              onPress: () => handleToggle(row.key, false),
                            },
                          ],
                        );
                        return;
                      }
                      handleToggle(row.key, next);
                    }}
                    disabled={saving === row.key}
                    trackColor={{ false: '#E5E7EB', true: COLORS.brand.green }}
                    thumbColor={Platform.OS === 'android' ? (value ? '#1a1a1a' : '#f4f4f5') : undefined}
                    ios_backgroundColor="#E5E7EB"
                  />
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.footnote}>
          Bildirim ayarların sadece bu hesap için geçerlidir. Cihaz seviyesinde bildirim iznini
          kapatırsan hiçbir bildirim alamazsın.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  sectionHint: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.text.secondary,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    lineHeight: 20,
  },
  loadingBox: {
    paddingVertical: SPACING['3xl'],
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: RADIUS.lg,
    marginHorizontal: SPACING.lg,
    overflow: 'hidden',
    ...SHADOWS.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  rowTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.primary,
  },
  rowDesc: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.text.secondary,
    lineHeight: 18,
  },
  recommendedBadge: {
    backgroundColor: COLORS.brand.green,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#1a1a1a',
    letterSpacing: 0.3,
  },
  footnote: {
    fontSize: TYPOGRAPHY.size.xs,
    color: COLORS.text.tertiary,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    lineHeight: 16,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: '#FEF3C7',
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  bannerTitle: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#78350F',
  },
  bannerBody: {
    fontSize: TYPOGRAPHY.size.xs,
    color: '#92400E',
    marginTop: 2,
    lineHeight: 16,
  },
  bannerBtn: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.xs,
  },
  bannerBtnText: {
    color: '#ffffff',
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
});
