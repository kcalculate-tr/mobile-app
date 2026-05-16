import { create } from 'zustand';

interface OnboardingState {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: {
    il: string;
    ilce: string;
    mahalle: string;
    street: string;
    fullAddress: string;
  };

  setAuth: (email: string, password: string) => void;
  setIdentity: (firstName: string, lastName: string, phone: string) => void;
  setAddress: (addr: OnboardingState['address']) => void;
  reset: () => void;
}

const initial = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phone: '',
  address: { il: 'İzmir', ilce: '', mahalle: '', street: '', fullAddress: '' },
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initial,
  setAuth: (email, password) => set({ email, password }),
  setIdentity: (firstName, lastName, phone) => set({ firstName, lastName, phone }),
  setAddress: (address) => set({ address }),
  reset: () => set(initial),
}));
