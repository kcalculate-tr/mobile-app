import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import MapView, { Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { MapPin, X, Check } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '../../constants/theme';
import { distanceInMeters } from '../../lib/geo';
import { haptic } from '../../utils/haptics';

const DISTANCE_WARNING_METERS = 500;

interface Props {
  visible: boolean;
  addressDistrict: string;
  addressNeighbourhood: string | null;
  initialCoords: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onConfirm: (coords: { latitude: number; longitude: number }) => void;
}

const toNormalized = (v: string | null | undefined) =>
  (v || '')
    .toLocaleLowerCase('tr')
    .replace(/[̇̀-ͯ]/g, '')
    .trim();

// FAZ L — sabit pin ortada durur, kullanıcı haritayı sürükler (Uber/Yemeksepeti
// deseni); MapView kendisi hareket eder, pin ikonu View olarak üstte sabit.
export default function AddressVerificationSheet({
  visible,
  addressDistrict,
  addressNeighbourhood,
  initialCoords,
  onClose,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();
  const [region, setRegion] = useState<Region | null>(null);
  const [deviceCoords, setDeviceCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [reverseGeo, setReverseGeo] = useState<{ district?: string; neighbourhood?: string } | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setRegion(
      initialCoords
        ? { ...initialCoords, latitudeDelta: 0.006, longitudeDelta: 0.006 }
        : { latitude: 38.4237, longitude: 27.1428, latitudeDelta: 0.05, longitudeDelta: 0.05 }, // İzmir merkez, geocode yoksa varsayılan
    );
    setDeviceCoords(null);
    setReverseGeo(null);
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({});
        setDeviceCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      } catch {
        // konum alınamazsa mesafe uyarısı gösterilmez, engel değil
      }
    })();
  }, [visible, initialCoords]);

  const handleRegionChangeComplete = (r: Region) => {
    setRegion(r);
  };

  const runReverseGeocode = async () => {
    if (!region) return;
    setChecking(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: region.latitude, longitude: region.longitude });
      const geo = results?.[0];
      if (geo) {
        setReverseGeo({ district: geo.subregion || geo.district || undefined, neighbourhood: geo.district || geo.name || undefined });
      }
    } catch {
      // sessiz — sadece öneri amaçlı, engel değil
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
    if (!reverseGeo) return null;
    const districtMismatch =
      reverseGeo.district && toNormalized(reverseGeo.district) !== toNormalized(addressDistrict);
    const neighbourhoodMismatch =
      addressNeighbourhood &&
      reverseGeo.neighbourhood &&
      toNormalized(reverseGeo.neighbourhood) !== toNormalized(addressNeighbourhood);
    if (!districtMismatch && !neighbourhoodMismatch) return null;
    return `Bu konum ${reverseGeo.district || ''}${reverseGeo.neighbourhood ? ' / ' + reverseGeo.neighbourhood : ''} gibi görünüyor, adresiniz ${addressDistrict}${addressNeighbourhood ? ' / ' + addressNeighbourhood : ''} olarak kayıtlı.`;
  }, [reverseGeo, addressDistrict, addressNeighbourhood]);

  const handleConfirm = () => {
    if (!region) return;
    haptic.selection();
    onConfirm({ latitude: region.latitude, longitude: region.longitude });
  };

  if (!visible || !region) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={{ flex: 1 }}>
          <MapView
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
        </View>

        <TouchableOpacity
          style={[styles.closeBtn, { top: insets.top + 8 }]}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <X size={18} color="#000" />
        </TouchableOpacity>

        <View style={[styles.sheet, { paddingBottom: Math.max(20, insets.bottom + 12) }]}>
          <Text style={styles.title}>Teslimat konumunu onayla</Text>
          <Text style={styles.sub}>Haritayı sürükleyerek pin'i teslimat noktasına getir.</Text>

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
            <Text style={styles.confirmBtnText}>Bu Konumu Onayla</Text>
          </TouchableOpacity>
        </View>
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
});
