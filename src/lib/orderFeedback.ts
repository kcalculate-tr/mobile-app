import { getSupabaseClient } from './supabase';

export type PendingFeedbackOrder = {
  id: number;
  orderCode: string | null;
  deliveredAt: string;
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
    .select('id, order_code, updated_at')
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
  };
};

/** Puan + (opsiyonel) yorum kaydeder. */
export const submitOrderReview = async ({
  orderId,
  userId,
  rating,
  comment,
}: {
  orderId: number;
  userId: string;
  rating: number;
  comment?: string;
}): Promise<{ ok: boolean; error?: string }> => {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('reviews').insert({
    order_id: orderId,
    user_id: userId,
    rating: Math.max(1, Math.min(5, Math.round(rating))),
    comment: comment?.trim() || null,
    // Yorumlar moderasyondan geçtikten sonra yayınlanır.
    is_approved: false,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
};

/**
 * "Şimdi değil" denince bu sipariş için bir daha sorulmasın diye 1 puanlık
 * sahte kayıt ATMIYORUZ — bunun yerine çağıran taraf oturum içinde saklıyor.
 * (Kalıcı erteleme gerekirse reviews'a değil ayrı bir tabloya yazılmalı.)
 */
