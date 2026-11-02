import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../core/AuthContext';
import {
  getApiBaseUrl,
  isApiBaseUrlConfigured,
  validateCoupon,
} from '../lib/api';
import {
  formatSupabaseErrorForDevLog,
  mapSupabaseErrorToUserMessage,
} from '../lib/supabaseErrors';
import { getSupabaseClient } from '../core/supabase';
import { useFlagsContext, FLAG_KEYS, type FlagKey } from '../core/flags';
import { COLORS } from '../constants/theme';

type DiagnosticsData = {
  sessionInfo: string;
  addressesInfo: string;
  deliveryRuleInfo: string;
  apiInfo: string;
  couponPingInfo: string;
};

const initialData: DiagnosticsData = {
  sessionInfo: '-',
  addressesInfo: '-',
  deliveryRuleInfo: '-',
  apiInfo: '-',
  couponPingInfo: '-',
};

export default function DevDiagnosticsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState<DiagnosticsData>(initialData);

  const runDiagnostics = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    const diagnostics: DiagnosticsData = { ...initialData };

    try {
      const supabase = getSupabaseClient();
      const sessionRes = await supabase.auth.getSession();
      if (sessionRes.error) {
        diagnostics.sessionInfo = mapSupabaseErrorToUserMessage(
          sessionRes.error,
          'Session okunamadı.',
        );
      } else {
        diagnostics.sessionInfo = sessionRes.data.session
          ? `Var (${sessionRes.data.session.user.id})`
          : 'Yok';
      }

      if (!user) {
        diagnostics.addressesInfo = 'Kullanıcı yok';
      } else {
        const addressesRes = await supabase
          .from('addresses')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (addressesRes.error) {
          diagnostics.addressesInfo = mapSupabaseErrorToUserMessage(
            addressesRes.error,
            'Addresses sorgusu başarısız.',
          );
        } else {
          diagnostics.addressesInfo = `Adet: ${addressesRes.count ?? 0}`;
        }
      }

      const deliveryRes = await supabase
        .from('delivery_zones')
        .select('district,is_active,min_order,updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (deliveryRes.error) {
        diagnostics.deliveryRuleInfo = mapSupabaseErrorToUserMessage(
          deliveryRes.error,
          'delivery_zones sorgusu başarısız.',
        );
      } else if (!deliveryRes.data) {
        diagnostics.deliveryRuleInfo = 'Kural bulunamadı';
      } else {
        diagnostics.deliveryRuleInfo = `${String(deliveryRes.data.district || '-')} | aktif=${deliveryRes.data.is_active !== false ? 'evet' : 'hayır'} | min=${Number(deliveryRes.data.min_order || 0)}`;
      }

      const apiBaseConfigured = isApiBaseUrlConfigured();
      const apiBaseUrl = getApiBaseUrl();
      diagnostics.apiInfo = apiBaseConfigured
        ? `Aktif (${apiBaseUrl})`
        : 'Kapalı (EXPO_PUBLIC_API_BASE_URL yok)';

      if (!apiBaseConfigured) {
        diagnostics.couponPingInfo = 'Atlandı (API base URL yok)';
      } else {
        try {
          const couponRes = await validateCoupon({
            code: '__PING__',
            cartSubtotal: 0,
          });
          diagnostics.couponPingInfo = couponRes.valid
            ? 'Ping başarılı (valid=true)'
            : `Ping yanıtı (valid=false): ${couponRes.message || 'mesaj yok'}`;
        } catch (error: unknown) {
          diagnostics.couponPingInfo = mapSupabaseErrorToUserMessage(
            error,
            'Kupon ping başarısız.',
          );
        }
      }
    } catch (error: unknown) {
      if (__DEV__) {
        console.warn(
          `[diagnostics] unexpected error: ${formatSupabaseErrorForDevLog(error)}`,
        );
      }
      setErrorMessage(
        mapSupabaseErrorToUserMessage(
          error,
          'Tanı verileri alınamadı. Lütfen tekrar deneyin.',
        ),
      );
    } finally {
      setData(diagnostics);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>Tanı</Text>
        <Text style={styles.subtitle}>Sadece geliştirme ortamı</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.brand.green} />
          </View>
        ) : (
          <>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <DiagnosticRow label="Supabase Session" value={data.sessionInfo} />
            <DiagnosticRow label="Addresses Count" value={data.addressesInfo} />
            <DiagnosticRow label="Delivery Rule Query" value={data.deliveryRuleInfo} />
            <DiagnosticRow label="API Base URL" value={data.apiInfo} />
            <DiagnosticRow label="Validate Coupon Ping" value={data.couponPingInfo} />
            {__DEV__ ? <FlagsDebugSection /> : null}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.refreshButton} onPress={runDiagnostics}>
          <Text style={styles.refreshText}>Yenile</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const DiagnosticRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.card}>
    <Text style={styles.cardLabel}>{label}</Text>
    <Text style={styles.cardValue}>{value}</Text>
  </View>
);

// __DEV__ bayrak listesi — çözümlenmiş değeri gösterir ve yerel geçersiz kılma
// (override) sunar. Yalnız geliştirme; üretim build'inde hiç render edilmez.
const FlagsDebugSection = () => {
  const ctx = useFlagsContext();
  if (!ctx) return null;
  const { flags, devOverrides, setDevOverride, refresh } = ctx;
  const overrideKeys = Object.keys(devOverrides) as FlagKey[];
  const hasOverride = overrideKeys.length > 0;

  const cycle = (key: FlagKey) => {
    // yok → açık → kapalı → yok
    const cur = devOverrides[key];
    if (cur === undefined) void setDevOverride(key, true);
    else if (cur === true) void setDevOverride(key, false);
    else void setDevOverride(key, null);
  };

  // Tüm override'ları sırayla kaldır (her çağrı provider state'ini günceller).
  const resetAll = () => {
    for (const key of overrideKeys) void setDevOverride(key, null);
  };

  return (
    <View style={styles.flagsSection}>
      <View style={styles.flagsHeaderRow}>
        <Text style={styles.flagsTitle}>Bayraklar (__DEV__)</Text>
        <View style={styles.flagsActions}>
          <TouchableOpacity onPress={() => void refresh()} style={styles.flagsSmallBtn}>
            <Text style={styles.flagsSmallBtnText}>Yenile</Text>
          </TouchableOpacity>
          {hasOverride ? (
            <TouchableOpacity onPress={resetAll} style={styles.flagsSmallBtn}>
              <Text style={styles.flagsSmallBtnText}>Sıfırla</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      {FLAG_KEYS.map((key) => {
        const ov = devOverrides[key];
        const effective = flags[key];
        return (
          <TouchableOpacity key={key} style={styles.flagRow} onPress={() => cycle(key)}>
            <Text style={styles.flagKey}>{key}</Text>
            <Text style={[styles.flagValue, effective ? styles.flagOn : styles.flagOff]}>
              {effective ? 'AÇIK' : 'kapalı'}
              {ov !== undefined ? ' · override' : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
      <Text style={styles.flagsHint}>
        Dokun: override yok → açık → kapalı → yok. Override yalnız bu cihazda,
        yalnız geliştirmede.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: COLORS.brand.green,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  subtitle: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
  },
  content: {
    padding: 16,
    paddingBottom: 140,
    gap: 10,
  },
  center: {
    marginTop: 28,
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardLabel: {
    color: '#6B7280',
    fontSize: 12,
    marginBottom: 6,
  },
  cardValue: {
    color: COLORS.text.primary,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'white',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  refreshButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: {
    color: 'white',
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    marginBottom: 8,
  },
  flagsSection: {
    marginTop: 6,
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  flagsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flagsTitle: {
    color: COLORS.text.primary,
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  flagsActions: {
    flexDirection: 'row',
    gap: 8,
  },
  flagsSmallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  flagsSmallBtnText: {
    fontSize: 12,
    color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  flagKey: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text.primary,
    fontFamily: 'PlusJakartaSans_500Medium',
  },
  flagValue: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  flagOn: {
    color: COLORS.brand.green,
  },
  flagOff: {
    color: '#9CA3AF',
  },
  flagsHint: {
    marginTop: 4,
    fontSize: 11,
    color: '#9CA3AF',
    lineHeight: 15,
  },
});
