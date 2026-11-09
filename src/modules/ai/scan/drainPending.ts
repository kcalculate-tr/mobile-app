// G16-S1 — Bekleyen fotoğrafları boşaltma: Tara ekranı ve Ana sayfa AYNI
// kilidi paylaşır (modül düzeyinde tek uçuş) → aynı fotoğraf iki kez
// analiz edilip kaydedilmez.
import { getAiScanClient } from './client';
import { saveAiScanEstimate } from './saveEstimate';
import { processPendingQueue, type ProcessResult } from './pendingProcessor';
import { getSupabaseClient } from '../../../core/supabase';
import { trackScanLog, trackScanOutcome } from './scanTrack';

type Listener = (r: ProcessResult) => void;
const listeners = new Set<Listener>();
/** Boşaltma bitince (en az bir fotoğraf işlendiyse ya da kota bilgisi geldiyse) haber verir. */
export function onPendingDrained(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

let inflight: Promise<ProcessResult | null> | null = null;

export function drainPendingScans(userId: string, isCancelled?: () => boolean): Promise<ProcessResult | null> {
  if (inflight) return Promise.resolve(null); // başka çağrı zaten işliyor
  inflight = processPendingQueue({
    client: getAiScanClient(),
    isCancelled,
    save: (entry, estimate) =>
      saveAiScanEstimate(getSupabaseClient(), {
        userId,
        mealType: entry.mealType,
        sourceRef: entry.id,
        estimate,
      }),
  })
    .catch(() => null)
    .then((r) => {
      // G19-S3: kuyruktan analiz edilen her fotoğraf scan_success + scan_log; durma sebebi limit/başarısızlık.
      if (r) {
        for (const p of r.processed) {
          trackScanOutcome({ status: 'ok', estimate: p.estimate, remaining: 0, reset_at: '' }, 'queue');
          trackScanLog(p.estimate, false);
        }
        if (r.lastOutcome && r.lastOutcome.status !== 'ok') trackScanOutcome(r.lastOutcome, 'queue');
      }
      if (r && (r.processed.length > 0 || r.lastOutcome)) listeners.forEach((l) => l(r));
      return r;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
