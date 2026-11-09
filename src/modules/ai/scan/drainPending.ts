// G16-S1 — Bekleyen fotoğrafları boşaltma: Tara ekranı ve Ana sayfa AYNI
// kilidi paylaşır (modül düzeyinde tek uçuş) → aynı fotoğraf iki kez
// analiz edilip kaydedilmez.
import { getAiScanClient } from './client';
import { saveAiScanEstimate } from './saveEstimate';
import { processPendingQueue, type ProcessResult } from './pendingProcessor';
import { getSupabaseClient } from '../../../core/supabase';
import { deleteQueuedImage } from './localImage';
import { trackScan } from './scanEvents';

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

export function drainPendingScans(
  userId: string,
  isCancelled?: () => boolean,
  lang?: 'tr' | 'en',
): Promise<ProcessResult | null> {
  if (inflight) return Promise.resolve(null); // başka çağrı zaten işliyor
  inflight = processPendingQueue({
    client: getAiScanClient(),
    isCancelled,
    lang,
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
      if (r) {
        // G19-S1 md.4/6: işlenen ve düşen kuyruk fotoğrafları silinir; ölçüm olayları.
        for (const p of r.processed) {
          void deleteQueuedImage(p.entry.imageUri);
          trackScan('scan_success', { n_items: p.estimate.ingredients.length, kcal: p.estimate.kcal });
          trackScan('log_meal', { source: 'scan', n_items: p.estimate.ingredients.length, kcal: p.estimate.kcal, edited: false, meal_type: p.entry.mealType });
        }
        for (const d of r.dropped ?? []) {
          void deleteQueuedImage(d.imageUri);
          trackScan('scan_failed', { reason: 'queue_dropped', stage: 'queue' });
        }
        if (r.lastOutcome?.status === 'quota_exhausted') trackScan('scan_limit');
        else if (r.lastOutcome?.status === 'failed') {
          trackScan('scan_failed', { reason: r.lastOutcome.failure?.code ?? 'unknown', stage: r.lastOutcome.failure?.stage ?? 'analyze' });
        }
      }
      if (r && (r.processed.length > 0 || r.lastOutcome || (r.dropped?.length ?? 0) > 0)) listeners.forEach((l) => l(r));
      return r;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
