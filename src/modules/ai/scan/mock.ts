// AI tarama mock istemcisi — bellek içi günlük kota sayacı. Deterministik.
// failAnalysis=true ile başarısız analiz (hak iadesi) senaryosu test edilir.
import type { AiScanClient, ReserveResult, ScanEstimate } from './types';

export interface MockAiScanOptions {
  cap?: number; // günlük tavan (varsayılan 3)
  failAnalysis?: boolean; // analyzeImage her zaman patlasın
  resetAt?: string;
}

export function createMockAiScanClient(options: MockAiScanOptions = {}): AiScanClient & {
  _remaining: () => number;
  _reservedKeys: Set<string>;
} {
  const cap = options.cap ?? 3;
  const resetAt = options.resetAt ?? '2026-11-04T00:00:00.000+03:00';
  let used = 0;
  const reservedKeys = new Set<string>();

  return {
    _remaining: () => cap - used,
    _reservedKeys: reservedKeys,

    async reserveScan({ idempotencyKey }): Promise<ReserveResult> {
      // Aynı anahtar tekrar gelirse yeni hak düşürmez (atomik/idempotent).
      if (reservedKeys.has(idempotencyKey)) {
        return { ok: true, remaining: cap - used, reset_at: resetAt };
      }
      if (used >= cap) {
        return { ok: false, remaining: 0, reset_at: resetAt };
      }
      used += 1;
      reservedKeys.add(idempotencyKey);
      return { ok: true, remaining: cap - used, reset_at: resetAt };
    },

    async releaseScan({ idempotencyKey }): Promise<void> {
      if (reservedKeys.has(idempotencyKey)) {
        reservedKeys.delete(idempotencyKey);
        used = Math.max(0, used - 1);
      }
    },

    async analyzeImage(): Promise<Omit<ScanEstimate, 'isEstimate'>> {
      if (options.failAnalysis) throw new Error('mock: analiz başarısız');
      return {
        name: 'Tabak (tahmini)',
        kcal: 640,
        protein_g: 35,
        carbs_g: 60,
        fat_g: 22,
        portion: 1,
        ingredients: [
          { name: 'Tavuk', grams: 120 },
          { name: 'Pirinç', grams: 150 },
        ],
        photo_url: null,
      };
    },
  };
}

export const mockAiScanClient = createMockAiScanClient();
