import { supabase } from './supabase';

// Not: Banner + fetchBanners/fetchPromoBanners yeni banner_rows + banner_cells
// sistemine taşındı — src/lib/banners.ts. Campaign tipi ve fetchCampaigns
// "Fırsatlar & Kuponlar" ekranında indirim kartları + kupon listesi için
// kullanılmaya devam ediyor.

export interface Campaign {
  id: string;
  title: string;
  description?: string;
  code?: string;
  badge?: string;
  color_from?: string;
  color_via?: string;
  color_to?: string;
  is_active: boolean;
  order?: number;
  start_date?: string;
  end_date?: string;
  min_cart_total?: number;
  discount_type?: string;
  discount_value?: number;
  max_discount?: number;
  image_url?: string;
  max_uses_per_user?: number | null;
  /** Kişiye özel atanmışsa dolu — "Kuponlarım" sekmesini ayırmak için. */
  user_id?: string | null;
  /** 'macro_reward' = Macro karşılığı üretilmiş ücretsiz öğün kuponu. */
  source?: string | null;
  /** free_item kuponunun geçmediği ürün kategorileri. */
  excluded_categories?: string[] | null;
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('is_active', true)
    .order('order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Hedef kitle (herkese / kayıtlı kullanıcı / kayıtlı olmayan) ve kullanılmış
// tek-seferlik kuponlar RLS tarafından zaten filtreleniyor — client'ta ekstra
// filtre gerekmez. `supabase` auth'lu client olduğu için auth.uid()/jwt email
// RLS policy'sinde otomatik çalışır.
export async function fetchAvailableCampaigns(): Promise<Campaign[]> {
  return fetchCampaigns();
}

// ─── Kupon doğrulama (validate_coupon RPC) ─────────────────────────────────

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

/**
 * Sepet kalemi — yalnızca ürün kimliği ve adet gönderilir.
 * Kategori ve fiyat SUNUCUDA products tablosundan okunur; istemcinin
 * bildirdiği fiyata güvenilmez (free_item kuponunda indirim tutarını
 * belirlediği için kritik).
 */
export interface CouponCartItem {
  product_id: number;
  quantity: number;
}

export async function validateCoupon(
  code: string,
  cartTotal: number,
  items?: CouponCartItem[],
): Promise<CouponValidationResponse> {
  // validate_coupon_v2, tüm uygunluk kontrolünü validate_coupon'a devredip
  // yalnızca free_item (ücretsiz öğün) kuponunda indirim tutarını sepetten
  // hesaplar. Diğer kupon tipleri için davranış birebir aynı.
  const { data, error } = await supabase.rpc('validate_coupon_v2', {
    p_code: code,
    p_cart_total: cartTotal,
    p_items: items && items.length > 0 ? items : null,
  });
  if (error || !data) {
    return { valid: false, reason: 'not_found' };
  }
  return data as CouponValidationResponse;
}
