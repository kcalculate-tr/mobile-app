import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PantryItem {
  id: string;
  productId: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  quantity: number;
  addedAt: string;
  imageUrl?: string;
}

interface PantryState {
  items: PantryItem[];
  addItems: (items: Omit<PantryItem, 'id' | 'addedAt'>[]) => void;
  consumeItem: (id: string) => PantryItem | null;
  removeItem: (id: string) => void;
}

export const usePantryStore = create<PantryState>()(
  persist(
    (set, get) => ({
      items: [],
      addItems: (newItems) => {
        const now = new Date().toISOString();
        const pantryItems: PantryItem[] = newItems.map((item) => ({
          ...item,
          id: `${item.productId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          addedAt: now,
        }));
        set((state) => ({ items: [...state.items, ...pantryItems] }));
      },
      consumeItem: (id) => {
        const item = get().items.find((i) => i.id === id) ?? null;
        set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
        return item;
      },
      removeItem: (id) => {
        set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
      },
    }),
    {
      name: 'pantry-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
