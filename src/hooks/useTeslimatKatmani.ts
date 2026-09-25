import { useEffect, useState } from 'react';
import { fetchAllDeliveryZones } from '../lib/delivery';
import {
  adresKatmani,
  KatmanBolgeSatiri,
  TeslimatKatmani,
} from '../lib/deliveryTiers';

/**
 * Seçili adresin teslimat katmanını çözer.
 *
 * Yalnız O İLÇENİN satırlarını çeker — tüm delivery_zones 900+ satır ve
 * anasayfada bir rozet için hepsini indirmek gereksiz. İlçe değişmedikçe
 * yeniden sorgu atılmaz.
 *
 * Katman bilinene kadar `null` döner; çağıran taraf bu sırada hiçbir şey
 * göstermemeli — "teslimat yok" yazıp sonra "var"a dönmek, hiç yazmamaktan
 * daha kötü.
 */
export function useTeslimatKatmani(
  ilce: string | null | undefined,
  mahalle: string | null | undefined,
): TeslimatKatmani | null {
  const [katman, setKatman] = useState<TeslimatKatmani | null>(null);

  useEffect(() => {
    const ilceAdi = (ilce || '').trim();
    if (!ilceAdi) {
      setKatman(null);
      return;
    }

    let gecerli = true;
    setKatman(null);

    (async () => {
      try {
        const satirlar = await fetchAllDeliveryZones<KatmanBolgeSatiri>({
          select: 'district, neighborhood, is_active, allow_immediate, allow_scheduled',
          applyFilters: (q) => q.eq('district', ilceAdi),
        });
        if (!gecerli) return;
        setKatman(adresKatmani(satirlar, ilceAdi, mahalle));
      } catch (e) {
        if (__DEV__) console.warn('teslimat katmanı okunamadı:', e);
        // Hata hâlinde sessiz kal: yanlış "teslimat yok" göstermektense
        // hiçbir şey gösterme.
        if (gecerli) setKatman(null);
      }
    })();

    return () => { gecerli = false; };
  }, [ilce, mahalle]);

  return katman;
}
