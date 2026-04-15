import { create } from 'zustand';
import { Address } from '../types';

type AddressStore = {
  selectedAddress: Address | null;
  setSelectedAddress: (address: Address | null) => void;
};

export const useAddressStore = create<AddressStore>((set) => ({
  selectedAddress: null,
  setSelectedAddress: (address) => set({ selectedAddress: address }),
}));
