// eatkcal v2 — sepet ve sipariş özetinin paylaştığı okuma sorguları.
// Sorgular bugünkü CheckoutScreen.tsx ile BİREBİR (yalnız okuma; yazma yok):
//  - settings.min_cart_amount   → CheckoutScreen.tsx:1054-1062
//  - delivery_zones (ilçe)      → CheckoutScreen.tsx:1252-1258
import { getSupabaseClient } from '../../../../core/supabase';
import type { Address } from '../../../../types';
import type { DeliveryType } from '../../../../lib/deliveryRules';
import { resolveZoneRule, RULES_FETCH_ERROR_MESSAGE, type ZoneRuleResult } from '../model/checkoutModel';

/** settings.min_cart_amount (hata → throw; çağıran 'error' durumuna geçer). */
export async function fetchSettingsMinCart(): Promise<number> {
  const { data, error } = await getSupabaseClient()
    .from('settings')
    .select('min_cart_amount')
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Math.max(0, Number(data?.min_cart_amount || 0));
}

/** Seçili adresin ilçe kuralı → bugünkü ekranla aynı DeliveryRuleStatus. */
export async function fetchZoneRuleFor(
  address: Pick<Address, 'district' | 'neighbourhood'>,
  deliveryTimeType: DeliveryType,
): Promise<ZoneRuleResult> {
  try {
    const { data, error } = await getSupabaseClient()
      .from('delivery_zones')
      .select('*')
      .eq('district', address.district)
      .order('updated_at', { ascending: false })
      .limit(500);
    if (error) return { status: { status: 'error', message: RULES_FETCH_ERROR_MESSAGE }, deliveryDays: null };
    return resolveZoneRule((Array.isArray(data) ? data : []) as Record<string, unknown>[], address, deliveryTimeType);
  } catch {
    return { status: { status: 'error', message: RULES_FETCH_ERROR_MESSAGE }, deliveryDays: null };
  }
}
