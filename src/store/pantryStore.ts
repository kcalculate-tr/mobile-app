import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PantryItem {
  id: string;
  productId: string;
  orderItemId?: string;
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
  removedOrderItemIds: string[];
  addItems: (items: Omit<PantryItem, 'id' | 'addedAt'>[]) => void;
  addItemsFromOrders: (items: Omit<PantryItem, 'id' | 'addedAt'>[]) => void;
  consumeItem: (id: string) => PantryItem | null;
  removeItem: (id: string) => void;
}

const makeId = (productKey: string) =>
  `${productKey}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export const usePantryStore = create<PantryState>()(
  persist(
    (set, get) => ({
      items: [],
      removedOrderItemIds: [],
      addItems: (newItems) => {
        const now = new Date().toISOString();
        const pantryItems: PantryItem[] = newItems.map((item) => ({
          ...item,
          id: makeId(item.productId),
          addedAt: now,
        }));
        set((state) => ({ items: [...state.items, ...pantryItems] }));
      },
      addItemsFromOrders: (newItems) => {
        const state = get();
        const existing = new Set<string>([
          ...state.items
            .map((i) => i.orderItemId)
            .filter((x): x is string => typeof x === 'string' && x.length > 0),
          ...state.removedOrderItemIds,
        ]);

        const fresh = newItems.filter(
          (i) =>
            typeof i.orderItemId === 'string' &&
            i.orderItemId.length > 0 &&
            !existing.has(i.orderItemId),
        );

        if (fresh.length === 0) return;

        const now = new Date().toISOString();
        const pantryItems: PantryItem[] = fresh.map((item) => ({
          ...item,
          id: makeId(item.orderItemId ?? item.productId),
          addedAt: now,
        }));
        set((s) => ({ items: [...s.items, ...pantryItems] }));
      },
      consumeItem: (id) => {
        const item = get().items.find((i) => i.id === id) ?? null;
        set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
        return item;
      },
      removeItem: (id) => {
        const target = get().items.find((i) => i.id === id);
        set((state) => {
          const nextItems = state.items.filter((i) => i.id !== id);
          if (!target?.orderItemId) {
            return { items: nextItems };
          }
          if (state.removedOrderItemIds.includes(target.orderItemId)) {
            return { items: nextItems };
          }
          return {
            items: nextItems,
            removedOrderItemIds: [...state.removedOrderItemIds, target.orderItemId],
          };
        });
      },
    }),
    {
      name: 'pantry-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
