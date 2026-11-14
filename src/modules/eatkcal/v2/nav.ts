// eatkcal v2 (G13-S2) — rota adları ve parametre tipleri.
//
// `src/navigation/types.ts` bu oturumun dosyası DEĞİL (S1 sahipliği). v2
// rotaları kendi param listesini burada tutar; AppNavigator'a kayıt
// `routes.tsx` üzerinden, yalnız `yeni_siparis` açıkken yapılır. v2 ekranları
// mevcut rotalara da (PaymentScreen, OrderSuccess, ProfileContracts, Login …)
// gidebilsin diye gezinme tipi iki listenin birleşimidir.
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../../navigation/types';

export type EkV2ParamList = {
  /** Mağaza (FinEkStore) — `brandKey` mevcut `brands.key` / ürün `brand` alanı. */
  EkStore: { brandKey: string };
  /** Ürün detayı (FinEkProduct / FinEkProductScroll). */
  EkProduct: { productId: string };
  /** Sepet (FinEkCart / Empty / Skeleton). G25-S1 md.4: `couponCode` → Macro ödül kuponu uygulanır. */
  EkCart: { couponCode?: string } | undefined;
  /** Sipariş özeti — tek sayfa (FinEkCheckout + PayWait/Fail/Unknown). */
  EkCheckout: { selectedAddressId?: string } | undefined;
  /** Adreslerim (FinEkAddresses / Empty). `selectMode` → seçip özete döner. */
  EkAddresses: { selectMode?: boolean } | undefined;
  /** Adres ekle / düzenle (FinEkAddress / NoPerm / NoMap). */
  EkAddressAdd:
    | {
        addressId?: string;
        selectMode?: boolean;
        /** G48-S1: konum kapısından (hizmet verilen İzmir ilçesi) — ilçe önceden dolu. */
        gateDistrict?: string;
        /** G48-S1: kapıdan gelindi → kayıttan sonra eatkcal ana sayfası (ya da kapının `next` hedefi). */
        afterGate?: { next?: 'EkStore' | 'EkCart'; brandKey?: string };
      }
    | undefined;
  /** Siparişlerim (FinEkOrders / Empty / FilterEmpty). */
  EkOrders: undefined;
  /** Sipariş detayı (FinEkOrderDetail). */
  EkOrderDetail: { orderId: number };
  /** İl kapısı (FinSignupEat → SignupEatScreen; FinCityR1/WaitlistR1). */
  EkCityGate: { next?: 'EkStore' | 'EkCart'; brandKey?: string } | undefined;
};

export type EkRouteName = keyof EkV2ParamList;

/** v2 ekranlarının gezinme tipi: v2 rotaları + mevcut kök rotalar. */
export type EkNavList = RootStackParamList & EkV2ParamList;
export type EkNav = NativeStackNavigationProp<EkNavList>;

export function useEkNav(): EkNav {
  return useNavigation<EkNav>();
}
