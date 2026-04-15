import type { SupabaseClient } from '@supabase/supabase-js';
import { OptionGroup, OptionItem, Product } from '../types';

const PRODUCT_OPTION_GROUP_TABLE_CANDIDATES = [
  'product_option_groups',
  'product_option_group',
] as const;

const toSafeString = (value: unknown) => String(value ?? '').trim();

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isRelationMissingError = (error: unknown) => {
  const message = `${(error as { message?: string })?.message || ''} ${(error as { details?: string })?.details || ''}`.toLowerCase();
  const code = (error as { code?: string })?.code;
  return (
    code === '42P01' ||
    message.includes('does not exist') ||
    message.includes('could not find the table')
  );
};

export const mapProductRow = (row: Record<string, unknown>): Product => {
  const desc = toSafeString(row.desc) || toSafeString(row.description) || undefined;
  const img =
    toSafeString(row.img) ||
    toSafeString(row.image_url) ||
    toSafeString(row.image) ||
    undefined;

  return {
    id: toNumber(row.id, 0),
    name: toSafeString(row.name) || toSafeString(row.title) || 'Ürün',
    price: Math.max(0, toNumber(row.price, 0)),
    desc,
    img,
    category: toSafeString(row.category) || undefined,
    slug: toSafeString(row.slug) || undefined,
    type: toSafeString(row.type) || undefined,
    calories: row.calories != null ? Math.max(0, Math.round(toNumber(row.calories, 0))) : undefined,
    cal: row.cal != null ? Math.max(0, Math.round(toNumber(row.cal, 0))) : undefined,
    protein: row.protein != null ? Math.max(0, toNumber(row.protein, 0)) : undefined,
    carbs: row.carbs != null ? Math.max(0, toNumber(row.carbs, 0)) : undefined,
    fats: row.fats != null ? Math.max(0, toNumber(row.fats, 0)) : undefined,
    in_stock: row.in_stock != null ? Boolean(row.in_stock) : undefined,
    is_available: row.is_available != null ? Boolean(row.is_available) : undefined,
    order: row.order != null ? toNumber(row.order, 0) : undefined,
    is_favorite: row.is_favorite != null ? Boolean(row.is_favorite) : undefined,
    favorite_order: row.favorite_order != null ? toNumber(row.favorite_order, 0) : undefined,
  };
};

export { Product } from '../types';

export const fetchProductsFromSupabase = async (
  supabase: SupabaseClient,
  signal?: AbortSignal,
): Promise<Product[]> => {
  let query = supabase.from('products').select('*');
  if (signal) {
    query = query.abortSignal(signal);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (Array.isArray(data) ? data : [])
    .map((row) => mapProductRow(row as Record<string, unknown>))
    .filter((product) => product.is_available !== false && product.in_stock !== false)
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
};

export const fetchProducts = async (signal?: AbortSignal): Promise<Product[]> => {
  const { getSupabaseClient } = await import('./supabase');
  const supabase = getSupabaseClient();
  return fetchProductsFromSupabase(supabase, signal);
};

export const fetchFeaturedProducts = async (): Promise<Product[]> => {
  const { getSupabaseClient } = await import('./supabase');
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_favorite', true)
    .eq('is_available', true)
    .order('favorite_order', { ascending: true });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((row) =>
    mapProductRow(row as Record<string, unknown>)
  );
};

const mapOptionItemRow = (row: Record<string, unknown>): OptionItem => ({
  id: toSafeString(row.id),
  groupId: toSafeString(row.group_id),
  name: toSafeString(row.name) || 'Seçenek',
  priceAdjustment: Math.max(0, toNumber(row.price_adjustment, 0)),
  sortOrder: Math.max(0, Math.floor(toNumber(row.sort_order, 0))),
  isAvailable: row.is_available !== false,
});

const mapOptionGroupRow = (
  row: Record<string, unknown>,
  sortOrder: number,
  items: OptionItem[],
): OptionGroup => {
  const minSelectionRaw = Math.max(0, Math.floor(toNumber(row.min_selection, 0)));
  const minSelection = row.is_required ? Math.max(1, minSelectionRaw) : minSelectionRaw;
  const maxSelection = Math.max(
    minSelection,
    Math.max(1, Math.floor(toNumber(row.max_selection, 1))),
  );

  return {
    id: toSafeString(row.id),
    name: toSafeString(row.name) || 'Seçenek Grubu',
    description: toSafeString(row.description),
    minSelection,
    maxSelection,
    isRequired: Boolean(row.is_required),
    sortOrder,
    items,
  };
};

export const fetchProductOptionGroups = async (
  supabase: SupabaseClient,
  productId: string,
): Promise<OptionGroup[]> => {
  const safeProductId = toSafeString(productId);
  if (!safeProductId) return [];

  let relationRows: Record<string, unknown>[] | null = null;
  let lastError: unknown = null;

  for (const tableName of PRODUCT_OPTION_GROUP_TABLE_CANDIDATES) {
    const response = await supabase
      .from(tableName)
      .select('id,product_id,group_id,sort_order')
      .eq('product_id', safeProductId)
      .order('sort_order', { ascending: true });

    if (!response.error) {
      relationRows = (response.data as Record<string, unknown>[] | null) || [];
      lastError = null;
      break;
    }

    lastError = response.error;
    if (!isRelationMissingError(response.error)) {
      break;
    }
  }

  if (!relationRows && lastError) {
    throw lastError;
  }

  const normalizedLinks = (relationRows || [])
    .map((row) => ({
      groupId: toSafeString(row.group_id),
      sortOrder: Math.max(0, Math.floor(toNumber(row.sort_order, 0))),
    }))
    .filter((row) => row.groupId)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (normalizedLinks.length === 0) {
    return [];
  }

  const groupIds = Array.from(new Set(normalizedLinks.map((row) => row.groupId)));

  const [{ data: groupRows, error: groupError }, { data: itemRows, error: itemError }] =
    await Promise.all([
      supabase
        .from('option_groups')
        .select('id,name,description,min_selection,max_selection,is_required')
        .in('id', groupIds),
      supabase
        .from('option_items')
        .select('id,group_id,name,price_adjustment,is_available,sort_order')
        .in('group_id', groupIds)
        .order('sort_order', { ascending: true }),
    ]);

  if (groupError) throw groupError;
  if (itemError) throw itemError;

  const groupsById = new Map(
    (Array.isArray(groupRows) ? groupRows : []).map((row) => [
      toSafeString((row as Record<string, unknown>).id),
      row as Record<string, unknown>,
    ]),
  );

  const itemsByGroup = (Array.isArray(itemRows) ? itemRows : []).reduce<
    Record<string, OptionItem[]>
  >((acc, row) => {
    const item = mapOptionItemRow(row as Record<string, unknown>);
    if (!item.groupId || !item.id) return acc;
    const current = acc[item.groupId] || [];
    current.push(item);
    acc[item.groupId] = current;
    return acc;
  }, {});

  return normalizedLinks
    .map((link) => {
      const rawGroup = groupsById.get(link.groupId);
      if (!rawGroup) return null;
      const items = (itemsByGroup[link.groupId] || [])
        .filter((item) => item.isAvailable)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      return mapOptionGroupRow(rawGroup, link.sortOrder, items);
    })
    .filter((group): group is OptionGroup => Boolean(group));
};

export const getGroupSelectionLimits = (group: OptionGroup) => {
  const min = Math.max(0, Math.floor(toNumber(group.minSelection, 0)));
  const max = Math.max(min, Math.floor(toNumber(group.maxSelection, 1)));
  return { min, max };
};
