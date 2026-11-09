// G16-S1 — Bağlantı gelince bekleyen fotoğrafları SIRAYLA analiz et.
// Saf orkestrasyon (istemci/kayıt enjekte edilir). Günlük ücretsiz hak
// yalnız analiz başarılı olunca düşer: `runAiScan` başarısızlıkta rezervasyonu
// iade eder; başarısız/kota biten girdi kuyrukta kalır ve döngü durur.
import { runAiScan } from './runScan';
import { bumpPendingAttempt, getPendingScanQueue, removePendingScanPhoto, type PendingScanPhoto } from './offlineQueue';
import { classifyScanFailure } from './scanError';

/** G19-S1 md.4: sayılan hata bu kadar tekrarlanırsa girdi düşer (kuyruk kilitlenmez). */
export const PENDING_MAX_ATTEMPTS = 3;
import type { AiScanClient, AiScanOutcome, ScanEstimate } from './types';

export interface ProcessedScan {
  entry: PendingScanPhoto;
  estimate: ScanEstimate;
}

export interface ProcessResult {
  processed: ProcessedScan[];
  /** G19-S1 md.4: kalıcı hata ya da deneme sınırı yüzünden kuyruktan düşen girdiler. */
  dropped?: PendingScanPhoto[];
  /** Durma sebebi: boş / başarısız / kota / iptal */
  stoppedBy: 'empty' | 'failed' | 'quota_exhausted' | 'cancelled';
  lastOutcome?: AiScanOutcome;
}

export async function processPendingQueue(opts: {
  client: AiScanClient;
  save: (entry: PendingScanPhoto, estimate: ScanEstimate) => Promise<unknown>;
  isCancelled?: () => boolean;
  now?: number;
  /** G19-S1 md.3: cihaz dili → yiyecek adları. */
  lang?: 'tr' | 'en';
}): Promise<ProcessResult> {
  const queue = await getPendingScanQueue(opts.now);
  const processed: ProcessedScan[] = [];
  const dropped: PendingScanPhoto[] = [];
  for (const entry of queue) {
    if (opts.isCancelled?.()) return { processed, dropped, stoppedBy: 'cancelled' };
    let outcome: AiScanOutcome;
    try {
      outcome = await runAiScan(opts.client, {
        idempotencyKey: entry.id,
        imageRef: entry.imageUri,
        ...(entry.hint ? { hint: entry.hint } : {}),
        ...((entry.lang ?? opts.lang) ? { lang: entry.lang ?? opts.lang } : {}),
      });
    } catch {
      // rezervasyon (RPC) hatası — ağ/sunucu; girdi kalır, sonra yeniden denenir
      return { processed, dropped, stoppedBy: 'failed' };
    }
    if (outcome.status === 'quota_exhausted') {
      return { processed, dropped, stoppedBy: 'quota_exhausted', lastOutcome: outcome };
    }
    if (outcome.status === 'failed') {
      const cls = classifyScanFailure(outcome.failure?.code);
      if (cls === 'transient') return { processed, dropped, stoppedBy: 'failed', lastOutcome: outcome };
      const attempts = cls === 'permanent' ? PENDING_MAX_ATTEMPTS : await bumpPendingAttempt(entry.id);
      if (attempts >= PENDING_MAX_ATTEMPTS) {
        // Kalıcı hata: girdi düşer, kuyruk SIRADAKİYLE sürer (tek bozuk foto hepsini kilitlemez).
        await removePendingScanPhoto(entry.id);
        dropped.push(entry);
        continue;
      }
      return { processed, dropped, stoppedBy: 'failed', lastOutcome: outcome };
    }
    try {
      await opts.save(entry, outcome.estimate);
    } catch {
      return { processed, dropped, stoppedBy: 'failed', lastOutcome: outcome };
    }
    await removePendingScanPhoto(entry.id);
    processed.push({ entry, estimate: outcome.estimate });
  }
  return { processed, dropped, stoppedBy: 'empty' };
}
