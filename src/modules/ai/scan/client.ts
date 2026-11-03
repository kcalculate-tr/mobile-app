// AI tarama gerçek istemcisi. reserve/release RPC; analiz edge fonksiyonu.
// Kota SUNUCUDA denetlenir. `core/supabase` tembel require (Node testleri için).
//
// G6: analiz adımı `analyze-ai-scan` edge fonksiyonudur (G6-CONTRACT.md); gövde
// { reservation_id, image_path }. reservation_id = rezervasyonun idempotency
// anahtarı; image_path = user-media kovasındaki kendi yolu. Yanıt (items+total)
// istemcinin düz ScanEstimate biçimine maplenir.
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
    // Edge fonksiyonu adı ve gövdesi G6-CONTRACT.md ile birebir:
    // reservation_id = rezervasyon anahtarı (idempotencyKey), image_path = user-media yolu.
    const { data, error } = await sb().functions.invoke('analyze-ai-scan', {
      body: { reservation_id: idempotencyKey, image_path: imageRef },
    });
    if (error) throw new Error(`analyze-ai-scan: ${error.message}`);
    const res = data as {
      items?: { name: string; grams: number; kcal: number; protein_g: number; carb_g: number; fat_g: number }[];
      total?: { kcal: number; protein_g: number; carb_g: number; fat_g: number };
      lang?: string;
    };
    const items = res.items ?? [];
    const total = res.total ?? { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 };
    // items+total → düz ScanEstimate (carb_g → carbs_g). Ad = öğelerin birleşimi.
    return {
      name: items.length ? items.map((i) => i.name).join(', ') : (res.lang === 'en' ? 'Food' : 'Yemek'),
      kcal: total.kcal,
      protein_g: total.protein_g,
      carbs_g: total.carb_g,
      fat_g: total.fat_g,
      portion: 1,
      ingredients: items.map((i) => ({ name: i.name, grams: i.grams })),
      photo_url: null,
    };
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
