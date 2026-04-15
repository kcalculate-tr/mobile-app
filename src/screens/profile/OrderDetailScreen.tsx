import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { type Icon, CaretLeftIcon, ShoppingCartIcon, CheckCircleIcon, ChefHatIcon, TruckIcon, ConfettiIcon } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenContainer from '../../components/ScreenContainer';
import { getSupabaseClient } from '../../lib/supabase';
import {
  formatSupabaseErrorForDevLog,
  mapSupabaseErrorToUserMessage,
} from '../../lib/supabaseErrors';
import { RootStackParamList } from '../../navigation/types';
import { COLORS, TYPOGRAPHY } from '../../constants/theme';

type OrderDetailRouteProp = RouteProp<RootStackParamList, 'OrderDetail'>;
type OrderDetailNavigationProp = NativeStackNavigationProp<RootStackParamList>;

type OrderItem = {
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

type OrderDetailData = {
  id: number;
  order_code: string | null;
  created_at: string;
  total_amount: number;
  status: string;
  payment_status: string | null;
  order_items: OrderItem[];
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Beklemede',
  pending_payment: 'Ödeme Bekleniyor',
  confirmed: 'Onaylandı',
  preparing: 'Hazırlanıyor',
  on_the_way: 'Yolda',
  ready: 'Hazır',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal',
  payment_failed: 'Ödeme Başarısız',
  refunded: 'İade Edildi',
};

const STATUS_CONFIG: Record<string, { bg: string; color: string }> = {
  pending:         { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' },
  pending_payment: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B' },
  confirmed:       { bg: 'rgba(59,130,246,0.12)', color: '#3B82F6' },
  preparing:       { bg: '#f0f0f0',               color: COLORS.text.primary },
  on_the_way:      { bg: COLORS.brand.green,               color: COLORS.text.primary },
  ready:           { bg: COLORS.brand.green,               color: COLORS.text.primary },
  delivered:       { bg: COLORS.brand.green,               color: COLORS.text.primary },
  cancelled:       { bg: 'rgba(212,24,61,0.1)',   color: '#d4183d' },
  payment_failed:  { bg: 'rgba(220,38,38,0.1)',   color: '#DC2626' },
  refunded:        { bg: '#f0f0f0',               color: '#6B7280' },
};

const TRACKING_STEPS: { title: string; subtitle: string; Icon: Icon; statusThreshold: number }[] = [
  { title: 'Sipariş Verildi', subtitle: 'Siparişiniz alındı', Icon: ShoppingCartIcon, statusThreshold: 0 },
  { title: 'Onaylandı', subtitle: 'Siparişiniz onaylandı', Icon: CheckCircleIcon, statusThreshold: 1 },
  { title: 'Hazırlanıyor', subtitle: 'Mutfakta hazırlanıyor', Icon: ChefHatIcon, statusThreshold: 2 },
  { title: 'Yola Çıktı', subtitle: 'Kurye yola çıktı', Icon: TruckIcon, statusThreshold: 3 },
  { title: 'Teslim Edildi', subtitle: 'Siparişiniz teslim edildi', Icon: ConfettiIcon, statusThreshold: 4 },
];

const getTrackingProgress = (status: string): number => {
  const map: Record<string, number> = {
    pending: 0, pending_payment: 0,
    confirmed: 1,
    preparing: 2,
    on_the_way: 3, ready: 3,
    delivered: 4,
  };
  return map[status] ?? -1;
};

const formatDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export default function OrderDetailScreen() {
  const navigation = useNavigation<OrderDetailNavigationProp>();
  const route = useRoute<OrderDetailRouteProp>();
  const insets = useSafeAreaInsets();
  const { orderId } = route.params;

  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(product_name, quantity, unit_price, total_price)')
        .eq('id', orderId)
        .single();

      if (error) throw error;

      const raw = data as Record<string, unknown>;
      const rawItems = Array.isArray(raw.order_items)
        ? (raw.order_items as Record<string, unknown>[])
        : [];

      setOrder({
        id: Number(raw.id ?? 0),
        order_code: raw.order_code != null ? String(raw.order_code).trim() || null : null,
        created_at: String(raw.created_at ?? ''),
        total_amount: Number(raw.total_amount ?? 0),
        status: String(raw.status ?? ''),
        payment_status: raw.payment_status != null ? String(raw.payment_status) : null,
        order_items: rawItems.map((item) => ({
          product_name: String(item.product_name ?? 'Ürün'),
          quantity: Number(item.quantity ?? 0),
          unit_price: Number(item.unit_price ?? 0),
          total_price: Number(item.total_price ?? 0),
        })),
      });
    } catch (err: unknown) {
      if (__DEV__) {
        console.warn(`[order-detail] load error: ${formatSupabaseErrorForDevLog(err)}`);
      }
      setErrorMessage(mapSupabaseErrorToUserMessage(err, 'Sipariş detayı yüklenemedi.'));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  const statusCfg = order
    ? (STATUS_CONFIG[order.status] ?? { bg: '#f0f0f0', color: COLORS.text.secondary })
    : { bg: '#f0f0f0', color: COLORS.text.secondary };
  const statusLabel = order ? (STATUS_LABELS[order.status] ?? order.status) : '';
  const trackingProgress = order ? getTrackingProgress(order.status) : -1;
  const isCancelled = order?.status === 'cancelled' || order?.status === 'payment_failed';

  return (
    <ScreenContainer edges={['top']} style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.75}>
          <CaretLeftIcon size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Sipariş Takibi</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color={COLORS.brand.green} size="large" />
        </View>
      ) : errorMessage ? (
        <View style={s.centered}>
          <Text style={s.errorText}>{errorMessage}</Text>
          <TouchableOpacity onPress={loadOrder} style={s.retryBtn}>
            <Text style={s.retryBtnText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      ) : order == null ? null : (
        <>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[s.scroll, { paddingBottom: Math.max(100, insets.bottom + 80) }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Order summary */}
            <View style={s.card}>
              <View style={s.rowBetween}>
                <Text style={s.orderCode}>
                  {order.order_code ?? `#${String(order.id).slice(0, 8).toUpperCase()}`}
                </Text>
                <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
                  <Text style={[s.statusBadgeText, { color: statusCfg.color }]}>{statusLabel}</Text>
                </View>
              </View>
              <Text style={s.dateText}>{formatDate(order.created_at)}</Text>
            </View>

            {/* Tracking timeline (non-cancelled orders) */}
            {!isCancelled && trackingProgress >= 0 && (
              <View style={s.card}>
                <View style={s.handleBar} />
                {TRACKING_STEPS.map((step, i) => {
                  const done = i <= trackingProgress;
                  return (
                    <View key={i} style={[s.stepRow, i < TRACKING_STEPS.length - 1 && s.stepRowGap]}>
                      {/* Icon + vertical line */}
                      <View style={s.stepLeft}>
                        <View style={[s.stepIcon, done && s.stepIconDone]}>
                          <step.Icon size={20} color={done ? '#000000' : '#9ca3af'} weight={done ? 'fill' : 'regular'} />
                        </View>
                        {i < TRACKING_STEPS.length - 1 && (
                          <View style={[s.stepLine, done && trackingProgress > i && s.stepLineDone]} />
                        )}
                      </View>
                      {/* Content */}
                      <View style={s.stepContent}>
                        <Text style={[s.stepTitle, done && s.stepTitleDone]}>{step.title}</Text>
                        <Text style={s.stepSub}>{step.subtitle}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Items */}
            {order.order_items.length > 0 && (
              <View style={s.card}>
                <Text style={s.sectionTitle}>Ürünler</Text>
                {order.order_items.map((item, idx) => (
                  <View
                    key={idx}
                    style={[s.itemRow, idx < order.order_items.length - 1 && s.itemRowBorder]}
                  >
                    <View style={s.itemLeft}>
                      <Text style={s.itemName}>{item.product_name}</Text>
                      <Text style={s.itemQty}>{item.quantity} adet × ₺{item.unit_price.toFixed(2)}</Text>
                    </View>
                    <Text style={s.itemTotal}>₺{item.total_price.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Order info */}
            <View style={s.card}>
              <Text style={s.sectionTitle}>Sipariş Bilgileri</Text>
              {[
                { label: 'Sipariş No', value: order.order_code ?? `#${String(order.id).slice(0, 8).toUpperCase()}` },
                { label: 'Tarih', value: formatDate(order.created_at) },
                { label: 'Ödeme Durumu', value: order.payment_status ?? '-' },
              ].map((row) => (
                <View key={row.label} style={s.infoRow}>
                  <Text style={s.infoLabel}>{row.label}</Text>
                  <Text style={s.infoValue}>{row.value}</Text>
                </View>
              ))}
              <View style={[s.infoRow, s.totalRow]}>
                <Text style={s.totalLabel}>Toplam Tutar</Text>
                <Text style={s.totalAmount}>₺{order.total_amount.toFixed(2)}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Bottom button */}
          <View style={[s.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
            <TouchableOpacity
              style={s.footerBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.85}
            >
              <Text style={s.footerBtnText}>
                {order.status === 'delivered' ? 'Sipariş Teslim Alındı ✓' : 'Geri Dön'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: TYPOGRAPHY.size.lg, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: '#B91C1C', fontSize: TYPOGRAPHY.size.md, textAlign: 'center' },
  retryBtn: { backgroundColor: COLORS.brand.green, borderRadius: 100, paddingHorizontal: 20, paddingVertical: 10 },
  retryBtnText: { color: COLORS.text.primary, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', fontSize: TYPOGRAPHY.size.md },

  scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },

  card: {
    backgroundColor: COLORS.white, borderRadius: 20, padding: 16, gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderCode: { fontSize: TYPOGRAPHY.size.xl, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
  statusBadge: { borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5 },
  statusBadgeText: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold'},
  dateText: { fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.tertiary },

  // Tracking
  handleBar: { width: 48, height: 4, borderRadius: 100, backgroundColor: '#e0e0e0', alignSelf: 'center', marginBottom: 12 },
  stepRow: { flexDirection: 'row', gap: 14 },
  stepRowGap: { marginBottom: 4 },
  stepLeft: { alignItems: 'center', width: 40 },
  stepIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center', justifyContent: 'center',
  },
  stepIconDone: { backgroundColor: COLORS.brand.green },
  stepEmoji: { fontSize: TYPOGRAPHY.size.xl },
  stepLine: { width: 2, flex: 1, minHeight: 16, backgroundColor: '#f0f0f0', borderRadius: 100, marginTop: 4 },
  stepLineDone: { backgroundColor: COLORS.brand.green },
  stepContent: { flex: 1, paddingTop: 8, paddingBottom: 16 },
  stepTitle: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.semibold,
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.tertiary, marginBottom: 2 },
  stepTitleDone: { color: COLORS.text.primary },
  stepSub: { fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.tertiary },

  // Items
  sectionTitle: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  itemRowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  itemLeft: { flex: 1, marginRight: 12 },
  itemName: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.semibold,
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.primary },
  itemQty: { fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.tertiary, marginTop: 2 },
  itemTotal: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },

  // Info rows
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  infoLabel: { fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.tertiary },
  infoValue: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.semibold,
fontFamily: 'PlusJakartaSans_600SemiBold', color: COLORS.text.primary },
  totalRow: { borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', paddingTop: 10, marginTop: 4 },
  totalLabel: { fontSize: TYPOGRAPHY.size.lg, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
  totalAmount: { fontSize: TYPOGRAPHY.size['2xl'], fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.text.primary },

  // Footer
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  footerBtn: {
    height: 56, borderRadius: 100,
    backgroundColor: COLORS.brand.green,
    alignItems: 'center', justifyContent: 'center',
  },
  footerBtnText: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },
});
