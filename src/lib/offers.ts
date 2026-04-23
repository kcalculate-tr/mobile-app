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
