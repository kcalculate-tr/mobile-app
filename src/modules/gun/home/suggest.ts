// G18-S2 md.4 — FinHomeIzmir tek eatkcal öneri kartı (SAF seçim).
// Gerekçe satırı yalnız DOĞRUysa: kalan protein hedefin ≥ %30'u → "Protein eksik,
// <öğün> için"; değilse yalnız "<Öğün> için". Ürün gerçek menüden (aktif, satışta,
// fiyatlı, görselli; paket ürün makroları seçime bağlı olduğundan dışarıda).
import type { Product } from '../../../types';
import type { SlotKey } from '../homeData';
import { getEffectivePrice } from '../../../utils/price';

export interface EkSuggestion {
  id: string;
  name: string;
  image: string;
  kcal: number | null;
  price: number | null;
  reason: 'protein' | 'slot';
  slot: SlotKey;
}

export function pickEatkcalSuggestion(
  products: Product[],
  ctx: { proteinLeft: number; proteinTarget: number; kcalLeft: number; slot: SlotKey },
): EkSuggestion | null {
  const list = (products ?? []).filter(
    (p) =>
      p &&
      (p as { is_active?: boolean }).is_active !== false &&
      p.is_available !== false &&
      p.in_stock !== false &&
      !p.is_bundle &&
      Number(p.price) > 0 &&
      !!p.img,
  );
  if (list.length === 0) return null;
  const kcalOf = (p: Product) => {
    const n = Number(p.calories ?? p.cal);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  const fits = (p: Product) => ctx.kcalLeft <= 0 || (kcalOf(p) ?? Infinity) <= ctx.kcalLeft;
  const proteinLow = ctx.proteinTarget > 0 && ctx.proteinLeft / ctx.proteinTarget >= 0.3;
  let pick: Product | undefined;
  let reason: EkSuggestion['reason'] = 'slot';
  if (proteinLow) {
    const byProtein = [...list].filter((p) => Number(p.protein) > 0).sort((a, b) => Number(b.protein) - Number(a.protein));
    pick = byProtein.find(fits) ?? byProtein[0];
    if (pick) reason = 'protein';
  }
  if (!pick) {
    const byOrder = [...list].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    pick = byOrder.find(fits) ?? byOrder[0];
  }
  return {
    id: String(pick.id),
    name: pick.name,
    image: pick.img!,
    kcal: kcalOf(pick),
    price: getEffectivePrice(pick) || null,
    reason,
    slot: ctx.slot,
  };
}
