// Kupon dogrulama tipleri ve hata mesajlari — Supabase istemcisine dokunmaz,
// boylece birim testinden import edilebilir (bkz. deliveryRules.ts notu).

export type CouponValidationReason =
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'not_yours'
  | 'min_cart'
  | 'user_limit_reached'
  | 'total_limit_reached'
  | 'auth_required'
  | 'first_order_only'
  | 'items_required'
  | 'no_eligible_item';

export interface CouponValidationSuccess {
  valid: true;
  campaign_id: string;
  code: string;
  title?: string;
  discount_type: 'percent' | 'fixed' | 'sponsor' | 'free_item';
  discount_value: number;
  discount_amount: number;
  final_total?: number;
  remaining_uses_for_user?: number | null;
}

export interface CouponValidationFailure {
  valid: false;
  reason: CouponValidationReason;
  min_cart_total?: number;
}

export type CouponValidationResponse = CouponValidationSuccess | CouponValidationFailure;

const COUPON_ERROR_MESSAGES: Record<CouponValidationReason, string> = {
  not_found: 'Kupon bulunamadı',
  inactive: 'Kupon aktif değil',
  expired: 'Kuponun süresi doldu',
  not_started: 'Kupon henüz başlamadı',
  not_yours: 'Bu kupon size tanımlı değil',
  min_cart: 'Minimum sepet tutarı sağlanmadı',
  user_limit_reached: 'Bu kuponu zaten kullandınız',
  total_limit_reached: 'Kupon kullanım limiti doldu',
  auth_required: 'Giriş yapmalısınız',
  first_order_only: 'Bu kupon yalnızca ilk siparişte geçerlidir.',
  items_required: 'Bu kupon için sepetinde ürün olmalı.',
  no_eligible_item: 'Ücretsiz öğün kuponu koli ve çoklu tabaklarda geçerli değil. Sepetine tekil bir öğün ekle.',
};

export function getCouponErrorMessage(result: CouponValidationFailure): string {
  if (result.reason === 'min_cart' && result.min_cart_total != null) {
    return `Bu kupon ₺${result.min_cart_total} ve üzeri siparişlerde geçerlidir.`;
  }
  return COUPON_ERROR_MESSAGES[result.reason] ?? 'Kupon uygulanamadı';
}
