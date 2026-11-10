// G22-S1 md.4 — RevenueCat teklif kartları (yerel fiyat). Oturum boyunca bir kez yüklenir.
// Fiyat gelmezse `cards = null` + `failed = true` → çağıran FinSubError gösterir (yedek metin YOK).
import { useCallback, useEffect, useState } from 'react';
import { buildPlanCards, type PlanCard } from './plans';
import { loadOfferingProducts, useSubscriptionStore } from './purchases';

let memo: PlanCard[] | null = null;

export function usePlanCards(enabled = true) {
  const available = useSubscriptionStore((s) => s.available);
  const [cards, setCards] = useState<PlanCard[] | null>(memo);
  const [loading, setLoading] = useState(!memo && enabled && available);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!available) {
      setFailed(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFailed(false);
    const products = await loadOfferingProducts();
    const built = products ? buildPlanCards(products) : null;
    memo = built;
    setCards(built);
    setFailed(!built);
    setLoading(false);
  }, [available]);

  useEffect(() => {
    if (!enabled || memo) return;
    void load();
  }, [enabled, load]);

  return { cards, loading, failed, reload: load };
}

/** Test/vitrin: önbelleği doldur ya da temizle. */
export function setPlanCardsMemo(next: PlanCard[] | null): void {
  memo = next;
}

/** Hak sheet'i karoları için aylık fiyat metni (yoksa null → satır gizli). */
export function monthlyPriceOf(cards: PlanCard[] | null, tier: 'fresh' | 'balance'): string | null {
  return cards?.find((c) => c.tier === tier && !c.yearly)?.priceText ?? null;
}
