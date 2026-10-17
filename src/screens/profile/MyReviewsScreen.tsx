// Değerlendirmelerim — müşterinin kendi değerlendirmeleri ve bizim yanıtlarımız.
//
// Neden ayrı ekran: değerlendirme pop-up'ı (OrderFeedbackModal) puanı alıyor
// ama müşteri sonra ne yazdığını göremiyordu; yanıt yazdığımızda da yanıt
// hiçbir yerde görünmüyordu. Yanıtın görülebildiği tek yer burası.
//
// RLS: reviews_read_approved_or_owner politikası sahibine kendi satırını
// okutuyor, yani onay beklemede olan değerlendirme de burada görünür.
// Yanıt alanlarını müşteri DEĞİŞTİREMEZ (fn_reviews_reply_guard); yalnız
// reply_seen_at'i güncelleyebilir — "yeni yanıt" rozetini o alan sürüyor.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretLeft, ChatCircleDots, Star } from '../../components/icons';
import { getSupabaseClient } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';

type ReviewRow = {
  id: number;
  rating: number;
  comment: string | null;
  is_approved: boolean;
  created_at: string;
  admin_reply: string | null;
  admin_reply_at: string | null;
  reply_seen_at: string | null;
  orders: { order_code: string | null } | null;
};

function formatDate(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function Yildizlar({ value }: { value: number }) {
  return (
    <View style={styles.yildizSatir}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={16}
          weight={n <= value ? 'fill' : 'regular'}
          color={n <= value ? COLORS.brand.green : COLORS.gray[300]}
        />
      ))}
    </View>
  );
}

export default function MyReviewsScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Ekran açıldığı ANDAKİ görülmemiş yanıtlar. Aşağıda reply_seen_at'i
  // damgalıyoruz; rozet bu set'ten okunduğu için damga rozeti anında
  // kaybettirmiyor, müşteri yanıtı görüyor.
  const [yeniYanitlar, setYeniYanitlar] = useState<Set<number>>(new Set());

  const fetchRows = useCallback(async () => {
    if (!user?.id) {
      setRows([]);
      setLoading(false);
      return;
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, comment, is_approved, created_at, admin_reply, admin_reply_at, reply_seen_at, orders(order_code)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Değerlendirmelerim] okuma hatası:', error.message);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as unknown as ReviewRow[];
    setRows(list);
    setLoading(false);

    const gorulmemis = list
      .filter((r) => (r.admin_reply ?? '') !== '' && !r.reply_seen_at)
      .map((r) => r.id);

    if (gorulmemis.length > 0) {
      setYeniYanitlar((prev) => new Set([...prev, ...gorulmemis]));
      // Best-effort: damgalanamazsa rozet bir sonraki açılışta yine görünür,
      // kullanıcı için kayıp yok.
      await supabase
        .from('reviews')
        .update({ reply_seen_at: new Date().toISOString() })
        .in('id', gorulmemis);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const ortalama = useMemo(() => {
    if (rows.length === 0) return null;
    const t = rows.reduce((s, r) => s + Number(r.rating ?? 0), 0);
    return (t / rows.length).toFixed(1);
  }, [rows]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <CaretLeft size={18} color="#000000" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Değerlendirmelerim</Text>
          <Text style={styles.headerSub}>
            {rows.length > 0
              ? `${rows.length} değerlendirme · ortalama ${ortalama}`
              : 'Verdiğin puanlar ve bizim yanıtlarımız'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.merkez}>
          <ActivityIndicator color={COLORS.brand.green} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await fetchRows();
                setRefreshing(false);
              }}
              tintColor={COLORS.brand.green}
            />
          }
        >
          {rows.length === 0 ? (
            <View style={styles.bosDurum}>
              <ChatCircleDots size={40} color={COLORS.gray[300]} />
              <Text style={styles.bosBaslik}>Henüz değerlendirme yok</Text>
              <Text style={styles.bosMetin}>
                Siparişin teslim edildikten sonra puan vermen istenir. Verdiğin puanlar
                ve bizim yanıtlarımız burada birikir.
              </Text>
            </View>
          ) : (
            rows.map((r) => {
              const yeni = yeniYanitlar.has(r.id);
              const yanit = (r.admin_reply ?? '').trim();
              return (
                <View key={r.id} style={styles.card}>
                  <View style={styles.cardUst}>
                    <Yildizlar value={Number(r.rating ?? 0)} />
                    <Text style={styles.tarih}>{formatDate(r.created_at)}</Text>
                  </View>

                  {r.orders?.order_code ? (
                    <Text style={styles.siparisKodu}>Sipariş {r.orders.order_code}</Text>
                  ) : null}

                  {r.comment ? <Text style={styles.yorum}>{r.comment}</Text> : null}

                  {!r.is_approved && r.comment ? (
                    <View style={styles.moderasyon}>
                      <Text style={styles.moderasyonMetin}>Yorumun onay bekliyor</Text>
                    </View>
                  ) : null}

                  {yanit ? (
                    <View style={styles.yanitKart}>
                      <View style={styles.yanitUst}>
                        <Text style={styles.yanitBaslik}>KCAL yanıtı</Text>
                        {yeni ? (
                          <View style={styles.yeniRozet}>
                            <Text style={styles.yeniRozetMetin}>YENİ</Text>
                          </View>
                        ) : null}
                        {r.admin_reply_at ? (
                          <Text style={styles.yanitTarih}>{formatDate(r.admin_reply_at)}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.yanitMetin}>{yanit}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  headerTitle: { fontSize: 18, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
  headerSub: { fontSize: 12, color: COLORS.text.secondary, marginTop: 1 },
  merkez: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },

  card: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  cardUst: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  yildizSatir: { flexDirection: 'row', gap: 2 },
  tarih: { fontSize: 12, color: COLORS.text.tertiary },
  siparisKodu: { fontSize: 12, color: COLORS.text.secondary, marginTop: 8 },
  yorum: { fontSize: 14, color: COLORS.text.primary, lineHeight: 20, marginTop: 8 },

  moderasyon: {
    alignSelf: 'flex-start', marginTop: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: COLORS.gray[100],
  },
  moderasyonMetin: { fontSize: 11, color: COLORS.text.secondary },

  yanitKart: {
    marginTop: 12, padding: 12, borderRadius: 14,
    backgroundColor: 'rgba(185,239,20,0.12)',
    borderLeftWidth: 3, borderLeftColor: COLORS.brand.green,
  },
  yanitUst: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  yanitBaslik: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
  yanitTarih: { fontSize: 11, color: COLORS.text.tertiary, marginLeft: 'auto' },
  yeniRozet: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    backgroundColor: COLORS.brand.green,
  },
  yeniRozetMetin: { fontSize: 9, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.black },
  yanitMetin: { fontSize: 14, color: COLORS.text.primary, lineHeight: 20 },

  bosDurum: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, gap: 8 },
  bosBaslik: { fontSize: 16, fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary, marginTop: 8 },
  bosMetin: { fontSize: 13, color: COLORS.text.secondary, textAlign: 'center', lineHeight: 19 },
});
