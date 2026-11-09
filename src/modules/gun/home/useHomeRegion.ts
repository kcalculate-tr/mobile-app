// G18-S2 md.4 — Ana sayfa bölgesi kancası: kayıtlı adres → seçilen il → izinli konum.
// İzin İSTEMİ AÇMAZ (yalnız önceden verilmişse son bilinen konum okunur).
// `enabled` false iken (bayrak kapalı) hiçbir okuma yapılmaz.
import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

import { useAddressStore } from '../../../store/addressStore';
import { readCityGatePassed, readNotifyCities } from '../../eatkcal/cityGateStorage';
import { resolveHomeRegion, type HomeRegion } from './region';

let override: HomeRegion | null = null;
/** Yalnız vitrin/test: bölgeyi sabitler (null → gerçek çözüm). */
export function setHomeRegionOverride(r: HomeRegion | null): void {
  override = r;
}

async function readChosenCity(): Promise<'izmir' | 'other' | null> {
  if (await readCityGatePassed()) return 'izmir';
  const notify = await readNotifyCities();
  return notify.length > 0 ? 'other' : null;
}

async function readPermittedCoords(): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 24 * 3600 * 1000 });
    return last ? { latitude: last.coords.latitude, longitude: last.coords.longitude } : null;
  } catch {
    return null;
  }
}

export function useHomeRegion(enabled: boolean): HomeRegion {
  const addressCity = useAddressStore((s) => (s.selectedAddress as { city?: string | null } | null)?.city ?? null);
  const [region, setRegion] = useState<HomeRegion>(override ?? 'unknown');
  useEffect(() => {
    if (!enabled) return;
    if (override) {
      setRegion(override);
      return;
    }
    const fromAddress = resolveHomeRegion({ addressCity });
    if (fromAddress !== 'unknown') {
      setRegion(fromAddress);
      return;
    }
    let alive = true;
    (async () => {
      const chosenCity = await readChosenCity();
      if (chosenCity) {
        if (alive) setRegion(chosenCity);
        return;
      }
      const coords = await readPermittedCoords();
      if (alive) setRegion(resolveHomeRegion({ coords }));
    })();
    return () => {
      alive = false;
    };
  }, [enabled, addressCity]);
  return region;
}
