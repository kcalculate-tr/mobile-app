import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAddressStore } from '../store/addressStore';
import { useDeliveryContextStore } from '../store/deliveryContextStore';
import { cihazKonumunuCoz, enYakinAdres } from '../lib/nearestLocation';
import { invalidateBranchAvailability } from '../lib/branchAvailability';
import type { Address } from '../types';

/**
 * AÇILIŞTA EN YAKIN KONUM (13.10.2026)
 *
 * Trendyol/Yemeksepeti gibi: uygulama açıldığı anda kullanıcının nerede
 * olduğunu bilmeli ki menüyü doğru şubeye göre gösterebilelim. Aksi hâlde
 * şubede tükenen ürün katalogda durmaya devam ediyor ve sorun ancak ödeme
 * anında ortaya çıkıyor.
 *
 * Öncelik sırası — en ucuzdan en pahalıya:
 *  1. Seçili teslimat adresi varsa onu kullan. Konum izni İSTENMEZ.
 *  2. Kullanıcı girişliyse ve kayıtlı adresi varsa, cihaza en yakın olanı seç.
 *  3. Hiçbiri yoksa konum izni iste, GPS'i ilçe/mahalleye çevir.
 *
 * İzin bir kez reddedilirse bir daha açılışta sorulmaz (locationDenied).
 * Hiçbir adımda GPS'ten türetilen konum TESLİMAT ADRESİ yerine geçmez —
 * sipariş her zaman gerçek, kayıtlı adrese gider.
 */
export function useNearestLocationBootstrap() {
  const { user } = useAuth();
  const calisti = useRef(false);

  useEffect(() => {
    if (calisti.current) return;
    calisti.current = true;

    let mounted = true;

    (async () => {
      try {
        const adresDurumu = useAddressStore.getState();
        const baglam = useDeliveryContextStore.getState();

        // 1) Seçili adres varsa iş bitti — izin isteme.
        const secili = adresDurumu.selectedAddress;
        if (secili?.district) {
          baglam.setContext({
            district: secili.district,
            neighbourhood: secili.neighbourhood,
            latitude: secili.latitude ?? null,
            longitude: secili.longitude ?? null,
            source: 'address',
          });
          invalidateBranchAvailability();
          return;
        }

        // 2) Girişli kullanıcının kayıtlı adresleri arasından en yakını.
        if (user?.id) {
          const { getSupabaseClient } = await import('../lib/supabase');
          const { data } = await getSupabaseClient()
            .from('addresses')
            .select('*')
            .eq('user_id', user.id);

          const adresler = (data ?? []) as Address[];
          if (adresler.length > 0) {
            const konum = await cihazKonumunuCoz(false); // izin varsa kullan, yoksa sorma
            const sec = enYakinAdres(adresler, konum);
            if (mounted && sec) {
              useAddressStore.getState().setSelectedAddress(sec);
              useDeliveryContextStore.getState().setContext({
                district: sec.district,
                neighbourhood: sec.neighbourhood,
                latitude: sec.latitude ?? null,
                longitude: sec.longitude ?? null,
                source: 'address',
              });
              invalidateBranchAvailability();
              return;
            }
          }
        }

        // 3) Adres yok — konumu sor (bir kez reddedildiyse sorma).
        if (baglam.locationDenied) return;

        const konum = await cihazKonumunuCoz(true);
        if (!mounted) return;

        if (!konum) {
          useDeliveryContextStore.getState().setLocationDenied(true);
          return;
        }

        useDeliveryContextStore.getState().setContext({
          district: konum.district,
          neighbourhood: konum.neighbourhood,
          latitude: konum.latitude,
          longitude: konum.longitude,
          source: 'gps',
        });
        invalidateBranchAvailability();
      } catch {
        // Konum çözümü uygulamayı asla bozmamalı — sessiz geç.
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user?.id]);
}
