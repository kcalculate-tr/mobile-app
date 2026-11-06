// eatkcal v2 (G13-S2 md.5) — FinEkAddress harita alanı: sabit orta pin,
// kullanıcı haritayı sürükler (AVS "Uber/Yemeksepeti deseni", AVS:85-86 ile
// aynı). Harita `onMapReady` vermezse (yüklenemedi) FinEkAddressNoMap kartı.
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { MapPin, MapTrifold } from '../../../../../components/icons';
import { ekType, useEk } from '../kit';
import { EkInkButton } from '../orders/OrdersParts';

/** Bu sürede `onMapReady` gelmezse harita yüklenemedi sayılır. */
export const MAP_READY_TIMEOUT_MS = 10000;

export type AddressMapHandle = { centerOn: (c: { latitude: number; longitude: number }) => void };

type Props = {
  height: number;
  initialCenter: { latitude: number; longitude: number };
  zoomedIn: boolean;
  /** Pin bırakıldı (kullanıcı haritayı sürükleyip bıraktı ya da ortalandı). */
  onCenterChange: (c: { latitude: number; longitude: number }, byUser: boolean) => void;
  onMapFailed: () => void;
  /** Pin altı durum hapı (bölge). */
  status?: React.ReactNode;
  /** İzin yok: pinin üstünde "Sürükle" ipucu (FinEkAddressNoPerm). */
  dragHint?: string;
  mapLabel: string;
};

export const AddressMap = forwardRef<AddressMapHandle, Props>(function AddressMap(
  { height, initialCenter, zoomedIn, onCenterChange, onMapFailed, status, dragHint, mapLabel },
  ref,
) {
  const { c, theme } = useEk();
  const mapRef = useRef<MapView>(null);
  const readyRef = useRef(false);
  const failedRef = useRef(onMapFailed);
  failedRef.current = onMapFailed;

  const delta = zoomedIn ? 0.006 : 0.05;
  const [initialRegion] = useState<Region>({ ...initialCenter, latitudeDelta: delta, longitudeDelta: delta });

  useImperativeHandle(ref, () => ({
    centerOn: (coords) => {
      mapRef.current?.animateToRegion({ ...coords, latitudeDelta: 0.006, longitudeDelta: 0.006 }, 400);
    },
  }));

  useEffect(() => {
    const t = setTimeout(() => {
      if (!readyRef.current) failedRef.current();
    }, MAP_READY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={{ height }} accessibilityLabel={mapLabel}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onMapReady={() => {
          readyRef.current = true;
        }}
        onRegionChangeComplete={(r, details) => {
          onCenterChange({ latitude: r.latitude, longitude: r.longitude }, details?.isGesture !== false);
        }}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        userInterfaceStyle={theme.isDark ? 'dark' : 'light'}
      />
      <View pointerEvents="none" style={styles.pinWrap}>
        {dragHint ? (
          <View style={[styles.hint, { backgroundColor: c.ink }]}>
            <Text style={[ekType.c13s, { color: c.surface }]}>{dragHint}</Text>
          </View>
        ) : null}
        <MapPin size={40} color={c.ink} weight="fill" />
        <View style={styles.pinShadow} />
      </View>
      {status ? (
        <View pointerEvents="box-none" style={styles.statusWrap}>
          {status}
        </View>
      ) : null}
    </View>
  );
});

/** FinEkAddressNoMap — haritanın yerine kart; "Tekrar dene" haritayı yeniden kurar. */
export function NoMapCard({
  height,
  title,
  body,
  retryLabel,
  onRetry,
}: {
  height: number;
  title: string;
  body: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  const { c } = useEk();
  return (
    <View style={[styles.noMap, { height, backgroundColor: c.line }]}>
      <View style={[styles.noMapCard, { backgroundColor: c.surface }]} accessibilityRole="alert">
        <View style={[styles.noMapIcon, { backgroundColor: c.line }]}>
          <MapTrifold size={22} color={c.ink} />
        </View>
        <Text style={[ekType.h20, { color: c.ink, textAlign: 'center' }]}>{title}</Text>
        <Text style={[ekType.b15, { color: c.secondary, textAlign: 'center', marginBottom: 8 }]}>{body}</Text>
        <View style={{ alignSelf: 'stretch' }}>
          {/* G15-S5 (FinEkAddressNoMap): Final kurtarma düğmesi mürekkep (lime değil). */}
          <EkInkButton label={retryLabel} onPress={onRetry} testID="ek-address-nomap-retry" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pinWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: '50%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  pinShadow: { width: 10, height: 4, borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.25)', marginTop: -2 },
  hint: { paddingHorizontal: 10, minHeight: 28, borderRadius: 14, justifyContent: 'center', marginBottom: 6 },
  statusWrap: { position: 'absolute', left: 16, right: 16, top: '50%', marginTop: 16, alignItems: 'center' },
  noMap: { justifyContent: 'center', paddingHorizontal: 24 },
  noMapCard: { borderRadius: 20, paddingTop: 20, paddingHorizontal: 16, paddingBottom: 16, alignItems: 'center', gap: 8, marginTop: -40 },
  noMapIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
});
