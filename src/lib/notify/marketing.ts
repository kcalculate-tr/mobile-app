// G20-S3 md.6 (B-11) — Pazarlama bildirimi: varsayılan KAPALI (açık onay = opt-in).
// İlk bildirim izni sheet'inde AYRI kutu (işaretsiz gelir); tercih satırı yoksa
// pazarlama kapalı sayılır (istemci + send-notification). Mevcut kullanıcıların
// kayıtlı tercihleri DEĞİŞMEZ (yalnız varsayılan / yeni satır).
import { getSupabaseClient } from '../../core/supabase';

export { DEFAULT_NOTIFY_PREFS, MARKETING_DEFAULT, prefsFromRow, type NotifyPrefs } from './marketingPrefs';

/**
 * Pazarlama onayını hesaba yaz. Satır yoksa önce oluşturulur (yeni satır sunucuda
 * pazarlama KAPALI başlar), sonra GÜNCELLEME ile açılır/kapanır. Oturum yok / hata → false.
 */
export async function setMarketingOptIn(on: boolean): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return false;
    const { data: row } = await supabase
      .from('notification_preferences')
      .select('user_id')
      .eq('user_id', uid)
      .maybeSingle();
    if (!row) await supabase.from('notification_preferences').insert({ user_id: uid });
    const { error } = await supabase
      .from('notification_preferences')
      .update({ marketing_enabled: on, updated_at: new Date().toISOString() })
      .eq('user_id', uid);
    return !error;
  } catch {
    return false;
  }
}
