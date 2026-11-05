// eatkcal v2 (G13-S2 md.5) — konum izni + ters geocode (NATIVE; testlerden
// import edilmez). AddressVerificationSheet.tsx'teki çağrıların aynısı:
//  - izin: getForegroundPermissionsAsync / requestForegroundPermissionsAsync (AVS:123-160)
//  - konum: getCurrentPositionAsync({}) (AVS:148, 173)
//  - ters geocode: native reverseGeocodeAsync + Google geocode PARALEL (AVS:192-233,
//    create modu) → `mergeReverseGeo`. Google çağrısı AVS'de dışa verilmediği için
//    (reverseGeocodeWithGoogle, AVS:46-68) aynı URL/anahtar kuralıyla buraya alındı.
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import {
  fromNativeGeocode,
  mergeReverseGeo,
  parseGoogleComponents,
  type ReverseGeo,
} from './addressModel';

/** AVS:13 — İzmir merkezi (izin yoksa harita buradan başlar). */
export const IZMIR_CENTER = { latitude: 38.4237, longitude: 27.1428 };

export type LocationPermission = 'granted' | 'denied' | 'undetermined';

const getGoogleMapsKey = (): string => {
  const fromConfig = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)
    ?.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
  return String(
    (typeof fromConfig === 'string' ? fromConfig : '') || process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '',
  ).trim();
};

/** Sormadan izin durumu (AVS:124). `canAskAgain=false` + denied → kalıcı ret. */
export async function readLocationPermission(): Promise<{ status: LocationPermission; canAskAgain: boolean }> {
  try {
    const { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
    return { status: status as LocationPermission, canAskAgain };
  } catch {
    return { status: 'undetermined', canAskAgain: true };
  }
}

/** İzin iste (AVS:142 / 161). */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/** Cihaz konumu (AVS:148) — alınamazsa null; engel değil. */
export async function currentCoords(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const pos = await Location.getCurrentPositionAsync({});
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

async function reverseGeocodeWithGoogle(lat: number, lng: number): Promise<ReverseGeo | null> {
  const key = getGoogleMapsKey();
  if (!key) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}&language=tr`,
    );
    const data = await res.json();
    return parseGoogleComponents(data?.results?.[0]?.address_components);
  } catch {
    return null;
  }
}

/** Pin konumunun adresi — AVS create modu ile aynı (native + Google paralel). */
export async function reverseGeocodeAt(latitude: number, longitude: number): Promise<ReverseGeo | null> {
  try {
    const [results, google] = await Promise.all([
      Location.reverseGeocodeAsync({ latitude, longitude }),
      reverseGeocodeWithGoogle(latitude, longitude),
    ]);
    return mergeReverseGeo(fromNativeGeocode(results?.[0]), google);
  } catch {
    return null;
  }
}
