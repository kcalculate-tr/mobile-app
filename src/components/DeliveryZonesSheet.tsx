import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, MapPin } from 'phosphor-react-native';
import { ActivityIndicator } from 'react-native';
import { getSupabaseClient } from '../lib/supabase';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../constants/theme';

type Tab = 'immediate' | 'scheduled';

type ZoneRow = {
  id: string;
  district: string;
  min_order: number;
  is_active: boolean;
  allow_immediate: boolean;
  allow_scheduled: boolean;
};

type DistrictGroup = {
  district: string;
  minAmount: number;
};

function groupByDistrict(zones: ZoneRow[]): DistrictGroup[] {
  const map = new Map<string, number>();
  zones.forEach(z => {
    const current = map.get(z.district);
    const amount = Number(z.min_order) || 0;
    if (current === undefined || amount < current) {
      map.set(z.district, amount);
    }
  });
  return Array.from(map.entries())
    .map(([district, minAmount]) => ({ district, minAmount }))
    .sort((a, b) => a.district.localeCompare(b.district, 'tr'));
}

type Props = {
  visible: boolean;
  onClose: () => void;
};

const DeliveryZonesSheet = React.memo(function DeliveryZonesSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
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
          .select('district, min_order, allow_immediate, allow_scheduled')
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

  const renderItem = ({ item }: { item: DistrictGroup }) => (
    <View style={s.row}>
      <View style={s.rowLeft}>
        <MapPin size={18} color="#999" />
        <Text style={s.districtText}>{item.district}</Text>
      </View>
      <Text style={s.minAmountText}>Min ₺{item.minAmount.toLocaleString('tr-TR')}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Drag handle */}
          <View style={s.handleWrap}>
            <View style={s.handle} />
          </View>

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Teslimat Bölgeleri</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <X size={22} color={COLORS.text.primary} />
            </TouchableOpacity>
          </View>

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
              contentContainerStyle={s.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}

          {/* Footer */}
          <Text style={s.footer}>
            Minimum sipariş tutarları bölgeye göre değişiklik gösterebilir.
          </Text>
        </View>
      </View>
    </Modal>
  );
});

export default DeliveryZonesSheet;

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    minHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DDD',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: 18,
    fontWeight: TYPOGRAPHY.weight.bold as '700',
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: SPACING.sm,
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
    flex: 1,
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
  listContent: {
    paddingHorizontal: SPACING.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  districtText: {
    fontSize: 15,
    fontWeight: TYPOGRAPHY.weight.medium as '500',
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.primary,
  },
  minAmountText: {
    fontSize: 14,
    fontWeight: TYPOGRAPHY.weight.semibold as '600',
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#F97316',
  },
  separator: {
    height: 1,
    backgroundColor: '#F0F0F0',
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
