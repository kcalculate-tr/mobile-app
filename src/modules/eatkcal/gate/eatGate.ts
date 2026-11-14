// G48-S1 md.2 — eatkcal konum kapısı: veri tarafı (NATIVE; saf kural gateRule.ts'te).
//  • Oturumlu: sunucuda kayıtlı adres var mı (`addresses`, 1 satır yeter). Sonuç hesap başına
//    cihazda önbelleklenir (`eatkcal-has-address:<uid>`) — sorgu başarısızsa son bilinen değer.
//  • Oturumsuz: cihazdaki "kapı geçildi" işareti (yalnız oturumsuz gezinme için; cityGateStorage).
//  • İzmir ilçeleri: `delivery_zones` (uygulamanın mevcut okuma yolu fetchAllDeliveryZones; RLS okuma açık).
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '../../../core/supabase';
import { fetchAllDeliveryZones } from '../../../lib/delivery';
import { readCityGatePassed } from '../cityGateStorage';
import { useAddressStore } from '../../../store/addressStore';
import { buildDistrictList, shouldShowGate, type DistrictOption } from './gateRule';

const cacheKey = (uid: string) => `eatkcal-has-address:${uid}`;
let memo: { uid: string; has: boolean } | null = null;
let devForce: boolean | null = null;

/** YALNIZ __DEV__ vitrini: kapıyı zorla göster (true) / geç (false) / gerçek kural (null). */
export function __devForceEatGate(show: boolean | null): void {
  if (__DEV__) devForce = show;
}

async function remember(uid: string, has: boolean): Promise<void> {
  memo = { uid, has };
  try {
    await AsyncStorage.setItem(cacheKey(uid), has ? '1' : '0');
  } catch {
    /* yut */
  }
}

async function readCache(uid: string): Promise<boolean | null> {
  try {
    const v = await AsyncStorage.getItem(cacheKey(uid));
    return v === '1' ? true : v === '0' ? false : null;
  } catch {
    return null;
  }
}

/** Sunucudaki adres sayısı (0 / 1); hata ya da ağ yoksa null. */
export async function fetchAddressCount(uid: string): Promise<number | null> {
  try {
    const { data, error } = await getSupabaseClient().from('addresses').select('id').eq('user_id', uid).limit(1);
    if (error || !Array.isArray(data)) return null;
    return data.length;
  } catch {
    return null;
  }
}

async function sessionUserId(): Promise<string | null> {
  try {
    const { data } = await getSupabaseClient().auth.getSession();
    return data?.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Kapı gösterilmeli mi? `userId` verilmezse oturumdan okunur (null = oturumsuz). */
export async function resolveEatGate(userId?: string | null): Promise<boolean> {
  if (__DEV__ && devForce != null) return devForce;
  const uid = userId === undefined ? await sessionUserId() : userId;
  if (!uid) {
    return shouldShowGate({ signedIn: false, addressCount: null, lastKnownHasAddress: null, anonPassed: await readCityGatePassed() });
  }
  const count = await fetchAddressCount(uid);
  let last: boolean | null = memo?.uid === uid ? memo.has : null;
  if (count != null) await remember(uid, count > 0);
  else if (last == null) last = await readCache(uid);
  return shouldShowGate({ signedIn: true, addressCount: count, lastKnownHasAddress: last, anonPassed: false });
}

/** Önbellekten anlık karar (ilk karede boş ekran olmasın): true = geç, false = kapı, null = bilinmiyor. */
export function peekEatGatePassed(userId: string | null): boolean | null {
  if (__DEV__ && devForce != null) return !devForce;
  if (userId && memo?.uid === userId) return memo.has;
  // Bu hesabın seçili adresi cihazda varsa (sahibi aynı) adres var demektir; sunucu sorgusu doğrular.
  const a = useAddressStore.getState();
  if (userId && a.selectedAddress && a.ownerKey === userId) return true;
  return null;
}

export async function readEatGatePassed(): Promise<boolean> {
  return !(await resolveEatGate());
}

/** Adres kaydedildi → bu hesap için kapı kalkar. */
export function markHasAddress(uid: string | null | undefined): void {
  if (uid) void remember(uid, true);
}

/** Oturum kapandı / değişti. */
export function invalidateEatGateCache(): void {
  memo = null;
}

/** Ekran kancası: 'unknown' | 'show' | 'pass'; odakta ve oturum değişince yeniden değerlendirilir. */
export function useEatGate(userId: string | null) {
  const peek = peekEatGatePassed(userId);
  const [state, setState] = useState<'unknown' | 'show' | 'pass'>(peek == null ? 'unknown' : peek ? 'pass' : 'show');
  const seq = useRef(0);
  const recheck = useCallback(async () => {
    const my = ++seq.current;
    const show = await resolveEatGate(userId).catch(() => true);
    if (seq.current === my) setState(show ? 'show' : 'pass');
  }, [userId]);
  useEffect(() => {
    void recheck();
  }, [recheck]);
  return { state, recheck, setState };
}

// ── İzmir ilçeleri ───────────────────────────────────────────────────────────
let districtCache: DistrictOption[] | null = null;
let districtLoad: Promise<DistrictOption[]> | null = null;

export function fetchIzmirDistricts(): Promise<DistrictOption[]> {
  if (districtCache) return Promise.resolve(districtCache);
  if (districtLoad) return districtLoad;
  districtLoad = fetchAllDeliveryZones<Record<string, unknown>>({ select: 'city,district,is_active' })
    .then((rows) => {
      const list = buildDistrictList(rows);
      if (list.length > 0) districtCache = list;
      return list;
    })
    .finally(() => {
      districtLoad = null;
    });
  return districtLoad;
}

export function useIzmirDistricts() {
  const [list, setList] = useState<DistrictOption[]>(districtCache ?? []);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>(districtCache ? 'ok' : 'loading');
  const load = useCallback(() => {
    setStatus((s) => (s === 'ok' ? s : 'loading'));
    fetchIzmirDistricts()
      .then((l) => {
        setList(l);
        setStatus(l.length > 0 ? 'ok' : 'error');
      })
      .catch(() => setStatus('error'));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return { list, status, retry: load };
}
