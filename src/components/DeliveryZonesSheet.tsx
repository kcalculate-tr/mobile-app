import React, { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MapPin } from 'phosphor-react-native';
import { ActivityIndicator } from 'react-native';
import BottomSheet from './BottomSheet';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/theme';
import { formatDeliveryDaysFull } from '../utils/deliveryDays';
import {
  fetchAllDeliveryZones,
  fetchGlobalDeliverySettings,
  resolveMinOrder,
  DeliveryGlobals,
  DeliveryZoneRow,
} from '../lib/delivery';

type Tab = 'immediate' | 'scheduled';

type ZoneRow = {
  id: string;
  district: string;
  min_order: number;
  min_order_immediate: number | null;
  min_order_scheduled: number | null;
  is_active: boolean;
  allow_immediate: boolean;
  allow_scheduled: boolean;
  delivery_days: number[] | null;
  delivery_days_immediate: number[] | null;
  delivery_days_scheduled: number[] | null;
};

type DistrictGroup = {
  district: string;
  minOrderImmediate: number;
  minOrderScheduled: number;
  deliveryDaysImmediate: number[] | null;
  deliveryDaysScheduled: number[] | null;
};

function sanitizeDays(arr: unknown): number[] | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const out = arr
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 6);
  return out.length > 0 ? out : null;
}

function groupByDistrict(
  zones: ZoneRow[],
  globals: DeliveryGlobals | null,
): DistrictGroup[] {
  const rowMap = new Map<string, ZoneRow>();
  const immediateMap = new Map<string, number[] | null>();
  const scheduledMap = new Map<string, number[] | null>();
  zones.forEach(z => {
    // Keep the row with the smallest resolved immediate min-order so the
    // displayed amount is a reasonable "starting at" value when multiple
    // neighbourhood rows exist for the same district.
    const existing = rowMap.get(z.district);
    const currentImmediate = resolveMinOrder(z as DeliveryZoneRow, globals, 'immediate');
    if (!existing || currentImmediate < resolveMinOrder(existing as DeliveryZoneRow, globals, 'immediate')) {
      rowMap.set(z.district, z);
    }
    // Fallback chain: new typed column → legacy delivery_days → null (unknown).
    const legacy = sanitizeDays(z.delivery_days);
    if (!immediateMap.has(z.district)) {
      immediateMap.set(z.district, sanitizeDays(z.delivery_days_immediate) ?? legacy);
    }
    if (!scheduledMap.has(z.district)) {
      scheduledMap.set(z.district, sanitizeDays(z.delivery_days_scheduled) ?? legacy);
    }
  });
  return Array.from(rowMap.entries())
    .map(([district, row]) => ({
      district,
      minOrderImmediate: resolveMinOrder(row as DeliveryZoneRow, globals, 'immediate'),
      minOrderScheduled: resolveMinOrder(row as DeliveryZoneRow, globals, 'scheduled'),
      deliveryDaysImmediate: immediateMap.get(district) ?? null,
      deliveryDaysScheduled: scheduledMap.get(district) ?? null,
    }))
    .sort((a, b) => a.district.localeCompare(b.district, 'tr'));
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

const DeliveryZonesSheet = React.memo(function DeliveryZonesSheet({ visible, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('immediate');
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [globals, setGlobals] = useState<DeliveryGlobals | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    setLoading(true);

    (async () => {
      try {
        const [zoneRows, globalsRes] = await Promise.all([
          // Paginated — a single .select() stops at PostgREST's 1000-row cap and
          // would lose late-alphabetical districts once delivery_zones grows.
          // allow_immediate/scheduled filter is pushed to the server to minimize
          // payload, then client also filters by active tab below.
          fetchAllDeliveryZones<ZoneRow>({
            select: 'district, min_order, min_order_immediate, min_order_scheduled, allow_immediate, allow_scheduled, delivery_days, delivery_days_immediate, delivery_days_scheduled',
            applyFilters: (q) => q.or('allow_immediate.eq.true,allow_scheduled.eq.true'),
          }),
          fetchGlobalDeliverySettings(),
        ]);
        if (mounted) {
          setZones(zoneRows);
          setGlobals(globalsRes);
        }
      } catch (e) {
        if (__DEV__) {
          console.warn('delivery_zones error:', e);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [visible]);

  const filtered = zones.filter(z =>
    tab === 'immediate' ? z.allow_immediate : z.allow_scheduled,
  );
  const grouped = groupByDistrict(filtered, globals);

  const renderItem = ({ item }: { item: DistrictGroup }) => {
    const days = tab === 'immediate' ? item.deliveryDaysImmediate : item.deliveryDaysScheduled;
    const minAmount = tab === 'immediate' ? item.minOrderImmediate : item.minOrderScheduled;
    return (
      <View style={s.row}>
        <View style={s.rowLeft}>
          <MapPin size={18} color="#999" />
          <View style={{ flex: 1 }}>
            <Text style={s.districtText} numberOfLines={1}>{item.district}</Text>
            {days && days.length > 0 ? (
              <Text style={s.deliveryDaysText} numberOfLines={1}>{formatDeliveryDaysFull(days)}</Text>
            ) : null}
          </View>
        </View>
        <Text style={s.minAmountText} numberOfLines={1}>Min ₺{minAmount.toLocaleString('tr-TR')}</Text>
      </View>
    );
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Teslimat Bölgeleri"
      showCloseButton
      contentStyle={s.contentReset}
    >
      {/* Tabs */}
      <View style={s.tabBar}>
        {([
          { key: 'immediate' as Tab, label: 'Hemen Teslim' },
          { key: 'scheduled' as Tab, label: 'Randevulu Teslim' },
        ]).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.tab, tab === t.key && s.tabActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="small" color={COLORS.brand.green} />
        </View>
      ) : grouped.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>Bu teslimat türü için henüz bölge tanımlanmamıştır.</Text>
        </View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={(item) => item.district}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        />
      )}

      {/* Footer */}
      <Text style={s.footer}>
        Minimum sipariş tutarları bölgeye göre değişiklik gösterebilir.
      </Text>
    </BottomSheet>
  );
});

export default DeliveryZonesSheet;

const s = StyleSheet.create({
  contentReset: {
    paddingHorizontal: 0,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#F97316',
  },
  tabText: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.weight.medium as '500',
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#999',
  },
  tabTextActive: {
    fontWeight: TYPOGRAPHY.weight.bold as '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  center: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#999',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 12,
  },
  districtText: {
    fontSize: 15,
    fontWeight: TYPOGRAPHY.weight.medium as '500',
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.primary,
  },
  deliveryDaysText: {
    fontSize: 11,
    color: '#878787',
    fontFamily: 'PlusJakartaSans_400Regular',
    marginTop: 2,
  },
  minAmountText: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.weight.semibold as '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#F97316',
    flexShrink: 0,
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: SPACING.lg,
  },
  footer: {
    fontSize: 12,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
});
