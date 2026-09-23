import React, { useEffect, useMemo, useRef } from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CheckCircle, MapPin, NavigationArrow } from 'phosphor-react-native';
import Selectable from '../ui/Selectable';
import { COLORS, RADIUS, SPACING, SURFACE, TYPOGRAPHY } from '../../constants/theme';
import { distanceInMeters } from '../../lib/geo';
import type { Branch } from '../../lib/branches';

type Coords = { latitude: number; longitude: number };

interface Props {
  branches: Branch[];
  selectedId: string | null;
  onSelect: (branch: Branch) => void;
  /** Cihaz konumu — en yakın şubeyi otomatik seçmek için. */
  deviceCoords?: Coords | null;
  googleMapsKey: string;
}

/** Metre cinsinden mesafeyi kullanıcıya okunur hale getirir. */
const mesafeEtiketi = (m: number): string =>
  m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;

export default function BranchPicker({
  branches,
  selectedId,
  onSelect,
  deviceCoords,
  googleMapsKey,
}: Props) {
  // Kullanıcı bir kez elle şube seçtiyse otomatik seçim bir daha araya girmez.
  const elleSecildiRef = useRef(false);
  // Konuma dayalı olarak işaretlenen şube — "otomatik seçildi" notu yalnızca
  // seçim HÂLÂ bu şubeyse gösterilir.
  const otoSecilenIdRef = useRef<string | null>(null);

  /** Her şube için cihaza mesafe (koordinatı olmayan şube için null). */
  const mesafeler = useMemo(() => {
    const harita = new Map<string, number>();
    if (!deviceCoords) return harita;
    for (const b of branches) {
      if (b.latitude == null || b.longitude == null) continue;
      harita.set(b.id, distanceInMeters(deviceCoords, { latitude: b.latitude, longitude: b.longitude }));
    }
    return harita;
  }, [branches, deviceCoords]);

  /** Mesafeye göre sıralı liste — en yakın şube her zaman ilk kartta. */
  const siraliSubeler = useMemo(() => {
    if (mesafeler.size === 0) return branches;
    return [...branches].sort((a, b) => {
      const da = mesafeler.get(a.id);
      const db = mesafeler.get(b.id);
      if (da == null && db == null) return 0;
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
  }, [branches, mesafeler]);

  /** Kart dokunuşu — bu andan sonra otomatik seçim devre dışı. */
  const elleSec = (branch: Branch) => {
    elleSecildiRef.current = true;
    otoSecilenIdRef.current = null;
    onSelect(branch);
  };

  // En yakın şubeyi otomatik işaretle.
  //
  // Cihaz konumu GPS'ten ASENKRON gelir: ilk render'da `mesafeler` boştur.
  // Bu yüzden "bir kez çalış" mantığı kullanılamaz — konumsuz ilk seçim
  // yalnızca geçici bir varsayılandır ve koordinatlar düştüğünde gerçek en
  // yakın şubeyle güncellenir. Tek kilit kullanıcının kendi seçimidir.
  useEffect(() => {
    if (elleSecildiRef.current) return;
    if (branches.length === 0) return;

    const enYakin = mesafeler.size > 0 ? siraliSubeler.find((b) => mesafeler.has(b.id)) ?? null : null;

    // Konum yoksa kullanıcı boş ekranla kalmasın diye ilk şube işaretlenir;
    // "otomatik seçildi" notu ise YALNIZCA konuma dayalı seçimde çıkar.
    const hedef = enYakin ?? (selectedId ? null : branches[0]);
    if (!hedef) return;

    otoSecilenIdRef.current = enYakin ? enYakin.id : null;
    if (hedef.id !== selectedId) onSelect(hedef);
    // onSelect kasıtlı olarak bağımlılık dışı: parent'ta her render'da yeniden
    // oluşan bir closure ise effect sonsuz döner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches, mesafeler, siraliSubeler, selectedId]);

  const secili = branches.find((b) => b.id === selectedId) ?? null;
  const otomatikSecimDuruyor = !!secili && otoSecilenIdRef.current === secili.id;

  const haritaUrl = (adres: string) =>
    `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(adres)}` +
    `&zoom=16&size=800x300&scale=2&markers=color:0xE8431A%7C${encodeURIComponent(adres)}` +
    `&style=feature:poi%7Cvisibility:off&key=${googleMapsKey}`;

  return (
    <View>
      <View style={s.grid}>
        {siraliSubeler.map((branch) => {
          const aktif = branch.id === selectedId;
          const mesafe = mesafeler.get(branch.id);
          return (
            <Selectable
              key={branch.id}
              selected={aktif}
              onPress={() => elleSec(branch)}
              style={s.kart}
              selectedStyle={s.kartAktif}
              borderRadius={RADIUS.sm}
              overlayInset={-1}
            >
              <View style={s.kartUst}>
                <MapPin size={15} color={aktif ? '#000' : SURFACE.unselectedText} weight={aktif ? 'fill' : 'regular'} />
                {aktif ? <CheckCircle size={16} color="#000" weight="fill" /> : null}
              </View>
              <Text style={[s.kartAd, aktif && s.kartAdAktif]} numberOfLines={2}>
                {branch.name}
              </Text>
              {mesafe != null ? (
                <View style={s.mesafeSatir}>
                  <NavigationArrow
                    size={11}
                    weight="fill"
                    color={aktif ? 'rgba(0,0,0,0.55)' : SURFACE.unselectedMutedText}
                  />
                  <Text style={[s.mesafeText, aktif && s.mesafeTextAktif]}>{mesafeEtiketi(mesafe)}</Text>
                </View>
              ) : null}
            </Selectable>
          );
        })}
      </View>

      {otomatikSecimDuruyor ? (
        <View style={s.otoNot}>
          <NavigationArrow size={13} color={COLORS.text.secondary} weight="fill" />
          <Text style={s.otoNotText}>
            Konumuna en yakın şube otomatik olarak seçildi, değiştirmek için şube seçin.
          </Text>
        </View>
      ) : null}

      {secili ? (
        <View style={s.detay}>
          <Text style={s.detayAdres}>{secili.address}</Text>
          {googleMapsKey ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() =>
                Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(secili.address)}`)
              }
              style={s.harita}
            >
              <Image source={{ uri: haritaUrl(secili.address) }} style={s.haritaImg} resizeMode="cover" />
              <View style={s.haritaRozet}>
                <MapPin size={11} color="#000" weight="fill" />
                <Text style={s.haritaRozetText}>Haritada Aç</Text>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  kart: {
    // İki sütun: satırın yarısından gap payı düşülür.
    width: '48.5%',
    minHeight: 92,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: SURFACE.unselectedBorder,
    backgroundColor: SURFACE.unselectedBg,
    justifyContent: 'space-between',
  },
  kartAktif: {
    backgroundColor: COLORS.brand.green,
    borderColor: 'transparent',
  },
  kartUst: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  kartAd: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: SURFACE.unselectedText,
    lineHeight: 18,
  },
  kartAdAktif: {
    fontFamily: 'PlusJakartaSans_800ExtraBold',
    color: '#000000',
  },
  mesafeSatir: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.xs,
  },
  mesafeText: {
    fontSize: 11,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: SURFACE.unselectedMutedText,
  },
  mesafeTextAktif: {
    color: 'rgba(0,0,0,0.6)',
  },
  otoNot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.xs,
    backgroundColor: '#f5f5f5',
  },
  otoNotText: {
    flex: 1,
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.secondary,
    lineHeight: 16,
  },
  detay: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  detayAdres: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.secondary,
    lineHeight: 20,
  },
  harita: {
    height: 120,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  haritaImg: {
    width: '100%',
    height: '100%',
  },
  haritaRozet: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.brand.green,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  haritaRozetText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
});
