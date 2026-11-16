// G56-S1 — eatkcal ana sayfa bölümlerinin veri katmanı (yalnız OKUMA + iki davet RPC'si).
// Her çağrı hata yutar: bölüm verisi gelmezse bölüm gizlenir, sayfa etkilenmez.
import { getSupabaseClient } from '../../../../core/supabase';
import { fetchPastOrders, type PastOrder } from '../../../../lib/reorder';
import { fetchProductOptionGroups } from '../../../../lib/products';
import { fetchProductOptionLinks } from '../../../../lib/productOptions';
import { REORDER_LIMIT, TOP_SECTION } from './config';
import { parseApplyResult, parseMyReferral, normalizeReferralCode, type ApplyResult, type MyReferral } from './referral';
import type { PlanItemLike, PlanSlot, ProductOptionInfo, TopRpcRow } from './rules';

/** Son N TAMAMLANMIŞ (teslim edilmiş) sipariş — "Tekrar sipariş ver". */
export async function fetchDeliveredOrders(userId: string): Promise<PastOrder[]> {
  try {
    return await fetchPastOrders(userId, REORDER_LIMIT, ['delivered']);
  } catch {
    return [];
  }
}

/** top_products_week RPC. Migration uygulanmadıysa (404) → [] → bölüm gizli. */
export async function fetchTopProductsWeek(): Promise<TopRpcRow[]> {
  try {
    const { data, error } = await getSupabaseClient().rpc('top_products_week', { p_limit: TOP_SECTION.limit });
    if (error || !Array.isArray(data)) return [];
    return data as TopRpcRow[];
  } catch {
    return [];
  }
}

/** Ödül ayarları (settings tek satır). Kolon yoksa / hata → null → davet girişleri gizli. */
export async function fetchReferralSettings(): Promise<{ rewardTl: number | null; minOrderTl: number | null } | null> {
  try {
    const { data, error } = await getSupabaseClient()
      .from('settings')
      .select('referral_reward_tl, referral_min_order_tl')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { referral_reward_tl?: unknown; referral_min_order_tl?: unknown };
    const n = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
    return { rewardTl: n(row.referral_reward_tl), minOrderTl: n(row.referral_min_order_tl) };
  } catch {
    return null;
  }
}

export async function fetchMyReferral(): Promise<MyReferral | null> {
  try {
    const { data, error } = await getSupabaseClient().rpc('my_referral');
    if (error) return null;
    return parseMyReferral(data);
  } catch {
    return null;
  }
}

export async function applyReferralCode(code: string): Promise<ApplyResult> {
  try {
    const { data, error } = await getSupabaseClient().rpc('apply_referral_code', { p_code: normalizeReferralCode(code) });
    if (error) return { ok: false, error: 'error' };
    return parseApplyResult(data);
  } catch {
    return { ok: false, error: 'error' };
  }
}

/** Davet kodu girilebilir mi? Kullanıcının iptal/başarısız dışında siparişi yoksa ve henüz davet satırı yoksa. */
export async function fetchCanApplyReferral(userId: string): Promise<boolean> {
  try {
    const sb = getSupabaseClient();
    const [orders, refs] = await Promise.all([
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', userId).not('status', 'in', '(payment_failed,expired,cancelled)'),
      sb.from('referrals').select('id', { count: 'exact', head: true }).eq('referee_id', userId),
    ]);
    if (orders.error || refs.error) return false;
    return (orders.count ?? 0) === 0 && (refs.count ?? 0) === 0;
  } catch {
    return false;
  }
}

/** Tekrar sipariş: ürün başına seçenek grupları + şablonlar (eski seçim doğrulaması için). */
export async function fetchOptionInfo(productIds: readonly string[]): Promise<Map<string, ProductOptionInfo>> {
  const out = new Map<string, ProductOptionInfo>();
  const sb = getSupabaseClient();
  await Promise.all(
    [...new Set(productIds)].map(async (id) => {
      try {
        const [groups, links] = await Promise.all([fetchProductOptionGroups(sb, id), fetchProductOptionLinks(id)]);
        out.set(id, { groups, links });
      } catch {
        // Bilinmiyorsa güvenli taraf: ürün sayfası (rebuild null döner).
        out.set(id, { groups: [{ id: '__unknown__', name: '', description: '', minSelection: 1, maxSelection: 1, isRequired: true, sortOrder: 0, items: [] }], links: [] });
      }
    }),
  );
  return out;
}

/** Bugünün öğün planı satırları (meal_plan_items, kendi satırları — RLS). Tablo/plan yoksa []. */
export async function fetchTodayPlanItems(userId: string, today: string): Promise<PlanItemLike[]> {
  try {
    const { data, error } = await getSupabaseClient()
      .from('meal_plan_items')
      .select('id, date, slot, source, ref_id, name, kcal')
      .eq('user_id', userId)
      .eq('date', today);
    if (error || !Array.isArray(data)) return [];
    const slots: PlanSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
    return (data as Record<string, unknown>[])
      .filter((r) => slots.includes(String(r.slot) as PlanSlot))
      .map((r) => ({
        id: String(r.id),
        date: String(r.date),
        slot: String(r.slot) as PlanSlot,
        source: (r.source === 'eatkcal' || r.source === 'custom' ? r.source : 'recipe') as PlanItemLike['source'],
        refId: r.ref_id != null ? String(r.ref_id) : null,
        name: String(r.name ?? ''),
        kcal: Number(r.kcal) || 0,
      }));
  } catch {
    return [];
  }
}
