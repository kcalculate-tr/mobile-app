import { getSupabaseClient } from './supabase';
import { pickTypeDefaults } from './deliveryRules';
import type { DeliveryGlobals, DeliveryZoneRow } from './deliveryRules';

// ─── Types ───────────────────────────────────────────────────────────────────

export * from './deliveryRules';

// ─── Paginated zone fetcher ─────────────────────────────────────────────────

// PostgREST caps a single SELECT at 1000 rows. delivery_zones exceeds that once
// İzmir mahalleleri are imported (~1300+ rows), so a single .select() silently
// drops late-alphabetical districts (Urla, Torbalı, Tire, Seferihisar, Selçuk).
// Paginate with .range() until a batch returns fewer than pageSize rows.
//
// applyFilters lets callers tack on .or(), .eq(), etc. before the range clause —
// the DeliveryZonesSheet uses it to keep its allow_immediate/scheduled filter.

export interface FetchAllDeliveryZonesOptions {
  select?: string;
   
  applyFilters?: (query: any) => any;
}

export async function fetchAllDeliveryZones<T = DeliveryZoneRow>(
  options: FetchAllDeliveryZonesOptions = {},
): Promise<T[]> {
  const { select = '*', applyFilters } = options;
  const pageSize = 1000;
  const maxPages = 20;
  const all: T[] = [];
  let from = 0;

  const supabase = getSupabaseClient();
  for (let page = 0; page < maxPages; page += 1) {
     
    let q: any = supabase.from('delivery_zones').select(select);
    if (applyFilters) q = applyFilters(q);
    q = q.order('district').range(from, from + pageSize - 1);

    const { data, error } = (await q) as { data: T[] | null; error: Error | null };
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

// ─── Globals fetcher ─────────────────────────────────────────────────────────

/**
 * Reads the global delivery defaults from `delivery_settings` sentinel row
 * `district = '__GLOBAL__'`. Returns `null` if not configured.
 *
 * Expected shape of `cargo_rules`:
 * ```
 * {
 *   immediate: { min_order, shipping_fee, free_shipping_above },
 *   scheduled: { min_order, shipping_fee, free_shipping_above },
 * }
 * ```
 */
export async function fetchGlobalDeliverySettings(): Promise<DeliveryGlobals | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('delivery_settings')
      .select('cargo_rules')
      .eq('district', '__GLOBAL__')
      .maybeSingle();

    if (error) {
      if (__DEV__) {
        console.warn('[delivery] fetchGlobalDeliverySettings error:', error.message);
      }
      return null;
    }
    if (!data?.cargo_rules) return null;

    const rules = data.cargo_rules as Record<string, unknown>;
    return {
      immediate: pickTypeDefaults(rules.immediate),
      scheduled: pickTypeDefaults(rules.scheduled),
    };
  } catch (e) {
    if (__DEV__) {
      console.warn('[delivery] fetchGlobalDeliverySettings threw:', e);
    }
    return null;
  }
}
