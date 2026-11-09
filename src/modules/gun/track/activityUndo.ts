// G19-S2 md.3 — Etkinlik "Geri al": activity_logs satırını siler. RLS
// `activity_logs_own` (for all, user_id = auth.uid()) sahibine silme izni veriyor;
// ayrı RPC gerekmez. Kcal tahmini sunucuda satırdan hesaplandığı için gün toplamı
// (get_my_day_activity) silmeden sonra kendiliğinden düşer.
import { getSupabaseClient } from '../../../core/supabase';

export async function deleteActivityLog(id: string): Promise<boolean> {
  try {
    const { error } = await getSupabaseClient().from('activity_logs').delete().eq('id', id);
    return !error;
  } catch {
    return false;
  }
}
