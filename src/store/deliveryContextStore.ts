import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * TESLİMAT BAĞLAMI (13.10.2026)
 *
 * Yalnız "hangi şubeye düşerim" sorusunu cevaplamak için tutulan hafif konum.
 * Katalog filtresi (şubede kapatılmış ürünler) bunu kullanır.
 *
 * DİKKAT — bu bir TESLİMAT ADRESİ DEĞİLDİR ve asla öyle kullanılmamalıdır.
 * Sipariş hep `addressStore.selectedAddress`'e (gerçek, kayıtlı adres) gider.
 * GPS'ten türetilmiş bir ilçe/mahalle ile sipariş oluşturulursa kurye yanlış
 * yere gider; bu yüzden iki kavram bilerek ayrı tutuluyor.
 */
export type TeslimatBaglamiKaynagi = 'address' | 'gps';

type DeliveryContextStore = {
  district: string | null;
  neighbourhood: string | null;
  latitude: number | null;
  longitude: number | null;
  source: TeslimatBaglamiKaynagi | null;
  updatedAt: number | null;
  /** Kullanıcı konum iznini reddetti — açılışta tekrar tekrar sorma. */
  locationDenied: boolean;

  setContext: (v: {
    district: string | null;
    neighbourhood: string | null;
    latitude?: number | null;
    longitude?: number | null;
    source: TeslimatBaglamiKaynagi;
  }) => void;
  setLocationDenied: (denied: boolean) => void;
  clear: () => void;
};

export const useDeliveryContextStore = create<DeliveryContextStore>()(
  persist(
    (set) => ({
      district: null,
      neighbourhood: null,
      latitude: null,
      longitude: null,
      source: null,
      updatedAt: null,
      locationDenied: false,

      setContext: ({ district, neighbourhood, latitude, longitude, source }) =>
        set({
          district: district || null,
          neighbourhood: neighbourhood || null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          source,
          updatedAt: Date.now(),
        }),

      setLocationDenied: (denied) => set({ locationDenied: denied }),

      clear: () =>
        set({
          district: null,
          neighbourhood: null,
          latitude: null,
          longitude: null,
          source: null,
          updatedAt: null,
        }),
    }),
    {
      name: 'kcal-delivery-context',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
