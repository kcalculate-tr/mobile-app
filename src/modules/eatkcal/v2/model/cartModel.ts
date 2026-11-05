// eatkcal v2 — sepet satırı sunumu (saf). Hesap YOK: makro/fiyat cartStore'da
// (computeLineMacros, getSubtotal); burada yalnız ekranda ne yazılacağı.
import type { CartItem } from '../../../../types';

/** Üst düzey satırlar + her birinin bağlı (ekstra) satırları — CartScreen.tsx:414-417. */
export function groupCartLines(items: readonly CartItem[]): { item: CartItem; children: CartItem[] }[] {
  return items
    .filter((it) => !it.parentLineKey)
    .map((item) => ({ item, children: items.filter((c) => c.parentLineKey === item.lineKey) }));
}

/**
 * "Basmati · Izgara Tavuk 150 g · Maş Fasulye" seçim özeti. Kaynaklar bugünkü
 * sepetle aynı alanlar (CartScreen.tsx:463-620): selectedOptions.labels,
 * selected_options[].value_name, bundle_selections[].name, bağlı satır adları.
 */
export function lineSummary(item: CartItem, children: readonly CartItem[] = []): string {
  const parts: string[] = [];
  for (const l of item.selectedOptions?.labels ?? []) if (l) parts.push(String(l));
  for (const o of item.selected_options ?? []) if (o?.value_name) parts.push(String(o.value_name));
  for (const b of item.bundle_selections ?? []) if (b?.name) parts.push(String(b.name));
  for (const c of children) if (c?.name) parts.push(String(c.name));
  return Array.from(new Set(parts)).join(' · ');
}

/** Satır fiyatı (ana + bağlı satırlar), eski fiyat varsa o da. */
export function linePrice(item: CartItem, children: readonly CartItem[] = []): { now: number; was: number | null } {
  const childSum = children.reduce((s, c) => s + c.unitPrice * c.quantity, 0);
  const now = Number((item.unitPrice * item.quantity + childSum).toFixed(2));
  const was =
    item.originalUnitPrice != null && item.originalUnitPrice > item.unitPrice
      ? Number((item.originalUnitPrice * item.quantity + childSum).toFixed(2))
      : null;
  return { now, was };
}

/** Ücretsiz teslimat ilerlemesi 0..1 (eşik yoksa null). */
export function freeShippingProgress(subtotal: number, freeAbove: number): number | null {
  if (!(freeAbove > 0)) return null;
  return Math.max(0, Math.min(1, subtotal / freeAbove));
}
