// eatkcal v2 (G13-S2 md.5) — FinEkInfo: "Nerelere teslimat yapıyoruz?"
// Sekmeler: Teslimat · (SSS) · Bölgeler.
//
// VERİ MEVCUT KAYNAKTAN (bugünkü DeliveryZonesSheet ile aynı sorgu/kural):
//  - bölgeler: `fetchAllDeliveryZones` + `is_active=true` + (hemen|planlı) filtresi
//    (DeliveryZonesSheet.tsx:100-112), ilçe özeti `ilceleriOzetle` (:57-86)
//  - global ücret/minimum: `fetchGlobalDeliverySettings` (src/lib/delivery.ts)
//  - süre: `formatEstimatedDelivery` (deliveryRules) — veri yoksa gösterilmez
//  - Gel-Al şubeleri: `fetchBranches` (src/lib/branches.ts)
//  - İzmir haritası: `IzmirTeslimatHaritasi` (açık ilçeler canlı veriden)
// SSS (G15-S5 md.3): uygulamadaki mevcut SSS metni (HowItWorksModal "Sipariş ve
//   Teslimat" bölümü) → i18n `eatkcal.v2.faq.q1..q5`; Final'deki 5 açılır satır.
// "Çok yakında" listesi ve soğuk zincir notu bugünkü sheet'te de SABİT metin
// (iş vaadi, DB durumu değil — DeliveryZonesSheet.tsx:168-176).
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Sheet, haptic } from '../../../../core/design';
import { Clock, CalendarBlank, Storefront, Fire, Snowflake, CaretDown } from '../../../../components/icons';
import IzmirTeslimatHaritasi from '../../../../components/IzmirTeslimatHaritasi';
import { ilceleriOzetle } from '../../../../components/DeliveryZonesSheet';
import {
  fetchAllDeliveryZones,
  fetchGlobalDeliverySettings,
  type DeliveryGlobals,
  type DeliveryZoneRow,
} from '../../../../lib/delivery';
import { fetchBranches, type Branch } from '../../../../lib/branches';
import { tlGruplu } from '../../../../lib/money';
import { ekType, useEk } from './kit';
import { commonImmediateEta, immediateDeliveryFree, minOrderSummary } from '../model/addressInfo';

type ZoneRow = DeliveryZoneRow & {
  district: string;
  is_active: boolean | null;
  allow_immediate: boolean | null;
  allow_scheduled: boolean | null;
};

export type EkInfoTab = 'delivery' | 'faq' | 'zones';
type Tab = EkInfoTab;

const FAQ_KEYS = [1, 2, 3, 4, 5] as const;

function FaqItem({ n }: { n: number }) {
  const { c, t } = useEk();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.faq, { borderBottomColor: c.line }]}>
      <Pressable
        onPress={() => {
          haptic('selection');
          setOpen((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.faqHead}
        testID={`ek-info-faq-${n}`}
      >
        <Text style={[ekType.b15s, { color: c.ink, flex: 1 }]}>{t(`eatkcal.v2.faq.q${n}`)}</Text>
        <CaretDown size={14} color={c.secondary} style={open ? { transform: [{ rotate: '180deg' }] } : undefined} />
      </Pressable>
      {open ? <Text style={[ekType.c13, { color: c.secondary, marginBottom: 8 }]}>{t(`eatkcal.v2.faq.a${n}`)}</Text> : null}
    </View>
  );
}

export function EkInfoSheet({
  visible,
  onClose,
  initialTab = 'delivery',
}: {
  visible: boolean;
  onClose: () => void;
  /** Açılış sekmesi (vitrin FinEkInfo: 'zones'). */
  initialTab?: Tab;
}) {
  const { c, t, theme } = useEk();
  const [tab, setTab] = useState<Tab>(initialTab);
  const { height: winH } = useWindowDimensions();
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [globals, setGlobals] = useState<DeliveryGlobals | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let mounted = true;
    setLoading(true);
    setFailed(false);
    (async () => {
      try {
        const [rows, g, b] = await Promise.all([
          fetchAllDeliveryZones<ZoneRow>({
            applyFilters: (q) => q.eq('is_active', true).or('allow_immediate.eq.true,allow_scheduled.eq.true'),
          }),
          fetchGlobalDeliverySettings(),
          fetchBranches().catch(() => [] as Branch[]),
        ]);
        if (!mounted) return;
        setZones(rows);
        setGlobals(g);
        setBranches(b.filter((x) => x.name));
      } catch (e) {
        if (__DEV__) console.warn('[EkInfoSheet] delivery_zones error:', e);
        if (mounted) setFailed(true);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [visible]);

  const ozet = useMemo(() => ilceleriOzetle(zones, globals), [zones, globals]);
  const fastDistricts = useMemo(() => ozet.filter((i) => i.hizli), [ozet]);
  const eta = useMemo(() => commonImmediateEta(zones), [zones]);
  const free = useMemo(() => immediateDeliveryFree(zones, globals), [zones, globals]);
  const minOrder = useMemo(() => minOrderSummary(fastDistricts.map((d) => d.minHizli)), [fastDistricts]);

  const nowBody = [eta ? t('eatkcal.v2.info.now_body_eta', { eta }) : t('eatkcal.v2.info.now_body'), free ? t('eatkcal.v2.info.free_suffix') : '']
    .filter(Boolean)
    .join(' · ');
  const branchNames = branches.map((b) => b.name).join(t('eatkcal.v2.info.pickup_join'));

  const rows: { key: string; Icon: typeof Clock; title: string; body: string }[] = [
    { key: 'now', Icon: Clock, title: t('eatkcal.v2.info.now_title'), body: nowBody },
    { key: 'scheduled', Icon: CalendarBlank, title: t('eatkcal.v2.info.scheduled_title'), body: t('eatkcal.v2.info.scheduled_body') },
    ...(branchNames
      ? [{ key: 'pickup', Icon: Storefront, title: t('eatkcal.v2.info.pickup_title'), body: t('eatkcal.v2.info.pickup_body', { branches: branchNames }) }]
      : []),
    { key: 'hot', Icon: Fire, title: t('eatkcal.v2.info.hot_title'), body: t('eatkcal.v2.info.hot_body') },
    { key: 'cold', Icon: Snowflake, title: t('eatkcal.v2.info.cold_title'), body: t('eatkcal.v2.info.cold_body') },
  ];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'delivery', label: t('eatkcal.v2.info.tab_delivery') },
    { key: 'faq', label: t('eatkcal.v2.info.tab_faq') },
    { key: 'zones', label: t('eatkcal.v2.info.tab_zones') },
  ];

  return (
    <Sheet visible={visible} onClose={onClose} title={t('eatkcal.v2.info.title')} product="eat" maxHeightRatio={0.88}>
      {/* G15-S5: Final sheet sabit yükseklikte (~%85); sekme değişince zıplamaz. */}
      <View style={{ minHeight: winH * 0.85 - 150 }}>
      <View style={[styles.tabs, { backgroundColor: c.line }]} accessibilityRole="tablist">
        {tabs.map((x) => {
          const on = tab === x.key;
          return (
            <Pressable
              key={x.key}
              onPress={() => {
                haptic('selection');
                setTab(x.key);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.tab, { backgroundColor: on ? c.surface : 'transparent' }]}
              testID={`ek-info-tab-${x.key}`}
            >
              <Text style={[ekType.b15s, { color: c.ink, fontSize: 14 }]}>{x.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'faq' ? (
        <View testID="ek-info-faq">
          {FAQ_KEYS.map((n) => (
            <FaqItem key={n} n={n} />
          ))}
        </View>
      ) : tab === 'delivery' ? (
        <View testID="ek-info-delivery">
          {rows.map(({ key, Icon, title, body }) => (
            <View key={key} style={[styles.infoRow, { borderBottomColor: c.line }]}>
              <Icon size={22} color={c.ink} />
              <View style={styles.infoText}>
                <Text style={[ekType.b15s, { color: c.ink }]}>{title}</Text>
                <Text style={[ekType.c13, { color: c.secondary }]}>{body}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.zones} testID="ek-info-zones">
          <View style={styles.mapBox}>
            <IzmirTeslimatHaritasi height={170} acikIlceler={fastDistricts.map((d) => d.district)} />
            {/* G15-S5 (FinEkInfo-Dark): ortak harita bileşeni sabit açık renkli → koyu temada karartma katmanı. */}
            {theme.isDark ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.42)' }]} /> : null}
          </View>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={c.ink} />
            </View>
          ) : failed || fastDistricts.length === 0 ? (
            <Text style={[ekType.c13, { color: c.secondary }]}>{t('eatkcal.v2.info.load_failed')}</Text>
          ) : (
            <>
              <Text style={[ekType.c13s, { color: c.secondary }]}>
                {eta ? t('eatkcal.v2.info.zones_now_eta', { eta }) : t('eatkcal.v2.info.zones_now')}
              </Text>
              <View style={styles.chips}>
                {fastDistricts.map((d) => (
                  <View key={d.district} style={[styles.chip, { backgroundColor: c.surface, borderColor: c.line }]}>
                    <Text style={[ekType.b15s, { color: c.ink }]}>{d.district}</Text>
                  </View>
                ))}
              </View>
              {minOrder != null ? (
                <View style={styles.kv}>
                  <Text style={[ekType.b15, { color: c.ink, fontSize: 14 }]}>{t('eatkcal.v2.info.min_order')}</Text>
                  <Text style={[ekType.b15s, ekType.num, { color: c.ink, fontSize: 14 }]}>
                    {minOrder === 'varies' ? t('eatkcal.v2.info.min_order_varies') : tlGruplu(minOrder)}
                  </Text>
                </View>
              ) : null}
            </>
          )}
          <Text style={[ekType.c13, { color: c.secondary }]}>
            <Text style={[ekType.c13s, { color: c.ink }]}>{t('eatkcal.v2.info.soon_label')} </Text>
            {t('eatkcal.v2.info.soon_list')}
          </Text>
          <Text style={[ekType.c13, { color: c.secondary }]}>{t('eatkcal.v2.info.others')}</Text>
        </View>
      )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 22, marginBottom: 4 },
  tab: { flex: 1, minHeight: 44, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  infoRow: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  infoText: { flex: 1, gap: 2 },
  zones: { gap: 10, paddingTop: 8, paddingBottom: 8 },
  // Harita SVG'si oranını korur (meet); kenar boşluğu harita zemin rengiyle dolar → tam genişlik.
  mapBox: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#F7F9F5' },
  center: { paddingVertical: 16, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 32, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, justifyContent: 'center' },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  faq: { paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  faqHead: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
