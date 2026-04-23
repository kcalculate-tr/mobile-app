import { supabase } from './supabase';

export type BannerCell = {
  id: string;
  row_id: string;
  position: number;
  image_url: string | null;
  title: string | null;
  link: string | null;
  navigate_to: string | null;
  is_active: boolean;
};

export type BannerRow = {
  id: string;
  type: 'hero' | 'promo';
  grid_size: number;
  order: number;
  is_active: boolean;
  cells: BannerCell[];
};

export async function fetchBannerRows(): Promise<{
  hero: BannerRow[];
  promo: BannerRow[];
}> {
  const [rowsRes, cellsRes] = await Promise.all([
    supabase
      .from('banner_rows')
      .select('*')
      .eq('is_active', true)
      .order('type')
      .order('order'),
    supabase
      .from('banner_cells')
      .select('*')
      .eq('is_active', true)
      .order('position'),
  ]);

  if (rowsRes.error) throw rowsRes.error;
  if (cellsRes.error) throw cellsRes.error;

  const rows = (rowsRes.data ?? []) as Omit<BannerRow, 'cells'>[];
  const cells = (cellsRes.data ?? []) as BannerCell[];

  const cellsByRow = new Map<string, BannerCell[]>();
  for (const c of cells) {
    const arr = cellsByRow.get(c.row_id) ?? [];
    arr.push(c);
    cellsByRow.set(c.row_id, arr);
  }

  const enriched: BannerRow[] = rows.map((row) => ({
    ...row,
    cells: (cellsByRow.get(row.id) ?? [])
      .filter((c) => c.position < row.grid_size && !!c.image_url)
      .sort((a, b) => a.position - b.position),
  }));

  const hero = enriched.filter((r) => r.type === 'hero' && r.cells.length > 0);
  const promo = enriched.filter((r) => r.type === 'promo' && r.cells.length > 0);

  return { hero, promo };
}
