// eatkcal v2 (G13-S2 md.6) — Siparişlerim (FinEkOrders / FinEkOrdersEmpty /
// FinEkOrdersFilterEmpty). Veri: bugünkü OrdersScreen'in sorgusu (ordersData.ts)
// + mevcut getPendingModificationsForUser (src/lib/orders.ts). Yalnız okur.
// Bayrak `yeni_siparis` kapalıyken bu ekran kayıtlı değildir.
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../../../core/AuthContext';
import { useRequireAuth } from '../../../../hooks/useRequireAuth';
import { haptic } from '../../../../core/design';
import { Receipt, Package, WarningCircle } from '../../../../components/icons';
import { formatSupabaseErrorForDevLog } from '../../../../lib/supabaseErrors';
import { getPendingModificationsForUser, type OrderModificationType } from '../../../../lib/orders';
import { useEkNav } from '../nav';
import { EkHeader, EkScreen, EkSkeleton, ekType, money, useEk } from '../ui/kit';
import { EkStateCard, OrderStatusBadge } from '../ui/orders/OrdersParts';
import {
  ORDERS_FILTERS,
  filterOrders,
  orderCodeLabel,
  ordersViewState,
  type OrderListRow,
  type OrdersFilter,
} from '../model/orders';
import { fetchOrdersForList } from '../model/ordersData';

const FILTER_KEY: Record<OrdersFilter, string> = {
  all: 'eatkcal.v2.orders.filter_all',
  active: 'eatkcal.v2.orders.filter_active',
  past: 'eatkcal.v2.orders.filter_past',
  cancelled: 'eatkcal.v2.orders.filter_cancelled',
};

export function formatOrderDate(iso: string, lang: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function EkOrdersScreen() {
  const navigation = useEkNav();
  const { c, t, lang } = useEk();
  const { user } = useAuth();
  const { isAuthenticated } = useRequireAuth();

  const [filter, setFilter] = useState<OrdersFilter>('all');
  const [orders, setOrders] = useState<OrderListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingMods, setPendingMods] = useState<Record<string, OrderModificationType>>({});

  const load = useCallback(async () => {
    if (!user) return;
    setFailed(false);
    try {
      setOrders(await fetchOrdersForList(user.id));
      try {
        const mods = await getPendingModificationsForUser(user.id);
        const map: Record<string, OrderModificationType> = {};
        mods.forEach((mod) => {
          if (!map[mod.order_id]) map[mod.order_id] = mod.type;
        });
        setPendingMods(map);
      } catch (modErr: unknown) {
        if (__DEV__) console.warn(`[ek-orders] pending modifications: ${formatSupabaseErrorForDevLog(modErr)}`);
      }
    } catch (error: unknown) {
      if (__DEV__) console.warn(`[ek-orders] load: ${formatSupabaseErrorForDevLog(error)}`);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // İlk odakta yükler; detaydan dönünce (değerlendirme/tekrar sipariş sonrası)
  // liste tazelenir.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const view = ordersViewState(orders, filter);
  const visible = useMemo(() => filterOrders(orders, filter), [orders, filter]);

  if (!isAuthenticated) return null;

  const header = <EkHeader title={t('eatkcal.v2.orders.title')} onBack={() => navigation.goBack()} right={<View style={{ width: 44 }} />} />;

  return (
    <EkScreen
      header={header}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.secondary} />}
      testID="ek-orders"
    >
      {/* Filtre çipleri — veri varken (boş durumda panoda çip yok). */}
      {!loading && !failed && view !== 'empty' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          accessibilityRole="tablist"
        >
          {ORDERS_FILTERS.map((f) => {
            const on = f === filter;
            return (
              <Pressable
                key={f}
                onPress={() => {
                  haptic('selection');
                  setFilter(f);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                hitSlop={{ top: 4, bottom: 4 }}
                testID={`ek-orders-filter-${f}`}
                style={[
                  styles.chip,
                  on ? { backgroundColor: c.accent } : { backgroundColor: c.surface, borderColor: c.line, borderWidth: 1 },
                ]}
              >
                <Text style={[styles.chipText, { color: on ? c.onAccent : c.ink }]}>{t(FILTER_KEY[f])}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.list}>
        {loading ? (
          [0, 1, 2, 3].map((i) => <EkSkeleton key={i} height={80} radius={20} />)
        ) : failed ? (
          <View style={styles.stateWrap}>
            <EkStateCard
              icon={<WarningCircle size={24} color={c.ink} />}
              title={t('eatkcal.v2.orders.error_title')}
              body={t('eatkcal.v2.orders.error_body')}
              action={t('eatkcal.v2.orders.error_action')}
              onAction={() => {
                setLoading(true);
                void load();
              }}
              testID="ek-orders-error"
            />
          </View>
        ) : view === 'empty' ? (
          <View style={styles.stateWrap}>
            <EkStateCard
              icon={<Receipt size={24} color={c.ink} />}
              title={t('eatkcal.v2.orders.empty_title')}
              body={t('eatkcal.v2.orders.empty_body')}
              action={t('eatkcal.v2.orders.empty_action')}
              onAction={() => navigation.navigate('Tabs', { screen: 'Home' })}
              testID="ek-orders-empty"
            />
          </View>
        ) : view === 'filter_empty' ? (
          <View style={styles.stateWrap}>
            <EkStateCard
              icon={<Package size={24} color={c.ink} />}
              title={t('eatkcal.v2.orders.filter_empty_title')}
              body={t('eatkcal.v2.orders.filter_empty_body')}
              action={t('eatkcal.v2.orders.filter_empty_action')}
              onAction={() => setFilter('all')}
              testID="ek-orders-filter-empty"
            />
          </View>
        ) : (
          visible.map((order) => {
            const mod = pendingMods[String(order.id)];
            return (
              <Pressable
                key={order.id}
                onPress={() => navigation.navigate('EkOrderDetail', { orderId: order.id })}
                accessibilityRole="button"
                testID={`ek-order-row-${order.id}`}
                style={({ pressed }) => [styles.row, { backgroundColor: c.surface }, pressed && { opacity: 0.85 }]}
              >
                <View style={styles.rowBody}>
                  <Text style={[ekType.b15s, { color: c.ink, fontFamily: 'PlusJakartaSans_700Bold' }]} numberOfLines={1}>
                    {orderCodeLabel(order)}
                  </Text>
                  <Text style={[ekType.c13, { color: c.secondary }]} numberOfLines={1}>
                    {t('eatkcal.v2.orders.row_meta', {
                      date: formatOrderDate(order.created_at, lang),
                      amount: money(order.total_amount),
                    })}
                  </Text>
                  {mod ? (
                    <Text style={[ekType.c13s, { color: c.secondary }]} numberOfLines={1}>
                      {t(`eatkcal.v2.orders.mod_pending.${mod}`)}
                    </Text>
                  ) : null}
                </View>
                <OrderStatusBadge status={order.status} />
              </Pressable>
            );
          })
        )}
      </View>
    </EkScreen>
  );
}

const styles = StyleSheet.create({
  chips: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 2, gap: 8 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 14 },
  list: { paddingHorizontal: 16, paddingTop: 10, gap: 10 },
  stateWrap: { marginTop: 120 },
  row: { padding: 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 80 },
  rowBody: { flex: 1, gap: 2 },
});
