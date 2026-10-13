import Constants from 'expo-constants';
import * as Location from 'expo-location';
import type { Address } from '../types';

/**
 * EN YAKIN KONUM (13.10.2026)
 *
 * Trendyol/Yemeksepeti deseni: uygulama açılır açılmaz kullanıcının nerede
 * olduğunu bilir ve menüyü ona göre gösterir. Bizde bu, "hangi şube" sorusunun
 * cevabı demek — şubede kapatılmış ürünleri katalogdan elemek için gerekli.
 */

export interface KonumSonucu {
  district: string | null;
  neighbourhood: string | null;
  latitude: number;
  longitude: number;
}

const googleAnahtari = (): string => {
  const fromConfig = (Constants.expoConfig?.extra as Record<string, unknown> | undefined)
    ?.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
  return String(
    (typeof fromConfig === 'string' ? fromConfig : '') ||
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ||
      '',
  ).trim();
};

// Google'ın TR'de mahalleyi taşıdığı tip tutarlı değil: gözlemde
// administrative_area_level_4 geldi, dokümanda neighborhood/sublocality de
// mümkün. Hepsini sırayla dener. (AddressVerificationSheet'teki ile aynı kural.)
const googleIleCoz = async (lat: number, lng: number) => {
  const key = googleAnahtari();
  if (!key) return null;
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}&language=tr`,
    );
    const data = await res.json();
    const parcalar = data?.results?.[0]?.address_components as
      | { long_name: string; types: string[] }[]
      | undefined;
    if (!parcalar) return null;
    const bul = (t: string) => parcalar.find((c) => c.types.includes(t))?.long_name ?? null;
    return {
      district: bul('administrative_area_level_2'),
      neighbourhood:
        bul('administrative_area_level_4') || bul('neighborhood') || bul('sublocality'),
    };
  } catch {
    return null;
  }
};

/** İzin durumunu SORMADAN okur — açılışta gereksiz istem çıkmasın diye. */
export const konumIzniVarMi = async (): Promise<boolean> => {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
};

/**
 * Cihaz konumunu alıp ilçe/mahalleye çevirir.
 * `istemGoster` false ise izin daha önce verilmemişse hiçbir şey sormaz.
 */
export const cihazKonumunuCoz = async (istemGoster: boolean): Promise<KonumSonucu | null> => {
  try {
    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      if (!istemGoster) return null;
      ({ status } = await Location.requestForegroundPermissionsAsync());
      if (status !== 'granted') return null;
    }

    const konum = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    if (!konum) return null;

    const { latitude, longitude } = konum.coords;

    const google = await googleIleCoz(latitude, longitude);
    if (google?.district) {
      return { ...google, latitude, longitude };
    }

    // Google anahtarı yoksa ya da cevap vermediyse cihazın kendi çözümü.
    const [yerel] = await Location.reverseGeocodeAsync({ latitude, longitude });
    return {
      district: yerel?.subregion || yerel?.city || null,
      neighbourhood: yerel?.district || yerel?.name || null,
      latitude,
      longitude,
    };
  } catch {
    return null;
  }
};

const KM_PER_DEG = 111;

/** Kaba düzlemsel mesafe — sadece sıralama için, hassasiyet gerekmiyor. */
export const mesafeKm = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number => {
  const dLat = (a.latitude - b.latitude) * KM_PER_DEG;
  const dLng =
    (a.longitude - b.longitude) * KM_PER_DEG * Math.cos((a.latitude * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
};

/**
 * Kayıtlı adresler arasından cihaza en yakını. Koordinatı olmayan adresler
 * sıralamaya giremez; hiçbirinde koordinat yoksa varsayılan adres döner.
 */
export const enYakinAdres = (
  adresler: Address[],
  cihaz: { latitude: number; longitude: number } | null,
): Address | null => {
  if (adresler.length === 0) return null;
  const varsayilan = adresler.find((a) => a.is_default) ?? adresler[0];
  if (!cihaz) return varsayilan;

  const koordinatli = adresler.filter(
    (a) => typeof a.latitude === 'number' && typeof a.longitude === 'number',
  );
  if (koordinatli.length === 0) return varsayilan;

  return koordinatli.reduce((enYakin, aday) => {
    const d1 = mesafeKm(cihaz, {
      latitude: enYakin.latitude as number,
      longitude: enYakin.longitude as number,
    });
    const d2 = mesafeKm(cihaz, {
      latitude: aday.latitude as number,
      longitude: aday.longitude as number,
    });
    return d2 < d1 ? aday : enYakin;
  }, koordinatli[0]);
};
