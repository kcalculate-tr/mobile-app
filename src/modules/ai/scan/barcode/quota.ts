// G22-S1 md.5 — barkod günlük hakkı: `reserve_barcode_scan(p_code)` (ücretsiz 5/gün, Fresh/Balance
// sınırsız; aynı gün aynı barkod ikinci kez sayılmaz). Ürün BULUNDUKTAN sonra çağrılır (bulunamayan
// barkod hak yemez). RPC yoksa (migration öncesi) ya da ağ hatasında İZİN VERİLİR (fail-open:
// barkod sorgusu ücretsiz ve istemci tarafı; yanlış "hakkın bitti" göstermekten güvenli).
import { barcodeAllowed, quotaFromReserve, type QuotaSnapshot } from '../../../../lib/subscription/limits';

type SupabaseModule = typeof import('../../../../core/supabase');

export interface BarcodeQuotaResult {
  allowed: boolean;
  snapshot: QuotaSnapshot | null;
}

export type BarcodeRpc = (code: string) => Promise<{ data: unknown; error: unknown }>;

const defaultRpc: BarcodeRpc = async (code) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sb = (require('../../../../core/supabase') as SupabaseModule).getSupabaseClient();
  const { data, error } = await sb.rpc('reserve_barcode_scan', { p_code: code });
  return { data, error };
};

export async function reserveBarcode(code: string, rpc: BarcodeRpc = defaultRpc): Promise<BarcodeQuotaResult> {
  try {
    const { data, error } = await rpc(code);
    if (error) return { allowed: true, snapshot: null };
    const res = (data ?? null) as { ok?: unknown } | null;
    return { allowed: barcodeAllowed(res, false), snapshot: res ? quotaFromReserve('barcode', res) : null };
  } catch {
    return { allowed: true, snapshot: null };
  }
}
