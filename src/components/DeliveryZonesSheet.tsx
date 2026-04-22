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
import { getSupabaseClient } from '../lib/supabase';
import { COLORS, TYPOGRAPHY, SPACING } from '../constants/theme';
import { formatDeliveryDays } from '../utils/deliveryDays';

type Tab = 'immediate' | 'scheduled';

type ZoneRow = {
  id: string;
  district: string;
  min_order: number;
  is_active: boolean;
  allow_immediate: boolean;
  allow_scheduled: boolean;
  delivery_days: number[] | null;
  delivery_days_immediate: number[] | null;
  delivery_days_scheduled: number[] | null;
};

type DistrictGroup = {
  district: string;
  minAmount: number;
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

function groupByDistrict(zones: ZoneRow[]): DistrictGroup[] {
  const minMap = new Map<string, number>();
  const immediateMap = new Map<string, number[] | null>();
  const scheduledMap = new Map<string, number[] | null>();
  zones.forEach(z => {
    const current = minMap.get(z.district);
    const amount = Number(z.min_order) || 0;
    if (current === undefined || amount < current) {
      minMap.set(z.district, amount);
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
  return Array.from(minMap.entries())
    .map(([district, minAmount]) => ({
      district,
      minAmount,
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    setLoading(true);

    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('delivery_zones')
          .select('district, min_order, allow_immediate, allow_scheduled, delivery_days, delivery_days_immediate, delivery_days_scheduled')
          .or('allow_immediate.eq.true,allow_scheduled.eq.true')
          .order('district');
        if (__DEV__ && error) {
          console.warn('delivery_zones error:', error.message);
        }
        if (mounted && data) setZones(data as ZoneRow[]);
      } catch {
        // silently fail
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [visible]);

  const filtered = zones.filter(z =>
    tab === 'immediate' ? z.allow_immediate : z.allow_scheduled,
  );
  const grouped = groupByDistrict(filtered);

  const renderItem = ({ item }: { item: DistrictGroup }) => {
    const days = tab === 'immediate' ? item.deliveryDaysImmediate : item.deliveryDaysScheduled;
    return (
      <View style={s.row}>
        <View style={s.rowLeft}>
          <MapPin size={18} color="#999" />
          <View style={{ flex: 1 }}>
            <Text style={s.districtText} numberOfLines={1}>{item.district}</Text>
            {days && days.length > 0 ? (
              <Text style={s.deliveryDaysText} numberOfLines={1}>{formatDeliveryDays(days)}</Text>
            ) : null}
          </View>
        </View>
        <Text style={s.minAmountText} numberOfLines={1}>Min ₺{item.minAmount.toLocaleString('tr-TR')}</Text>
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
