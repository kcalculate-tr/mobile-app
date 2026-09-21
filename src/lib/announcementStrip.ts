import type { SupabaseClient } from '@supabase/supabase-js';

export type AnnouncementStrip = {
  id: string;
  message: string;
  speedMs: number;
  bgColor: string | null;
  textColor: string | null;
  navigateTo: string | null;
};

/**
 * Ana sayfa duyuru şeridi — en yüksek öncelikli AKTİF satır.
 * RLS zaten aktif + tarih penceresi filtresini uyguluyor (bkz. migration
 * 20260921120000_announcement_strip.sql), burada sadece sıralayıp ilkini alıyoruz.
 * Tablo boşsa null döner → şerit hiç render edilmez.
 */
export const fetchActiveAnnouncementStrip = async (
  supabase: SupabaseClient,
): Promise<AnnouncementStrip | null> => {
  const { data, error } = await supabase
    .from('announcement_strip')
    .select('id, message, speed_ms, bg_color, text_color, navigate_to')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Tablo henüz migrate edilmemişse (42P01) uygulama patlamasın — şerit yok sayılır.
  if (error || !data) return null;

  const message = String(data.message ?? '').trim();
  if (!message) return null;

  const speed = Number(data.speed_ms);
  return {
    id: String(data.id),
    message,
    speedMs: Number.isFinite(speed) && speed >= 3000 ? speed : 18000,
    bgColor: (data.bg_color as string | null) ?? null,
    textColor: (data.text_color as string | null) ?? null,
    navigateTo: (data.navigate_to as string | null) ?? null,
  };
};
