import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import Constants from 'expo-constants';
import MapView, { Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { MapPin, X, Check, NavigationArrow } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/theme';
import { distanceInMeters, normalizeTurkishText } from '../../lib/geo';
import { haptic } from '../../utils/haptics';

const DISTANCE_WARNING_METERS = 500;
const IZMIR_CENTER = { latitude: 38.4237, longitude: 27.1428 };

export type ReverseGeoResult = {
  district?: string;
  /** Native (Apple/Android) sonucu — birincil aday. */
  neighbourhood?: string;
  /** Google sonucu — Apple'ın mahallesi delivery_zones'da eşleşmezse ikinci
   * deneme. İkisi FARKLI mahalle sınırları kullanabilir (aynı koordinat için
   * Apple "Yeşilyurt", Google "Salih Omurtak" dönebiliyor — biri delivery_zones'da
   * olup diğeri olmayabilir), tek kaynağa güvenmek yetersiz kaldığı için ikisi de taşınır. */
  neighbourhoodAlt?: string;
  street?: string;
  streetNumber?: string;
  postalCode?: string;
};

const getGoogleMapsKey = (): string => {
  const fromConfig =
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
  return String((typeof fromConfig === 'string' ? fromConfig : '') || process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '').trim();
};

type GoogleReverseResult = {
  district?: string;
  neighbourhood?: string;
  street?: string;
  streetNumber?: string;
  postalCode?: string;
};

// Google'ın reverse-geocode'da mahalleyi taşıdığı tip TR'de tutarlı değil —
// gözlemde "administrative_area_level_4" geldi, dokümantasyonda "neighborhood"/
// "sublocality" da mümkün; hepsini dener.
const reverseGeocodeWithGoogle = async (lat: number, lng: number): Promise<GoogleReverseResult | null> => {
  const key = getGoogleMapsKey();
  if (!key) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}&language=tr`,
    );
    const data = await res.json();
    const components = data?.results?.[0]?.address_components as
      | { long_name: string; types: string[] }[]
      | undefined;
    if (!components) return null;
    const find = (type: string) => components.find((c) => c.types.includes(type))?.long_name;
    return {
      district: find('administrative_area_level_2'),
      neighbourhood: find('administrative_area_level_4') || find('neighborhood') || find('sublocality'),
      street: find('route'),
      streetNumber: find('street_number'),
      postalCode: find('postal_code'),
    };
  } catch {
    return null;
  }
};

interface Props {
  visible: boolean;
  /** 'verify': mevcut adresi doğrula (mismatch kontrolü aktif). 'create': yeni adres — konum önce, form sonra. */
  mode?: 'verify' | 'create';
  addressDistrict?: string;
  addressNeighbourhood?: string | null;
  initialCoords: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onConfirm: (coords: { latitude: number; longitude: number }, reverseGeo?: ReverseGeoResult) => void;
  /** create modunda, sistem konum izni reddedilince (sheet kendini kapatır, çağıran manuel forma düşmeli). */
  onPermissionDenied?: () => void;
}

// FAZ L — sabit pin ortada durur, kullanıcı haritayı sürükler (Uber/Yemeksepeti
// deseni); MapView kendisi hareket eder, pin ikonu View olarak üstte sabit.
export default function AddressVerificationSheet({
  visible,
  mode = 'verify',
  addressDistrict = '',
  addressNeighbourhood = null,
  initialCoords,
  onClose,
  onConfirm,
  onPermissionDenied,
}: Props) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [permissionStep, setPermissionStep] = useState<'checking' | 'intro' | 'granted'>(
    mode === 'create' ? 'checking' : 'granted',
  );
  const [region, setRegion] = useState<Region | null>(null);
  const [deviceCoords, setDeviceCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [reverseGeo, setReverseGeo] = useState<ReverseGeoResult | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setReverseGeo(null);
    setDeviceCoords(null);
    setRegion(
      initialCoords
        ? { ...initialCoords, latitudeDelta: 0.006, longitudeDelta: 0.006 }
        : { ...IZMIR_CENTER, latitudeDelta: 0.05, longitudeDelta: 0.05 },
    );

    if (mode !== 'create') {
      setPermissionStep('granted');
      requestDeviceLocation();
      return;
    }

    // create: önce mevcut izin durumuna bak, sorma — undetermined ise açıklama göster.
    (async () => {
      const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        setPermissionStep('granted');
        requestDeviceLocation(true);
      } else if (status === 'denied' && !canAskAgain) {
        onPermissionDenied?.();
      } else {
        setPermissionStep('intro');
      }
    })();
  }, [visible, initialCoords, mode]);

  const requestDeviceLocation = async (recenter = false) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (mode === 'create') onPermissionDenied?.();
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setDeviceCoords(coords);
      if (recenter && !initialCoords) {
        const next = { ...coords, latitudeDelta: 0.006, longitudeDelta: 0.006 };
        setRegion(next);
        mapRef.current?.animateToRegion(next, 400);
      }
    } catch {
      // konum alınamazsa mesafe uyarısı/otomatik ortalama gösterilmez, engel değil
    }
  };

  const handleAllowLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') {
      setPermissionStep('granted');
      requestDeviceLocation(true);
    } else {
      onPermissionDenied?.();
    }
  };

  const handleUseMyLocation = async () => {
    haptic.selection();
    try {
      const pos = await Location.getCurrentPositionAsync({});
      const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setDeviceCoords(coords);
      const next = { ...coords, latitudeDelta: 0.006, longitudeDelta: 0.006 };
      setRegion(next);
      mapRef.current?.animateToRegion(next, 400);
    } catch {
      // sessiz — buton tekrar denenebilir
    }
  };

  const handleRegionChangeComplete = (r: Region) => {
    setRegion(r);
  };

  // React state güncellemeleri asenkron uygulanır — çağıran taraf (handleConfirm)
  // setReverseGeo sonrası HEMEN reverseGeo'yu okursa hâlâ eski değeri görür
  // (bir sonraki render'a kadar). Bu yüzden sonucu hem state'e yazıyoruz
  // (UI için) hem de doğrudan döndürüyoruz (çağıran taze veriyi garanti alsın).
  const runReverseGeocode = async (): Promise<ReverseGeoResult | null> => {
    if (!region) return null;
    setChecking(true);
    try {
      const nativePromise = Location.reverseGeocodeAsync({ latitude: region.latitude, longitude: region.longitude });
      // create modunda HER ZAMAN Google'ı da paralel çağırıyoruz (sadece native
      // tamamen boşsa değil) — gözlemde Apple mahalleyi BOŞ değil YANLIŞ/farklı
      // sınırla dönebiliyor (aynı koordinat: Apple "Yeşilyurt", Google "Salih
      // Omurtak" — sadece ikincisi delivery_zones'da). AddressesScreen ikisini
      // de dener, ilk eşleşeni kullanır. verify modunda (mismatch kontrolü
      // native veriyle yeterli) gereksiz API çağrısından kaçınılır.
      const googlePromise = mode === 'create' ? reverseGeocodeWithGoogle(region.latitude, region.longitude) : Promise.resolve(null);
      const [results, googleResult] = await Promise.all([nativePromise, googlePromise]);
      const geo = results?.[0];

      let resolved: ReverseGeoResult | null = geo
        ? {
            district: geo.subregion || geo.district || undefined,
            neighbourhood: geo.district || geo.name || undefined,
            street: geo.street || geo.name || undefined,
            streetNumber: geo.streetNumber || undefined,
            postalCode: geo.postalCode || undefined,
          }
        : null;

      if (googleResult) {
        resolved = {
          district: resolved?.district || googleResult.district,
          neighbourhood: resolved?.neighbourhood,
          neighbourhoodAlt: googleResult.neighbourhood,
          street: resolved?.street || googleResult.street,
          streetNumber: resolved?.streetNumber || googleResult.streetNumber,
          postalCode: resolved?.postalCode || googleResult.postalCode,
        };
      }

      setReverseGeo(resolved);
      return resolved;
    } catch {
      // sessiz — sadece öneri amaçlı, engel değil
      return null;
    } finally {
      setChecking(false);
    }
  };

  const distanceWarning = useMemo(() => {
    if (!deviceCoords || !region) return null;
    const d = distanceInMeters(deviceCoords, region);
    return d >= DISTANCE_WARNING_METERS ? Math.round(d) : null;
  }, [deviceCoords, region]);

  const mismatchWarning = useMemo(() => {
    if (mode !== 'verify' || !reverseGeo) return null;
    const districtMismatch =
      reverseGeo.district && normalizeTurkishText(reverseGeo.district) !== normalizeTurkishText(addressDistrict);
    const neighbourhoodMismatch =
      addressNeighbourhood &&
      reverseGeo.neighbourhood &&
      normalizeTurkishText(reverseGeo.neighbourhood) !== normalizeTurkishText(addressNeighbourhood);
    if (!districtMismatch && !neighbourhoodMismatch) return null;
    return `Bu konum ${reverseGeo.district || ''}${reverseGeo.neighbourhood ? ' / ' + reverseGeo.neighbourhood : ''} gibi görünüyor, adresiniz ${addressDistrict}${addressNeighbourhood ? ' / ' + addressNeighbourhood : ''} olarak kayıtlı.`;
  }, [mode, reverseGeo, addressDistrict, addressNeighbourhood]);

  const handleConfirm = async () => {
    if (!region) return;
    haptic.selection();
    // create modunda son bir reverse-geocode ile forma aktarılacak veriyi taze al.
    // DİKKAT: runReverseGeocode'un DÖNÜŞ DEĞERİNİ kullanıyoruz, `reverseGeo`
    // state'ini değil — setReverseGeo bu fonksiyonun içinde çağrılıyor ama state
    // güncellemesi bir sonraki render'a kadar burada görünmez (stale closure).
    const freshReverseGeo = mode === 'create' ? await runReverseGeocode() : reverseGeo;
    onConfirm({ latitude: region.latitude, longitude: region.longitude }, freshReverseGeo || undefined);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {permissionStep === 'intro' ? (
          <View style={styles.introWrap}>
            <TouchableOpacity
              style={[styles.closeBtn, { top: insets.top + 8 }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <X size={18} color="#000" />
            </TouchableOpacity>
            <View style={styles.introIcon}>
              <MapPin size={36} color={COLORS.brand.green} weight="fill" />
            </View>
            <Text style={styles.title}>Konumunu kullanabilir miyiz?</Text>
            <Text style={[styles.sub, { textAlign: 'center', marginTop: 8 }]}>
              Teslimat adresini haritada doğrulamak ve sana en yakın şubeyi bulmak için konumunu kullanıyoruz.
            </Text>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleAllowLocation} activeOpacity={0.85}>
              <Text style={styles.confirmBtnText}>İzin Ver ve Devam Et</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 14 }} onPress={() => onPermissionDenied?.()} activeOpacity={0.7}>
              <Text style={styles.skipText}>Şimdi değil, adresi elle gireceğim</Text>
            </TouchableOpacity>
          </View>
        ) : !region ? null : (
          <>
            <View style={{ flex: 1 }}>
              <MapView
                ref={mapRef}
                style={{ flex: 1 }}
                initialRegion={region}
                onRegionChangeComplete={handleRegionChangeComplete}
                onRegionChange={() => setReverseGeo(null)}
                onTouchEnd={runReverseGeocode}
                showsUserLocation
                showsMyLocationButton={false}
              />
              {/* Sabit pin — haritanın merkezinde, kullanıcı haritayı sürükler */}
              <View pointerEvents="none" style={styles.pinWrap}>
                <MapPin size={40} color={COLORS.brand.green} weight="fill" />
              </View>

              <TouchableOpacity
                style={[styles.myLocationBtn, { bottom: 24 }]}
                onPress={handleUseMyLocation}
                activeOpacity={0.85}
              >
                <NavigationArrow size={18} color="#000" weight="fill" />
                <Text style={styles.myLocationBtnText}>Konumumu Kullan</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.closeBtn, { top: insets.top + 8 }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <X size={18} color="#000" />
            </TouchableOpacity>

            <View style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom + 12) }]}>
              <Text style={styles.title}>
                {mode === 'create' ? 'Teslimat noktanı işaretle' : 'Teslimat konumunu onayla'}
              </Text>
              <Text style={styles.sub}>Haritayı sürükleyerek pin'i kapına getir.</Text>

              {checking ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <ActivityIndicator size="small" color={COLORS.text.secondary} />
                  <Text style={styles.checkingText}>Konum kontrol ediliyor…</Text>
                </View>
              ) : null}

              {distanceWarning ? (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    Şu an farklı bir konumdasın (~{distanceWarning >= 1000 ? `${(distanceWarning / 1000).toFixed(1)} km` : `${distanceWarning} m`}
                    {' '}uzakta). Sipariş bu adrese mi gitsin?
                  </Text>
                </View>
              ) : null}

              {mismatchWarning ? (
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>{mismatchWarning}</Text>
                </View>
              ) : null}

              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.85}>
                <Check size={18} color="#000" />
                <Text style={styles.confirmBtnText}>
                  {mode === 'create' ? 'Bu Konumu Kullan' : 'Bu Konumu Onayla'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pinWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -40,
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },
  myLocationBtn: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 4 },
    }),
  },
  myLocationBtnText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.semibold,
    fontFamily: 'PlusJakartaSans_600SemiBold',
    color: '#000',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    gap: SPACING.sm,
    marginTop: -RADIUS.xl,
  },
  title: {
    fontSize: TYPOGRAPHY.size.lg,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: COLORS.text.primary,
  },
  sub: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.secondary,
  },
  checkingText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.secondary,
  },
  warningBox: {
    backgroundColor: '#FFF7ED',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  warningText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: '#C2410C',
    lineHeight: 19,
  },
  confirmBtn: {
    height: 52,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.brand.green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  confirmBtnText: {
    fontSize: TYPOGRAPHY.size.md,
    fontWeight: TYPOGRAPHY.weight.bold,
    fontFamily: 'PlusJakartaSans_700Bold',
    color: '#000',
  },
  // İzin açıklama ekranı
  introWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  introIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F0FDE8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  skipText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: 'PlusJakartaSans_500Medium',
    color: COLORS.text.secondary,
    textDecorationLine: 'underline',
  },
});
