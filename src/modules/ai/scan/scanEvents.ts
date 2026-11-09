// G19-S1 md.6 — Tara ölçüm olayları. Adlar D-S1 olay sözlüğüyle (night19/data,
// `analytics_event_names`) AYNI: sözlükte karşılığı olan olay sözlükteki adı kullanır.
//
//   görev adı       → gönderilen ad     props
//   scan_open       → scan_open         { camera: 'live' | 'fallback' }            (sözlüğe EKLENİR)
//   scan_capture    → scan_start        { source, has_note, retry, offline }      (sözlükte var)
//   scan_success    → scan_success      { n_items, kcal, cached }                  (sözlükte var, KPI)
//   scan_fail       → scan_failed       { reason, stage }                          (sözlükte var)
//   scan_log        → log_meal          { source: 'scan', n_items, kcal, edited, meal_type } (sözlükte var, KPI)
//   scan_limit      → scan_limit        { }                                        (sözlüğe EKLENİR)
//
// KİŞİSEL VERİ YOK: foto yolu, not metni, yemek adı, kullanıcı kimliği gönderilmez.
// Gönderim G19-S3'ün tek `track` API'sine (src/lib/analytics) tembel require ile
// gider — bu dosya native import yapmaz (Node testleri sink'i değiştirir).

export type ScanEventName = 'scan_open' | 'scan_start' | 'scan_success' | 'scan_failed' | 'log_meal' | 'scan_limit';

export const SCAN_EVENT_NAMES: readonly ScanEventName[] = [
  'scan_open',
  'scan_start',
  'scan_success',
  'scan_failed',
  'log_meal',
  'scan_limit',
];

type Props = Record<string, string | number | boolean | null>;
type Sink = (name: ScanEventName, props: Props) => void;

const defaultSink: Sink = (name, props) => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('../../../lib/analytics') as typeof import('../../../lib/analytics')).track(name, props);
  } catch {
    // ölçüm akışı asla bozmaz
  }
};

let sink: Sink = defaultSink;

/** Test/vitrin: olayları yakala. `null` → varsayılan (analytics_events). */
export function setScanEventSink(next: Sink | null): void {
  sink = next ?? defaultSink;
}

/** Yalnız bilinen, kişisel olmayan alanlar geçer (beyaz liste). */
const ALLOWED: Record<ScanEventName, readonly string[]> = {
  scan_open: ['camera'],
  scan_start: ['source', 'has_note', 'retry', 'offline'],
  scan_success: ['n_items', 'kcal', 'cached'],
  scan_failed: ['reason', 'stage'],
  log_meal: ['source', 'n_items', 'kcal', 'edited', 'meal_type'],
  scan_limit: [],
};

export function scanEventProps(name: ScanEventName, props: Record<string, unknown>): Props {
  const out: Props = {};
  for (const key of ALLOWED[name]) {
    const v = props[key];
    if (typeof v === 'string') out[key] = v.slice(0, 40);
    else if (typeof v === 'number' && Number.isFinite(v)) out[key] = Math.round(v);
    else if (typeof v === 'boolean' || v === null) out[key] = v;
  }
  return out;
}

export function trackScan(name: ScanEventName, props: Record<string, unknown> = {}): void {
  try {
    sink(name, scanEventProps(name, props));
  } catch {
    // ölçüm akışı asla bozmaz
  }
}
