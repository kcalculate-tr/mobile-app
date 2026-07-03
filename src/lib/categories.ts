import { supabase } from './supabase';

export interface Category {
  id: number;
  name: string;
  order?: number;
  emoji?: string;
  img?: string;
  image_url?: string;
}

export interface CategoryProduct {
  id: string | number;
  name: string;
  price: number;
  calories: number;
  protein: number;
  img?: string | null;
  category?: string | null;
  order?: number | null;
  discount_type?: string | null;
  discount_value?: number | null;
  brand?: string | null;
  gramaj_options?: Array<Record<string, unknown>>;
}

const toSafeString = (value: unknown) => String(value ?? '').trim();
const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const mapCategoryRow = (row: Record<string, unknown>): Category => ({
  id: toNumber(row.id, 0),
  name: toSafeString(row.name) || 'Kategori',
  order: row.order != null ? toNumber(row.order, 0) : undefined,
  emoji: toSafeString(row.emoji) || undefined,
  img: toSafeString(row.img) || undefined,
  image_url: toSafeString(row.image_url) || undefined,
});

const mapCategoryProductRow = (
  row: Record<string, unknown>,
): CategoryProduct => ({
  id: toSafeString(row.id) || toNumber(row.id, 0),
  name: toSafeString(row.name) || 'Ürün',
  price: toNumber(row.price, 0),
  calories: toNumber(row.calories, 0),
  protein: toNumber(row.protein, 0),
  img: toSafeString(row.img) || null,
  category: toSafeString(row.category) || null,
  order: row.order != null ? toNumber(row.order, 0) : null,
  discount_type: typeof row.discount_type === 'string' && row.discount_type ? row.discount_type : null,
  discount_value: row.discount_value != null ? toNumber(row.discount_value, 0) : null,
  brand: typeof row.brand === 'string' && row.brand ? row.brand : null,
  gramaj_options: Array.isArray(row.gramaj_options) ? (row.gramaj_options as Array<Record<string, unknown>>) : [],
});

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, order, img, emoji, image_url')
    .order('order', { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .map((row) => mapCategoryRow(row as Record<string, unknown>))
    .filter((category) => category.id > 0);
}

const ALL_PRODUCTS_NAMES = ['Tüm Ürünler', 'Tum Urunler'];

export async function fetchProductsByCategory(
  categoryName: string,
): Promise<CategoryProduct[]> {
  if (ALL_PRODUCTS_NAMES.includes(categoryName)) {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, calories, protein, img, category, is_available, order, discount_type, discount_value, brand, gramaj_options')
      .eq('is_available', true)
      .order('order', { ascending: true });

    if (error) throw error;

    return (data ?? []).map((row) =>
      mapCategoryProductRow(row as Record<string, unknown>),
    );
  }

  const categoryNames = [categoryName];

  const { data: parentRow } = await supabase
    .from('categories')
    .select('id')
    .eq('name', categoryName)
    .maybeSingle();

  if (parentRow?.id != null) {
    const { data: children } = await supabase
      .from('categories')
      .select('name')
      .eq('parent_id', parentRow.id);
    (children ?? []).forEach((row) => {
      const name = toSafeString((row as Record<string, unknown>).name);
      if (name && !categoryNames.includes(name)) categoryNames.push(name);
    });
  }

  const { data, error } = await supabase
    .from('products')
    .select('id, name, price, calories, protein, img, category, is_available, order, discount_type, discount_value, brand, gramaj_options')
    .in('category', categoryNames)
    .eq('is_available', true)
    .order('order', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) =>
    mapCategoryProductRow(row as Record<string, unknown>),
  );
}

export async function fetchProductsByBrand(
  brandKey: string,
): Promise<CategoryProduct[]> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, price, calories, protein, img, category, is_available, order, discount_type, discount_value, brand, gramaj_options')
    .eq('brand', brandKey)
    .eq('is_available', true)
    .order('order', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) =>
    mapCategoryProductRow(row as Record<string, unknown>),
  );
}
