// G19-S3 + G19-S4 — Tara sonuç/kayıt olayları (eşleme saf: scanMetrics.ts; gönderim
// scanEvents.trackScan + gun/track/events.trackEvent → ikisi de lib/analytics track()).
import { normalizeMealType } from '../../gun/homeData';
import { trackEvent } from '../../gun/track/events';
import { trackScan } from './scanEvents';
import { scanOutcomeEvent, type ScanVia } from './scanMetrics';
import type { AiScanOutcome } from './types';

/** Analiz sonucu → tam 1 olay (scan_success | scan_limit | scan_fail). */
export function trackScanOutcome(outcome: AiScanOutcome, via: ScanVia): void {
  const ev = scanOutcomeEvent(outcome, via);
  trackScan(ev.name, ev.props);
}

/**
 * Tara sonucu güne kaydedildi → scan_log + log_add{source:'scan'} (her kayıt tam bir kez).
 * logFlight köprüsü source='scan' uçuşlarını saymaz (çift sayım yok).
 */
export function trackScanLog(
  estimate: { kcal: number; ingredients?: unknown[] },
  edited: boolean,
  mealType?: string | null,
): void {
  const n = Array.isArray(estimate.ingredients) ? Math.max(1, estimate.ingredients.length) : 1;
  const kcal = Math.round(estimate.kcal || 0);
  trackScan('scan_log', { n_items: n, kcal, edited, ...(mealType ? { meal_type: mealType } : {}) });
  trackEvent({ name: 'log_add', props: { source: 'scan', slot: normalizeMealType(mealType ?? null), kcal, offline: false } });
}
