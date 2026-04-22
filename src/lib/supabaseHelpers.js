import { supabase } from '../supabase';

// PostgREST hard-caps single-request results at 1000 rows. Any full-table read
// on growing tables (delivery_zones has ~1300+ rows once İzmir mahalleleri are
// imported) silently loses the tail. These helpers paginate with .range() until
// a batch returns fewer than pageSize rows.
//
// Always pass at least one stable `orderBy` column — without ORDER BY, postgres
// may return different rows on different pages.

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

/**
 * Paginated full-table SELECT.
 *
 * @param {string} table
 * @param {{
 *   select?: string,
 *   orderBy?: Array<string | { column: string, ascending?: boolean }>,
 * }} options
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function fetchAllRows(table, options = {}) {
  const select = options.select || '*';
  const rawOrder = Array.isArray(options.orderBy) && options.orderBy.length > 0
    ? options.orderBy
    : ['id'];
  const orderBy = rawOrder.map((o) => (
    typeof o === 'string'
      ? { column: o, ascending: true }
      : { column: o.column, ascending: o.ascending !== false }
  ));

  const all = [];
  let from = 0;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    let q = supabase.from(table).select(select);
    for (const o of orderBy) {
      q = q.order(o.column, { ascending: o.ascending });
    }
    q = q.range(from, from + PAGE_SIZE - 1);
    const { data, error } = await q;
    if (error) throw error;
    const rows = Array.isArray(data) ? data : [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

/**
 * Convenience wrapper around fetchAllRows for delivery_zones, defaulting to the
 * (district, neighborhood) ordering that every admin caller expects.
 */
export function fetchAllDeliveryZones(options = {}) {
  return fetchAllRows('delivery_zones', {
    select: options.select || '*',
    orderBy: options.orderBy || ['district', 'neighborhood'],
  });
}
