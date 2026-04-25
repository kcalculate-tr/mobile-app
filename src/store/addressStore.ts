import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Address } from '../types';

type AddressStore = {
  selectedAddress: Address | null;
  setSelectedAddress: (address: Address | null) => void;
};

export const useAddressStore = create<AddressStore>()(
  persist(
    (set) => ({
      selectedAddress: null,
      setSelectedAddress: (address) => set({ selectedAddress: address }),
    }),
    {
      name: 'kcal-selected-address',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
