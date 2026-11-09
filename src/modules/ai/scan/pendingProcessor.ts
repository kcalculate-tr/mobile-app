// G16-S1 — Bağlantı gelince bekleyen fotoğrafları SIRAYLA analiz et.
// Saf orkestrasyon (istemci/kayıt enjekte edilir). Günlük ücretsiz hak
// yalnız analiz başarılı olunca düşer: `runAiScan` başarısızlıkta rezervasyonu
// iade eder; başarısız/kota biten girdi kuyrukta kalır ve döngü durur.
import { runAiScan } from './runScan';
import { getPendingScanQueue, removePendingScanPhoto, type PendingScanPhoto } from './offlineQueue';
import type { AiScanClient, AiScanOutcome, ScanEstimate } from './types';

export interface ProcessedScan {
  entry: PendingScanPhoto;
  estimate: ScanEstimate;
}

export interface ProcessResult {
  processed: ProcessedScan[];
  /** Durma sebebi: boş / başarısız / kota / iptal */
  stoppedBy: 'empty' | 'failed' | 'quota_exhausted' | 'cancelled';
  lastOutcome?: AiScanOutcome;
}

export async function processPendingQueue(opts: {
  client: AiScanClient;
  save: (entry: PendingScanPhoto, estimate: ScanEstimate) => Promise<unknown>;
  isCancelled?: () => boolean;
  now?: number;
}): Promise<ProcessResult> {
  const queue = await getPendingScanQueue(opts.now);
  const processed: ProcessedScan[] = [];
  for (const entry of queue) {
    if (opts.isCancelled?.()) return { processed, stoppedBy: 'cancelled' };
    let outcome: AiScanOutcome;
    try {
      outcome = await runAiScan(opts.client, {
        idempotencyKey: entry.id,
        imageRef: entry.imageUri,
        ...(entry.hint ? { hint: entry.hint } : {}),
      });
    } catch {
      return { processed, stoppedBy: 'failed' };
    }
    if (outcome.status !== 'ok') {
      return { processed, stoppedBy: outcome.status === 'failed' ? 'failed' : 'quota_exhausted', lastOutcome: outcome };
    }
    try {
      await opts.save(entry, outcome.estimate);
    } catch {
      return { processed, stoppedBy: 'failed', lastOutcome: outcome };
    }
    await removePendingScanPhoto(entry.id);
    processed.push({ entry, estimate: outcome.estimate });
  }
  return { processed, stoppedBy: 'empty' };
}
