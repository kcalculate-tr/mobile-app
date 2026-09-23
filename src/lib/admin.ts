import { getSupabaseClient } from './supabase'

/**
 * Kullanıcı admin_allowlist'te mi?
 *
 * Tabloda `admin_allowlist_self_read` politikası var: herkes YALNIZCA kendi
 * satırını okuyabiliyor. Yani bu sorgu başkasının yetkisini sızdırmaz.
 *
 * Yetki gerektiren işlerin kapısı DEĞİL — sunucu tarafı zaten kendi
 * kontrolünü yapıyor. Bu yalnızca arayüzde "henüz herkese açılmamış" bölümleri
 * göstermek için.
 */
export async function isAdminUser(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('admin_allowlist')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle()
    return !error && !!data
  } catch {
    return false
  }
}
