/**
 * Şube bazlı ürün kapatma (13.10.2026)
 *
 * Mutfaklar ürünü kendi şubesi için kapatabiliyor (branch_product_stock).
 * Uygulama, teslimat adresi belli olunca o adresin düştüğü şubeyi ve o şubede
 * KAPALI olan ürün id'lerini `fn_branch_availability` RPC'siyle tek çağrıda
 * alır. Satır yoksa ürün o şubede açıktır — yani varsayılan davranış eskisi
 * gibidir, sunucuda açıkça kapatılmadıkça hiçbir şey değişmez.
 *
 * Sunucu tarafında ayrıca `trg_orders_stock_guard_insert` var: kapalı ürün
 * içeren sipariş INSERT'te (ödeme alınmadan) reddedilir. Burası o hatayı
 * kullanıcıya ödeme ekranına gitmeden göstermek için.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface BranchAvailability {
  branchId: string | null;
  branchName: string | null;
  closedProductIds: number[];
}

export const EMPTY_BRANCH_AVAILABILITY: BranchAvailability = {
  branchId: null,
  branchName: null,
  closedProductIds: [],
};

export const fetchBranchAvailability = async (
  supabase: SupabaseClient,
  params: { district?: string | null; neighbourhood?: string | null; addressId?: string | null },
): Promise<BranchAvailability> => {
  const { data, error } = await supabase.rpc('fn_branch_availability', {
    p_district: params.district ?? null,
    p_neighbourhood: params.neighbourhood ?? null,
    p_address_id: params.addressId ?? null,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return EMPTY_BRANCH_AVAILABILITY;

  const raw = (row as { closed_product_ids?: unknown }).closed_product_ids;
  const closedProductIds = Array.isArray(raw)
    ? raw.map((v) => Number(v)).filter((n) => Number.isFinite(n))
    : [];

  return {
    branchId: (row as { branch_id?: string | null }).branch_id ?? null,
    branchName: (row as { branch_name?: string | null }).branch_name ?? null,
    closedProductIds,
  };
};

/** Sepette, o şubede kapalı olan satırların ürün adlarını döner. */
export const findClosedCartItemNames = (
  cartItems: { productId: number | string; name: string }[],
  closedProductIds: number[],
): string[] => {
  if (closedProductIds.length === 0) return [];
  const kapali = new Set(closedProductIds);
  const adlar = new Set<string>();
  for (const item of cartItems) {
    if (kapali.has(Number(item.productId))) adlar.add(item.name);
  }
  return [...adlar];
};
