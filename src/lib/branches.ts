import { getSupabaseClient } from './supabase';

export interface Branch {
  id: string;
  name: string;
  address: string;
}

export async function fetchBranches(): Promise<Branch[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('branches')
    .select('id, name, address');

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
  }));
}
