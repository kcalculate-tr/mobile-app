// eatkcal v2 (G13-S2 md.1–2) — "Hemen · 30-55 dk" çipi için veri.
// Seçili adres (addressStore) → bölge satırları (mevcut fetchAllDeliveryZones,
// ilçe filtresi) → pickZoneRowForAddress → formatEstimatedDelivery. Dükkan açık
// mı: mevcut fetchBusinessHours + isShopOpenNow. YALNIZ GÖSTERİM — ücret,
// minimum ve teslimat izni kararları Sipariş özeti'nde mevcut akışla verilir.
import { useEffect, useMemo, useState } from 'react';
import { fetchAllDeliveryZones, type DeliveryZoneRow } from '../../../../../lib/delivery';
import { fetchBusinessHours, isShopOpenNow, type BusinessHours } from '../../../../../lib/businessHours';
import { useAddressStore } from '../../../../../store/addressStore';
import { deliveryChip, pickZoneRowForAddress } from '../../model/homeData';

export function useDeliveryChip(knownHours?: BusinessHours | null) {
  const address = useAddressStore((s) => s.selectedAddress);
  const [rows, setRows] = useState<DeliveryZoneRow[]>([]);
  const [hours, setHours] = useState<BusinessHours | null>(knownHours ?? null);

  useEffect(() => {
    if (knownHours !== undefined) {
      setHours(knownHours);
      return;
    }
    let alive = true;
    fetchBusinessHours()
      .then((bh) => alive && setHours(bh))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [knownHours]);

  useEffect(() => {
    const district = address?.district;
    if (!district) {
      setRows([]);
      return;
    }
    let alive = true;
    fetchAllDeliveryZones({ applyFilters: (q) => q.eq('district', district) })
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, [address?.district]);

  const chip = useMemo(
    () => deliveryChip(pickZoneRowForAddress(rows, address), hours ? isShopOpenNow(hours) : true),
    [rows, address, hours],
  );
  return { address, chip };
}
