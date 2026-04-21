import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { type Icon, CaretLeftIcon, ShoppingCartIcon, CheckCircleIcon, ChefHatIcon, TruckIcon, ConfettiIcon, MapPinIcon, CalendarIcon, XCircleIcon } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import ScreenContainer from '../../components/ScreenContainer';
import { getSupabaseClient } from '../../lib/supabase';
import {
  formatSupabaseErrorForDevLog,
  mapSupabaseErrorToUserMessage,
} from '../../lib/supabaseErrors';
import {
  createOrderModification,
  getOrderModifications,
  type OrderModification,
  type OrderModificationType,
} from '../../lib/orders';
import { RootStackParamList } from '../../navigation/types';
import { COLORS, TYPOGRAPHY } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';

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
  scheduled_date: string | null;
  scheduled_time: string | null;
  address_id: string | null;
};

type AddressRow = {
  id: string;
  title: string;
  full_address: string;
  district: string;
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

const MODIFICATION_LABELS: Record<OrderModificationType, { pending: string; approved: string; rejected: string }> = {
  cancel: {
    pending: 'İptal Talebi Beklemede',
    approved: 'İptal Talebi Onaylandı',
    rejected: 'İptal Talebi Reddedildi',
  },
  date_change: {
    pending: 'Tarih Değişikliği Beklemede',
    approved: 'Tarih Değişikliği Onaylandı',
    rejected: 'Tarih Değişikliği Reddedildi',
  },
  address_change: {
    pending: 'Adres Değişikliği Beklemede',
    approved: 'Adres Değişikliği Onaylandı',
    rejected: 'Adres Değişikliği Reddedildi',
  },
};

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

const formatDateOnly = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
};

export function getHoursUntilDelivery(
  scheduledDate: string | null | undefined,
  scheduledTime: string | null | undefined,
): number | null {
  if (!scheduledDate) return null;
  const time = (scheduledTime && scheduledTime.trim()) || '12:00';
  // Time may come through as "HH:MM" or "HH:MM:SS"
  const timeParts = time.split(':');
  const hh = Number(timeParts[0] || 12);
  const mm = Number(timeParts[1] || 0);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;

  const [y, m, d] = scheduledDate.split('-').map((v) => Number(v));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;

  const target = new Date(y, (m || 1) - 1, d || 1, hh, mm, 0, 0);
  if (Number.isNaN(target.getTime())) return null;

  return (target.getTime() - Date.now()) / (1000 * 60 * 60);
}

export default function OrderDetailScreen() {
  const navigation = useNavigation<OrderDetailNavigationProp>();
  const route = useRoute<OrderDetailRouteProp>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { orderId } = route.params;

  const [order, setOrder] = useState<OrderDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [modifications, setModifications] = useState<OrderModification[]>([]);
  const [modifying, setModifying] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState<Date>(new Date());
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);

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
        scheduled_date: raw.scheduled_date ? String(raw.scheduled_date) : null,
        scheduled_time: raw.scheduled_time ? String(raw.scheduled_time) : null,
        address_id: raw.address_id ? String(raw.address_id) : null,
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

  const loadModifications = useCallback(async () => {
    try {
      const rows = await getOrderModifications(String(orderId));
      setModifications(rows);
    } catch (err: unknown) {
      if (__DEV__) {
        console.warn(`[order-detail] modifications load error: ${formatSupabaseErrorForDevLog(err)}`);
      }
    }
  }, [orderId]);

  useEffect(() => {
    void loadOrder();
    void loadModifications();
  }, [loadOrder, loadModifications]);

  const latestMod = modifications[0] ?? null;
  const pendingMod = useMemo(
    () => modifications.find((m) => m.status === 'pending') ?? null,
    [modifications],
  );

  const hoursUntil = order ? getHoursUntilDelivery(order.scheduled_date, order.scheduled_time) : null;
  const hasScheduled = !!order?.scheduled_date;

  const statusCfg = order
    ? (STATUS_CONFIG[order.status] ?? { bg: '#f0f0f0', color: COLORS.text.secondary })
    : { bg: '#f0f0f0', color: COLORS.text.secondary };
  const statusLabel = order ? (STATUS_LABELS[order.status] ?? order.status) : '';
  const trackingProgress = order ? getTrackingProgress(order.status) : -1;
  const isCancelled = order?.status === 'cancelled' || order?.status === 'payment_failed';
  const isTerminal = isCancelled || order?.status === 'delivered' || order?.status === 'refunded';

  const canShowCancelAndDate = !!order && !isTerminal && hasScheduled && hoursUntil !== null && hoursUntil >= 48;
  const canShowAddressOnly = !!order && !isTerminal && hasScheduled && hoursUntil !== null && hoursUntil < 48;

  const handleCancelPress = useCallback(() => {
    if (!order) return;
    Alert.alert(
      'Siparişi İptal Et',
      'Bu sipariş için iptal talebi oluşturmak istediğinizden emin misiniz? Talebiniz ekibimiz tarafından incelenecektir.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'İptal Talebi Gönder',
          style: 'destructive',
          onPress: async () => {
            setModifying(true);
            try {
              await createOrderModification({ orderId: String(order.id), type: 'cancel' });
              await loadModifications();
              Alert.alert(
                'Talebiniz Alındı',
                'İptal talebiniz oluşturuldu. KCAL onayladığında bilgilendirileceksiniz.',
              );
            } catch (err: unknown) {
              Alert.alert(
                'Hata',
                mapSupabaseErrorToUserMessage(err, 'İptal talebi oluşturulamadı. Lütfen tekrar deneyin.'),
              );
            } finally {
              setModifying(false);
            }
          },
        },
      ],
    );
  }, [order, loadModifications]);

  const handleDateChangeSubmit = useCallback(
    async (nextDate: Date) => {
      if (!order) return;
      const y = nextDate.getFullYear();
      const m = String(nextDate.getMonth() + 1).padStart(2, '0');
      const d = String(nextDate.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${d}`;
      setModifying(true);
      try {
        await createOrderModification({
          orderId: String(order.id),
          type: 'date_change',
          newScheduledDate: iso,
          newScheduledTime: order.scheduled_time ?? undefined,
        });
        await loadModifications();
        Alert.alert(
          'Talebiniz Alındı',
          'Tarih değişikliği talebiniz oluşturuldu. KCAL onayladığında bilgilendirileceksiniz.',
        );
      } catch (err: unknown) {
        Alert.alert(
          'Hata',
          mapSupabaseErrorToUserMessage(err, 'Tarih değişikliği talebi oluşturulamadı.'),
        );
      } finally {
        setModifying(false);
      }
    },
    [order, loadModifications],
  );

  const openDatePicker = useCallback(() => {
    if (!order) return;
    // start at current scheduled date + 1 day as sensible default
    const base = order.scheduled_date ? new Date(order.scheduled_date) : new Date();
    base.setDate(base.getDate() + 1);
    setDatePickerValue(base);
    setShowDatePicker(true);
  }, [order]);

  const onDatePickerChange = useCallback(
    (_event: unknown, selected?: Date) => {
      if (Platform.OS === 'android') {
        setShowDatePicker(false);
        if (selected) {
          void handleDateChangeSubmit(selected);
        }
        return;
      }
      if (selected) setDatePickerValue(selected);
    },
    [handleDateChangeSubmit],
  );

  const confirmIOSDate = useCallback(() => {
    setShowDatePicker(false);
    void handleDateChangeSubmit(datePickerValue);
  }, [datePickerValue, handleDateChangeSubmit]);

  const openAddressSheet = useCallback(async () => {
    if (!user) return;
    setAddressSheetOpen(true);
    setAddressesLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('addresses')
        .select('id, title, full_address, district')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows: AddressRow[] = (Array.isArray(data) ? data : []).map((row) => ({
        id: String((row as Record<string, unknown>).id ?? ''),
        title: String((row as Record<string, unknown>).title ?? 'Adres'),
        full_address: String((row as Record<string, unknown>).full_address ?? ''),
        district: String((row as Record<string, unknown>).district ?? ''),
      }));
      setAddresses(rows.filter((r) => r.id));
    } catch (err: unknown) {
      if (__DEV__) {
        console.warn(`[order-detail] addresses load error: ${formatSupabaseErrorForDevLog(err)}`);
      }
      Alert.alert('Hata', mapSupabaseErrorToUserMessage(err, 'Adresler yüklenemedi.'));
    } finally {
      setAddressesLoading(false);
    }
  }, [user]);

  const handleAddressPick = useCallback(
    async (addr: AddressRow) => {
      if (!order) return;
      setAddressSheetOpen(false);
      setModifying(true);
      try {
        await createOrderModification({
          orderId: String(order.id),
          type: 'address_change',
          newAddressId: addr.id,
          newAddressText: addr.full_address,
        });
        await loadModifications();
        Alert.alert(
          'Talebiniz Alındı',
          'Adres değişikliği talebiniz oluşturuldu. KCAL onayladığında bilgilendirileceksiniz.',
        );
      } catch (err: unknown) {
        Alert.alert(
          'Hata',
          mapSupabaseErrorToUserMessage(err, 'Adres değişikliği talebi oluşturulamadı.'),
        );
      } finally {
        setModifying(false);
      }
    },
    [order, loadModifications],
  );

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
            {/* Modification status banner */}
            {latestMod && (
              <View style={[s.modBanner, modBannerStyle(latestMod.status)]}>
                <Text style={[s.modBannerTitle, { color: modBannerColor(latestMod.status) }]}>
                  {MODIFICATION_LABELS[latestMod.type][latestMod.status]}
                </Text>
                {latestMod.status === 'rejected' && latestMod.reject_reason ? (
                  <Text style={s.modBannerBody}>Neden: {latestMod.reject_reason}</Text>
                ) : null}
                {latestMod.type === 'date_change' && latestMod.new_scheduled_date ? (
                  <Text style={s.modBannerBody}>
                    Yeni tarih: {formatDateOnly(latestMod.new_scheduled_date)}
                    {latestMod.new_scheduled_time ? ` • ${latestMod.new_scheduled_time.slice(0, 5)}` : ''}
                  </Text>
                ) : null}
                {latestMod.type === 'address_change' && latestMod.new_address_text ? (
                  <Text style={s.modBannerBody}>Yeni adres: {latestMod.new_address_text}</Text>
                ) : null}
              </View>
            )}

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
              {order.scheduled_date ? (
                <Text style={s.dateText}>
                  Randevu: {formatDateOnly(order.scheduled_date)}
                  {order.scheduled_time ? ` • ${order.scheduled_time.slice(0, 5)}` : ''}
                </Text>
              ) : null}
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

            {/* Modification actions */}
            {!isTerminal && (pendingMod || canShowCancelAndDate || canShowAddressOnly) && (
              <View style={s.card}>
                <Text style={s.sectionTitle}>Sipariş Değişikliği</Text>
                {pendingMod ? (
                  <View style={[s.pendingPill]}>
                    <Text style={s.pendingPillText}>
                      {MODIFICATION_LABELS[pendingMod.type].pending}
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {canShowCancelAndDate && (
                      <>
                        <TouchableOpacity
                          style={[s.modBtn, s.modBtnDanger]}
                          onPress={handleCancelPress}
                          disabled={modifying}
                          activeOpacity={0.85}
                        >
                          <XCircleIcon size={18} color="#DC2626" />
                          <Text style={[s.modBtnText, { color: '#DC2626' }]}>Siparişi İptal Et</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.modBtn, s.modBtnGray]}
                          onPress={openDatePicker}
                          disabled={modifying}
                          activeOpacity={0.85}
                        >
                          <CalendarIcon size={18} color={COLORS.text.primary} />
                          <Text style={[s.modBtnText, { color: COLORS.text.primary }]}>Tarih Değiştir</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {canShowAddressOnly && (
                      <TouchableOpacity
                        style={[s.modBtn, s.modBtnGray]}
                        onPress={openAddressSheet}
                        disabled={modifying}
                        activeOpacity={0.85}
                      >
                        <MapPinIcon size={18} color={COLORS.text.primary} />
                        <Text style={[s.modBtnText, { color: COLORS.text.primary }]}>Adres Değiştir</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}
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

          {/* Date picker */}
          {showDatePicker && Platform.OS === 'android' && (
            <DateTimePicker
              mode="date"
              display="default"
              value={datePickerValue}
              minimumDate={new Date(Date.now() + 48 * 60 * 60 * 1000)}
              onChange={onDatePickerChange}
            />
          )}
          {Platform.OS === 'ios' && (
            <Modal
              visible={showDatePicker}
              transparent
              animationType="fade"
              onRequestClose={() => setShowDatePicker(false)}
            >
              <Pressable style={s.sheetBackdrop} onPress={() => setShowDatePicker(false)} />
              <View style={[s.sheet, { paddingBottom: Math.max(16, insets.bottom) }]}>
                <View style={s.sheetHandle} />
                <Text style={s.sheetTitle}>Yeni Tarih Seç</Text>
                <DateTimePicker
                  mode="date"
                  display="spinner"
                  value={datePickerValue}
                  minimumDate={new Date(Date.now() + 48 * 60 * 60 * 1000)}
                  onChange={onDatePickerChange}
                />
                <View style={s.sheetActions}>
                  <TouchableOpacity
                    style={[s.sheetBtn, s.sheetBtnGhost]}
                    onPress={() => setShowDatePicker(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.sheetBtnGhostText}>Vazgeç</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.sheetBtn, s.sheetBtnPrimary]}
                    onPress={confirmIOSDate}
                    activeOpacity={0.85}
                  >
                    <Text style={s.sheetBtnPrimaryText}>Onayla</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          )}

          {/* Address sheet */}
          <Modal
            visible={addressSheetOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setAddressSheetOpen(false)}
          >
            <Pressable style={s.sheetBackdrop} onPress={() => setAddressSheetOpen(false)} />
            <View style={[s.sheet, { paddingBottom: Math.max(16, insets.bottom) }]}>
              <View style={s.sheetHandle} />
              <Text style={s.sheetTitle}>Yeni Adres Seç</Text>
              {addressesLoading ? (
                <ActivityIndicator color={COLORS.brand.green} style={{ padding: 24 }} />
              ) : addresses.length === 0 ? (
                <Text style={s.emptyText}>Kayıtlı adres bulunamadı.</Text>
              ) : (
                <ScrollView style={{ maxHeight: 360 }}>
                  {addresses.map((addr) => (
                    <TouchableOpacity
                      key={addr.id}
                      style={s.addrRow}
                      onPress={() => void handleAddressPick(addr)}
                      activeOpacity={0.85}
                    >
                      <MapPinIcon size={18} color={COLORS.text.primary} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.addrTitle}>{addr.title}</Text>
                        <Text style={s.addrSub} numberOfLines={2}>{addr.full_address}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              <TouchableOpacity
                style={[s.sheetBtn, s.sheetBtnGhost, { marginTop: 12 }]}
                onPress={() => setAddressSheetOpen(false)}
                activeOpacity={0.8}
              >
                <Text style={s.sheetBtnGhostText}>Vazgeç</Text>
              </TouchableOpacity>
            </View>
          </Modal>
        </>
      )}
    </ScreenContainer>
  );
}

const modBannerStyle = (status: string) => {
  if (status === 'pending') {
    return {
      backgroundColor: '#FFEDD5',
      borderColor: COLORS.brand.green,
    };
  }
  if (status === 'approved') {
    return {
      backgroundColor: '#DCFCE7',
      borderColor: '#22C55E',
    };
  }
  return {
    backgroundColor: '#FEE2E2',
    borderColor: '#DC2626',
  };
};

const modBannerColor = (status: string) => {
  if (status === 'pending') return '#EA580C';
  if (status === 'approved') return '#166534';
  return '#B91C1C';
};

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

  // Modification banner
  modBanner: {
    borderRadius: 16, padding: 14, gap: 4,
    borderWidth: 1,
  },
  modBannerTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  modBannerBody: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.text.primary,
  },

  // Mod action buttons
  modBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 100, borderWidth: 1,
  },
  modBtnDanger: { borderColor: '#DC2626', backgroundColor: 'transparent' },
  modBtnGray: { borderColor: '#D1D5DB', backgroundColor: 'transparent' },
  modBtnText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  pendingPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFEDD5',
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pendingPillText: {
    color: '#EA580C',
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
  },

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

  // Sheet
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 14,
    gap: 12,
  },
  sheetHandle: {
    width: 40, height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  sheetActions: { flexDirection: 'row', gap: 10 },
  sheetBtn: {
    flex: 1, height: 48, borderRadius: 100,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetBtnPrimary: { backgroundColor: COLORS.brand.green },
  sheetBtnPrimaryText: {
    color: COLORS.text.primary,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
  },
  sheetBtnGhost: { borderWidth: 1, borderColor: '#E5E7EB' },
  sheetBtnGhostText: {
    color: COLORS.text.primary,
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
  },

  addrRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  addrTitle: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  addrSub: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.text.tertiary,
    marginTop: 2,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.size.sm,
    color: COLORS.text.tertiary,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
