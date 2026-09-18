import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildCartLineKey, normalizeSelectedOptions } from '../lib/cart';
import { supabase } from '../lib/supabase';
import { calculateOptionsPriceModifier, getEffectivePrice, hasDiscount } from '../utils/price';
import { logEvent, track } from '../lib/analytics';
import { computeLineMacros, computeUnitMacros } from '../lib/itemMacros';
import type { CartItem, CartSelectedOptions, CartState, Product } from '../types';

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      appliedCoupon: null,

      addItem: (
        product: Product,
        options: Partial<CartSelectedOptions>,
        quantity = 1,
        parentLineKey?: string,
      ) => {
        const normalizedOptions = normalizeSelectedOptions(options);
        const templateOptions = normalizedOptions.templateOptions;
        // FIX 5 grup: ekstra (child) kalemin lineKey'i parent + ürün ile
        // namespace'lenir → standalone aynı ürünle MERGE olmaz, parent
        // başına ayrışır, cascade silme parentLineKey üzerinden çalışır.
        const lineKey = parentLineKey
          ? `${parentLineKey}::x::${product.id}`
          : buildCartLineKey(
              String(product.id),
              normalizedOptions.byGroup,
              templateOptions,
            );
        const effectivePrice = getEffectivePrice(product);
        const templateModifier = calculateOptionsPriceModifier(templateOptions);

        // Bundle kalemi: slot ekstraları fiyata ETKİ ETMEZ (tek bundle fiyatı),
        // makrolar seçilen öğünlerin TOPLAMI. Normal ürün davranışı değişmez.
        const bundleSelections =
          product.is_bundle && Array.isArray(normalizedOptions.bundleSelections)
            ? normalizedOptions.bundleSelections
            : undefined;

        // FIX: ekstra/gramaj farkı HER ZAMAN fiyata eklenir (bundle dahil).
        // Önceden is_bundle'da extraPrice atılıyordu → ücretli ekstralar
        // (protein gramaj, ekstra garnitür, legacy paket premium'ları) sepete
        // taşınmıyordu (gelir kaybı). makro/bundleSelections mantığı korunur.
        const unitPrice = Number(
          (effectivePrice + normalizedOptions.extraPrice + templateModifier).toFixed(2),
        );

        const productHasDiscount = hasDiscount(product);
        const originalUnitPrice = productHasDiscount
          ? Number(
              (
                (Number(product.price) || 0) +
                normalizedOptions.extraPrice + templateModifier
              ).toFixed(2),
            )
          : undefined;

        // Tek paylaşılan makro kaynağı (src/lib/itemMacros) — bundle ise alt
        // ürün seçimlerinin toplamı, değilse ürün + seçili opsiyon/gramaj
        // modifikatörleri. Sepet/ürün detayı/checkout/tracker hep bunu kullanır.
        const unitMacros = computeUnitMacros({
          product,
          templateOptions,
          bundleSelections,
        });

        set((state) => {
          const existingIndex = state.items.findIndex((item) => item.lineKey === lineKey);

          if (existingIndex >= 0) {
            // Ekstra (child) kalemler sabit x1 kalır — parent miktarı
            // artsa/ tekrar eklense bile child çoğalmaz (basit UX).
            if (parentLineKey) {
              return { items: state.items };
            }
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
            // Birim başı, modifikatör/bundle toplamı DAHİL edilmiş nihai değer
            // (bkz. computeUnitMacros) — CartScreen/orders.ts bunu tekrar
            // modifikatörlerle işlemeden, sadece adetle çarpar.
            calories: unitMacros.kcal ?? undefined,
            protein: unitMacros.protein ?? undefined,
            carbs: unitMacros.carbs ?? undefined,
            fats: unitMacros.fat ?? undefined,
            img: product.img ?? undefined,
            selectedOptions: normalizedOptions,
            selected_options: templateOptions,
            bundle_selections: bundleSelections,
            parentLineKey,
          };

          return { items: [...state.items, newItem] };
        });

        // Sadece parent kalem için AddToCart event'i (child ekstralar
        // parent ile birlikte zaten sayıldı — çift event olmasın).
        if (!parentLineKey) {
          logEvent.addToCart(String(product.id), unitPrice, quantity);
          track('add_to_cart', {
            product_id: String(product.id),
            price: unitPrice,
            quantity,
            brand: product.brand ?? undefined,
            category: product.category ?? undefined,
          });
        }
      },

      removeItem: (lineKey: string) => {
        // Silmeden önce oku — cascade filtreleme sonrası item referansı kaybolur.
        const removed = get().items.find((i) => i.lineKey === lineKey);

        set((state) => ({
          // Parent silinince ekstra (child) kalemleri de cascade sil.
          items: state.items.filter(
            (item) => item.lineKey !== lineKey && item.parentLineKey !== lineKey,
          ),
        }));

        // addToCart ile simetrik: yalnızca parent kalem için event (child cascade
        // silmeler ayrı sayılmasın).
        if (removed && !removed.parentLineKey) {
          track('remove_from_cart', {
            product_id: removed.productId,
            price: removed.unitPrice,
            quantity: removed.quantity,
          });
        }
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
        // discount_amount validate_coupon RPC tarafından apply anında
        // hesaplanır (max_discount dahil); burada yalnız subtotal'ı aşmasın
        // diye clamp ediyoruz.
        return Math.min(appliedCoupon.discountAmount, subtotal);
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
          (acc, item) => {
            // item zaten birim başı, modifikatör/bundle toplamı dahil nihai
            // değeri taşıyor (bkz. computeUnitMacros çağrıldığı yerler) —
            // burada sadece adetle çarpıp topluyoruz.
            const line = computeLineMacros({
              product: item,
              quantity: item.quantity,
              bundleSelections: item.bundle_selections,
            });
            return {
              kcal: acc.kcal + (line.kcal ?? 0),
              protein: acc.protein + (line.protein ?? 0),
              carbs: acc.carbs + (line.carbs ?? 0),
              fats: acc.fats + (line.fat ?? 0),
            };
          },
          { kcal: 0, protein: 0, carbs: 0, fats: 0 },
        );
      },

      refreshPrices: async (): Promise<{ changed: boolean; names: string[] }> => {
        const items = get().items;
        if (!items || items.length === 0) return { changed: false, names: [] };
        const ids = Array.from(new Set(items.map((i) => i.productId)));
        const numIds = ids.map((x) => Number(x)).filter((n) => Number.isFinite(n));
        const { data, error } = await supabase
          .from('products')
          .select('id, price, discount_type, discount_value')
          .in('id', numIds);
        if (error || !Array.isArray(data)) return { changed: false, names: [] };
        const byId = new Map(data.map((r: any) => [String(r.id), r]));

        let changed = false;
        const names: string[] = [];
        const nextItems = items.map((item) => {
          const raw = byId.get(String(item.productId));
          if (!raw) return item; // ürün bulunamadı → dokunma
          const p = {
            price: Number(raw.price) || 0,
            discount_type: raw.discount_type ?? null,
            discount_value: raw.discount_value == null ? null : Number(raw.discount_value),
          };
          const effectiveBase = getEffectivePrice(p);
          const extraPrice = item.selectedOptions?.extraPrice ?? 0;
          const templateModifier = calculateOptionsPriceModifier(item.selected_options ?? []);
          const newUnit = Number((effectiveBase + extraPrice + templateModifier).toFixed(2));
          const disc = hasDiscount(p);
          const newOriginal = disc
            ? Number((p.price + extraPrice + templateModifier).toFixed(2))
            : undefined;
          if (Math.abs(newUnit - Number(item.unitPrice || 0)) > 0.009) {
            changed = true;
            names.push(item.name);
          }
          return {
            ...item,
            unitPrice: newUnit,
            originalUnitPrice: newOriginal,
            discountType: disc ? p.discount_type : null,
            discountValue: disc ? p.discount_value : null,
          };
        });
        if (changed) set({ items: nextItems });
        return { changed, names };
      },

      // Fiyat tazelemeyle AYNI prensip: sepete eklenirken hesaplanan makro
      // bir "fotoğraf"tır, DB sonradan düzeltilirse bayatlar. Bu, o fotoğrafı
      // günceller — ürünün kendisi ve (varsa) bundle alt ürünleri (linked
      // product) için DB'den taze calories/protein/carbs/fats çekip
      // computeUnitMacros ile yeniden hesaplar. Fiyat/adet/opsiyon seçimi/
      // sepet imzasına dokunmaz.
      refreshMacros: async (): Promise<void> => {
        const items = get().items;
        if (!items || items.length === 0) return;

        const productIdSet = new Set<string>();
        items.forEach((item) => {
          productIdSet.add(item.productId);
          (item.bundle_selections ?? []).forEach((sel) => {
            if (sel.linked_product_id != null) {
              productIdSet.add(String(sel.linked_product_id));
            }
          });
        });
        const numIds = Array.from(productIdSet)
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n));
        if (numIds.length === 0) return;

        const { data, error } = await supabase
          .from('products')
          .select('id, calories, cal, protein, carbs, fats')
          .in('id', numIds);
        if (error || !Array.isArray(data)) return;
        const byId = new Map(data.map((r: any) => [String(r.id), r]));

        const nextItems = items.map((item) => {
          const freshBundleSelections = item.bundle_selections?.map((sel) => {
            if (sel.linked_product_id == null) return sel;
            const fresh = byId.get(String(sel.linked_product_id));
            if (!fresh) return sel;
            return {
              ...sel,
              calories: Number(fresh.calories ?? fresh.cal) || 0,
              protein: Number(fresh.protein) || 0,
              carbs: Number(fresh.carbs) || 0,
              fat: Number(fresh.fats) || 0,
            };
          });

          const freshProduct = byId.get(item.productId);
          const unitMacros = computeUnitMacros({
            product: freshProduct ?? item,
            templateOptions: item.selected_options,
            bundleSelections: freshBundleSelections ?? item.bundle_selections,
          });

          return {
            ...item,
            bundle_selections: freshBundleSelections ?? item.bundle_selections,
            calories: unitMacros.kcal ?? undefined,
            protein: unitMacros.protein ?? undefined,
            carbs: unitMacros.carbs ?? undefined,
            fats: unitMacros.fat ?? undefined,
          };
        });

        set({ items: nextItems });
      },
    }),
    {
      name: 'kcal-cart',
      storage: createJSONStorage(() => AsyncStorage),
      // v5: AppliedCoupon şeması validate_coupon RPC sözleşmesine göre değişti
      // (discountAmount eklendi, minOrderAmount/campaign kaldırıldı) — eski
      // persisted appliedCoupon şekli uyumsuz, sürüm atlanarak temizleniyor.
      version: 5,
      migrate: (_persistedState, _version) => ({
        items: [],
        appliedCoupon: null,
      }) as Partial<CartState>,
    },
  ),
);
