// AI tarama gerçek istemcisi. reserve/release RPC; analiz edge fonksiyonu.
// Kota SUNUCUDA denetlenir. `core/supabase` tembel require (Node testleri için).
//
// SORULAR: analiz adımının edge fonksiyonu adı sözleşmede yok; aşağıda
// 'analyze_ai_scan' varsayıldı — S2 kesin adı verince güncellenecek.
import type { AiScanClient, ReserveResult, ScanEstimate } from './types';

type SupabaseModule = typeof import('../../../core/supabase');
function sb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('../../../core/supabase') as SupabaseModule).getSupabaseClient();
}

function rpcError(name: string, error: { message: string }): never {
  throw new Error(`${name}: ${error.message}`);
}

export const realAiScanClient: AiScanClient = {
  async reserveScan({ idempotencyKey }): Promise<ReserveResult> {
    const { data, error } = await sb().rpc('reserve_ai_scan', {
      p_idempotency_key: idempotencyKey,
    });
    if (error) rpcError('reserve_ai_scan', error);
    return data as ReserveResult;
  },

  async releaseScan({ idempotencyKey }): Promise<void> {
    const { error } = await sb().rpc('release_ai_scan', {
      p_idempotency_key: idempotencyKey,
    });
    if (error) rpcError('release_ai_scan', error);
  },

  async analyzeImage({ idempotencyKey, imageRef }): Promise<Omit<ScanEstimate, 'isEstimate'>> {
    const { data, error } = await sb().functions.invoke('analyze_ai_scan', {
      body: { idempotency_key: idempotencyKey, image_ref: imageRef },
    });
    if (error) throw new Error(`analyze_ai_scan: ${error.message}`);
    return data as Omit<ScanEstimate, 'isEstimate'>;
  },
};

let activeClient: AiScanClient = realAiScanClient;

export function getAiScanClient(): AiScanClient {
  return activeClient;
}

export function setAiScanClient(client: AiScanClient): void {
  activeClient = client;
}

export function resetAiScanClient(): void {
  activeClient = realAiScanClient;
}
