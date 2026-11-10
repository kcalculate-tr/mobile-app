// G22-S1 md.6 — Restoran puanı (son 3 ay). Kaynak: `restaurant_rating(p_branch_id)` RPC
// (migration 20261110100200): son 90 günün ortalaması (1–5), sayı, <10 → is_new, alt boyutlar
// (canlı şemada kolon yok → null). Yarım yıldız yuvarlama İSTEMCİDE (roundHalfStar).
// RPC yoksa (migration öncesi) null → arayüz puan satırını hiç çizmez (uydurma yok).

export interface RestaurantRating {
  average: number | null;
  count: number;
  isNew: boolean;
  taste: number | null;
  delivery: number | null;
  calorieFit: number | null;
}

/** 0,5 adımına yuvarla (4,24 → 4; 4,25 → 4,5; 4,74 → 4,5; 4,75 → 5), 0–5 aralığında. */
export function roundHalfStar(v: number | null | undefined): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(5, Math.round(v * 2) / 2));
}

/** Gösterim: "4,5" (TR) / "4.5" (EN); tam sayılarda ",0" yok. */
export function formatRating(v: number, lang: string): string {
  const r = roundHalfStar(v);
  const s = Number.isInteger(r) ? String(r) : r.toFixed(1);
  return lang === 'en' ? s : s.replace('.', ',');
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** RPC satırı → model. Satır yoksa null. SAF. */
export function mapRatingRow(data: unknown): RestaurantRating | null {
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null | undefined;
  if (!row || typeof row !== 'object') return null;
  const count = Math.max(0, Math.floor(num(row.review_count) ?? 0));
  return {
    average: count > 0 ? num(row.average) : null,
    count,
    isNew: row.is_new === true || count < 10,
    taste: num(row.taste),
    delivery: num(row.delivery),
    calorieFit: num(row.calorie_fit),
  };
}

type Rpc = (branchId: string | null) => Promise<{ data: unknown; error: unknown }>;

const defaultRpc: Rpc = async (branchId) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getSupabaseClient } = require('../core/supabase') as typeof import('../core/supabase');
  const { data, error } = await getSupabaseClient().rpc('restaurant_rating', { p_branch_id: branchId });
  return { data, error };
};

const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; value: RestaurantRating | null }>();

/** Şube puanı (null şube = tüm şubeler). 10 dk önbellek; hata/RPC yok → null. */
export async function fetchRestaurantRating(branchId: string | null = null, rpc: Rpc = defaultRpc, now: number = Date.now()): Promise<RestaurantRating | null> {
  const key = branchId ?? '*';
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.value;
  try {
    const { data, error } = await rpc(branchId);
    const value = error ? null : mapRatingRow(data);
    cache.set(key, { at: now, value });
    return value;
  } catch {
    return null;
  }
}

export function clearRestaurantRatingCache(): void {
  cache.clear();
}
