import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { fetchAllDeliveryZones } from '../lib/supabaseHelpers';

function normalizeForCompare(value) {
  return String(value || '').trim().toLocaleLowerCase('tr-TR');
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
        // Paginated read — a single .select() stops at 1000 rows and loses
        // late-alphabetical districts once mahalleler grow past that cap.
        const data = await fetchAllDeliveryZones({ orderBy: ['district'] });

        if (!isMounted) return;

        const normalized = data.map((item) => ({
          ...item,
          city: String(item?.city || '').trim(),
          district: String(item?.district || '').trim(),
          neighborhood: String(item?.neighborhood || '').trim(),
          is_active: toBool(item?.is_active),
          min_order: Math.max(0, toNumber(item?.min_order, 0)),
          allow_immediate: toBool(item?.allow_immediate),
          allow_scheduled: toBool(item?.allow_scheduled),
        }))
          .sort((a, b) => {
            const districtDiff = String(a?.district || '').localeCompare(String(b?.district || ''), 'tr');
            if (districtDiff !== 0) return districtDiff;
            return String(a?.neighborhood || '').localeCompare(String(b?.neighborhood || ''), 'tr');
          });
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

  const districtConfigs = useMemo(() => {
    const districtMap = new Map();

    deliveryZones.forEach((item) => {
      const districtName = String(item?.district || '').trim();
      if (!districtName) return;

      const key = normalizeForCompare(districtName);
      const cityName = String(item?.city || '').trim();
      const active = toBool(item?.is_active);
      const minOrder = Math.max(0, toNumber(item?.min_order, 0));

      if (!districtMap.has(key)) {
        districtMap.set(key, {
          district: districtName,
          city: cityName,
          is_active: active,
          min_order: minOrder,
        });
        return;
      }

      const current = districtMap.get(key);
      current.is_active = current.is_active || active;
      current.min_order = Math.max(current.min_order, minOrder);
      if (!current.city && cityName) current.city = cityName;
    });

    return Array.from(districtMap.values()).sort((a, b) => (
      String(a?.district || '').localeCompare(String(b?.district || ''), 'tr')
    ));
  }, [deliveryZones]);

  const getDistrictConfig = useCallback((districtValue) => {
    const normalizedDistrict = normalizeForCompare(districtValue);
    if (!normalizedDistrict) return null;

    return districtConfigs.find((item) => normalizeForCompare(item?.district) === normalizedDistrict) || null;
  }, [districtConfigs]);

  const fetchDistrictConfigByDistrict = useCallback(async (districtValue) => {
    const district = String(districtValue || '').trim();
    if (!district) {
      return { status: 'not_configured', data: null };
    }

    const { data, error } = await supabase
      .from('delivery_zones')
      .select('district,is_active,min_order,updated_at')
      .eq('district', district)
      .order('updated_at', { ascending: false })
      .order('min_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (import.meta.env.DEV) {
        console.error('fetchDistrictConfigByDistrict error:', {
          code: error?.code || '',
          message: error?.message || '',
        });
      }
      return { status: 'error', data: null };
    }

    if (!data) {
      return { status: 'not_configured', data: null };
    }

    return {
      status: 'ok',
      data: {
        district: String(data?.district || district).trim(),
        is_active: toBool(data?.is_active),
        min_order: Math.max(0, toNumber(data?.min_order, 0)),
      },
    };
  }, []);

  return {
    deliveryZones,
    deliveryZonesLoading,
    deliveryZonesError,
    districts,
    districtConfigs,
    getDistrictConfig,
    fetchDistrictConfigByDistrict,
    getNeighborhoodsByDistrict,
  };
}
