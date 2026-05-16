import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildCartLineKey, normalizeSelectedOptions } from '../lib/cart';
import { calculateOptionsPriceModifier, getEffectivePrice, hasDiscount } from '../utils/price';
import type { CartItem, CartSelectedOptions, CartState, Product } from '../types';

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      appliedCoupon: null,

      addItem: (product: Product, options: Partial<CartSelectedOptions>, quantity = 1) => {
        const normalizedOptions = normalizeSelectedOptions(options);
        const templateOptions = normalizedOptions.templateOptions;
        const lineKey = buildCartLineKey(
          String(product.id),
          normalizedOptions.byGroup,
          templateOptions,
        );
        const effectivePrice = getEffectivePrice(product);
        const templateModifier = calculateOptionsPriceModifier(templateOptions);
        const unitPrice = Number(
          (effectivePrice + normalizedOptions.extraPrice + templateModifier).toFixed(2),
        );

        const productHasDiscount = hasDiscount(product);
        const originalUnitPrice = productHasDiscount
          ? Number(
              ((Number(product.price) || 0) + normalizedOptions.extraPrice + templateModifier).toFixed(2),
            )
          : undefined;

        const calorieMod = (templateOptions ?? []).reduce(
          (s, o) => s + (Number(o.calorie_modifier) || 0),
          0,
        );
        const proteinMod = (templateOptions ?? []).reduce(
          (s, o) => s + (Number(o.protein_modifier) || 0),
          0,
        );
        const carbsMod = (templateOptions ?? []).reduce(
          (s, o) => s + (Number(o.carbs_modifier) || 0),
          0,
        );
        const fatsMod = (templateOptions ?? []).reduce(
          (s, o) => s + (Number(o.fats_modifier) || 0),
          0,
        );
        const effectiveCalories = Math.max(0, Math.round((Number(product.calories) || 0) + calorieMod));
        const effectiveProtein = Math.max(0, (Number(product.protein) || 0) + proteinMod);
        const effectiveCarbs = Math.max(0, (Number(product.carbs) || 0) + carbsMod);
        const effectiveFats = Math.max(0, (Number(product.fats) || 0) + fatsMod);

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
            originalUnitPrice,
            discountType: productHasDiscount ? (product.discount_type ?? null) : null,
            discountValue: productHasDiscount ? (product.discount_value ?? null) : null,
            calories: product.calories,
            protein: product.protein,
            carbs: product.carbs,
            fats: product.fats,
            img: product.img ?? undefined,
            selectedOptions: normalizedOptions,
            selected_options: templateOptions,
            effective_calories: effectiveCalories,
            effective_protein: effectiveProtein,
            effective_carbs: effectiveCarbs,
            effective_fats: effectiveFats,
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
            kcal: acc.kcal + (item.effective_calories ?? item.calories ?? 0) * item.quantity,
            protein: acc.protein + (item.effective_protein ?? item.protein ?? 0) * item.quantity,
            carbs: acc.carbs + (item.effective_carbs ?? item.carbs ?? 0) * item.quantity,
            fats: acc.fats + (item.effective_fats ?? item.fats ?? 0) * item.quantity,
          }),
          { kcal: 0, protein: 0, carbs: 0, fats: 0 },
        );
      },
    }),
    {
      name: 'kcal-cart',
      storage: createJSONStorage(() => AsyncStorage),
      version: 4,
      migrate: (_persistedState, _version) => ({
        items: [],
        appliedCoupon: null,
      }) as Partial<CartState>,
    },
  ),
);
