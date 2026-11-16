// G56-S1 — kartlardaki "+" (Sepete ekle): EkStore quickAdd ile AYNI karar zinciri (yeni mantık yok).
// Gramaj ya da zorunlu seçenek grubu → ürün sayfası; seçenekler öğrenilemezse → ürün sayfası.
import { useCallback, useState } from 'react';
import { useCartStore } from '../../../../../store/cartStore';
import { fetchProductOptionGroups } from '../../../../../lib/products';
import { getSupabaseClient } from '../../../../../core/supabase';
import { needsOptionSelection } from '../../../../../lib/quickAdd';
import { haptic } from '../../../../../core/design';
import type { Product } from '../../../../../types';

export function useQuickAdd(openProduct: (id: string) => void, onAdded: (count: number) => void) {
  const addItem = useCartStore((s) => s.addItem);
  const [addingId, setAddingId] = useState<string | null>(null);
  const quickAdd = useCallback(
    async (product: Product) => {
      const id = String(product.id);
      if (needsOptionSelection({ gramajOptions: product.gramaj_options })) {
        openProduct(id);
        return;
      }
      setAddingId(id);
      try {
        const groups = await fetchProductOptionGroups(getSupabaseClient(), id);
        if (needsOptionSelection({ optionGroups: groups })) {
          openProduct(id);
          return;
        }
        addItem(product, {}, 1);
        haptic('success');
        onAdded(1);
      } catch {
        openProduct(id);
      } finally {
        setAddingId(null);
      }
    },
    [addItem, openProduct, onAdded],
  );
  return { addingId, quickAdd };
}
