import { getSupabaseClient } from './supabase';

export interface Branch {
  id: string;
  name: string;
  address: string;
  /**
   * Yaklaşık koordinat — SADECE "kullanıcıya en yakın şube" sıralaması için.
   * Haritadaki pin bu değerden değil, `address` metninin Google tarafından
   * geocode edilmesinden gelir; böylece pin her zaman gerçek kapı numarasında
   * durur, koordinat kaba olsa bile.
   */
  latitude: number | null;
  longitude: number | null;
}

const toCoord = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export async function fetchBranches(): Promise<Branch[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('branches')
    .select('id, name, address, latitude, longitude');

  if (error) {
    if (__DEV__) {
      console.error('[branches] fetchBranches error:', JSON.stringify(error));
    }
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: String(row.id ?? ''),
    name: String(row.name ?? ''),
    address: String(row.address ?? ''),
    latitude: toCoord(row.latitude),
    longitude: toCoord(row.longitude),
  }));
}
