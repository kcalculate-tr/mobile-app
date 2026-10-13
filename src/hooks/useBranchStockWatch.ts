import { useEffect, useRef } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import { useAddressStore } from '../store/addressStore';
import { useCartStore } from '../store/cartStore';
import { getClosedProductIds, invalidateBranchAvailability } from '../lib/branchAvailability';

/**
 * ŞUBE BAZLI STOK İZLEYİCİSİ (13.10.2026)
 *
 * Mutfak bir ürünü kendi şubesi için kapattığında:
 *  · katalogda görünmemesini `src/lib/products.ts` / `categories.ts` hallediyor,
 *  · SEPETTE duran kalemi bu hook düşürüyor ve kullanıcıya söylüyor.
 *
 * Eskiden sessizdi: ürün sepette kalıyor, sipariş sunucuda reddediliyor ve
 * müşteri ödeme ekranında "bir sorun oluştu" görüyordu — neyin yanlış
 * olduğunu anlamasının imkânı yoktu.
 *
 * Ne zaman kontrol edilir:
 *  · açılışta bir kez,
 *  · teslimat adresi değiştiğinde (şube değişmiş olabilir),
 *  · uygulama arka plandan öne geldiğinde (kullanıcı beklerken kapanmış olabilir).
 */
export function useBranchStockWatch() {
  const selectedAddress = useAddressStore((s) => s.selectedAddress);
  const adresAnahtari = selectedAddress
    ? `${selectedAddress.id ?? ''}|${selectedAddress.district ?? ''}|${selectedAddress.neighbourhood ?? ''}`
    : '';
  const kontrolEdiliyor = useRef(false);

  useEffect(() => {
    let mounted = true;

    const kontrolEt = async (force: boolean) => {
      if (kontrolEdiliyor.current) return;
      // Sepet boşsa uyaracak bir şey yok; gereksiz sorgu atma.
      if (useCartStore.getState().items.length === 0) return;

      kontrolEdiliyor.current = true;
      try {
        if (force) invalidateBranchAvailability();
        const { closedProductIds, branchName } = await getClosedProductIds(force);
        if (!mounted || closedProductIds.length === 0) return;

        const dusenler = useCartStore.getState().removeUnavailableItems(closedProductIds);
        if (!mounted || dusenler.length === 0) return;

        Alert.alert(
          'Sepetiniz güncellendi',
          dusenler.length === 1
            ? `"${dusenler[0]}" şu anda ${branchName ? `${branchName} şubesinde ` : ''}tükendi ve sepetinizden çıkarıldı.`
            : `Şu ürünler şu anda ${branchName ? `${branchName} şubesinde ` : ''}tükendi ve sepetinizden çıkarıldı:\n\n• ${dusenler.join('\n• ')}`,
          [{ text: 'Tamam' }],
        );
      } catch {
        // Sessiz geç — stok kontrolü uygulamayı bozmamalı.
      } finally {
        kontrolEdiliyor.current = false;
      }
    };

    kontrolEt(true);

    const sub = AppState.addEventListener('change', (durum: AppStateStatus) => {
      if (durum === 'active') kontrolEt(true);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, [adresAnahtari]);
}
