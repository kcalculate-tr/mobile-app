import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import BottomSheet from './BottomSheet';
import IzmirTeslimatHaritasi from './IzmirTeslimatHaritasi';
import { COLORS, SPACING } from '../constants/theme';
import {
  fetchAllDeliveryZones,
  fetchGlobalDeliverySettings,
  resolveMinOrder,
  DeliveryGlobals,
  DeliveryZoneRow,
} from '../lib/delivery';
import { tlGruplu } from '../lib/money';

/**
 * Teslimat bölgeleri — TEK EKRAN, liste yok.
 *
 * 25.09.2026 (2. tur, İlter'in geri bildirimi):
 *  · Harita gerçek İzmir il silüeti oldu (serbest çizim "blob" İzmir'e
 *    benzemiyordu) — bkz. IzmirTeslimatHaritasi.tsx.
 *  · İKİ UZUN LİSTE KALDIRILDI. Artık yalnızca HEMEN TESLİMAT yapılan
 *    ilçeler rozet olarak gösteriliyor; diğer ilçeler tek cümlelik bir notla
 *    özetleniyor. Onbeş ilçeyi minimum tutarlarıyla listelemek "tek bakışta
 *    anlaşılsın" amacının tersine çalışıyordu.
 *  · Sekmeler (1. turda kaldırılmıştı) geri gelmedi.
 *
 * Korunan davranış: sorgu `is_active` filtresini UYGULAR. Eski sürüm yalnız
 * allow_immediate/allow_scheduled'a bakıyordu; Çeşme'nin 25 mahallesi
 * is_active=false olmasına rağmen allow_scheduled=true olduğu için listede
 * görünüyor, yani teslimat yapmadığımız bir ilçeyi yapıyormuş gibi
 * gösteriyorduk.
 *
 * Rozetler CANLI veriden geliyor, kodda sabit değil: Bayraklı ve Bornova
 * hemen teslimata açıldığında (allow_immediate=true) yeni sürüm gerekmeden
 * listede belirirler.
 */

type ZoneRow = DeliveryZoneRow & {
  district: string;
  is_active: boolean | null;
  allow_immediate: boolean | null;
  allow_scheduled: boolean | null;
};

type IlceSatiri = {
  district: string;
  hizli: boolean;
  minHizli: number;
};

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

    const mevcut = harita.get(ilce);
    if (!mevcut) {
      harita.set(ilce, { district: ilce, hizli: hizliVar, minHizli });
    } else {
      mevcut.hizli = mevcut.hizli || hizliVar;
      mevcut.minHizli = Math.min(mevcut.minHizli, minHizli);
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
              'district, is_active, min_order, min_order_immediate, allow_immediate, allow_scheduled',
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

  // Minimum tutar tek satırda: ilçeler arasında değişmiyorsa net rakam,
  // değişiyorsa rakam vermek yerine "adresinize göre" demek doğru —
  // yanlış bir rakam ikinci bir "neden sipariş veremiyorum" sorusu yaratır.
  const minTutarlar = Array.from(
    new Set(hizliIlceler.map((i) => i.minHizli).filter((n) => Number.isFinite(n) && n > 0)),
  );
  const minTutarMetni =
    minTutarlar.length === 1
      ? `Minimum sipariş tutarı ${tlGruplu(minTutarlar[0])}.`
      : minTutarlar.length > 1
        ? 'Minimum sipariş tutarı ilçeye göre değişir; adresinizi seçtiğinizde görünür.'
        : null;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Nerelere teslimat yapıyoruz?" showCloseButton>
      <IzmirTeslimatHaritasi acikIlceler={hizliIlceler.map((i) => i.district)} />

      {loading ? (
        <View style={s.orta}>
          <ActivityIndicator size="small" color={COLORS.brand.green} />
        </View>
      ) : hizliIlceler.length === 0 ? (
        <View style={s.orta}>
          <Text style={s.bosMetin}>Teslimat bölgeleri şu an yüklenemedi.</Text>
        </View>
      ) : (
        <View style={s.bolum}>
          <View style={s.baslikSatiri}>
            <View style={s.nokta} />
            <Text style={s.baslik}>Hemen teslimat</Text>
          </View>
          <Text style={s.altBaslik}>
            Bu ilçelere kendi kuryemizle, siparişinizi aynı gün getiriyoruz.
          </Text>

          <View style={s.rozetler}>
            {hizliIlceler.map((it) => (
              <View key={it.district} style={s.rozet}>
                <Text style={s.rozetMetin}>{it.district}</Text>
              </View>
            ))}
          </View>

          {minTutarMetni ? <Text style={s.minTutar}>{minTutarMetni}</Text> : null}

          {/* Sabit liste, bilerek: "çok yakında" bir İŞ VAADİ, veritabanındaki
              bir durum değil. delivery_zones'tan türetilseydi planlı teslimat
              yapılan her ilçe (Urla, Torbalı, Güzelbahçe…) burada belirirdi —
              oysa yakın vadede açılacak olanlar yalnız bu beşi. */}
          <Text style={s.yakinda}>
            <Text style={s.yakindaVurgu}>Çok yakında: </Text>
            Karşıyaka, Buca, Gaziemir, Menderes ve Menemen.
          </Text>
        </View>
      )}

      <View style={s.notKutusu}>
        <Text style={s.notMetni}>
          Diğer ilçelere şu an sadece ertesi gün teslimat ile soğuk zincir
          teslimat yapılabilmektedir.
        </Text>
      </View>
    </BottomSheet>
  );
});

export default DeliveryZonesSheet;

const s = StyleSheet.create({
  orta: { minHeight: 100, alignItems: 'center', justifyContent: 'center' },
  bosMetin: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.text.secondary,
    textAlign: 'center',
  },
  bolum: { marginTop: SPACING.md },
  baslikSatiri: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nokta: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.brand.green,
  },
  baslik: {
    fontSize: 17,
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: COLORS.text.primary,
  },
  altBaslik: {
    fontSize: 13,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.text.secondary,
    marginTop: 5,
    lineHeight: 19,
  },
  // Rozetler: ilçe sayısı azken (şu an 4, 1 Ekim'den sonra 6) sarmalanan
  // rozet dizisi liste satırlarından hem daha kompakt hem tek bakışta okunur.
  rozetler: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: SPACING.md,
  },
  rozet: {
    backgroundColor: COLORS.brand.green,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 15,
  },
  rozetMetin: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_700Bold',
    // Yeşil üzerinde SİYAH: beyaz yazı #B9EF14 üzerinde 1.4:1 kalıyor,
    // gün ışığında okunmuyor. Siyah 14.8:1.
    color: COLORS.text.primary,
  },
  minTutar: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.secondary,
    marginTop: SPACING.md,
  },
  yakinda: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_400Regular',
    color: COLORS.text.secondary,
    lineHeight: 19,
    marginTop: 6,
  },
  yakindaVurgu: {
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  notKutusu: {
    backgroundColor: '#F4F6F1',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  notMetni: {
    fontSize: 12.5,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#5B6357',
    lineHeight: 19,
  },
});
