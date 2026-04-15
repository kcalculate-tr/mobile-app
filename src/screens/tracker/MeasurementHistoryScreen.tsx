import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {CaretLeft, TrendDown, TrendUp, Minus, Ruler, Scales} from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient } from '../../lib/supabase';
import { RootStackParamList } from '../../navigation/types';
import { COLORS } from '../../constants/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Measurement = {
  id: string;
  date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
};

const fmt = (date: string) =>
  new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

const diff = (current: number | null, previous: number | null) => {
  if (current == null || previous == null) return null;
  return Math.round((current - previous) * 10) / 10;
};

function DiffBadge({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  if (value == null || value === 0) return (
    <View style={[b.badge, { backgroundColor: '#f0f0f0' }]}>
      <Minus size={10} color={COLORS.text.tertiary} />
      <Text style={[b.text, { color: COLORS.text.tertiary }]}>—</Text>
    </View>
  );
  // inverse: bel/kalça için azalma iyi
  const isGood = inverse ? value < 0 : value < 0;
  const color = isGood ? '#16A34A' : '#DC2626';
  const bg = isGood ? '#DCFCE7' : '#FEE2E2';
  return (
    <View style={[b.badge, { backgroundColor: bg }]}>
      {value < 0
        ? <TrendDown size={10} color={color} />
        : <TrendUp size={10} color={color} />
      }
      <Text style={[b.text, { color }]}>{value > 0 ? '+' : ''}{value}</Text>
    </View>
  );
}

const b = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 100, paddingHorizontal: 7, paddingVertical: 3 },
  text: { fontSize: 10, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold'},
});

export default function MeasurementHistoryScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [data, setData] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: rows } = await supabase
        .from('body_measurements')
        .select('id,date,weight_kg,waist_cm,hip_cm,chest_cm')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(90);
      setData((rows as Measurement[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Özet hesapla (ilk vs son)
  const first = data.length > 0 ? data[data.length - 1] : null;
  const last = data.length > 0 ? data[0] : null;

  const totalWeightDiff = diff(last?.weight_kg ?? null, first?.weight_kg ?? null);
  const totalWaistDiff = diff(last?.waist_cm ?? null, first?.waist_cm ?? null);

  const motivationMessage = () => {
    if (!first || !last) return null;
    if (totalWeightDiff == null) return null;
    if (data.length === 1) return 'İlk ölçümün kaydedildi, harika başlangıç!';
    if (totalWeightDiff < -5) return `Tebrikler! Toplamda ${Math.abs(totalWeightDiff)} kg verdin!`;
    if (totalWeightDiff < -2) return `Harika ilerliyorsun! ${Math.abs(totalWeightDiff)} kg eksildin.`;
    if (totalWeightDiff < 0) return `Doğru yoldasın, ${Math.abs(totalWeightDiff)} kg eksildin.`;
    if (totalWeightDiff === 0) return 'Kilonu koruyorsun, tutarlılık başarının anahtarı!';
    if (totalWeightDiff > 0) return `${totalWeightDiff} kg arttın, hedefe göre bu normal olabilir.`;
    return null;
  };

  const message = motivationMessage();

  return (
    <ScreenContainer edges={['top']} style={s.root}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.75}>
          <CaretLeft size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Ölçüm Geçmişi</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.content, { paddingBottom: Math.max(32, insets.bottom + 24) }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.brand.green} style={{ marginTop: 40 }} />
        ) : data.length === 0 ? (
          <View style={s.empty}>
            <Ruler size={52} color="#000000" weight="duotone" />
            <Text style={s.emptyTitle}>Henüz ölçüm yok</Text>
            <Text style={s.emptySub}>Hedef Düzenle'den ölçümlerini kaydedebilirsin.</Text>
          </View>
        ) : (
          <>
            {/* Motivasyon mesajı */}
            {message && (
              <View style={s.motivationCard}>
                <Text style={s.motivationText}>{message}</Text>
              </View>
            )}

            {/* Özet kart */}
            {first && last && data.length > 1 && (
              <View style={s.summaryCard}>
                <Text style={s.summaryTitle}>Genel Özet</Text>
                <Text style={s.summaryPeriod}>
                  {fmt(first.date)} → {fmt(last.date)}
                </Text>
                <View style={s.summaryRow}>
                  {[
                    { label: 'Kilo', from: first.weight_kg, to: last.weight_kg, unit: 'kg' },
                    { label: 'Bel', from: first.waist_cm, to: last.waist_cm, unit: 'cm' },
                    { label: 'Kalça', from: first.hip_cm, to: last.hip_cm, unit: 'cm' },
                    { label: 'Göğüs', from: first.chest_cm, to: last.chest_cm, unit: 'cm' },
                  ].map((item) => (
                    <View key={item.label} style={s.summaryCell}>
                      <Text style={s.summaryCellLabel}>{item.label}</Text>
                      <Text style={s.summaryCellValue}>
                        {item.to != null ? `${item.to} ${item.unit}` : '—'}
                      </Text>
                      <DiffBadge value={diff(item.to, item.from)} inverse />
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Liste */}
            <Text style={s.listTitle}>Tüm Kayıtlar</Text>
            {data.map((item, index) => {
              const prev = data[index + 1] ?? null;
              return (
                <View key={item.id} style={s.row}>
                  <View style={s.rowLeft}>
                    <Text style={s.rowDate}>{fmt(item.date)}</Text>
                    <View style={s.rowMetrics}>
                      {item.weight_kg != null && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Scales size={14} color={COLORS.text.secondary} weight="duotone" />
                          <Text style={s.rowMetric}>{item.weight_kg} kg</Text>
                        </View>
                      )}
                      {item.waist_cm != null && (
                        <Text style={s.rowMetric}>📐 Bel {item.waist_cm} cm</Text>
                      )}
                      {item.hip_cm != null && (
                        <Text style={s.rowMetric}>Kalça {item.hip_cm} cm</Text>
                      )}
                      {item.chest_cm != null && (
                        <Text style={s.rowMetric}>Göğüs {item.chest_cm} cm</Text>
                      )}
                    </View>
                  </View>
                  <DiffBadge value={diff(item.weight_kg, prev?.weight_kg ?? null)} inverse={false} />
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f6f6' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  content: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 17, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  emptySub: { fontSize: 13, color: COLORS.text.tertiary, textAlign: 'center' },

  motivationCard: {
    backgroundColor: '#1a1a1a', borderRadius: 16, padding: 16,
  },
  motivationText: { fontSize: 15, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.brand.green, lineHeight: 22 },

  summaryCard: {
    backgroundColor: '#ffffff', borderRadius: 16, padding: 16, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  summaryTitle: { fontSize: 14, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  summaryPeriod: { fontSize: 11, color: COLORS.text.tertiary },
  summaryRow: { flexDirection: 'row', gap: 8 },
  summaryCell: { flex: 1, alignItems: 'center', gap: 4 },
  summaryCellLabel: { fontSize: 10, color: COLORS.text.tertiary, fontWeight: '600',
fontFamily: 'PlusJakartaSans_600SemiBold'},
  summaryCellValue: { fontSize: 15, fontWeight: '800',
fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#000000' },

  listTitle: { fontSize: 13, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000', marginTop: 4 },

  row: {
    backgroundColor: '#ffffff', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  rowLeft: { gap: 6, flex: 1 },
  rowDate: { fontSize: 13, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000000' },
  rowMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  rowMetric: { fontSize: 11, color: COLORS.text.secondary },
});
