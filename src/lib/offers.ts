import { supabase } from './supabase';

// Not: Banner + fetchBanners/fetchPromoBanners yeni banner_rows + banner_cells
// sistemine taşındı — src/lib/banners.ts. Campaign tipi ve fetchCampaigns
// "Fırsatlar & Kuponlar" ekranında indirim kartları + kupon listesi için
// kullanılmaya devam ediyor.

export interface Campaign {
  id: string;
  title: string;
  description?: string;
  code?: string;
  badge?: string;
  color_from?: string;
  color_via?: string;
  color_to?: string;
  is_active: boolean;
  order?: number;
  start_date?: string;
  end_date?: string;
  min_cart_total?: number;
  discount_type?: string;
  discount_value?: number;
  max_discount?: number;
  image_url?: string;
  max_uses_per_user?: number | null;
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('is_active', true)
    .order('order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Kişi başı kullanım sınırına ulaşan kampanyaları kullanıcı listesinden çıkarır.
// Login değilse hepsini döner (filter uygulanamaz).
export async function fetchAvailableCampaigns(): Promise<Campaign[]> {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id;

  const all = await fetchCampaigns();
  if (!userId) return all;

  const { data: uses, error: usesErr } = await supabase
    .rpc('get_user_campaign_uses', { p_user_id: userId });

  if (usesErr) {
    console.error('[campaigns] get_user_campaign_uses failed', usesErr);
    return all;
  }

  const useCounts = new Map<string, number>();
  (uses ?? []).forEach((u: { campaign_id: string; use_count: number }) => {
    useCounts.set(String(u.campaign_id), Number(u.use_count) || 0);
  });

  return all.filter((c) => {
    const max = c.max_uses_per_user;
    if (max == null) return true;
    const count = useCounts.get(String(c.id)) ?? 0;
    return count < max;
  });
}

// Kupon kodu girince limit kontrolü için: kullanıcının bu kampanyayı
// kaç kez kullandığını döner (RPC ile). Login değilse 0.
export async function getCampaignUseCount(campaignId: string): Promise<number> {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes?.user?.id;
  if (!userId) return 0;

  const { data, error } = await supabase
    .rpc('get_user_campaign_uses', { p_user_id: userId });
  if (error) return 0;

  const row = (data ?? []).find((u: { campaign_id: string }) => String(u.campaign_id) === String(campaignId));
  return row ? Number(row.use_count) || 0 : 0;
}
