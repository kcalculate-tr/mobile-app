import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildCartLineKey, normalizeSelectedOptions } from '../lib/cart';
import type { CartItem, CartSelectedOptions, CartState, Product } from '../types';

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      appliedCoupon: null,

      addItem: (product: Product, options: Partial<CartSelectedOptions>, quantity = 1) => {
        const normalizedOptions = normalizeSelectedOptions(options);
        const lineKey = buildCartLineKey(String(product.id), normalizedOptions.byGroup);
        const unitPrice = Number((product.price + normalizedOptions.extraPrice).toFixed(2));

        set((state) => {
          const existingIndex = state.items.findIndex((item) => item.lineKey === lineKey);

          if (existingIndex >= 0) {
            const updatedItems = [...state.items];
            updatedItems[existingIndex] = {
              ...updatedItems[existingIndex],
              quantity: updatedItems[existingIndex].quantity + quantity,
            };
            return { items: updatedItems };
          }

          const newItem: CartItem = {
            lineKey,
            productId: String(product.id),
            name: product.name,
            quantity,
            unitPrice,
            calories: product.calories,
            protein: product.protein,
            carbs: product.carbs,
            fats: product.fats,
            img: product.img ?? undefined,
            selectedOptions: normalizedOptions,
          };

          return { items: [...state.items, newItem] };
        });
      },

      removeItem: (lineKey: string) => {
        set((state) => ({
          items: state.items.filter((item) => item.lineKey !== lineKey),
        }));
      },

      updateQuantity: (lineKey: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeItem(lineKey);
          return;
        }
        set((state) => ({
          items: state.items.map((item) =>
            item.lineKey === lineKey ? { ...item, quantity } : item,
          ),
        }));
      },

      clearCart: () => set({ items: [], appliedCoupon: null }),

      setCoupon: (coupon) => set({ appliedCoupon: coupon }),

      clearCoupon: () => set({ appliedCoupon: null }),

      getDiscountAmount: (subtotal: number) => {
        const { appliedCoupon } = get();
        if (!appliedCoupon) return 0;
        if (subtotal < (appliedCoupon.minOrderAmount || 0)) return 0;
        const type = appliedCoupon.discountType;
        if (type === 'percent' || type === 'percentage') {
          return Math.floor(subtotal * (appliedCoupon.discountValue / 100));
        }
        return Math.min(appliedCoupon.discountValue, subtotal);
      },

      getSubtotal: () => {
        const { items } = get();
        return Number(
          items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toFixed(2),
        );
      },

      getTotalMacros: () => {
        const { items } = get();
        return items.reduce(
          (acc, item) => ({
            kcal: acc.kcal + (item.calories ?? 0) * item.quantity,
            protein: acc.protein + (item.protein ?? 0) * item.quantity,
            carbs: acc.carbs + (item.carbs ?? 0) * item.quantity,
            fats: acc.fats + (item.fats ?? 0) * item.quantity,
          }),
          { kcal: 0, protein: 0, carbs: 0, fats: 0 },
        );
      },
    }),
    {
      name: 'kcal-cart',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
