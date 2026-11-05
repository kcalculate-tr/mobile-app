// eatkcal v2 (G13-S2 md.7) — FinEkErrors: hata kartlarının MEVCUT hata
// kodlarına eşlemesi. Saf (native yok) → birim testinden import edilir.
//
// "Hepsi aynı kart: başlık · tek satır açıklama · tek kurtarma aksiyonu."
// Kartın kendisi `ui/ErrorCard.tsx`. Burada yalnız "hangi mevcut hata → hangi
// kart" kararı var; yeni hata kodu UYDURULMAZ, kaynaklar:
//  - kupon   → src/lib/couponMessages.ts `CouponValidationReason` (validate_coupon_v2 RPC)
//  - stok    → src/lib/branchAvailability.ts `findClosedCartItemNames` (şubede kapalı
//              ürün) + sunucu `trg_orders_stock_guard_insert` (sipariş insert'i)
//  - fiyat   → src/store/cartStore.ts `refreshPrices()` → `{ changed, names }`
//  - adres   → Supabase `addresses` insert/update hatası (src/lib/supabaseErrors.ts)
import type { CouponValidationFailure, CouponValidationReason } from '../../../../lib/couponMessages';
import { getCouponErrorMessage } from '../../../../lib/couponMessages';

export type EkErrorKind = 'coupon' | 'stock' | 'price' | 'address';

export interface EkErrorModel {
  kind: EkErrorKind;
  /** i18n anahtarı (eatkcal.v2.errors.*) */
  titleKey: string;
  /** Mevcut akışın kendi mesajı varsa o (TR, mevcut ekranlarla aynı metin). */
  detail?: string;
  /** i18n anahtarı — tek kurtarma aksiyonu. */
  actionKey: string;
  /** Şablon parametreleri (ör. eski/yeni fiyat, ürün adları). */
  params?: Record<string, string | number>;
}

/** Kupon kartı: validate_coupon_v2 başarısızlığı → "Kupon geçersiz". */
export function couponError(failure: CouponValidationFailure): EkErrorModel {
  return {
    kind: 'coupon',
    titleKey: 'eatkcal.v2.errors.coupon_title',
    detail: getCouponErrorMessage(failure),
    actionKey: 'eatkcal.v2.errors.coupon_action',
    params: { reason: failure.reason },
  };
}

/** Hangi kupon kodları "geçersiz" kartını açar — hepsi (tek kart, mesaj mevcut metin). */
export const COUPON_REASONS: readonly CouponValidationReason[] = [
  'not_found',
  'inactive',
  'not_started',
  'expired',
  'not_yours',
  'min_cart',
  'user_limit_reached',
  'total_limit_reached',
  'auth_required',
  'first_order_only',
  'items_required',
  'no_eligible_item',
];

/** Stok kartı: şubede kapalı sepet ürünleri (findClosedCartItemNames çıktısı). */
export function stockError(closedNames: readonly string[]): EkErrorModel | null {
  if (closedNames.length === 0) return null;
  return {
    kind: 'stock',
    titleKey: 'eatkcal.v2.errors.stock_title',
    actionKey: 'eatkcal.v2.errors.stock_action',
    params: { names: closedNames.join(', '), count: closedNames.length },
  };
}

/** Sunucu stok koruması (trg_orders_stock_guard_insert) mesajı mı? */
export function isStockGuardError(message: string | null | undefined): boolean {
  const m = String(message ?? '').toLocaleLowerCase('tr-TR');
  return m.includes('stock_guard') || m.includes('tükendi') || m.includes('out_of_stock');
}

/** Fiyat kartı: cartStore.refreshPrices() sonucu. */
export function priceError(
  result: { changed: boolean; names: string[] },
  before: number,
  after: number,
): EkErrorModel | null {
  if (!result.changed) return null;
  return {
    kind: 'price',
    titleKey: 'eatkcal.v2.errors.price_title',
    actionKey: 'eatkcal.v2.errors.price_action',
    params: { before, after, names: result.names.join(', ') },
  };
}

/** Adres kartı: adres kaydı/güncellemesi Supabase hatası. */
export function addressSaveError(detail?: string): EkErrorModel {
  return {
    kind: 'address',
    titleKey: 'eatkcal.v2.errors.address_title',
    detail,
    actionKey: 'eatkcal.v2.errors.address_action',
  };
}
