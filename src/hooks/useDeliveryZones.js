import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';

function normalizeForCompare(value) {
  return String(value || '').trim().toLocaleLowerCase('tr-TR');
}

function toBool(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = String(value || '').trim().toLowerCase();
  if (['true', '1', 'yes', 'on', 'active'].includes(text)) return true;
  return false;
}

export default function useDeliveryZones() {
  const [deliveryZones, setDeliveryZones] = useState([]);
  const [deliveryZonesLoading, setDeliveryZonesLoading] = useState(false);
  const [deliveryZonesError, setDeliveryZonesError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function fetchDeliveryZones() {
      setDeliveryZonesLoading(true);
      setDeliveryZonesError('');

      try {
        const { data, error } = await supabase
          .from('delivery_zones')
          .select('id,district,neighborhood,is_active,allow_immediate,allow_scheduled')
          .order('district', { ascending: true })
          .order('neighborhood', { ascending: true });

        if (error) throw error;
        if (!isMounted) return;

        const normalized = (Array.isArray(data) ? data : []).map((item) => ({
          ...item,
          district: String(item?.district || '').trim(),
          neighborhood: String(item?.neighborhood || '').trim(),
          is_active: toBool(item?.is_active),
          allow_immediate: toBool(item?.allow_immediate),
          allow_scheduled: toBool(item?.allow_scheduled),
        }));
        setDeliveryZones(normalized);
      } catch (err) {
        if (!isMounted) return;
        setDeliveryZones([]);
        setDeliveryZonesError(err?.message || 'Teslimat bölgeleri yüklenemedi.');
      } finally {
        if (isMounted) setDeliveryZonesLoading(false);
      }
    }

    fetchDeliveryZones();

    return () => {
      isMounted = false;
    };
  }, []);

  const districts = useMemo(() => {
    const districtSet = new Set();
    deliveryZones.forEach((item) => {
      const district = String(item?.district || '').trim();
      if (district) districtSet.add(district);
    });
    return Array.from(districtSet).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [deliveryZones]);

  const getNeighborhoodsByDistrict = useCallback((districtValue) => {
    const normalizedDistrict = normalizeForCompare(districtValue);
    if (!normalizedDistrict) return [];
    return deliveryZones
      .filter((item) => normalizeForCompare(item?.district) === normalizedDistrict)
      .sort((a, b) => String(a?.neighborhood || '').localeCompare(String(b?.neighborhood || ''), 'tr'));
  }, [deliveryZones]);

  return {
    deliveryZones,
    deliveryZonesLoading,
    deliveryZonesError,
    districts,
    getNeighborhoodsByDistrict,
  };
}
