// G58-S2 md.4 — ücretsiz öğün kuponu istemci çağrıları. RPC yoksa (migration canlıda değil) sessiz.
import { getSupabaseClient } from '../../core/supabase';
import { parseFreeMealNotices, type FreeMealNotice } from './rules';

export async function fetchFreeMealNotices(): Promise<FreeMealNotice[]> {
  try {
    const { data, error } = await getSupabaseClient().rpc('my_free_meal_notices');
    if (error) return [];
    return parseFreeMealNotices(data);
  } catch {
    return [];
  }
}

export async function markFreeMealNoticesSeen(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    await getSupabaseClient().rpc('mark_free_meal_notices_seen', { p_ids: ids });
  } catch {
    // sonraki açılışta yeniden gösterilir — zararsız
  }
}

/** Paywall teklifi sunucuya (webhook yedeği: RevenueCat attribute gelmezse). */
export async function recordSubscriptionOffer(offer: 'izmir_fresh'): Promise<boolean> {
  try {
    const { error } = await getSupabaseClient().rpc('record_subscription_offer', { p_offer: offer });
    return !error;
  } catch {
    return false;
  }
}
