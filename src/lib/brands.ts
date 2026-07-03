import { supabase } from './supabase';

export interface Brand {
  key: string;
  name: string;
  tagline: string | null;
  description: string | null;
  hero_image_url: string | null;
  accent_color: string | null;
}

export async function fetchBrand(key: string): Promise<Brand | null> {
  const { data, error } = await supabase
    .from('brands')
    .select('key,name,tagline,description,hero_image_url,accent_color')
    .eq('key', key)
    .eq('is_active', true)
    .maybeSingle();
  if (error || !data) return null;
  return data as Brand;
}
