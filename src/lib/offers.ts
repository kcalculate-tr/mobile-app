import { supabase } from './supabase';

export interface Banner {
  id: string;
  image_url: string;
  link?: string;
  is_active: boolean;
  order?: number;
  navigate_to?: string;
  title?: string;
  section?: string;
}

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

export async function fetchBanners(): Promise<Banner[]> {
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .eq('is_active', true)
    .eq('section', 'slider')
    .order('order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPromoBanners(): Promise<Banner[]> {
  const { data } = await supabase
    .from('banners')
    .select('*')
    .eq('is_active', true)
    .eq('section', 'promo')
    .order('order');
  return (data || []) as Banner[];
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
