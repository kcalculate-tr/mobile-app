// G55-S1 md.1 — bildirim dili (SAF; node:test okur). Uygulama arayüz dili → `push_tokens.locale`.
// Sunucu (`supabase/functions/send-notification/locale.ts`) yalnız 'tr' | 'en' tanır;
// bilinmeyen her değer 'tr' (bugünkü davranış).
export type PushLocale = 'tr' | 'en';

export function toPushLocale(lang: string | null | undefined): PushLocale {
  return typeof lang === 'string' && lang.toLowerCase().startsWith('en') ? 'en' : 'tr';
}

/**
 * PostgREST "kolon yok" hatası mı? (migration uygulanmadan OTA giderse token kaydı
 * `locale` olmadan tekrarlanır — kayıt asla bu yüzden düşmez.)
 */
export function isMissingLocaleColumn(err: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!err) return false;
  return err.code === 'PGRST204' || err.code === '42703' || /locale/i.test(err.message ?? '');
}
