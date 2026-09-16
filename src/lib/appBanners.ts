import { SupabaseClient } from '@supabase/supabase-js';

// Görev 1.3: tek slotluk ana sayfa banner'ı. Mevcut banner_rows/banner_cells
// (hero/promo grid) sisteminden bağımsız — app_banners tablosu, RLS zaten
// yalnızca aktif + tarih penceresi içindeki satırları döndürüyor (bkz.
// supabase/migrations/20260916220000_app_banners.sql), burada sadece en
// yüksek priority'li TEK satır seçiliyor.
export type AppBanner = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  deeplink: string | null;
  priority: number;
};

export const fetchActiveAppBanner = async (
  supabase: SupabaseClient,
): Promise<AppBanner | null> => {
  const { data, error } = await supabase
    .from('app_banners')
    .select('id,title,subtitle,image_url,deeplink,priority')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: String(data.id),
    title: String(data.title ?? ''),
    subtitle: data.subtitle ? String(data.subtitle) : null,
    imageUrl: data.image_url ? String(data.image_url) : null,
    deeplink: data.deeplink ? String(data.deeplink) : null,
    priority: Number(data.priority) || 0,
  };
};
