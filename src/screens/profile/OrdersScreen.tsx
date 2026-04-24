import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SkeletonOrderCard } from '../../components/ui/SkeletonLoader';
import { useStaggerAnimation } from '../../hooks/useStaggerAnimation';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CaretLeft, CaretRight, Timer, CreditCard, CheckCircle, ChefHat, Truck, Confetti, XCircle, ArrowCounterClockwise, Package, ShoppingBag, WarningCircle } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { getSupabaseClient } from '../../lib/supabase';
import {
  formatSupabaseErrorForDevLog,
  mapSupabaseErrorToUserMessage,
} from '../../lib/supabaseErrors';
import { RootStackParamList } from '../../navigation/types';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '../../constants/theme';
import { getPendingModificationsForUser, type OrderModificationType } from '../../lib/orders';

const MOD_SHORT_LABELS: Record<OrderModificationType, string> = {
  cancel: 'İptal Talebi',
  date_change: 'Tarih Değ.',
  address_change: 'Adres Değ.',
};

type OrdersNavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Order = {
  id: number;
  order_code: string | null;
  created_at: string;
  total_amount: number;
  status: string;
  payment_status: string | null;
};

const ACTIVE_STATUSES = ['pending', 'pending_payment', 'confirmed', 'preparing', 'on_way', 'ready'];
const PAST_STATUSES = ['delivered', 'cancelled', 'payment_failed', 'refunded'];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Beklemede',
  pending_payment: 'Ödeme Bekleniyor',
  confirmed: 'Onaylandı',
  preparing: 'Hazırlanıyor',
  on_way: 'Yolda',
  ready: 'Hazır',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal Edildi',
  payment_failed: 'Ödeme Başarısız',
  refunded: 'İade Edildi',
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; Icon: any }> = {
  pending:         { label: 'Beklemede',        bg: 'rgba(245,158,11,0.12)',  color: '#F59E0B', Icon: Timer },
  pending_payment: { label: 'Ödeme Bekleniyor', bg: 'rgba(245,158,11,0.12)',  color: '#F59E0B', Icon: CreditCard },
  confirmed:       { label: 'Onaylandı',         bg: 'rgba(59,130,246,0.12)', color: '#3B82F6', Icon: CheckCircle },
  preparing:       { label: 'Hazırlanıyor',      bg: '#ffffff',                color: COLORS.text.primary, Icon: ChefHat },
  on_way:      { label: 'Yolda',             bg: COLORS.brand.green,                color: COLORS.text.primary, Icon: Truck },
  ready:           { label: 'Hazır',             bg: COLORS.brand.green,                color: COLORS.text.primary, Icon: Confetti },
  delivered:       { label: 'Teslim Edildi',     bg: COLORS.brand.green,                color: COLORS.text.primary, Icon: CheckCircle },
  cancelled:       { label: 'İptal Edildi',      bg: 'rgba(212,24,61,0.1)',    color: '#d4183d', Icon: XCircle },
  payment_failed:  { label: 'Ödeme Başarısız',  bg: 'rgba(220,38,38,0.1)',    color: '#DC2626', Icon: XCircle },
  refunded:        { label: 'İade Edildi',       bg: 'rgba(107,114,128,0.12)', color: '#6B7280', Icon: ArrowCounterClockwise },
};

const formatDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const TABS = [
  { key: 'all' as const, label: 'Tümü' },
  { key: 'active' as const, label: 'Aktif' },
  { key: 'past' as const, label: 'Tamamlanan' },
  { key: 'cancelled' as const, label: 'İptal' },
];

type TabKey = 'all' | 'active' | 'past' | 'cancelled';

export default function OrdersScreen() {
  const navigation = useNavigation<OrdersNavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isAuthenticated, loading } = useRequireAuth();

  const [selectedTab, setSelectedTab] = useState<TabKey>('all');
  const [orders, setOrders] = useState<Order[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const { getStyle } = useStaggerAnimation(orders.length);
  const [errorMessage, setErrorMessage] = useState('')
  const [refreshing, setRefreshing] = useState(false);
  const [pendingMods, setPendingMods] = useState<Record<string, OrderModificationType>>({});

  const loadOrders = useCallback(async () => {
    if (!user) return;
    setDataLoading(true);
    setErrorMessage('');

    try {
      const supabase = getSupabaseClient();
      let statuses: string[];
      if (selectedTab === 'active') statuses = ACTIVE_STATUSES;
      else if (selectedTab === 'past') statuses = ['delivered'];
      else if (selectedTab === 'cancelled') statuses = ['cancelled', 'payment_failed', 'refunded'];
      else statuses = [...ACTIVE_STATUSES, ...PAST_STATUSES];

      const { data, error } = await supabase
        .from('orders')
        .select('id, order_code, created_at, total_amount, status, payment_status')
        .eq('user_id', user.id)
        .in('status', statuses)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders(
        (Array.isArray(data) ? data : []).map((row) => ({
          id: Number(row.id ?? 0),
          order_code: String(row.order_code ?? '').trim() || null,
          created_at: String(row.created_at ?? ''),
          total_amount: Number(row.total_amount ?? 0),
          status: String(row.status ?? ''),
          payment_status: row.payment_status != null ? String(row.payment_status) : null,
        })),
      );

      // Fetch pending modifications for this user in one shot.
      try {
        const mods = await getPendingModificationsForUser(user.id);
        const map: Record<string, OrderModificationType> = {};
        mods.forEach((mod) => {
          // Keep first (most specific) per order_id
          if (!map[mod.order_id]) map[mod.order_id] = mod.type;
        });
        setPendingMods(map);
      } catch (modErr: unknown) {
        if (__DEV__) {
          console.warn(`[orders-screen] pending modifications load error: ${formatSupabaseErrorForDevLog(modErr)}`);
        }
      }
    } catch (error: unknown) {
      if (__DEV__) {
        console.warn(`[orders-screen] load error: ${formatSupabaseErrorForDevLog(error)}`);
      }
      setErrorMessage(
        mapSupabaseErrorToUserMessage(error, 'Siparişler yüklenemedi. Lütfen tekrar deneyin.'),
      );
    } finally {
      setDataLoading(false);
    }
  }, [user, selectedTab])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await loadOrders()
    setRefreshing(false)
  }, [loadOrders]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  if (loading) return <ActivityIndicator />;
  if (!isAuthenticated) return null;

  return (
    <View style={[s.root, { flex: 1, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.75}>
          <CaretLeft size={22} color="#000000" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Siparişlerim</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs */}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brand.green} />}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabsContent}
        style={s.tabsRow}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tabBtn, selectedTab === tab.key && s.tabBtnActive]}
            onPress={() => setSelectedTab(tab.key)}
            activeOpacity={0.8}
          >
            <Text style={[s.tabText, selectedTab === tab.key && s.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {dataLoading ? (
        <View style={{ gap: 10, padding: 16 }}>
          {[1,2,3,4].map(i => <SkeletonOrderCard key={i} />)}
        </View>
      ) : errorMessage ? (
        <View style={{ alignItems: 'center', paddingVertical: 48, gap: 12 }}>
          <WarningCircle size={48} color="#EF4444" weight="thin" />
          <Text style={{ fontSize: 16, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000' }}>Bir Hata Oluştu</Text>
          <Text style={{ fontSize: 14, color: COLORS.text.tertiary, textAlign: 'center' }}>{errorMessage}</Text>
          <TouchableOpacity
            onPress={loadOrders}
            style={{ backgroundColor: COLORS.brand.green, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 14, fontWeight: '700',
fontFamily: 'PlusJakartaSans_700Bold', color: '#000' }}>Tekrar Dene</Text>
          </TouchableOpacity>
        </View>
      ) : orders.length === 0 ? (
        <View style={s.centered}>
          <ShoppingBag size={48} color="#e0e0e0" weight="thin" />
          <Text style={s.emptyTitle}>Sipariş Bulunamadı</Text>
          <Text style={s.emptySub}>Bu kategoride sipariş yok</Text>
          {selectedTab === 'active' || selectedTab === 'all' ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('Tabs')}
              style={s.actionBtn}
              activeOpacity={0.85}
            >
              <Text style={s.actionBtnText}>Sipariş Ver</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brand.green} />}
          contentContainerStyle={[s.list, { paddingBottom: Math.max(24, insets.bottom + 16) }]}
          showsVerticalScrollIndicator={false}
        >
          {orders.map((order, index) => {
            const cfg = STATUS_CONFIG[order.status] ?? {
              label: STATUS_LABELS[order.status] ?? order.status,
              bg: '#f0f0f0',
              color: COLORS.text.secondary,
              Icon: Package,
            };
            const isActive = ACTIVE_STATUSES.includes(order.status);
            const progress = order.status === 'on_way' ? 0.65
              : order.status === 'preparing' ? 0.4
              : order.status === 'confirmed' ? 0.2
              : 0;

            return (
              <Animated.View key={order.id} style={getStyle(index)}>
              <TouchableOpacity
                style={s.card}
                activeOpacity={0.85}
                onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
              >
                {/* Top row */}
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.orderCode}>
                      {order.order_code ?? `#${String(order.id).slice(0, 8).toUpperCase()}`}
                    </Text>
                    <Text style={s.dateText}>{formatDate(order.created_at)}</Text>
                    {pendingMods[String(order.id)] ? (
                      <View style={s.modPill}>
                        <Text style={s.modPillText}>{MOD_SHORT_LABELS[pendingMods[String(order.id)]]}</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={[s.badge, { backgroundColor: cfg.bg }]}>
                    <cfg.Icon size={11} color={cfg.color} weight="fill" />
                    <Text style={[s.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>

                {/* Progress bar for active orders */}
                {isActive && progress > 0 && (
                  <View style={s.progressWrap}>
                    <View style={s.progressTrack}>
                      <View style={[s.progressFill, { width: `${progress * 100}%` as `${number}%` }]} />
                    </View>
                    <Text style={s.progressLabel}>
                      {order.status === 'on_way' ? '~20 dk kaldı' : 'Hazırlanıyor...'}
                    </Text>
                  </View>
                )}

                {/* Bottom row */}
                <View style={s.cardBottom}>
                  <Text style={s.amountText}>₺{order.total_amount.toFixed(2)}</Text>
                  <View style={s.detayRow}>
                    <Text style={s.detayText}>Detay</Text>
                    <CaretRight size={14} color={COLORS.text.secondary} />
                  </View>
                </View>
              </TouchableOpacity>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: TYPOGRAPHY.size.lg, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary },

  // Tabs
  tabsRow: { maxHeight: 50 },
  tabsContent: { paddingHorizontal: SPACING.lg, gap: SPACING.sm, paddingBottom: SPACING.md },
  tabBtn: {
    height: 34, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.lg, justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  tabBtnActive: { backgroundColor: COLORS.brand.green },
  tabText: { fontSize: TYPOGRAPHY.size.sm, fontWeight: TYPOGRAPHY.weight.medium,
fontFamily: 'PlusJakartaSans_500Medium', color: 'rgba(0,0,0,0.5)' },
  tabTextActive: { color: COLORS.text.primary, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', opacity: 1 },

  // States
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING['2xl'], gap: SPACING.sm },
  errorText: { color: '#B91C1C', fontSize: TYPOGRAPHY.size.md, textAlign: 'center' },
  
  emptyTitle: { fontSize: TYPOGRAPHY.size.lg, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary, textAlign: 'center' },
  emptySub: { fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.tertiary, textAlign: 'center', marginBottom: SPACING.sm },
  actionBtn: {
    backgroundColor: COLORS.brand.green, borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING['2xl'], paddingVertical: SPACING.md,
  },
  actionBtnText: { color: COLORS.text.primary, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', fontSize: TYPOGRAPHY.size.md },

  // List
  list: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.xs, gap: SPACING.sm },
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.md, padding: SPACING.lg,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderCode: { fontSize: TYPOGRAPHY.size.md, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold', color: COLORS.text.primary, marginBottom: 3 },
  dateText: { fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.tertiary },
  badge: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  badgeEmoji: { fontSize: TYPOGRAPHY.size.xs },
  badgeText: { fontSize: TYPOGRAPHY.size.xs, fontWeight: TYPOGRAPHY.weight.bold,
fontFamily: 'PlusJakartaSans_700Bold'},

  modPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFEDD5',
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    marginTop: 6,
  },
  modPillText: {
    color: '#EA580C',
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

  // Progress
  progressWrap: { gap: SPACING.xs },
  progressTrack: { height: 6, borderRadius: RADIUS.pill, backgroundColor: '#f0f0f0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: RADIUS.pill, backgroundColor: COLORS.brand.green },
  progressLabel: { fontSize: TYPOGRAPHY.size.xs, color: COLORS.text.tertiary, textAlign: 'right' },

  // Bottom row
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountText: { fontSize: TYPOGRAPHY.size.lg, fontWeight: TYPOGRAPHY.weight.extrabold,
fontFamily: 'PlusJakartaSans_800ExtraBold', color: COLORS.text.primary },
  detayRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  detayText: { fontSize: TYPOGRAPHY.size.sm, color: COLORS.text.secondary },
});
