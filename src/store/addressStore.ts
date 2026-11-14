import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Address } from '../types';
import { ANON_OWNER, ownerKeyFor } from './cartOwner';

type AddressStore = {
  selectedAddress: Address | null;
  /** G48 md.1: seçili adresin sahibi (kullanıcı kimliği ya da 'anon'). */
  ownerKey: string;
  setSelectedAddress: (address: Address | null) => void;
  /**
   * G48 md.1: oturum değişti. Sahip farklıysa seçim temizlenir; girişte
   * `AuthContext.hydrateSelectedAddress` kullanıcının kendi adresinden doldurur.
   */
  switchOwner: (userId: string | null) => void;
};

export const useAddressStore = create<AddressStore>()(
  persist(
    (set, get) => ({
      selectedAddress: null,
      ownerKey: ANON_OWNER,
      setSelectedAddress: (address) => set({ selectedAddress: address }),
      switchOwner: (userId) => {
        const key = ownerKeyFor(userId);
        if (get().ownerKey === key) return;
        set({ ownerKey: key, selectedAddress: null });
      },
    }),
    {
      name: 'kcal-selected-address',
      storage: createJSONStorage(() => AsyncStorage),
      // v1 (G48 md.1): eski sahipsiz seçim kimin olduğu bilinmediği için temizlenir.
      version: 1,
      partialize: (s) => ({ selectedAddress: s.selectedAddress, ownerKey: s.ownerKey }),
      migrate: () => ({ selectedAddress: null, ownerKey: ANON_OWNER }) as unknown as AddressStore,
    },
  ),
);
