// G19-S3 — Tara ölçüm olayları. `scanOutcomeEvent` saf (birim testli);
// `trackScanOutcome` onu track()'e verir. Ad listesi G19-S1 md.6 ile aynı:
// scan_open, scan_capture, scan_success{n_items}, scan_fail{code}, scan_log, scan_limit.
import type { AiScanOutcome } from './types';

export type ScanVia = 'camera' | 'gallery' | 'queue' | 'legacy';

export type ScanOutcomeEvent =
  | { name: 'scan_success'; props: { n_items: number; kcal: number; via: ScanVia } }
  | { name: 'scan_fail'; props: { code: string; stage: string; via: ScanVia } }
  | { name: 'scan_limit'; props: { via: ScanVia } };

export function scanOutcomeEvent(outcome: AiScanOutcome, via: ScanVia): ScanOutcomeEvent {
  if (outcome.status === 'ok') {
    const n = Array.isArray(outcome.estimate.ingredients) ? outcome.estimate.ingredients.length : 0;
    return {
      name: 'scan_success',
      props: { n_items: Math.max(1, n), kcal: Math.round(outcome.estimate.kcal || 0), via },
    };
  }
  if (outcome.status === 'quota_exhausted') return { name: 'scan_limit', props: { via } };
  // G19-S4: acil kapatma / genel tavan — başarı oranından hariç tutulur (TARA_ACILIS §3).
  if (outcome.status === 'unavailable') return { name: 'scan_fail', props: { code: outcome.reason, stage: 'reserve', via } };
  return {
    name: 'scan_fail',
    props: { code: outcome.failure?.code ?? 'unknown', stage: outcome.failure?.stage ?? 'analyze', via },
  };
}
