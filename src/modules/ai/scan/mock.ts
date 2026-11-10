// AI tarama mock istemcisi — bellek içi günlük kota sayacı. Deterministik.
// failAnalysis=true ile başarısız analiz (hak iadesi) senaryosu test edilir.
import type { AiScanClient, ReserveResult, ScanEstimate } from './types';
import { scanImagePath } from './scanPath';

export interface MockAiScanOptions {
  cap?: number; // günlük tavan (varsayılan 3)
  failAnalysis?: boolean; // analyzeImage her zaman patlasın
  // G17-S1: yükleme adımını taklit et (çağrı sırası `_calls`'a yazılır).
  withUpload?: boolean;
  failUpload?: boolean;
  userId?: string;
  resetAt?: string;
}

export function createMockAiScanClient(options: MockAiScanOptions = {}): AiScanClient & {
  _remaining: () => number;
  _reservedKeys: Set<string>;
  _calls: string[];
} {
  const cap = options.cap ?? 3;
  const resetAt = options.resetAt ?? '2026-11-04T00:00:00.000+03:00';
  let used = 0;
  const reservedKeys = new Set<string>();
  const calls: string[] = [];

  return {
    _remaining: () => cap - used,
    _reservedKeys: reservedKeys,
    _calls: calls,

    async reserveScan({ idempotencyKey }): Promise<ReserveResult> {
      calls.push(`reserve:${idempotencyKey}`);
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
      calls.push(`release:${idempotencyKey}`);
      if (reservedKeys.has(idempotencyKey)) {
        reservedKeys.delete(idempotencyKey);
        used = Math.max(0, used - 1);
      }
    },

    ...(options.withUpload || options.failUpload
      ? {
          async uploadImage({ idempotencyKey, localUri }: { idempotencyKey: string; localUri: string }) {
            calls.push(`upload:${localUri}`);
            if (options.failUpload) throw new Error('mock: yükleme başarısız');
            return scanImagePath(options.userId ?? 'mock-user', idempotencyKey);
          },
        }
      : {}),

    async analyzeText({ text, lang }): Promise<Omit<ScanEstimate, 'isEstimate'>> {
      calls.push(`analyzeText:${text}`);
      if (options.failAnalysis) throw new Error('mock: analiz başarısız');
      // G22-S1: virgülle ayrılan her parça bir öğe (vitrin/test için öngörülebilir).
      const parts = text.split(/,| ve | and /).map((x) => x.trim()).filter(Boolean);
      const items = (parts.length ? parts : [lang === 'en' ? 'Food' : 'Yemek']).map((name, i) => ({
        name,
        grams: 100,
        kcal: [143, 75, 112, 90][i % 4],
        protein_g: [13, 4, 1, 3][i % 4],
        carbs_g: [1, 13, 6, 10][i % 4],
        fat_g: [10, 1, 10, 4][i % 4],
      }));
      const sum = (k: 'kcal' | 'protein_g' | 'carbs_g' | 'fat_g') => items.reduce((a, x) => a + x[k], 0);
      return {
        name: items.map((x) => x.name).join(', '),
        kcal: sum('kcal'),
        protein_g: sum('protein_g'),
        carbs_g: sum('carbs_g'),
        fat_g: sum('fat_g'),
        portion: 1,
        ingredients: items,
        photo_url: null,
      };
    },

    async analyzeImage({ imageRef, lang }): Promise<Omit<ScanEstimate, 'isEstimate'>> {
      calls.push(`analyze:${imageRef}`);
      if (options.failAnalysis) throw new Error('mock: analiz başarısız');
      // G19-S1: gerçek edge yanıtı gibi öğe başına kcal/makro + `lang` ile ad dili.
      const en = lang === 'en';
      return {
        name: en ? 'Plate (estimate)' : 'Tabak (tahmini)',
        kcal: 640,
        protein_g: 35,
        carbs_g: 60,
        fat_g: 22,
        portion: 1,
        ingredients: [
          { name: en ? 'Chicken' : 'Tavuk', grams: 120, kcal: 260, protein_g: 30, carbs_g: 0, fat_g: 15 },
          { name: en ? 'Rice' : 'Pirinç', grams: 150, kcal: 380, protein_g: 5, carbs_g: 60, fat_g: 7 },
        ],
        photo_url: null,
      };
    },
  };
}

export const mockAiScanClient = createMockAiScanClient();
