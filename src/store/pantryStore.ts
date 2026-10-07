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
  pruneStale: (maxAgeDays: number) => void;
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
          // Deterministik: order line başına stabil id (storage yeniden kurulsa
          // da aynı) → instanceId=`${id}-${i}` = source_ref deterministik.
          id: item.orderItemId ?? makeId(item.productId),
          addedAt: now,
        }));
        set((s) => ({ items: [...s.items, ...pantryItems] }));
      },
      consumeItem: (id) => {
        const item = get().items.find((i) => i.id === id) ?? null;
        set((state) => ({ items: state.items.filter((i) => i.id !== id) }));
        return item;
      },
      // 07.10.2026: dolap HIC budanmiyordu. backfillPantry yalnizca son 30
      // gunde teslim edilen siparisleri EKLIYOR; eski item'lar AsyncStorage'da
      // sonsuza kadar kaliyordu. TrackerScreen'in "tuketildi" isareti ise
      // yalnizca son 30 gunun meal_consumptions satirlarindan turetiliyor —
      // yani 30 gunden eski bir dolap item'i "tuketilmemis" gorunuyor, ama
      // DB'de satiri duruyor. Kullanici "Tukettim" dediginde upsert unique
      // kisitina carpip SESSIZCE hicbir sey yazmiyor. Iki pencereyi ayni
      // tutmak bu sinifi kapatir.
      pruneStale: (maxAgeDays) => {
        const esik = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
        set((state) => {
          const kalan = state.items.filter((i) => {
            const t = Date.parse(String(i.addedAt));
            // addedAt okunamiyorsa item'i ATMA — veri kaybindan iyi.
            return Number.isNaN(t) ? true : t >= esik;
          });
          return kalan.length === state.items.length ? state : { items: kalan };
        });
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
