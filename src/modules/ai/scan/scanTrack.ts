// G19-S3 — Tara olaylarını track()'e verir (eşleme saf: scanMetrics.ts).
import { track } from '../../../lib/analytics';
import { scanOutcomeEvent, type ScanVia } from './scanMetrics';
import type { AiScanOutcome } from './types';

export function trackScanOutcome(outcome: AiScanOutcome, via: ScanVia): void {
  const ev = scanOutcomeEvent(outcome, via);
  if (ev.name === 'scan_success') track('scan_success', ev.props);
  else if (ev.name === 'scan_limit') track('scan_limit', ev.props);
  else track('scan_fail', ev.props);
}

export function trackScanLog(estimate: { kcal: number; ingredients?: unknown[] }, edited: boolean): void {
  const n = Array.isArray(estimate.ingredients) ? Math.max(1, estimate.ingredients.length) : 1;
  const kcal = Math.round(estimate.kcal || 0);
  track('scan_log', { n_items: n, kcal, edited });
  track('log_add', { source: 'scan', kcal });
}
