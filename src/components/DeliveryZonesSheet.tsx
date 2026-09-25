import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import BottomSheet from './BottomSheet';
import IzmirTeslimatHaritasi from './IzmirTeslimatHaritasi';
import { COLORS, SPACING } from '../constants/theme';
import { formatDeliveryDaysFull } from '../utils/deliveryDays';
import {
  fetchAllDeliveryZones,
  fetchGlobalDeliverySettings,
  resolveMinOrder,
  DeliveryGlobals,
  DeliveryZoneRow,
} from '../lib/delivery';
import { tlGruplu } from '../lib/money';

/**
 * Teslimat bölgeleri — TEK EKRAN, sekme yok.
 *
 * 25.09.2026 — neden yeniden yazıldı:
 *  1. SEKMELER KALDIRILDI. Önceki hâlde "Hemen Teslim" / "Randevulu Teslim"
 *     iki sekmeydi; müşteri kendi ilçesini görmek için doğru sekmeyi tahmin
 *     etmek zorundaydı ve iki katmanı yan yana karşılaştıramıyordu. Kafa
 *     karışıklığının kaynağı tam olarak buydu.
 *  2. is_active FİLTRESİ EKLENDİ. Eski sorgu yalnız allow_immediate /
 *     allow_scheduled'a bakıyordu. Çeşme'nin 25 mahallesi is_active=false
 *     olmasına rağmen allow_scheduled=true olduğu için listede görünüyordu —
 *     yani müşteriye teslimat yapmadığımız bir ilçeyi yapıyormuş gibi
 *     gösteriyorduk. Üç müşterinin Çeşme adresi kayıtlı.
 *  3. Minimum sipariş tutarı KORUNDU. Planlı teslimatta tutar 500 TL ile
 *     2500 TL arasında değişiyor (Konak 500, Torbalı/Urla 2500) — beş kat
 *     fark. Bunu gizlemek ikinci bir "neden sipariş veremiyorum" sorusu
 *     yaratırdı.
 */

type ZoneRow = DeliveryZoneRow & {
  district: string;
  is_active: boolean | null;
  allow_immediate: boolean | null;
  allow_scheduled: boolean | null;
  delivery_days: number[] | null;
  delivery_days_immediate: number[] | null;
  delivery_days_scheduled: number[] | null;
};

type IlceSatiri = {
  district: string;
  hizli: boolean;
  minHizli: number;
  minPlanli: number;
  planliGunler: number[] | null;
};

function gunleriTemizle(arr: unknown): number[] | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const out = arr.map(Number).filter((n) => Number.isFinite(n) && n >= 0 && n <= 6);
  return out.length > 0 ? out : null;
}

/**
 * İlçeye indirger. Bir ilçenin herhangi bir aktif mahallesinde hızlı teslimat
 * varsa ilçe hızlı sayılır. Minimum tutarda ilçedeki EN DÜŞÜK değer alınır —
 * "şu tutardan başlıyor" anlamında; ödeme ekranı adrese özel kesin tutarı
 * zaten gösteriyor.
 */
export function ilceleriOzetle(
  zones: ZoneRow[],
  globals: DeliveryGlobals | null,
): IlceSatiri[] {
  const harita = new Map<string, IlceSatiri>();

  for (const z of zones) {
    if (z.is_active !== true) continue;
    const hizliVar = z.allow_immediate === true;
    const planliVar = z.allow_scheduled === true;
    if (!hizliVar && !planliVar) continue;

    const ilce = String(z.district || '').trim();
    if (!ilce) continue;

    const minHizli = hizliVar ? resolveMinOrder(z, globals, 'immediate') : Infinity;
    const minPlanli = planliVar ? resolveMinOrder(z, globals, 'scheduled') : Infinity;
    const gunler = planliVar
      ? gunleriTemizle(z.delivery_days_scheduled) ?? gunleriTemizle(z.delivery_days)
      : null;

    const mevcut = harita.get(ilce);
    if (!mevcut) {
      harita.set(ilce, {
        district: ilce,
        hizli: hizliVar,
        minHizli,
        minPlanli,
        planliGunler: gunler,
      });
    } else {
      mevcut.hizli = mevcut.hizli || hizliVar;
      mevcut.minHizli = Math.min(mevcut.minHizli, minHizli);
      mevcut.minPlanli = Math.min(mevcut.minPlanli, minPlanli);
      mevcut.planliGunler = mevcut.planliGunler ?? gunler;
    }
  }

  return Array.from(harita.values()).sort((a, b) =>
    a.district.localeCompare(b.district, 'tr'),
  );
}

type Props = { visible: boolean; onClose: () => void };

const DeliveryZonesSheet = React.memo(function DeliveryZonesSheet({ visible, onClose }: Props) {
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
          fetchAllDeliveryZones<ZoneRow>({
            select:
              'district, is_active, min_order, min_order_immediate, min_order_scheduled, allow_immediate, allow_scheduled, delivery_days, delivery_days_immediate, delivery_days_scheduled',
            // is_active.eq.true ŞART — bkz. dosya başındaki 2 numaralı not.
            applyFilters: (q) =>
              q.eq('is_active', true).or('allow_immediate.eq.true,allow_scheduled.eq.true'),
          }),
          fetchGlobalDeliverySettings(),
        ]);
        if (mounted) {
          setZones(zoneRows);
          setGlobals(globalsRes);
        }
      } catch (e) {
        if (__DEV__) console.warn('delivery_zones error:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [visible]);

  const ozet = useMemo(() => ilceleriOzetle(zones, globals), [zones, globals]);
  const hizliIlceler = ozet.filter((i) => i.hizli);
  const planliIlceler = ozet.filter((i) => !i.hizli);

  const bolum = (
    baslik: string,
    altBaslik: string,
    renk: string,
    satirlar: IlceSatiri[],
    planliBolum: boolean,
  ) => {
    if (satirlar.length === 0) return null;
    return (
      <View style={s.bolum}>
        <View style={s.bolumBaslikSatiri}>
          <View style={[s.nokta, { backgroundColor: renk }]} />
          <Text style={s.bolumBaslik}>{baslik}</Text>
        </View>
        <Text style={s.bolumAlt}>{altBaslik}</Text>

        <View style={s.kart}>
          {satirlar.map((it, i) => {
            const tutar = planliBolum ? it.minPlanli : it.minHizli;
            const gunler = planliBolum && it.planliGunler ? formatDeliveryDaysFull(it.planliGunler) : null;
            return (
              <View key={it.district} style={[s.satir, i > 0 && s.satirCizgili]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.ilceAdi}>{it.district}</Text>
                  {gunler ? <Text style={s.gunler}>{gunler}</Text> : null}
                  {/* Hızlı ilçelerde planlı seçenek de var; tutarı farklı
                      olduğu için ikisi birden yazılıyor. */}
                  {!planliBolum && Number.isFinite(it.minPlanli) ? (
                    <Text style={s.gunler}>Gün seçerek: min {tlGruplu(it.minPlanli)}</Text>
                  ) : null}
                </View>
                <Text style={s.tutar}>
                  {Number.isFinite(tutar) ? `min ${tlGruplu(tutar)}` : '—'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Nerelere teslimat yapıyoruz?" showCloseButton>
      <IzmirTeslimatHaritasi />

      {loading ? (
        <View style={s.orta}>
          <ActivityIndicator size="small" color={COLORS.brand.green} />
        </View>
      ) : ozet.length === 0 ? (
        <View style={s.orta}>
          <Text style={s.bosMetin}>Teslimat bölgeleri şu an yüklenemedi.</Text>
        </View>
      ) : (
        <>
          {bolum(
            'Bugün teslimat',
            'Kendi kuryemizle, siparişinizi aynı gün getiriyoruz.',
            COLORS.brand.green,
            hizliIlceler,
            false,
          )}
          {bolum(
            'Gün seçerek teslimat',
            'Bu ilçelere gününü siz seçiyorsunuz; aynı gün teslimat yok.',
            '#C9D4BC',
            planliIlceler,
            true,
          )}
        </>
      )}

      <Text style={s.dipnot}>
        Listede olmayan ilçelere şimdilik teslimat yapamıyoruz. Minimum tutarlar
        başlangıç değeridir; adresinizi seçtiğinizde kesin tutar görünür.
      </Text>
    </BottomSheet>
  );
});

export default DeliveryZonesSheet;

const s = StyleSheet.create({
  orta: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  bosMetin: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  bolum: { marginTop: SPACING.lg },
  bolumBaslikSatiri: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nokta: { width: 12, height: 12, borderRadius: 6 },
  bolumBaslik: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
  },
  bolumAlt: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.text.secondary,
    marginTop: 4,
    marginBottom: 10,
    lineHeight: 18,
  },
  kart: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 14,
  },
  satir: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: 12,
  },
  satirCizgili: { borderTopWidth: 1, borderTopColor: '#F1F1F1' },
  ilceAdi: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: COLORS.text.primary,
  },
  gunler: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.text.secondary,
    marginTop: 2,
  },
  tutar: {
    fontSize: 13.5,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
    flexShrink: 0,
  },
  dipnot: {
    fontSize: 11.5,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.text.tertiary,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
});
