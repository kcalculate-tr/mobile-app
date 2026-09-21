import { getSupabaseClient } from './supabase';

export type FeedbackItem = {
  productId: number;
  name: string;
};

export type PendingFeedbackOrder = {
  id: number;
  orderCode: string | null;
  deliveredAt: string;
  /** Siparişteki ürünler — tek tek beğenilip beğenilmediği sorulur. */
  items: FeedbackItem[];
};

/** productId -> beğenildi mi (true/false). Dokunulmayan ürün hiç yazılmaz. */
export type ItemFeedbackMap = Record<number, boolean>;

// orders.items JSON'undan ürün listesi. Aynı ürün birden çok satırdaysa
// (farklı seçeneklerle) tek kez sorulur — musteri urune oy veriyor, satira degil.
const parseItems = (raw: unknown): FeedbackItem[] => {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: FeedbackItem[] = [];
  for (const row of raw) {
    const r = (row ?? {}) as Record<string, unknown>;
    const productId = Number(r.id);
    if (!Number.isFinite(productId) || productId <= 0 || seen.has(productId)) continue;
    seen.add(productId);
    out.push({
      productId,
      name: typeof r.name === 'string' && r.name.trim() ? r.name : 'Ürün',
    });
  }
  return out;
};

// Teslimattan bu kadar sonra sorulur (push cron'u ile aynı eşik).
export const FEEDBACK_DELAY_MINUTES = 30;
// Bu süreyi geçmiş siparişler için artık sorulmaz — geç gelen istem rahatsız edici.
export const FEEDBACK_WINDOW_HOURS = 48;

/**
 * Değerlendirme bekleyen EN SON teslim edilmiş sipariş.
 * Kriterler: teslim edilmiş, 30 dk geçmiş, 48 saati aşmamış, henüz yorumlanmamış.
 * Hiçbiri yoksa null → pop-up gösterilmez.
 */
export const fetchPendingFeedbackOrder = async (
  userId: string,
): Promise<PendingFeedbackOrder | null> => {
  const supabase = getSupabaseClient();

  const now = Date.now();
  const notAfter = new Date(now - FEEDBACK_DELAY_MINUTES * 60_000).toISOString();
  const notBefore = new Date(now - FEEDBACK_WINDOW_HOURS * 3_600_000).toISOString();

  const { data, error } = await supabase
    .from('orders')
    .select('id, order_code, updated_at, items')
    .eq('user_id', userId)
    .eq('status', 'delivered')
    .lte('updated_at', notAfter)
    .gte('updated_at', notBefore)
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error || !Array.isArray(data) || data.length === 0) return null;

  const ids = data.map((r) => Number(r.id));
  const { data: reviewed } = await supabase
    .from('reviews')
    .select('order_id')
    .eq('user_id', userId)
    .in('order_id', ids);

  const reviewedIds = new Set((reviewed ?? []).map((r) => Number(r.order_id)));
  const pending = data.find((r) => !reviewedIds.has(Number(r.id)));
  if (!pending) return null;

  return {
    id: Number(pending.id),
    orderCode: (pending.order_code as string | null) ?? null,
    deliveredAt: String(pending.updated_at),
    items: parseItems(pending.items),
  };
};

/** Puan + (opsiyonel) yorum + (opsiyonel) ürün bazında beğeni kaydeder. */
export const submitOrderReview = async ({
  orderId,
  userId,
  rating,
  comment,
  items,
  itemFeedback,
}: {
  orderId: number;
  userId: string;
  rating: number;
  comment?: string;
  items?: FeedbackItem[];
  itemFeedback?: ItemFeedbackMap;
}): Promise<{ ok: boolean; error?: string }> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('reviews')
    .insert({
      order_id: orderId,
      user_id: userId,
      rating: Math.max(1, Math.min(5, Math.round(rating))),
      comment: comment?.trim() || null,
      // Yorumlar moderasyondan geçtikten sonra yayınlanır.
      is_approved: false,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  // Ürün oyları BEST-EFFORT: burada bir hata olursa asıl değerlendirme yine
  // kaydedilmiş sayılır. Müşteriye "gönderilemedi" demek, gönderilmiş bir
  // puanı yok saymak olurdu.
  const votes = Object.entries(itemFeedback ?? {});
  if (votes.length > 0) {
    const byId = new Map((items ?? []).map((it) => [it.productId, it.name]));
    const rows = votes.map(([productId, liked]) => ({
      review_id: data?.id ?? null,
      order_id: orderId,
      user_id: userId,
      product_id: Number(productId),
      product_name: byId.get(Number(productId)) ?? null,
      liked,
    }));
    await supabase.from('review_item_feedback').insert(rows);
  }

  return { ok: true };
};

/**
 * "Şimdi değil" denince bu sipariş için bir daha sorulmasın diye 1 puanlık
 * sahte kayıt ATMIYORUZ — bunun yerine çağıran taraf oturum içinde saklıyor.
 * (Kalıcı erteleme gerekirse reviews'a değil ayrı bir tabloya yazılmalı.)
 */

/**
 * Değerlendirme pop-up'ının üst görseli.
 *
 * Ayrı bir alan: daha önce ana sayfadaki kcalculate marka banner'ı
 * kullanılıyordu, o yüzden markalar bölümündeki görsel her değiştiğinde
 * pop-up da değişiyordu. Alan boşsa çağıran taraf marka görseline düşer.
 */
export async function fetchReviewBannerUrl(): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('settings')
    .select('review_banner_url')
    .maybeSingle();
  if (error || !data) return null;
  const url = typeof data.review_banner_url === 'string' ? data.review_banner_url.trim() : '';
  return url || null;
}
